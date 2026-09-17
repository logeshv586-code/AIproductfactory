'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, CircleAlert, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import FactoryBuildDelivery, { type BuildDeliveryEnvelope } from './FactoryBuildDelivery'

type Platform = 'web' | 'desktop' | 'automation'
type Brief = { idea: string; audience: string; platform: Platform; priority: 'speed' | 'balanced' | 'scale'; privacy: 'cloud_allowed' | 'local_only'; constraints: string[]; target_os: Array<'linux' | 'windows' | 'macos'> }
type Contract = {
  run_id: string; plan_id: string; name: string; summary: string; rationale: string; generation_mode: string; brief: Brief;
  requirements: Array<{ id: string; title: string; description: string; priority: string; criteria_ids: string[] }>;
  excluded_scope: string[]; assumptions: string[]; research_limitations: string[];
  experience: { direction: string; pages: string[]; tokens: Record<string, string>; components: Array<{ name: string; purpose: string; states: string[]; interactions: string[]; origin: string }> };
  architecture: Record<string, unknown>; file_manifest: string[];
  tasks: Array<{ id: string; title: string; depends_on: string[]; files: string[] }>;
  acceptance: Array<{ id: string; description: string; kind: string }>;
  sources: Array<{ name: string; url: string; revision: string; license: string }>;
}
type Plan = { contract: Contract; contractHash: string }
type Plans = { runId: string; plans: Plan[]; recommendedPlanId: string; reasoning: string; mode: string; research: { evidence: Array<{ id: string; url: string; claim: string; limitation: string; status: string }>; limitations: string[] } }
type Approval = { runId: string; approvalId: string; contractHash: string; planId: string }
type Build = BuildDeliveryEnvelope & { buildId: string; status: string; tasks: Record<string, { success: boolean; summary: string }>; recoverable: boolean; elapsedSeconds: number }
const TERMINAL = new Set(['ready', 'blocked', 'failed', 'cancelled'])
const INITIAL: Brief = { idea: '', audience: '', platform: 'web', priority: 'balanced', privacy: 'cloud_allowed', constraints: [], target_os: ['linux'] }
const field = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const button = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40'

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/factory/core/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || data.success === false) throw new Error(data.error || 'Factory request failed')
  return data as T
}

export default function FactoryStudioCore() {
  const [brief, setBrief] = useState<Brief>(INITIAL)
  const [constraints, setConstraints] = useState('')
  const [plans, setPlans] = useState<Plans | null>(null)
  const [selected, setSelected] = useState('')
  const [approval, setApproval] = useState<Approval | null>(null)
  const [build, setBuild] = useState<Build | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Describe the outcome you want. We will research it and prepare three plans.')
  const chosen = plans?.plans.find(p => p.contract.plan_id === selected)
  const activeBuild = build && !TERMINAL.has(build.status)

  const refreshBuild = useCallback(async (id: string) => {
    const next = await api<Build>(`builds/${id}`)
    setBuild(next)
    return next
  }, [])

  useEffect(() => {
    const runId = window.localStorage.getItem('factory-core-run')
    const buildId = window.localStorage.getItem('factory-core-build')
    let stopped = false
    if (runId) api<Plans>(`runs/${runId}`).then(data => {
      if (!stopped) { setPlans(data); setSelected(data.recommendedPlanId); setBrief(data.plans[0].contract.brief); setConstraints(data.plans[0].contract.brief.constraints.join('\n')); setStatus('Saved plans restored. Review your selection before approving another build.') }
    }).catch(() => { window.localStorage.removeItem('factory-core-run') })
    if (buildId) refreshBuild(buildId).catch(() => { window.localStorage.removeItem('factory-core-build') })
    return () => { stopped = true }
  }, [refreshBuild])

  useEffect(() => {
    if (!build || TERMINAL.has(build.status) || build.recoverable) return
    const timer = window.setInterval(() => { refreshBuild(build.buildId).catch(e => setError(String(e.message))) }, 2000)
    return () => window.clearInterval(timer)
  }, [build, refreshBuild])

  function editBrief(update: Partial<Brief>) {
    setBrief(b => ({ ...b, ...update })); setApproval(null); setPlans(null); setSelected('')
    window.localStorage.removeItem('factory-core-run')
  }

  async function plan() {
    setBusy('research'); setError(''); setApproval(null); setBuild(null)
    window.localStorage.removeItem('factory-core-build')
    setStatus('Understanding your goal, checking sources and designing three concrete product plans…')
    try {
      const result = await api<Plans>('plans', { ...brief, constraints: constraints.split('\n').map(s => s.trim()).filter(Boolean) })
      setPlans(result); setSelected(result.recommendedPlanId)
      window.localStorage.setItem('factory-core-run', result.runId)
      setStatus(result.mode === 'fixture' ? 'Offline demonstration plans are ready. Configure a coding model for original product generation.' : 'Research complete. Compare the plans and review the actual behavior before approving.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Planning failed') }
    finally { setBusy('') }
  }

  async function approve() {
    if (!chosen || !plans) return
    setBusy('approval'); setError('')
    try {
      setApproval(await api<Approval>('approve', { runId: plans.runId, planId: chosen.contract.plan_id, contractHash: chosen.contractHash }))
      setStatus('This exact plan is approved. Its behavior, sources and acceptance criteria are locked for the build.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Approval failed') }
    finally { setBusy('') }
  }

  async function startBuild() {
    if (!approval) return
    setBusy('build'); setError('')
    try {
      const keyName = `factory-core-key-${approval.approvalId}`
      const key = window.localStorage.getItem(keyName) || crypto.randomUUID()
      window.localStorage.setItem(keyName, key)
      const result = await api<Build>('builds', { runId: approval.runId, approvalId: approval.approvalId, contractHash: approval.contractHash, idempotencyKey: key })
      setBuild(result); window.localStorage.setItem('factory-core-build', result.buildId)
      setStatus('Your approved product is queued. You can return to this browser to follow its progress.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Build could not start') }
    finally { setBusy('') }
  }

  async function control(action: 'resume' | 'cancel') {
    if (!build) return
    setBusy(action); setError('')
    try { setBuild(await api<Build>(`builds/${build.buildId}/${action}`, {})) }
    catch (e) { setError(e instanceof Error ? e.message : 'Build update failed') }
    finally { setBusy('') }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3 text-blue-700"><Sparkles aria-hidden="true" /><p className="text-sm font-semibold">AI Product Factory · Product Reasoning Core</p></div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Your idea. An original, working product.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">Research the possibilities, choose a product that fits, and turn the approved plan into code with visible evidence of what works.</p>
      </header>
      <section aria-labelledby="brief-title" className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 id="brief-title" className="text-xl font-semibold">1. Describe the outcome</h2>
        <label className="mt-5 block text-sm font-medium">What do you want to create?<textarea aria-label="Product idea" value={brief.idea} onChange={e => editBrief({ idea: e.target.value })} rows={4} className={field} placeholder="For example: a timber catalogue with a quantity calculator and a working quotation workflow." /></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">Who will use it?<input value={brief.audience} onChange={e => editBrief({ audience: e.target.value })} className={field} /></label>
          <label className="text-sm font-medium">Product type<select value={brief.platform} onChange={e => editBrief({ platform: e.target.value as Platform })} className={field}><option value="web">Website / web application</option><option value="desktop">Desktop application</option><option value="automation">Automation workflow</option></select></label>
          <label className="text-sm font-medium">Priority<select value={brief.priority} onChange={e => editBrief({ priority: e.target.value as Brief['priority'] })} className={field}><option value="speed">Launch quickly</option><option value="balanced">Best balance</option><option value="scale">Operational resilience</option></select></label>
          <label className="text-sm font-medium">Privacy<select value={brief.privacy} onChange={e => editBrief({ privacy: e.target.value as Brief['privacy'] })} className={field}><option value="cloud_allowed">Cloud AI and public research allowed</option><option value="local_only">Local model only; no external research</option></select></label>
        </div>
        {brief.platform === 'desktop' && <label className="mt-4 block text-sm font-medium">Target operating system<select value={brief.target_os[0]} onChange={e => editBrief({ target_os: [e.target.value as Brief['target_os'][number]] })} className={field}><option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option></select></label>}
        <label className="mt-4 block text-sm font-medium">Must-haves and boundaries <span className="font-normal text-slate-500">(one per line)</span><textarea value={constraints} onChange={e => { setConstraints(e.target.value); editBrief({}) }} rows={2} className={field} placeholder="Existing tools to integrate, budget, offline needs, features to exclude…" /></label>
        <button onClick={plan} disabled={!!busy || !!activeBuild || brief.idea.trim().length < 8} className={`${button} mt-5`}>{busy === 'research' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Research and create three plans</button>
      </section>
      <p role="status" className="px-2 text-sm leading-6 text-slate-600">{status}</p>
      {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert className="h-5 w-5 shrink-0" />{error}</div>}
      {plans && <section aria-labelledby="plans-title" className="space-y-4">
        <h2 id="plans-title" className="px-2 text-xl font-semibold">2. Choose your product</h2>
        {plans.mode === 'fixture' && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Offline test mode demonstrates the workflow. These plans and generated scaffolds cannot be labelled functionally verified.</p>}
        <div className="grid gap-4 lg:grid-cols-3">{plans.plans.map(p => <button key={p.contract.plan_id} onClick={() => { setSelected(p.contract.plan_id); setApproval(null) }} disabled={!!activeBuild} aria-pressed={selected === p.contract.plan_id} className={`rounded-2xl border p-5 text-left transition ${selected === p.contract.plan_id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{p.contract.plan_id}{plans.recommendedPlanId === p.contract.plan_id ? ' · Recommended' : ''}</p>
          <h3 className="mt-3 text-lg font-semibold">{p.contract.name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{p.contract.summary}</p>
          <p className="mt-4 text-xs text-slate-500">{p.contract.requirements.length} requirements · {p.contract.acceptance.length} acceptance checks · {p.contract.tasks.length} engineering tasks</p>
        </button>)}</div>
        {chosen && <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold">What this plan will deliver</h3><p className="mt-2 text-sm leading-6 text-slate-600">{chosen.contract.rationale}</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div><h4 className="font-semibold">Included behavior</h4><ul className="mt-3 space-y-3">{chosen.contract.requirements.map(r => <li key={r.id} className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{r.title}</strong><p className="mt-1 leading-6 text-slate-600">{r.description}</p></li>)}</ul></div>
            <div><h4 className="font-semibold">Original experience and components</h4><p className="mt-2 text-sm leading-6 text-slate-600">{chosen.contract.experience.direction}</p><ul className="mt-3 space-y-3">{chosen.contract.experience.components.map(c => <li key={c.name} className="rounded-xl bg-blue-50/60 p-3 text-sm"><strong>{c.name}</strong><p className="mt-1 leading-6">{c.purpose}</p><p className="mt-2 text-xs text-slate-500">{c.interactions.join(' · ')}</p></li>)}</ul></div>
          </div>
          <details className="mt-5 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">How we will test completion</summary><ul className="mt-3 space-y-2 text-sm">{chosen.contract.acceptance.map(c => <li key={c.id}><strong>{c.id}</strong> · {c.description} {c.kind === 'manual' && <span className="text-amber-700">— requires external validation</span>}</li>)}</ul></details>
          <details className="mt-3 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">Architecture, files and source evidence</summary><pre className="mt-3 overflow-auto text-xs">{JSON.stringify(chosen.contract.architecture, null, 2)}</pre><ul className="mt-3 font-mono text-xs">{chosen.contract.file_manifest.map(f => <li key={f}>{f}</li>)}</ul><ul className="mt-4 space-y-2 text-sm">{chosen.contract.sources.map(s => <li key={s.name}><a className="text-blue-700 underline" href={`${s.url}/tree/${s.revision}`} target="_blank" rel="noreferrer">{s.name}</a> · {s.license} · {s.revision.slice(0, 12)}</li>)}</ul>{!chosen.contract.sources.length && <p className="mt-3 text-sm">Original implementation with no external source repository locked.</p>}{plans.research.evidence.filter(e => /^https:\/\//.test(e.url)).map(e => <p key={e.id} className="mt-3 text-xs"><a className="text-blue-700 underline" href={e.url} target="_blank" rel="noreferrer">{e.claim}</a><span className="block text-slate-500">{e.limitation}</span></p>)}</details>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><h4 className="text-sm font-semibold">Assumptions and research limits</h4><ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">{[...chosen.contract.assumptions, ...chosen.contract.research_limitations].map((s, i) => <li key={i}>{s}</li>)}</ul></div><div><h4 className="text-sm font-semibold">Outside this plan</h4><ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">{chosen.contract.excluded_scope.map((s, i) => <li key={i}>{s}</li>)}</ul></div></div>
          <div className="mt-6 flex flex-wrap gap-3"><button onClick={approve} disabled={!!busy || !!activeBuild || !!approval} className={button}>{approval ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{approval ? 'Exact plan approved' : 'Approve this exact plan'}</button><button onClick={startBuild} disabled={!!busy || !!activeBuild || !approval} className={`${button} bg-slate-950`}>Build approved product</button></div>
          <p className="mt-3 text-xs text-slate-500">To revise the scope, edit the brief and create new plans. The Factory preserves the approved version for each build.</p>
        </div>}
      </section>}
      {build && <section aria-labelledby="build-title" className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 id="build-title" className="text-xl font-semibold">3. Build and verification</h2>
        <p role="status" className="mt-3 text-sm">{build.status === 'ready' ? 'Verified for the approved scope' : `Build status: ${build.status}`}{build.recoverable ? ' · Worker interrupted; ready to resume' : ''}</p>
        <ul className="mt-4 space-y-2 text-sm">{Object.entries(build.tasks || {}).map(([id, t]) => <li key={id} className={t.success ? 'text-emerald-800' : 'text-amber-800'}>{id}: {t.summary}</li>)}</ul>
        {build.errors?.map((e, i) => <p key={i} className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{e}</p>)}
        <div className="mt-4 flex gap-3">{(build.status === 'blocked' || build.status === 'failed' || build.recoverable) && <button className={button} disabled={!!busy} onClick={() => control('resume')}>Resume after addressing blockers</button>}{build.status !== 'ready' && build.status !== 'cancelled' && <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm" disabled={!!busy} onClick={() => control('cancel')}>Cancel build</button>}</div>
      </section>}
      {build?.delivery && <FactoryBuildDelivery result={build} />}
    </div>
  </main>
}
