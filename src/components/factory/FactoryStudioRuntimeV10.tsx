'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot, Check, CheckCircle2, ChevronDown, Cpu, KeyRound, Loader2, LockKeyhole,
  RefreshCw, ShieldCheck, Sparkles, WandSparkles,
} from 'lucide-react'
import FactoryStudioV10 from '@/components/factory/FactoryStudioV10'

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
  bestFor: string
}> = [
  { id: 'deepseek', name: 'DeepSeek', label: 'DeepSeek models', model: 'deepseek-chat', note: 'Official DeepSeek API. You can also use deepseek-reasoner.', bestFor: 'Affordable reasoning and planning' },
  { id: 'openai', name: 'OpenAI', label: 'GPT models', model: 'gpt-5-mini', note: 'General reasoning, planning and code generation.', bestFor: 'General product creation' },
  { id: 'anthropic', name: 'Anthropic', label: 'Claude models', model: 'claude-sonnet-4-20250514', note: 'Strong long-context reasoning and architecture work.', bestFor: 'Complex requirements and architecture' },
  { id: 'gemini', name: 'Google Gemini', label: 'Gemini models', model: 'gemini-3.6-flash', note: 'Fast multimodal and research-oriented workflows.', bestFor: 'Research and multimodal ideas' },
  { id: 'nvidia', name: 'NVIDIA NIM', label: 'Hosted/open models', model: 'openai/gpt-oss-20b', note: 'OpenAI-compatible NVIDIA-hosted model execution.', bestFor: 'Hosted open-model workflows' },
  { id: 'local', name: 'Local mode', label: 'No API key', model: 'local-deterministic', note: 'Offline deterministic fallback for testing and development.', bestFor: 'Private testing without an API key' },
]

const SESSION_KEY = 'ai-product-factory-model-session'

function providerInfo(provider: ProviderId) {
  return PROVIDERS.find((item) => item.id === provider) || PROVIDERS[0]
}

export default function FactoryStudioRuntimeV10() {
  const [provider, setProvider] = useState<ProviderId>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(providerInfo('deepseek').model)
  const [sessionId, setSessionId] = useState('')
  const [connection, setConnection] = useState<RuntimeConnection | null>(null)
  const [testing, setTesting] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [error, setError] = useState('')
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
      return originalFetch(input, { ...init, headers })
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
      setError(`Paste your ${selectedProvider.name} API key to continue.`)
      return
    }
    if (!model.trim()) {
      setError('Choose a model before continuing.')
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
        throw new Error(data?.error || 'Could not connect to this AI model.')
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
      setError(cause instanceof Error ? cause.message : 'AI connection failed.')
    } finally {
      setTesting(false)
    }
  }

  async function changeModel() {
    const id = sessionId
    window.sessionStorage.removeItem(SESSION_KEY)
    setSessionId('')
    setConnection(null)
    setApiKey('')
    setError('')
    if (id) {
      try {
        await fetch('/api/factory/llm/configure', {
          method: 'DELETE',
          headers: { 'X-LLM-Session': id },
        })
      } catch {
        // Browser state is already cleared; backend cleanup is best-effort.
      }
    }
  }

  if (restoring) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8fc] text-slate-700">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Restoring your AI session…
        </div>
      </main>
    )
  }

  if (connection && sessionId) {
    const connectedProvider = providerInfo(connection.provider)
    return (
      <div className="min-h-screen bg-[#f6f8fc]">
        <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">AI ready</div>
                <div className="text-sm font-semibold text-slate-950">{connectedProvider.name} · {connection.model}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <LockKeyhole className="h-3.5 w-3.5" /> Key kept in memory only
              </span>
              <button onClick={changeModel} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <RefreshCw className="h-3.5 w-3.5" /> Change AI
              </button>
            </div>
          </div>
        </div>
        <FactoryStudioV10 />
      </div>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f8fc] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.14),transparent_34%),radial-gradient(circle_at_82%_5%,rgba(124,58,237,0.12),transparent_32%),linear-gradient(to_bottom,rgba(255,255,255,0.9),transparent)]" />
      <div className="relative mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" /> AI Product Factory
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
            Connect an AI. Then just explain what you want.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            No developer setup is required. Choose an AI provider you already use, paste the key for this session, and the Product Factory handles research, recommendations, architecture and the approved build flow.
          </p>
        </header>

        <section className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_90px_-48px_rgba(15,23,42,0.45)]">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-5 sm:p-7 lg:p-8">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-3 text-white shadow-lg shadow-blue-200"><WandSparkles className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Choose your AI</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">Which AI should power the factory?</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Pick the provider you already have. We test the connection before starting.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PROVIDERS.map((item) => {
                  const active = provider === item.id
                  return (
                    <button key={item.id} onClick={() => chooseProvider(item.id)} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Cpu className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                        {active && <Check className="h-4 w-4 text-blue-700" />}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{item.bestFor}</div>
                    </button>
                  )
                })}
              </div>

              <label className="mt-6 block">
                <span className="text-xs font-semibold text-slate-700">{provider === 'local' ? 'No API key needed' : `${selectedProvider.name} API key`}</span>
                <div className="relative mt-2">
                  <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    disabled={provider === 'local'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={provider === 'local' ? 'Local mode works without a key' : `Paste your ${selectedProvider.name} key for this session`}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
                  />
                </div>
              </label>

              <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                  Advanced model settings <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <label className="mt-4 block">
                  <span className="text-[11px] font-medium text-slate-500">Model ID</span>
                  <div className="relative mt-2">
                    <Bot className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} placeholder="Model ID" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 font-mono text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">The suggested model is filled in automatically. Change this only when your provider account exposes a different model.</p>
                </label>
              </details>

              {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

              <button onClick={testAndStart} disabled={testing} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 disabled:opacity-50">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {testing ? 'Testing your AI…' : 'Test AI & open Product Studio'}
              </button>
            </div>

            <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 via-blue-50/50 to-violet-50/60 p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Private by design</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Your key is for this session, not part of the product data.</h3>
              <div className="mt-6 space-y-3">
                {[
                  [LockKeyhole, 'Memory-only secret', 'The raw API key is cleared from browser state after the backend creates an opaque runtime session.'],
                  [ShieldCheck, 'Connection tested first', 'The studio opens only after the selected provider and model respond successfully.'],
                  [Sparkles, 'Same AI through the workflow', 'The connected model powers product understanding, research reasoning and the build-planning flow.'],
                ].map(([Icon, title, description]) => {
                  const ItemIcon = Icon as typeof ShieldCheck
                  return (
                    <div key={String(title)} className="flex gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-600 shadow-sm"><ItemIcon className="h-4 w-4" /></div>
                      <div><div className="text-sm font-semibold text-slate-900">{String(title)}</div><p className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</p></div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> No environment file editing</div>
                <p className="mt-2 text-xs leading-5 text-emerald-800/80">Normal customers never need to touch terminal commands, configuration files or source code to begin using the Studio.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
