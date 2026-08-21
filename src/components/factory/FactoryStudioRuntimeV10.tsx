'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot, BrainCircuit, Check, CheckCircle2, ChevronDown, Code2, Cpu, HardDrive,
  KeyRound, Loader2, LockKeyhole, RefreshCw, Search, Server, ShieldCheck,
  Sparkles, WandSparkles,
} from 'lucide-react'
import FactoryStudioV11 from '@/components/factory/FactoryStudioV11'

type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'nvidia' | 'deepseek' | 'ollama' | 'lmstudio' | 'local'

type ProviderSpec = {
  id: ProviderId
  name: string
  label: string
  model: string
  note: string
  bestFor: string
  requiresKey: boolean
  localServer?: boolean
  baseUrl?: string
}

type RuntimeConnection = {
  provider: ProviderId
  model: string
  baseUrl?: string | null
  localExecution?: boolean
  expiresInSeconds?: number
}

type LocalRecommendation = {
  role: string
  model: string
  why: string
}

type LocalModelsResponse = {
  success?: boolean
  provider?: ProviderId
  baseUrl?: string
  models?: string[]
  recommendations?: LocalRecommendation[]
  count?: number
  error?: string
}

const PROVIDERS: ProviderSpec[] = [
  { id: 'deepseek', name: 'DeepSeek', label: 'DeepSeek models', model: 'deepseek-chat', note: 'Official DeepSeek API. You can also use deepseek-reasoner.', bestFor: 'Affordable reasoning and planning', requiresKey: true },
  { id: 'openai', name: 'OpenAI', label: 'GPT models', model: 'gpt-5-mini', note: 'General reasoning, planning and code generation.', bestFor: 'General product creation', requiresKey: true },
  { id: 'anthropic', name: 'Anthropic', label: 'Claude models', model: 'claude-sonnet-4-20250514', note: 'Strong long-context reasoning and architecture work.', bestFor: 'Complex requirements and architecture', requiresKey: true },
  { id: 'gemini', name: 'Google Gemini', label: 'Gemini models', model: 'gemini-3.6-flash', note: 'Fast multimodal and research-oriented workflows.', bestFor: 'Research and multimodal ideas', requiresKey: true },
  { id: 'nvidia', name: 'NVIDIA NIM', label: 'Hosted/open models', model: 'openai/gpt-oss-20b', note: 'OpenAI-compatible NVIDIA-hosted model execution.', bestFor: 'Hosted open-model workflows', requiresKey: true },
  { id: 'ollama', name: 'Ollama', label: 'Local models', model: '', note: 'Runs installed Ollama models on your own machine through the OpenAI-compatible API.', bestFor: 'Private local reasoning & building', requiresKey: false, localServer: true, baseUrl: 'http://127.0.0.1:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', label: 'Local models', model: '', note: 'Uses the LM Studio local server and automatically discovers models exposed by it.', bestFor: 'Easy desktop local AI', requiresKey: false, localServer: true, baseUrl: 'http://127.0.0.1:1234/v1' },
  { id: 'local', name: 'Offline test mode', label: 'No model download', model: 'local-deterministic', note: 'Deterministic fallback for CI and product-flow testing. Not intended as the highest-quality reasoning model.', bestFor: 'Offline testing only', requiresKey: false },
]

const SESSION_KEY = 'ai-product-factory-model-session'

function providerInfo(provider: ProviderId) {
  return PROVIDERS.find((item) => item.id === provider) || PROVIDERS[0]
}

function isLocalProvider(provider: ProviderId) {
  return provider === 'ollama' || provider === 'lmstudio' || provider === 'local'
}

export default function FactoryStudioRuntimeV10() {
  const [provider, setProvider] = useState<ProviderId>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(providerInfo('deepseek').model)
  const [baseUrl, setBaseUrl] = useState('')
  const [localModels, setLocalModels] = useState<string[]>([])
  const [localRecommendations, setLocalRecommendations] = useState<LocalRecommendation[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [localHint, setLocalHint] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [connection, setConnection] = useState<RuntimeConnection | null>(null)
  const [testing, setTesting] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [error, setError] = useState('')
  const wrappedFetchRef = useRef<typeof window.fetch | null>(null)

  const selectedProvider = useMemo(() => providerInfo(provider), [provider])
  const localServer = Boolean(selectedProvider.localServer)

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
          const restoredProvider = data.provider as ProviderId
          setSessionId(saved)
          setConnection({
            provider: restoredProvider,
            model: String(data.model),
            baseUrl: data.baseUrl ? String(data.baseUrl) : null,
            localExecution: Boolean(data.localExecution),
            expiresInSeconds: Number(data.expiresInSeconds || 0),
          })
          setProvider(restoredProvider)
          setModel(String(data.model))
          setBaseUrl(data.baseUrl ? String(data.baseUrl) : providerInfo(restoredProvider).baseUrl || '')
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

  async function discoverLocalModels(
    targetProvider: ProviderId = provider,
    targetBaseUrl: string = baseUrl,
    showFailure = true,
  ) {
    if (targetProvider !== 'ollama' && targetProvider !== 'lmstudio') return
    setDiscovering(true)
    setLocalHint('')
    if (showFailure) setError('')
    try {
      const params = new URLSearchParams({ provider: targetProvider })
      if (targetBaseUrl.trim()) params.set('baseUrl', targetBaseUrl.trim())
      const response = await fetch(`/api/factory/llm/models?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json() as LocalModelsResponse
      if (!response.ok || data.success === false) throw new Error(data.error || 'Could not discover local models.')

      const models = Array.isArray(data.models) ? data.models : []
      const recommendations = Array.isArray(data.recommendations) ? data.recommendations : []
      setLocalModels(models)
      setLocalRecommendations(recommendations)
      if (data.baseUrl) setBaseUrl(data.baseUrl)

      const balanced = recommendations.find((item) => item.role === 'Balanced')?.model
      if (models.length) {
        setModel((current) => current && models.includes(current) ? current : balanced || models[0])
        setLocalHint(`${models.length} local model${models.length === 1 ? '' : 's'} found. The factory ranked the best installed choices for research, reasoning and product building.`)
      } else {
        setModel('')
        setLocalHint('Server connected, but no models are available yet. Download or load a model, then discover again.')
      }
    } catch (cause) {
      setLocalModels([])
      setLocalRecommendations([])
      setLocalHint('')
      if (showFailure) setError(cause instanceof Error ? cause.message : 'Could not reach the local AI server.')
    } finally {
      setDiscovering(false)
    }
  }

  function chooseProvider(next: ProviderId) {
    const info = providerInfo(next)
    const nextBaseUrl = info.baseUrl || ''
    setProvider(next)
    setModel(info.model)
    setBaseUrl(nextBaseUrl)
    setApiKey('')
    setLocalModels([])
    setLocalRecommendations([])
    setLocalHint('')
    setError('')

    if (info.localServer) {
      window.setTimeout(() => void discoverLocalModels(next, nextBaseUrl, false), 0)
    }
  }

  async function testAndStart() {
    if (selectedProvider.requiresKey && !apiKey.trim()) {
      setError(`Paste your ${selectedProvider.name} API key to continue.`)
      return
    }
    if (!model.trim() && !localServer) {
      setError('Choose a model before continuing.')
      return
    }
    if (localServer && !baseUrl.trim()) {
      setError('Enter the local server URL, then discover your models.')
      return
    }

    setTesting(true)
    setError('')
    try {
      const response = await fetch('/api/factory/llm/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          model: model.trim(),
          baseUrl: localServer ? baseUrl.trim() : '',
        }),
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
        baseUrl: data.baseUrl ? String(data.baseUrl) : null,
        localExecution: Boolean(data.localExecution),
        expiresInSeconds: Number(data.expiresInSeconds || 0),
      })
      setModel(String(data.model))
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
    const connectedLocally = Boolean(connection.localExecution || isLocalProvider(connection.provider))
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
                {connection.baseUrl && <div className="mt-0.5 text-[11px] text-slate-500">{connection.baseUrl}</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                {connectedLocally ? <HardDrive className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                {connectedLocally ? 'Runs locally · no cloud key needed' : 'Key kept in memory only'}
              </span>
              <button onClick={changeModel} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <RefreshCw className="h-3.5 w-3.5" /> Change AI
              </button>
            </div>
          </div>
        </div>
        <FactoryStudioV11 />
      </div>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f8fc] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.14),transparent_34%),radial-gradient(circle_at_82%_5%,rgba(124,58,237,0.12),transparent_32%),linear-gradient(to_bottom,rgba(255,255,255,0.9),transparent)]" />
      <div className="relative mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" /> AI Product Factory
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
            Use cloud AI or run it privately on your PC.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Choose a hosted model, Ollama or LM Studio. For local AI, the Studio discovers your installed models and recommends the strongest available choice for research, reasoning and advanced product building.
          </p>
        </header>

        <section className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_90px_-48px_rgba(15,23,42,0.45)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-5 sm:p-7 lg:p-8">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-3 text-white shadow-lg shadow-blue-200"><WandSparkles className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Choose your AI</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">Which AI should power the factory?</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Cloud providers use a session-only key. Ollama and LM Studio run models from your own machine.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {PROVIDERS.map((item) => {
                  const active = provider === item.id
                  const local = isLocalProvider(item.id)
                  return (
                    <button key={item.id} onClick={() => chooseProvider(item.id)} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'}`}>
                      <div className="flex items-center justify-between gap-2">
                        {local ? <HardDrive className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-400'}`} /> : <Cpu className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-400'}`} />}
                        {active ? <Check className="h-4 w-4 text-blue-700" /> : local ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Local</span> : null}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-0.5 text-[11px] leading-5 text-slate-500">{item.bestFor}</div>
                    </button>
                  )
                })}
              </div>

              {selectedProvider.requiresKey ? (
                <label className="mt-6 block">
                  <span className="text-xs font-semibold text-slate-700">{selectedProvider.name} API key</span>
                  <div className="relative mt-2">
                    <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={`Paste your ${selectedProvider.name} key for this session`}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </label>
              ) : (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-900">No cloud API key needed</div>
                    <p className="mt-1 text-[11px] leading-5 text-emerald-800/80">{selectedProvider.note}</p>
                  </div>
                </div>
              )}

              {localServer && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-violet-50/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white p-2.5 text-blue-700 shadow-sm"><Server className="h-4 w-4" /></div>
                      <div>
                        <div className="text-sm font-semibold text-slate-950">Connect your {selectedProvider.name} server</div>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">We read only the local OpenAI-compatible model list and test the model you choose.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void discoverLocalModels()}
                      disabled={discovering}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
                    >
                      {discovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      {discovering ? 'Discovering…' : 'Discover local models'}
                    </button>
                  </div>

                  <label className="mt-4 block">
                    <span className="text-[11px] font-semibold text-slate-600">Local server URL</span>
                    <input
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      spellCheck={false}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-mono text-xs outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
                    />
                  </label>

                  {localModels.length > 0 && (
                    <label className="mt-4 block">
                      <span className="text-[11px] font-semibold text-slate-600">Model to use</span>
                      <select
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
                      >
                        {localModels.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                  )}

                  {localRecommendations.length > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {localRecommendations.map((item) => {
                        const Icon = item.role === 'Research & reasoning' ? BrainCircuit : item.role === 'Product building' ? Code2 : Sparkles
                        const selected = item.model === model
                        return (
                          <button
                            type="button"
                            key={`${item.role}-${item.model}`}
                            onClick={() => setModel(item.model)}
                            className={`rounded-xl border p-3 text-left transition ${selected ? 'border-violet-300 bg-white ring-2 ring-violet-100' : 'border-white bg-white/70 hover:border-violet-200'}`}
                          >
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700"><Icon className="h-3.5 w-3.5" /> {item.role}</div>
                            <div className="mt-2 break-all text-xs font-semibold text-slate-900">{item.model}</div>
                            <p className="mt-1 text-[10px] leading-4 text-slate-500">{item.why}</p>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {localHint && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-2.5 text-[11px] leading-5 text-emerald-800">{localHint}</div>}

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3 text-[11px] leading-5 text-slate-600">
                    {provider === 'ollama' ? (
                      <>
                        <strong className="text-slate-800">Easy Ollama setup:</strong> start Ollama, then install the models you want. Good starting choices are <code className="rounded bg-slate-100 px-1">gpt-oss:20b</code> for advanced reasoning/product work, <code className="rounded bg-slate-100 px-1">qwen3:8b</code> for a lighter balanced model, or <code className="rounded bg-slate-100 px-1">qwen2.5-coder:7b</code> for code-heavy building. The Studio will rank only models actually installed on your machine.
                      </>
                    ) : (
                      <>
                        <strong className="text-slate-800">Easy LM Studio setup:</strong> open the Developer tab, start the local server, download/load one or more models, then click <strong>Discover local models</strong>. The Studio uses LM Studio&apos;s OpenAI-compatible model list rather than making you type model IDs manually.
                      </>
                    )}
                  </div>
                </div>
              )}

              <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                  Advanced model settings <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <label className="mt-4 block">
                  <span className="text-[11px] font-medium text-slate-500">Model ID</span>
                  <div className="relative mt-2">
                    <Bot className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} placeholder={localServer ? 'Discover a model or type its exact local ID' : 'Model ID'} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 font-mono text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">For local servers, model discovery is recommended. Manual IDs remain available for advanced users and custom model aliases.</p>
                </label>
              </details>

              {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

              <button onClick={testAndStart} disabled={testing} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 disabled:opacity-50">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {testing ? 'Testing your AI…' : localServer ? `Test ${selectedProvider.name} & open Product Studio` : 'Test AI & open Product Studio'}
              </button>
            </div>

            <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 via-blue-50/50 to-violet-50/60 p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Private by design</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Use the best model available to you without turning setup into a developer task.</h3>
              <div className="mt-6 space-y-3">
                {[
                  [LockKeyhole, 'Session-only cloud secrets', 'Hosted API keys are cleared from browser state after the backend creates an opaque runtime session.'],
                  [HardDrive, 'True local options', 'Ollama and LM Studio can run the factory with models on your machine and no cloud API key.'],
                  [BrainCircuit, 'Model-fit recommendations', 'For local servers, installed models are ranked for research/reasoning, product building and balanced use.'],
                  [ShieldCheck, 'Connection tested first', 'The Product Studio opens only after the selected provider and model actually respond.'],
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
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> Normal-user friendly</div>
                <p className="mt-2 text-xs leading-5 text-emerald-800/80">Cloud users paste a key. Local users select Ollama or LM Studio and click Discover. No environment-file editing is required to start making products.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
