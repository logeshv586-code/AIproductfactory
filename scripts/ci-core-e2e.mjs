import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const base = process.env.FACTORY_BASE_URL || 'http://127.0.0.1:3000'
const browser = await chromium.launch({ headless: true, executablePath: process.env.FACTORY_CHROME_BIN || undefined })
const context = await browser.newContext({ baseURL: base, acceptDownloads: true })
const page = await context.newPage()
const browserErrors = []
page.on('pageerror', error => browserErrors.push(error.message))
try {
  await page.goto('/studio')
  await page.getByRole('button', { name: /Offline test mode/ }).click()
  await page.getByRole('button', { name: 'Test AI & open Product Studio' }).click()
  await expect(page.getByLabel('Product idea')).toBeVisible({ timeout: 30000 })
  await page.getByLabel('Product idea').fill('Build a working calculator with a custom quotation workflow')
  await page.getByRole('button', { name: 'Research and create three plans' }).click()
  await expect(page.getByRole('heading', { name: '2. Choose your product' })).toBeVisible({ timeout: 30000 })
  // Choose B explicitly; approval and packaging must preserve this selection.
  await page.getByRole('button', { name: /PLAN-B/ }).click()
  const approvalResponse = page.waitForResponse(r => r.url().endsWith('/core/approve') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Approve this exact plan' }).click()
  const approval = await (await approvalResponse).json()
  assert.equal(approval.planId, 'PLAN-B')
  const forged = await context.request.post('/api/factory/core/builds', { data: { runId: approval.runId, approvalId: approval.approvalId, contractHash: '0'.repeat(64), idempotencyKey: 'forged' } })
  assert.equal(forged.status(), 409)
  const buildResponse = page.waitForResponse(r => r.url().endsWith('/core/builds') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Build approved product' }).click()
  const response = await buildResponse
  assert.equal(response.status(), 202)
  const created = await response.json()
  const duplicate = await context.request.post('/api/factory/core/builds', { data: response.request().postDataJSON() })
  assert.equal((await duplicate.json()).buildId, created.buildId)
  await expect(page.getByRole('link', { name: /Download unverified source ZIP/ })).toBeVisible({ timeout: 150000 })
  const status = await (await context.request.get(`/api/factory/core/builds/${created.buildId}`)).json()
  assert.equal(status.status, 'blocked')
  assert.equal(status.pipelineVerified, false)
  const contractFile = status.delivery.sourceFiles.find(f => f.path === 'PRODUCT_CONTRACT.json')
  assert.equal(JSON.parse(contractFile.content).plan_id, 'PLAN-B')
  assert.equal(status.contractHash, approval.contractHash)
  const downloadWait = page.waitForEvent('download')
  await page.getByRole('link', { name: /Download unverified source ZIP/ }).click()
  const download = await downloadWait
  const bytes = await readFile(await download.path())
  assert.equal(bytes.subarray(0, 2).toString(), 'PK')
  await page.reload()
  await expect(page.getByRole('link', { name: /Download unverified source ZIP/ })).toBeVisible({ timeout: 30000 })
  const outsider = await browser.newContext({ baseURL: base })
  assert.equal((await outsider.request.get(`/api/factory/core/builds/${created.buildId}/artifact`)).status(), 401)
  await outsider.close()
  assert.deepEqual(browserErrors, [])
  console.log('PASS: hydrated Studio → exact plan B → approval → idempotent build → honest unverified ZIP → reload and ownership')
} finally {
  await context.close()
  await browser.close()
}
