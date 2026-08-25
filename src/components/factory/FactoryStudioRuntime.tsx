'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Bot, BrainCircuit, Check, CheckCircle2, ChevronRight, Cpu, KeyRound,
  Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, WandSparkles,
} from 'lucide-react'
import FactoryStudioV9 from '@/components/factory/FactoryStudioV9'
import FactoryBuildDelivery, { FactoryDemoShowcase, type BuildDeliveryEnvelope } from '@/components/factory/FactoryBuildDelivery'

type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'nvidia' | 'deepseek' | 'local'

type RuntimeConnection = {
  provider: ProviderId
  model: string
  expiresInSeconds?: number
}

const PROVIDERS: Array<{
  id: ProviderId
  name: string
  label: string
  model: string
  note: string
}> = [
  { id: 'openai', name: 'OpenAI', label: 'GPT models', model: 'gpt-5-mini', note: 'General reasoning, planning and code generation.' },
  { id: 'anthropic', name: 'Anthropic', label: 'Claude models', model: 'claude-sonnet-4-20250514', note: 'Strong long-context reasoning and architecture work.' },
  { id: 'gemini', name: 'Google Gemini', label: 'Gemini models', model: 'gemini-3.6-flash', note: 'Fast multimodal and research-oriented workflows.' },
  { id: 'nvidia', name: 'NVIDIA NIM', label: 'Hosted/open models', model: 'openai/gpt-oss-20b', note: 'OpenAI-compatible NVIDIA-hosted model execution.' },
  { id: 'deepseek', name: 'DeepSeek', label: 'Chat & R1 models', model: 'deepseek-chat', note: 'Official DeepSeek API (deepseek-chat, deepseek-reasoner).' },
  { id: 'local', name: 'Local mode', label: 'No API key', model: 'local-deterministic', note: 'Offline deterministic fallback for testing and development.' },
]

const AGENT_STAGES = [
  'Product Thinking', 'Intent', 'Requirements', 'Market', 'Competitors', 'Innovation',
  'Gap Analysis', 'Capabilities', 'GitHub Discovery', 'Repository Intelligence',
  'Strategy Tournament', 'Review', 'Human Approval', 'Deep Research', 'Composition',
  'Architecture', 'Simulation', 'Blueprint', 'Engineering', 'Execution', 'Learning',
]

const SESSION_KEY = 'ai-product-factory-model-session'

function providerInfo(provider: ProviderId) {
  return PROVIDERS.find((item) => item.id === provider) || PROVIDERS[0]
}

export default function FactoryStudioRuntime() {
  const [provider, setProvider] = useState<ProviderId>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(providerInfo('openai').model)
  const [sessionId, setSessionId] = useState('')
  const [connection, setConnection] = useState<RuntimeConnection | null>(null)
  const [testing, setTesting] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [error, setError] = useState('')
  const [latestBuild, setLatestBuild] = useState<BuildDeliveryEnvelope | null>(null)
  const wrappedFetchRef = useRef<typeof window.fetch | null>(null)

  const selectedProvider = useMemo(() => providerInfo(provider), [provider])

  useEffect(() => {
    let cancelled = false
    const saved = window.sessionStorage.getItem(SESSION_KEY) || ''
    if (!saved) {
      setRestoring(false)
      return
    }

    fetch('/api/factory/llm/configure', {
      method: 'GET',
      headers: { 'X-LLM-Session': saved },
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        if (data?.configured && data?.provider && data?.model) {
          setSessionId(saved)
          setConnection({
            provider: data.provider as ProviderId,
            model: String(data.model),
            expiresInSeconds: Number(data.expiresInSeconds || 0),
          })
          setProvider(data.provider as ProviderId)
          setModel(String(data.model))
        } else {
          window.sessionStorage.removeItem(SESSION_KEY)
        }
      })
      .catch(() => window.sessionStorage.removeItem(SESSION_KEY))
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!latestBuild?.delivery) return
    const id = window.setTimeout(() => {
      document.getElementById('build-delivery')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 250)
    return () => window.clearTimeout(id)
  }, [latestBuild])

  useEffect(() => {
    if (!sessionId || !connection) return

    const originalFetch = window.fetch.bind(window)
    const wrappedFetch: typeof window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
      if (!url.startsWith('/api/factory/')) return originalFetch(input, init)

      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
      headers.set('X-LLM-Session', sessionId)
      const response = await originalFetch(input, { ...init, headers })

      if (url.startsWith('/api/factory/build/approved')) {
        response.clone().json()
          .then((data) => {
            if (data?.success) setLatestBuild(data as BuildDeliveryEnvelope)
          })
          .catch(() => undefined)
      }
      return response
    }

    wrappedFetchRef.current = wrappedFetch
    window.fetch = wrappedFetch
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch
      wrappedFetchRef.current = null
    }
  }, [sessionId, connection])

  function chooseProvider(next: ProviderId) {
    setProvider(next)
    setModel(providerInfo(next).model)
    setApiKey('')
    setError('')
  }

  async function testAndStart() {
    if (provider !== 'local' && !apiKey.trim()) {
      setError('Enter the API key for the selected provider.')
      return
    }
    if (!model.trim()) {
      setError('Enter the model ID you want the agents to use.')
      return
    }

    setTesting(true)
    setError('')
    try {
      const response = await fetch('/api/factory/llm/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), model: model.trim() }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success || !data?.sessionId) {
        throw new Error(data?.error || 'Could not connect to this model.')
      }

      const id = String(data.sessionId)
      window.sessionStorage.setItem(SESSION_KEY, id)
      setSessionId(id)
      setConnection({
        provider: data.provider as ProviderId,
        model: String(data.model),
        expiresInSeconds: Number(data.expiresInSeconds || 0),
      })
      setApiKey('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Model connection failed.')
    } finally {
      setTesting(false)
    }
  }

  async function changeModel() {
    const id = sessionId
    window.sessionStorage.removeItem(SESSION_KEY)
    setSessionId('')
    setConnection(null)
    setLatestBuild(null)
    setApiKey('')
    setError('')
    if (id) {
      try {
        await fetch('/api/factory/llm/configure', {
          method: 'DELETE',
          headers: { 'X-LLM-Session': id },
        })
      } catch {
        // The local session is already removed; backend cleanup is best-effort.
      }
    }
  }

  if (restoring) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc] text-slate-700">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Restoring your AI model session…
        </div>
      </main>
    )
  }

  if (connection && sessionId) {
    const connectedProvider = providerInfo(connection.provider)
    return (
      <div className="min-h-screen bg-[#f7f9fc]">
        <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">AI engine connected</div>
                <div className="text-sm font-semibold text-slate-950">{connectedProvider.name} · {connection.model}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <LockKeyhole className="h-3.5 w-3.5" /> Tested · memory-only secret
              </span>
              <button
                onClick={changeModel}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Change model
              </button>
            </div>
          </div>
        </div>
        <FactoryDemoShowcase />
        <FactoryStudioV9 />
        <FactoryBuildDelivery result={latestBuild} />
      </div>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9fc] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[radial-gradient(circle_at_20%_15%,rgba(37,99,235,0.11),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(124,58,237,0.10),transparent_30%)]" />
      <div className="relative mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" /> AI Product Factory · Step 1
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-5xl">
            Connect your AI model, then describe the product you want.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Choose the model you already have access to. We test it first, then the same provider and model powers the Product Factory agents from idea research through architecture and the approved build.
          </p>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] sm:p-7">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><KeyRound className="h-5 w-5" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Model setup</div>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Which AI should build your product?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">No coding or environment-file editing is required for this session.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {PROVIDERS.map((item) => {
                const active = provider === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => chooseProvider(item.id)}
                    className={`rounded-2xl border p-3 text-left transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Cpu className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                      {active && <Check className="h-4 w-4 text-blue-700" />}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{item.label}</div>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">API key</span>
                <div className="relative mt-2">
                  <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    disabled={provider === 'local'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={provider === 'local' ? 'Not required for local mode' : `Paste your ${selectedProvider.name} API key`}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Model ID</span>
                <div className="relative mt-2">
                  <Bot className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    spellCheck={false}
                    placeholder="Enter the exact model ID available to your account"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 font-mono text-sm outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              </label>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              <span className="font-semibold text-slate-800">{selectedProvider.name}:</span> {selectedProvider.note} You can replace the suggested model ID with any compatible model your provider account exposes.
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs leading-5 text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                API keys stay in backend memory only for the active session and are never returned to the UI.
              </div>
              <button
                onClick={testAndStart}
                disabled={testing || !model.trim() || (provider !== 'local' && !apiKey.trim())}
                className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                {testing ? 'Testing model…' : 'Test model & start'}
                {!testing && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <aside className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.55)] sm:p-7">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-blue-200"><BrainCircuit className="h-5 w-5" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">One model session</div>
                <h2 className="mt-1 text-xl font-bold">What happens after connection?</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              You only describe the product in normal language. The Factory coordinates the specialist agents and keeps the technical work behind the workflow.
            </p>

            <div className="mt-5 max-h-[360px] overflow-auto pr-1">
              <div className="flex flex-wrap gap-2">
                {AGENT_STAGES.map((stage, index) => (
                  <div key={stage} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-slate-200">
                    <span className="text-blue-300">{String(index + 1).padStart(2, '0')}</span>
                    {stage}
                    {index < AGENT_STAGES.length - 1 && <ChevronRight className="h-3 w-3 text-slate-500" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
              {[
                'The connection is tested before any product work starts.',
                'Research, reasoning, architecture and build use the same runtime model session.',
                'Repository choices remain approval-gated before the autonomous build.',
              ].map((text) => (
                <div key={text} className="flex items-start gap-2.5 text-xs leading-5 text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> {text}
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { title: '1. Connect', text: 'Choose provider, paste key, enter model ID and test.' },
            { title: '2. Describe', text: 'Explain the product like you would explain it to a person.' },
            { title: '3. Approve & build', text: 'Compare evidence-backed options, approve one, then build.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
