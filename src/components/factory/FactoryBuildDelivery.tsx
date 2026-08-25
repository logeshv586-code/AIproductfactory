'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck, CheckCircle2, Clipboard, Code2, FileCode2, MonitorPlay,
  PlayCircle, ShieldCheck, Video,
} from 'lucide-react'

type SourceFile = {
  path: string
  size?: number
  content: string
  truncated?: boolean
}

type DeliveryCheck = {
  name: string
  passed: boolean
  detail?: string
}

type BuildDelivery = {
  workspaceId?: string
  fileCount?: number
  sourceFiles?: SourceFile[]
  previewHtml?: string
  artifactName?: string
  verification?: {
    passed?: boolean
    score?: number
    checks?: DeliveryCheck[]
    repairAttempts?: number
  }
  taskResults?: Array<{ title?: string; success?: boolean; summary?: string }>
}

export type BuildDeliveryEnvelope = {
  pipelineVerified?: boolean
  status?: string
  buildId?: string
  outputPath?: string | null
  delivery?: BuildDelivery | null
  verification?: Record<string, unknown>
  errors?: string[]
  note?: string
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function FactoryDemoShowcase() {
  const [demoUrl, setDemoUrl] = useState('')
  const [demoError, setDemoError] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    const parts = Array.from({ length: 6 }, (_, index) =>
      `/demo/ai-product-factory-demo.part${String(index).padStart(2, '0')}.b64`,
    )

    Promise.all(parts.map(async (path) => {
      const response = await fetch(path, { cache: 'force-cache' })
      if (!response.ok) throw new Error(`Demo asset failed to load (${response.status})`)
      const raw = atob((await response.text()).trim())
      const bytes = new Uint8Array(raw.length)
      for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
      return bytes
    }))
      .then((chunks) => {
        if (cancelled) return
        const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        const joined = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) {
          joined.set(chunk, offset)
          offset += chunk.byteLength
        }
        objectUrl = URL.createObjectURL(new Blob([joined], { type: 'video/mp4' }))
        setDemoUrl(objectUrl)
      })
      .catch((cause) => {
        if (!cancelled) setDemoError(cause instanceof Error ? cause.message : 'Demo video could not be loaded.')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  return (
    <section className="mx-auto mt-5 max-w-[1440px] px-4 sm:px-6 lg:px-8">
      <details className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_70px_-48px_rgba(37,99,235,0.35)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-700"><Video className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Product demo</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">See AI Product Factory from idea to approval</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Lightweight highlights created from the uploaded Product Factory walkthrough, embedded directly in the Studio.</p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            <PlayCircle className="h-4 w-4" /> Watch demo
          </div>
        </summary>
        <div className="border-t border-slate-100 bg-slate-950 p-2 sm:p-4">
          {demoUrl ? (
            <video src={demoUrl} className="aspect-[1.94/1] w-full rounded-2xl bg-black" controls preload="metadata" playsInline />
          ) : (
            <div className="grid aspect-[1.94/1] w-full place-items-center rounded-2xl bg-black px-5 text-center text-sm text-slate-300">
              {demoError || 'Preparing the embedded demo…'}
            </div>
          )}
        </div>
      </details>
    </section>
  )
}

export default function FactoryBuildDelivery({ result }: { result: BuildDeliveryEnvelope | null }) {
  const delivery = result?.delivery || null
  const sourceFiles = useMemo(() => delivery?.sourceFiles || [], [delivery])
  const [selectedPath, setSelectedPath] = useState('')
  const selectedFile = sourceFiles.find((file) => file.path === selectedPath) || sourceFiles[0]

  if (!result || !delivery) return null

  const checks = delivery.verification?.checks || []
  const passed = delivery.verification?.passed === true && result.pipelineVerified === true
  const score = delivery.verification?.score ?? 0

  async function copySelected() {
    if (!selectedFile?.content) return
    await navigator.clipboard.writeText(selectedFile.content)
  }

  return (
    <section id="build-delivery" className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8">
      <div className={cn(
        'overflow-hidden rounded-[30px] border bg-white shadow-[0_30px_90px_-52px_rgba(15,23,42,0.45)]',
        passed ? 'border-emerald-200' : 'border-amber-200',
      )}>
        <div className="flex flex-col gap-5 border-b border-slate-100 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('rounded-2xl p-3', passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              {passed ? <BadgeCheck className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Build delivery workspace</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Full source, generated demo and verification evidence</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                The coding agents implemented the approved plan inside a locked workspace. Review exactly what was generated before you use or deploy it.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', passed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
              {passed ? 'Verified build' : 'Verification needs attention'}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">{score}% checks</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">{delivery.fileCount || sourceFiles.length} files</span>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-slate-100 p-5 sm:p-6 xl:border-b-0 xl:border-r">
            <div className="mb-4 flex items-center gap-2">
              <MonitorPlay className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Generated product screen</div>
                <div className="text-xs text-slate-500">Self-contained preview created from the approved product and architecture.</div>
              </div>
            </div>
            {delivery.previewHtml ? (
              <iframe
                title="Generated product preview"
                srcDoc={delivery.previewHtml}
                sandbox="allow-scripts"
                className="h-[560px] w-full rounded-2xl border border-slate-200 bg-white shadow-inner"
              />
            ) : (
              <div className="grid h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">No generated preview was returned.</div>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-violet-600" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Generated source code</div>
                  <div className="text-xs text-slate-500">Select a file to inspect the exact generated content.</div>
                </div>
              </div>
              <button onClick={copySelected} disabled={!selectedFile} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
                <Clipboard className="h-3.5 w-3.5" /> Copy file
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[0.78fr_1.22fr]">
              <div className="max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                {sourceFiles.map((file) => {
                  const active = selectedFile?.path === file.path
                  return (
                    <button key={file.path} onClick={() => setSelectedPath(file.path)} className={cn('mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition', active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-950')}>
                      <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 truncate font-mono">{file.path}</span>
                    </button>
                  )
                })}
              </div>
              <pre className="max-h-[520px] min-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950 p-4 text-[11px] leading-5 text-slate-300">{selectedFile?.content || 'No source files returned.'}{selectedFile?.truncated ? '\n\n[Large file preview truncated by the API.]' : ''}</pre>
            </div>
          </div>
        </div>

        <div className="grid gap-5 border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Verification gates</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {checks.map((check) => (
                <div key={check.name} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <CheckCircle2 className={cn('h-4 w-4', check.passed ? 'text-emerald-600' : 'text-amber-600')} />
                    {check.passed ? 'PASS' : 'CHECK'} · {check.name}
                  </div>
                  {check.detail && <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{check.detail}</p>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><PlayCircle className="h-4 w-4 text-blue-600" /> Engineering agent work</div>
            <div className="space-y-2">
              {(delivery.taskResults || []).slice(0, 8).map((task, index) => (
                <div key={`${task.title}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-xs font-semibold text-slate-800">{task.success === false ? 'Needs review' : 'Completed'} · {task.title || `Task ${index + 1}`}</div>
                  {task.summary && <p className="mt-1 text-[11px] leading-5 text-slate-500">{task.summary}</p>}
                </div>
              ))}
              {!(delivery.taskResults || []).length && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">The deterministic build scaffold completed without additional agent task output.</div>}
            </div>
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
              Workspace: <span className="font-mono font-semibold">{delivery.workspaceId || result.buildId || 'generated-build'}</span>
              {delivery.artifactName ? <> · packaged as <span className="font-mono font-semibold">{delivery.artifactName}</span></> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
