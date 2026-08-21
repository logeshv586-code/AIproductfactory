'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, BrainCircuit, Check, CheckCircle2,
  ChevronDown, CircleDollarSign, Clipboard, ExternalLink, Github, Layers3, Loader2,
  LockKeyhole, Network, PackageSearch, Rocket, Search, ShieldCheck, Sparkles, Stars,
  WandSparkles, Zap,
} from 'lucide-react'
import type { FactoryManagerV10Report } from '@/lib/factory/manager-v10'
import type { LiveResearch } from '@/lib/factory/manager-v8'

type Strategy = {
  id: string
  name: string
  tagline?: string
  description?: string
  why?: string
  feasibility?: number
  innovation_score?: number
  complexity?: string
}

type StrategizeResponse = {
  success: boolean
  run_id: string
  graph: Record<string, any>
  strategies: Strategy[]
  error?: string
}

type ApproveResponse = {
  success: boolean
  run_id: string
  graph: Record<string, any>
  approved_strategy?: Strategy
  error?: string
}

type ApprovedBuildResult = {
  success: boolean
  pipelineVerified?: boolean
  status?: string
  buildId?: string
  outputPath?: string | null
  selectedRepos?: Array<Record<string, any>>
  verification?: Record<string, unknown>
  errors?: string[]
  note?: string
}

type CustomerPriority = 'speed' | 'balanced' | 'scale'

type ResearchResponse = LiveResearch & {
  profile?: {
    intentTerms?: string[]
    capabilities?: string[]
    domain?: string
  }
  summary?: LiveResearch['summary'] & {
    relevantSignalCount?: number
    rejectedSignalCount?: number
    githubCandidates?: number
    averageRelevance?: number
    confidenceBand?: string
  }
}

const EXAMPLES = [
  ['WhatsApp lead tracker', 'Create a simple system that captures new WhatsApp leads, organizes them by status, reminds my team to follow up and shows which leads are most likely to convert.'],
  ['AI sales assistant', 'Create an AI automation that researches a company, finds relevant prospects, drafts personalized outreach and requires manager approval before sending.'],
  ['Local AI video studio', 'Build a local-first AI video generation product with a simple prompt and reference-image workflow, scene continuity and optimized execution on a consumer GPU.'],
  ['Invoice follow-up', 'Build an assistant that reads unpaid invoices, reminds customers at the right time, tracks replies and asks a manager before sending sensitive follow-ups.'],
] as const

const PRIORITIES: Array<{ id: CustomerPriority; title: string; text: string }> = [
  { id: 'speed', title: 'Launch quickly', text: 'Simpler plan with fewer moving parts.' },
  { id: 'balanced', title: 'Best balance', text: 'Strong quality without unnecessary complexity.' },
  { id: 'scale', title: 'Built to scale', text: 'More governance and long-term resilience.' },
]

const CUSTOMER_STEPS = [
  ['01', 'Describe', 'Tell us the result you want in your own words.'],
  ['02', 'Understand & research', 'AI turns it into requirements and finds relevant evidence.'],
  ['03', 'Choose', 'Compare three plans written for normal people.'],
  ['04', 'Build & verify', 'Approve one plan, lock the sources and run the build checks.'],
] as const

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'purple' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    purple: 'border-violet-200 bg-violet-50 text-violet-700',
  }
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium', tones[tone])}>{children}</span>
}

function SectionTitle({ icon: Icon, eyebrow, title, text }: { icon: any; eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-2.5 text-blue-700 shadow-sm"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
        {text && <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">{text}</p>}
      </div>
    </div>
  )
}

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: ReactNode; helper: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="rounded-xl bg-slate-50 p-2 text-slate-500"><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  )
}

function Journey({ current }: { current: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {CUSTOMER_STEPS.map(([number, title, text], index) => {
        const position = index + 1
        const complete = current > position
        const active = current === position
        return (
          <div key={number} className={cn('rounded-2xl border px-4 py-3 transition', complete ? 'border-emerald-100 bg-emerald-50/80' : active ? 'border-blue-200 bg-blue-50/80 shadow-sm' : 'border-slate-200 bg-white/70')}>
            <div className="flex items-center gap-2">
              <span className={cn('grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold', complete ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span>
              <span className="text-xs font-semibold text-slate-900">{title}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{text}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function FactoryStudioV11() {
  const [mode, setMode] = useState<'new' | 'enhance'>('new')
  const [expertMode, setExpertMode] = useState(false)
  const [idea, setIdea] = useState(EXAMPLES[1][1])
  const [existingContext, setExistingContext] = useState('')
  const [audience, setAudience] = useState('')
  const [priority, setPriority] = useState<CustomerPriority>('balanced')
  const [platform, setPlatform] = useState('Web app')
  const [privacy, setPrivacy] = useState('Standard secure cloud')
  const [budget, setBudget] = useState('Keep recurring cost low')
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [building, setBuilding] = useState(false)
  const [directionApproved, setDirectionApproved] = useState(false)
  const [status, setStatus] = useState('Ready when you are. Describe the outcome you want.')
  const [error, setError] = useState('')
  const [strategize, setStrategize] = useState<StrategizeResponse | null>(null)
  const [liveResearch, setLiveResearch] = useState<ResearchResponse | null>(null)
  const [report, setReport] = useState<FactoryManagerV10Report | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState('')
  const [selectedComposition, setSelectedComposition] = useState('')
  const [buildResult, setBuildResult] = useState<ApprovedBuildResult | null>(null)

  const customerContext = useMemo(() => ({ audience, priority, platform, privacy, budget }), [audience, priority, platform, privacy, budget])
  const productIdea = idea.trim()
  const compiledIdea = useMemo(() => {
    const preferences = [
      audience.trim() ? `Target users: ${audience.trim()}` : '',
      `Product priority: ${priority}`,
      `Preferred platform: ${platform}`,
      `Privacy preference: ${privacy}`,
      `Cost preference: ${budget}`,
    ].filter(Boolean)
    if (mode === 'new') return [productIdea, ...preferences].join('\n')
    return [
      'Enhance an existing product. Preserve working behavior and use incremental adapters/modules instead of destructive rewrites.',
      existingContext.trim() ? `Existing product/repository/context: ${existingContext.trim()}` : '',
      `Enhancement goal: ${productIdea}`,
      ...preferences,
    ].filter(Boolean).join('\n')
  }, [mode, productIdea, existingContext, audience, priority, platform, privacy, budget])

  const researchBlocked = report?.managerVerdict.decision === 'RESEARCH_MORE'
  const journeyStep = buildResult || building || directionApproved ? 4 : report ? 3 : loading ? 2 : 1
  const chosenComposition = report?.compositionSuggestions.find((item) => item.id === selectedComposition) || report?.compositionSuggestions?.[0]
  const handoffAligned = Boolean(report && chosenComposition && report.compositionSuggestions[0]?.id === chosenComposition.id)

  async function post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok || data?.success === false) throw new Error(data?.error || data?.errors?.join?.(', ') || `Request failed: ${response.status}`)
    return data as T
  }

  async function analyze() {
    if (!productIdea) return
    setLoading(true)
    setError('')
    setBuildResult(null)
    setDirectionApproved(false)
    try {
      setStatus('Understanding the outcome, users and required capabilities…')
      const strategyData = await post<StrategizeResponse>('/api/factory/pi/strategize', { idea: compiledIdea })
      setStrategize(strategyData)
      const repoNames = Array.isArray(strategyData.graph?.repos)
        ? strategyData.graph.repos.map((repo: any) => repo?.full_name).filter(Boolean).slice(0, 8)
        : []

      setStatus('Researching capability-matched open-source options and current evidence…')
      const research = await post<ResearchResponse>('/api/factory/research/live', { idea: productIdea, repos: repoNames, graph: strategyData.graph })
      setLiveResearch(research)

      setStatus('Scoring relevance, capability coverage, maintenance, licensing and integration risk…')
      const manager = await post<{ success: true; report: FactoryManagerV10Report }>('/api/factory/manager', {
        idea: productIdea,
        runId: strategyData.run_id,
        graph: strategyData.graph,
        liveResearch: research,
        customerContext,
      })
      setReport(manager.report)
      setSelectedStrategy(manager.report.recommendedStrategy?.id || strategyData.strategies?.[0]?.id || '')
      setSelectedComposition(manager.report.compositionSuggestions?.[0]?.id || '')
      setStatus(manager.report.managerVerdict.decision === 'RESEARCH_MORE'
        ? 'AI needs stronger evidence before it should recommend a build. Refine the idea or analyze again.'
        : 'Analysis complete. Review what AI understood and choose the plan that feels right.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Factory analysis failed')
      setStatus('We could not complete the analysis. Your idea is preserved so you can try again.')
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    if (!report || researchBlocked) {
      setError('This recommendation is not build-ready yet. Improve the product brief or run research again before approving.')
      return
    }
    if (!strategize?.run_id || !selectedStrategy || !selectedComposition) return
    setApproving(true)
    setError('')
    try {
      setStatus('Locking your plan and checking the architecture against the selected source set…')
      const approved = await post<ApproveResponse>('/api/factory/pi/approve', { runId: strategize.run_id, strategyId: selectedStrategy })
      const manager = await post<{ success: true; report: FactoryManagerV10Report }>('/api/factory/manager', {
        idea: productIdea,
        runId: strategize.run_id,
        graph: approved.graph,
        liveResearch,
        customerContext,
        selectedCompositionId: selectedComposition,
      })
      setReport(manager.report)
      const preserved = manager.report.compositionSuggestions?.[0]?.id || selectedComposition
      setSelectedComposition(preserved)
      const blocked = manager.report.managerVerdict.decision === 'RESEARCH_MORE'
      setDirectionApproved(!blocked)
      setStatus(blocked
        ? 'The re-check found weak evidence. The plan was not unlocked for build.'
        : 'Plan approved. Direction, developer handoff and source set are aligned and locked.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approval failed')
      setStatus('The plan was not locked. Nothing has been changed.')
    } finally {
      setApproving(false)
    }
  }

  async function autonomousBuild() {
    if (!report || !directionApproved || researchBlocked) return
    const composition = report.compositionSuggestions.find((item) => item.id === selectedComposition) || report.compositionSuggestions[0]
    if (!composition?.repos?.length) {
      setError('Choose a plan with at least one validated reusable component before building.')
      return
    }

    setBuilding(true)
    setError('')
    setBuildResult(null)
    try {
      setStatus(`Building the approved “${composition.customerTitle}” plan with locked sources…`)
      const result = await post<ApprovedBuildResult>('/api/factory/build/approved', {
        idea: compiledIdea,
        runId: strategize?.run_id,
        strategyId: selectedStrategy,
        selectedRepos: composition.repos.map((repo) => ({
          fullName: repo.fullName,
          url: repo.url,
          description: repo.description,
          language: repo.language,
          license: repo.license,
          healthScore: repo.healthScore,
          capabilities: repo.capabilities,
          whySelected: repo.whySelected,
          integrationMode: repo.integrationMode,
        })),
      })
      setBuildResult(result)
      setStatus(result.pipelineVerified
        ? 'Verified build pipeline complete. The approved source set stayed locked throughout the run.'
        : 'Build pipeline finished, but verification still has items that need attention.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approved build failed')
      setStatus('The build could not finish. Your approved plan is still preserved.')
    } finally {
      setBuilding(false)
    }
  }

  async function copyPrompt() {
    if (!report?.idePrompt) return
    if (!handoffAligned) {
      setError('Approve the selected plan first so the developer handoff is regenerated for that exact choice.')
      return
    }
    await navigator.clipboard.writeText(report.idePrompt)
    setStatus('Developer handoff copied. It matches the selected plan and source set.')
  }

  function chooseComposition(id: string) {
    setSelectedComposition(id)
    setDirectionApproved(false)
    setBuildResult(null)
    setError('')
    setStatus('Plan changed. Review it, then approve before building.')
  }

  const qualityTone: 'green' | 'blue' | 'amber' = report?.recommendationQuality.band === 'High' ? 'green' : report?.recommendationQuality.band === 'Medium' ? 'blue' : 'amber'

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-800">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_12%_4%,rgba(37,99,235,0.14),transparent_34%),radial-gradient(circle_at_86%_8%,rgba(124,58,237,0.12),transparent_32%),linear-gradient(to_bottom,rgba(255,255,255,0.9),transparent)]" />

      <div className="relative mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 flex flex-col gap-4 rounded-[26px] border border-white/90 bg-white/85 p-4 shadow-[0_22px_70px_-38px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-200/80"><WandSparkles className="h-5 w-5" /></div>
            <div>
              <div className="flex items-center gap-2"><h1 className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg">AI Product Factory</h1><Pill tone="blue">Studio</Pill></div>
              <p className="mt-0.5 text-xs text-slate-500">From plain-language idea to evidence-backed product plan and verified build.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => setExpertMode(false)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', !expertMode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500')}>Simple</button>
              <button onClick={() => setExpertMode(true)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', expertMode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500')}>Expert</button>
            </div>
            <span className="hidden items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:inline-flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Evidence filtered before recommendation</span>
            {expertMode && <a href="https://github.com/logeshv586-code/AIproductfactory" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:shadow-sm"><Github className="h-4 w-4" /> Source <ExternalLink className="h-3 w-3" /></a>}
          </div>
        </header>

        <Journey current={journeyStep} />

        <section className="mt-5 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_30px_90px_-46px_rgba(30,64,175,0.38)]">
          <div className="grid xl:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><Sparkles className="h-3.5 w-3.5" /> No coding required</div>
              <h2 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-[52px] lg:leading-[1.04]">Tell us the outcome. <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">AI works out the product.</span></h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">Explain what you want in normal language. The factory converts it into requirements, finds relevant reusable technology, rejects weak evidence, compares practical plans and keeps you in control before anything is built.</p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button onClick={() => { setMode('new'); setDirectionApproved(false) }} className={cn('rounded-2xl border p-4 text-left transition', mode === 'new' ? 'border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-950">Create something new</div>{mode === 'new' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Start with an idea and let AI find the safest route to a working product.</p>
                </button>
                <button onClick={() => { setMode('enhance'); setDirectionApproved(false) }} className={cn('rounded-2xl border p-4 text-left transition', mode === 'enhance' ? 'border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-950">Improve something I already have</div>{mode === 'enhance' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Keep what works and add capabilities without a risky rewrite.</p>
                </button>
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                {mode === 'enhance' && <div className="mb-4"><label className="mb-2 block text-xs font-semibold text-slate-700">What are you improving?</label><input value={existingContext} onChange={(event) => setExistingContext(event.target.value)} placeholder="Product name, GitHub URL, website, or a short description" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></div>}
                <label className="mb-2 block text-xs font-semibold text-slate-700">What should the product do for you?</label>
                <textarea value={idea} onChange={(event) => { setIdea(event.target.value); setDirectionApproved(false) }} rows={5} placeholder="Example: I want a tool that reads my incoming leads, tells me which ones matter, drafts follow-ups and asks me before sending…" className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map(([title, text]) => <button key={title} onClick={() => { setIdea(text); setDirectionApproved(false) }} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{title}</button>)}</div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="block rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-semibold text-slate-700">Who will use it? <span className="font-normal text-slate-400">Optional</span></span><input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Example: sales team, students, shop owners" className="mt-2 w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400" /></label>
                <label className="block rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-semibold text-slate-700">Where should people use it?</span><select value={platform} onChange={(event) => setPlatform(event.target.value)} className="mt-2 w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none"><option>Web app</option><option>Mobile app</option><option>Desktop app</option><option>Web + mobile</option><option>Internal automation only</option></select></label>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold text-slate-700">What matters most?</div>
                <div className="grid gap-3 sm:grid-cols-3">{PRIORITIES.map((item) => <button key={item.id} onClick={() => { setPriority(item.id); setDirectionApproved(false) }} className={cn('rounded-2xl border p-4 text-left transition', priority === item.id ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-slate-300')}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-950">{item.title}</span>{priority === item.id && <Check className="h-4 w-4 text-violet-600" />}</div><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.text}</p></button>)}</div>
              </div>

              <details className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">Optional preferences <span className="font-normal text-slate-400">privacy and cost</span></summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="text-[11px] font-medium text-slate-500">Data & privacy</span><select value={privacy} onChange={(event) => setPrivacy(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"><option>Standard secure cloud</option><option>Prefer privacy-first / minimal retention</option><option>Private deployment preferred</option><option>Local-first / offline where possible</option></select></label>
                  <label className="block"><span className="text-[11px] font-medium text-slate-500">Running cost</span><select value={budget} onChange={(event) => setBudget(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"><option>Keep recurring cost low</option><option>Balance cost and quality</option><option>Quality is more important than cost</option><option>Enterprise budget / reliability first</option></select></label>
                </div>
              </details>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">{loading || approving || building ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}<span>{status}</span></div>
                <button onClick={analyze} disabled={loading || !productIdea} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{loading ? 'AI is analyzing…' : report ? 'Analyze again' : 'Analyze my idea'}{!loading && <ArrowRight className="h-4 w-4" />}</button>
              </div>
              {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
            </div>

            <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 via-blue-50/50 to-violet-50/50 p-6 sm:p-8 xl:border-l xl:border-t-0 xl:p-10">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500"><Stars className="h-4 w-4 text-blue-600" /> What AI does for you</div>
              <h3 className="mt-3 max-w-xl text-2xl font-semibold tracking-tight text-slate-950">You describe the result. The technical complexity stays underneath.</h3>
              <div className="mt-7 space-y-3">{[
                ['Understand', 'Turns your words into a clear product brief and required capabilities.'],
                ['Research', 'Finds relevant tools, repositories, competitors and current evidence.'],
                ['Verify', 'Rejects weak matches and checks maintenance, licensing and implementation risk.'],
                ['Recommend', 'Shows three practical plans with plain-language trade-offs.'],
                ['Build', 'Locks your approved plan and runs executable verification gates.'],
              ].map(([title, description], index) => <div key={title} className="flex gap-3 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-xs font-semibold text-white">{String(index + 1).padStart(2, '0')}</span><div><div className="text-sm font-semibold text-slate-950">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div></div>)}</div>
              <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><LockKeyhole className="h-4 w-4 text-blue-600" /> You stay in control</div><p className="mt-2 text-xs leading-5 text-slate-500">The AI can research and recommend on its own, but it cannot silently switch your approved product direction or source set.</p></div>
            </div>
          </div>
        </section>

        {report && <div className="mt-7 space-y-6">
          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle icon={BrainCircuit} eyebrow="AI understood your idea" title="Here is the product brief we are using" text="Check this before choosing a plan. If it does not match what you meant, edit your idea above and analyze again." />
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Goal</div><p className="mt-2 text-sm font-medium leading-6 text-slate-900">{report.customerBrief.goal}</p></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Who it is for</div><p className="mt-2 text-sm text-slate-700">{report.customerBrief.audience}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Priority</div><p className="mt-2 text-sm text-slate-700">{report.customerBrief.priority}</p></div></div>
              <div className="mt-4"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Capabilities AI identified</div><div className="mt-2 flex flex-wrap gap-2">{report.customerBrief.capabilities.length ? report.customerBrief.capabilities.map((capability) => <Pill key={capability} tone="blue">{capability}</Pill>) : <span className="text-xs text-slate-500">No explicit capability list was returned; the factory will use the workflow requirements.</span>}</div></div>
            </div>

            <div className={cn('rounded-[28px] border p-5 shadow-sm sm:p-6', researchBlocked ? 'border-amber-200 bg-amber-50' : 'border-slate-900 bg-slate-950 text-white')}>
              <div className="flex items-start justify-between gap-3"><div><div className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', researchBlocked ? 'text-amber-700' : 'text-blue-300')}>Recommendation quality</div><div className="mt-2 flex items-end gap-2"><span className={cn('text-4xl font-semibold tracking-tight', researchBlocked ? 'text-slate-950' : 'text-white')}>{report.recommendationQuality.score}%</span><span className={cn('pb-1 text-xs', researchBlocked ? 'text-slate-500' : 'text-slate-400')}>evidence quality</span></div></div><Pill tone={qualityTone}>{report.recommendationQuality.band}</Pill></div>
              <div className={cn('mt-5 h-2 overflow-hidden rounded-full', researchBlocked ? 'bg-amber-100' : 'bg-white/10')}><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${Math.max(4, report.recommendationQuality.score)}%` }} /></div>
              <p className={cn('mt-4 text-sm leading-6', researchBlocked ? 'text-slate-700' : 'text-slate-300')}>{report.recommendationQuality.explanation}</p>
              <div className="mt-5 grid grid-cols-2 gap-3"><div className={cn('rounded-2xl border p-3', researchBlocked ? 'border-amber-200 bg-white' : 'border-white/10 bg-white/5')}><div className={cn('text-2xl font-semibold', researchBlocked ? 'text-slate-950' : 'text-white')}>{report.recommendationQuality.relevantSignals}</div><div className={cn('mt-1 text-[11px]', researchBlocked ? 'text-slate-500' : 'text-slate-400')}>relevant evidence signals</div></div><div className={cn('rounded-2xl border p-3', researchBlocked ? 'border-amber-200 bg-white' : 'border-white/10 bg-white/5')}><div className={cn('text-2xl font-semibold', researchBlocked ? 'text-slate-950' : 'text-white')}>{report.recommendationQuality.rejectedSignals}</div><div className={cn('mt-1 text-[11px]', researchBlocked ? 'text-slate-500' : 'text-slate-400')}>weak/irrelevant signals rejected</div></div></div>
              {researchBlocked ? <div className="mt-4 rounded-xl border border-amber-300 bg-white px-3 py-3 text-xs leading-5 text-amber-900"><strong>Research more before build.</strong> The factory will not unlock approval while the evidence gate is weak.</div> : <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs leading-5 text-amber-100">Target: 90%+ recommendation relevance for supported product categories. This is not a promise that every build is 90% correct; executable verification is still required.</div>}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionTitle icon={Layers3} eyebrow="Choose your plan" title="Three ways to reach the same outcome" text="Pick based on what matters to you. Technical repository details stay hidden unless you open Expert mode." />
            <div className="grid gap-4 xl:grid-cols-3">{report.compositionSuggestions.map((option, index) => {
              const selected = selectedComposition === option.id
              return <button key={option.id} onClick={() => chooseComposition(option.id)} className={cn('group relative rounded-[24px] border p-5 text-left transition duration-200', selected ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-white ring-4 ring-blue-50 shadow-lg shadow-blue-100/70' : 'border-slate-200 bg-white hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-100')}>
                {selected && <span className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white"><Check className="h-4 w-4" /></span>}
                <div className="flex flex-wrap items-center gap-2 pr-8"><Pill tone={index === 0 ? 'blue' : 'slate'}>{index === 0 ? 'Recommended for your priority' : option.effort}</Pill><Pill>{option.integrationComplexity} complexity</Pill></div>
                <div className="mt-4 text-xl font-semibold tracking-tight text-slate-950">{option.customerTitle}</div><p className="mt-2 min-h-[44px] text-xs leading-5 text-slate-500">{option.bestFor}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-4"><div><div className="text-xl font-semibold text-slate-950">{option.estimatedFit}%</div><div className="text-[10px] text-slate-400">fit</div></div><div><div className="text-xl font-semibold text-slate-950">{option.capabilityCoverage}%</div><div className="text-[10px] text-slate-400">coverage</div></div><div><div className="text-xl font-semibold text-slate-950">{option.confidence}%</div><div className="text-[10px] text-slate-400">confidence</div></div></div>
                <div className="mt-4 space-y-2">{option.customerBenefits.slice(0, 3).map((benefit) => <div key={benefit} className="flex gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /><span>{benefit}</span></div>)}</div>
                {option.missingCapabilities.length > 0 && <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">{option.missingCapabilities.length} capability area{option.missingCapabilities.length === 1 ? '' : 's'} will stay product-owned instead of forcing an unrelated open-source project.</div>}
              </button>
            })}</div>
          </section>

          {chosenComposition && <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle icon={Rocket} eyebrow="Preview before build" title={`What “${chosenComposition.customerTitle}” will give you`} text="A product preview in customer language before you lock the direction." />
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">User outcome</div><p className="mt-2 text-sm leading-6 text-slate-700">{chosenComposition.resultingProduct}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">How the solution is organized</div><p className="mt-2 text-sm leading-6 text-slate-700">{report.architecturePreview.style}. {report.architecturePreview.deployment}.</p><div className="mt-3 flex flex-wrap gap-1.5">{report.architecturePreview.components.slice(0, 8).map((item) => <Pill key={item}>{item}</Pill>)}</div></div></div>
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div className="text-sm font-semibold text-slate-950">What stays uniquely yours</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{chosenComposition.customCodeNeeded.slice(0, 8).map((item) => <div key={item} className="flex gap-2 text-xs leading-5 text-slate-600"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />{item}</div>)}</div></div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Ready to proceed?</div><h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Approve first. Build second.</h3><p className="mt-2 text-sm leading-6 text-slate-500">Approval re-checks and locks your exact selected plan. The developer handoff is regenerated to match that same choice.</p>
              {researchBlocked && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Build gate locked</div><p className="mt-2">The current evidence quality is too weak. Refine your brief or run analysis again instead of approving a low-confidence source set.</p></div>}
              <div className="mt-5 space-y-3"><div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><div className="text-sm font-semibold text-slate-900">Evidence checked</div><div className="mt-1 text-xs leading-5 text-slate-500">Weak research is filtered before the plan is ranked.</div></div></div><div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><div><div className="text-sm font-semibold text-slate-900">Source lock</div><div className="mt-1 text-xs leading-5 text-slate-500">Only your approved component set can enter this build run.</div></div></div></div>
              <div className="mt-5 grid gap-3"><button onClick={approve} disabled={Boolean(researchBlocked) || approving || building} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45">{approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4 text-blue-600" />}{approving ? 'Checking & locking…' : directionApproved ? 'Plan approved' : 'Approve this plan'}</button><button onClick={autonomousBuild} disabled={Boolean(researchBlocked) || !directionApproved || building || approving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">{building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}{building ? 'Building & verifying…' : 'Start verified build'}</button></div>
              {!directionApproved && !researchBlocked && <p className="mt-3 text-center text-[11px] text-slate-400">Approve the selected plan before the build button becomes available.</p>}
            </div>
          </section>}

          {buildResult && <section className={cn('rounded-[28px] border p-5 shadow-sm sm:p-6', buildResult.pipelineVerified ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70')}><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className={cn('grid h-11 w-11 place-items-center rounded-2xl text-white', buildResult.pipelineVerified ? 'bg-emerald-500' : 'bg-amber-500')}>{buildResult.pipelineVerified ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</div><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Build result</div><h3 className="mt-1 text-xl font-semibold text-slate-950">{buildResult.pipelineVerified ? 'Verified build pipeline passed' : 'Build finished with checks still open'}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{buildResult.note || buildResult.status || 'The selected source set was preserved for this build run.'}</p></div></div><div className="flex flex-wrap gap-2">{buildResult.buildId && <Pill>Build {buildResult.buildId}</Pill>}{buildResult.outputPath && <Pill tone="green">Output ready</Pill>}</div></div>{buildResult.errors?.length ? <div className="mt-4 rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-700">{buildResult.errors.join(' · ')}</div> : null}</section>}

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionTitle icon={CircleDollarSign} eyebrow="Business view" title="Commercial starting point" text="Useful as a planning hypothesis—not a promise. Replace modeled assumptions with real usage and customer evidence before pricing publicly." /><div className="flex flex-wrap gap-2"><Pill tone={report.commercialPlan.pricingConfidence >= 60 ? 'green' : 'amber'}>{report.commercialPlan.pricingConfidence}% pricing confidence</Pill><Pill>{report.commercialPlan.status}</Pill></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{report.commercialPlan.tiers.slice(0, 3).map((tier) => <div key={tier.name} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-xs font-medium text-slate-500">{tier.name}</div><div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">${tier.monthlyPriceUsd}<span className="text-xs font-normal text-slate-400">/mo</span></div><div className="mt-2 text-[11px] leading-5 text-slate-500">Modeled margin {tier.modeledGrossMarginPct}% · {tier.bestFor}</div></div>)}</div></div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionTitle icon={ShieldCheck} eyebrow="Trust & safety" title="What must pass before we call it verified" text="AI confidence alone is never enough. The exact approved build must pass executable checks." /><div className="grid gap-2 sm:grid-cols-2">{report.accuracyContract.gates.map((gate, index) => <div key={gate.gate} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-[10px] font-semibold text-slate-500 shadow-sm">{index + 1}</span><span className="text-xs font-semibold text-slate-900">{gate.gate}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{gate.passCondition}</p></div>)}</div></div>
          </section>

          {expertMode && <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm"><details open><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Expert evidence</div><h3 className="mt-1 text-lg font-semibold text-slate-950">Technical research, repository scores and developer handoff</h3><p className="mt-1 text-xs text-slate-500">Hidden in Simple mode so everyday customers do not need to understand repositories or adapters.</p></div><ChevronDown className="h-5 w-5 text-slate-400" /></summary><div className="border-t border-slate-100 p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Relevant evidence" value={report.sourceIntelligence.signalCount} helper={`${report.sourceIntelligence.rejectedSignalCount} weak or irrelevant signals filtered out.`} icon={Zap} /><MetricCard label="GitHub candidates" value={report.sourceIntelligence.githubCandidates} helper="Capability-matched repository candidates returned by live GitHub research." icon={Github} /><MetricCard label="Qualified repositories" value={report.recommendationQuality.repositoriesQualified} helper={`From ${report.recommendationQuality.repositoriesConsidered} repositories considered.`} icon={PackageSearch} /><MetricCard label="Average relevance" value={`${report.sourceIntelligence.averageRelevance}%`} helper="Average relevance of evidence allowed into the recommendation view." icon={BarChart3} /></div>
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <div><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950"><Network className="h-4 w-4 text-blue-600" /> Qualified repository roles</div><div className="space-y-2">{report.repoExplainers.slice(0, 12).map((repo) => <div key={repo.fullName} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><a href={repo.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-semibold text-slate-900 hover:text-blue-700">{repo.fullName}<ExternalLink className="h-3 w-3 shrink-0" /></a><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{repo.description}</p></div><div className="flex shrink-0 flex-wrap gap-1.5"><Pill tone="blue">{repo.recommendationScore}% score</Pill><Pill>{repo.productRelevance}% relevant</Pill></div></div><div className="mt-3 flex flex-wrap gap-1.5">{repo.capabilities.slice(0, 5).map((capability) => <Pill key={capability}>{capability}</Pill>)}</div><div className="mt-3 text-[10px] text-slate-400">{repo.language} · {repo.license} · {repo.healthScore}% health · {repo.integrationMode}</div></div>)}</div></div>
              <div><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950"><Search className="h-4 w-4 text-violet-600" /> Relevant research evidence</div><div className="space-y-2">{report.sourceIntelligence.topSignals.slice(0, 10).map((signal) => <a key={`${signal.source}-${signal.url}`} href={signal.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"><div className="flex flex-wrap items-center gap-2"><Pill tone="purple">{signal.source}</Pill><Pill>{Math.round((signal.relevance || 0) * 100)}% relevance</Pill></div><div className="mt-2 text-xs font-semibold leading-5 text-slate-900">{signal.title}</div><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{signal.summary}</p></a>)}{!report.sourceIntelligence.topSignals.length && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">No evidence passed the current relevance threshold. The factory should research more instead of presenting unrelated results.</div>}</div></div>
            </div>
            <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-white sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Developer handoff</div><div className="mt-1 text-sm font-semibold">Implementation prompt for a coding agent</div><p className="mt-1 text-xs leading-5 text-slate-400">The handoff is regenerated after approval so it matches the exact selected plan.</p></div><button onClick={copyPrompt} disabled={!handoffAligned || Boolean(researchBlocked)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Clipboard className="h-4 w-4" /> {handoffAligned ? 'Copy developer prompt' : 'Approve selected plan first'}</button></div>{handoffAligned ? <pre className="mt-4 max-h-[340px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-[11px] leading-5 text-slate-300"><code>{report.idePrompt}</code></pre> : <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-slate-300">You changed the plan after research. Approve it to regenerate a source-locked developer handoff for this exact selection.</div>}</div>
          </div></details></section>}
        </div>}

        <footer className="py-8 text-center text-xs text-slate-400">AI Product Factory · Plain-language first · Evidence before recommendation · Human approval before locked build</footer>
      </div>
    </main>
  )
}
