'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, BrainCircuit, Check, CheckCircle2,
  ChevronDown, CircleDollarSign, Clipboard, ExternalLink, Github, Layers3, Loader2,
  LockKeyhole, PackageSearch, Rocket, Search, ShieldCheck, Sparkles, Stars, WandSparkles, Zap,
} from 'lucide-react'
import type { FactoryManagerV10Report } from '@/lib/factory/manager-v10'
import type { LiveResearch } from '@/lib/factory/manager-v8'

type Strategy = { id: string; name: string; description?: string; why?: string; confidence?: number }
type StrategizeResponse = { success: boolean; run_id: string; graph: Record<string, any>; strategies: Strategy[]; error?: string }
type ApproveResponse = { success: boolean; run_id: string; graph: Record<string, any>; approved_strategy?: Strategy; error?: string }
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
  profile?: { intentTerms?: string[]; capabilities?: string[]; domain?: string }
  summary?: LiveResearch['summary'] & {
    relevantSignalCount?: number
    rejectedSignalCount?: number
    githubCandidates?: number
    averageRelevance?: number
    confidenceBand?: string
  }
}

const EXAMPLES: Array<{ title: string; text: string }> = [
  { title: 'WhatsApp lead tracker', text: 'Create a simple system that captures new WhatsApp leads, organizes them by status, reminds my team to follow up and shows which leads are most likely to convert.' },
  { title: 'AI sales assistant', text: 'Create an AI automation that researches a company, finds relevant prospects, drafts personalized outreach and requires manager approval before sending.' },
  { title: 'Local AI video studio', text: 'Build a local-first AI video generation product with a simple prompt and reference-image workflow, scene continuity and optimized execution on a consumer GPU.' },
  { title: 'Invoice follow-up', text: 'Build an assistant that reads unpaid invoices, reminds customers at the right time, tracks replies and asks a manager before sending sensitive follow-ups.' },
]

const PRIORITIES: Array<{ id: CustomerPriority; title: string; text: string }> = [
  { id: 'speed', title: 'Launch quickly', text: 'Simpler plan with fewer moving parts.' },
  { id: 'balanced', title: 'Best balance', text: 'Strong quality without unnecessary complexity.' },
  { id: 'scale', title: 'Built to scale', text: 'More governance and long-term resilience.' },
]

const STEPS = [
  { number: '01', title: 'Describe', text: 'Tell us the outcome in your own words.' },
  { number: '02', title: 'Understand & research', text: 'AI finds requirements and relevant evidence.' },
  { number: '03', title: 'Choose', text: 'Compare three plain-language product plans.' },
  { number: '04', title: 'Build & verify', text: 'Approve, lock sources and run executable checks.' },
]

function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(' ') }

function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'purple' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    purple: 'border-violet-200 bg-violet-50 text-violet-700',
  }
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium', tones[tone])}>{children}</span>
}

function SectionTitle({ icon: Icon, eyebrow, title, text }: { icon: any; eyebrow: string; title: string; text?: string }) {
  return <div className="mb-5 flex items-start gap-3">
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-2.5 text-blue-700 shadow-sm"><Icon className="h-5 w-5" /></div>
    <div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>{text && <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">{text}</p>}</div>
  </div>
}

function Metric({ label, value, helper, icon: Icon }: { label: string; value: ReactNode; helper: string; icon: any }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><span className="rounded-xl bg-slate-50 p-2 text-slate-500"><Icon className="h-4 w-4" /></span></div><div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</div><div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div></div>
}

export default function FactoryStudioV11() {
  const [mode, setMode] = useState<'new' | 'enhance'>('new')
  const [expertMode, setExpertMode] = useState(false)
  const [idea, setIdea] = useState<string>(EXAMPLES[1].text)
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
  const chosenComposition = report?.compositionSuggestions.find((item) => item.id === selectedComposition) || report?.compositionSuggestions[0]
  const handoffAligned = Boolean(report && chosenComposition && report.compositionSuggestions[0]?.id === chosenComposition.id)
  const journeyStep = buildResult || building || directionApproved ? 4 : report ? 3 : loading ? 2 : 1
  const qualityTone: 'green' | 'blue' | 'amber' = report?.recommendationQuality.band === 'High' ? 'green' : report?.recommendationQuality.band === 'Medium' ? 'blue' : 'amber'

  async function post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok || data?.success === false) throw new Error(data?.error || data?.errors?.join?.(', ') || `Request failed: ${response.status}`)
    return data as T
  }

  async function analyze() {
    if (!productIdea) return
    setLoading(true); setError(''); setBuildResult(null); setDirectionApproved(false)
    try {
      setStatus('Understanding the outcome, users and required capabilities…')
      const strategyData = await post<StrategizeResponse>('/api/factory/pi/strategize', { idea: compiledIdea })
      setStrategize(strategyData)
      const repoNames = Array.isArray(strategyData.graph?.repos) ? strategyData.graph.repos.map((repo: any) => repo?.full_name).filter(Boolean).slice(0, 8) : []
      setStatus('Researching capability-matched open-source options and current evidence…')
      const research = await post<ResearchResponse>('/api/factory/research/live', { idea: productIdea, repos: repoNames, graph: strategyData.graph })
      setLiveResearch(research)
      setStatus('Scoring relevance, capability coverage, maintenance, licensing and integration risk…')
      const manager = await post<{ success: true; report: FactoryManagerV10Report }>('/api/factory/manager', { idea: productIdea, runId: strategyData.run_id, graph: strategyData.graph, liveResearch: research, customerContext })
      setReport(manager.report)
      setSelectedStrategy(manager.report.recommendedStrategy?.id || strategyData.strategies?.[0]?.id || '')
      setSelectedComposition(manager.report.compositionSuggestions[0]?.id || '')
      setStatus(manager.report.managerVerdict.decision === 'RESEARCH_MORE' ? 'AI needs stronger evidence before it should recommend a build. Refine the idea or analyze again.' : 'Analysis complete. Review what AI understood and choose a plan.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Factory analysis failed')
      setStatus('We could not complete the analysis. Your idea is preserved.')
    } finally { setLoading(false) }
  }

  async function approve() {
    if (!report || researchBlocked) { setError('This recommendation is not build-ready yet. Improve the brief or research again.'); return }
    if (!strategize?.run_id || !selectedStrategy || !selectedComposition) return
    setApproving(true); setError('')
    try {
      setStatus('Re-checking and locking your exact selected plan…')
      const approved = await post<ApproveResponse>('/api/factory/pi/approve', { runId: strategize.run_id, strategyId: selectedStrategy })
      const manager = await post<{ success: true; report: FactoryManagerV10Report }>('/api/factory/manager', { idea: productIdea, runId: strategize.run_id, graph: approved.graph, liveResearch, customerContext, selectedCompositionId: selectedComposition })
      setReport(manager.report)
      setSelectedComposition(manager.report.compositionSuggestions[0]?.id || selectedComposition)
      const blocked = manager.report.managerVerdict.decision === 'RESEARCH_MORE'
      setDirectionApproved(!blocked)
      setStatus(blocked ? 'The re-check found weak evidence. Build remains locked.' : 'Plan approved. Direction, handoff and source set are aligned and locked.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Approval failed') } finally { setApproving(false) }
  }

  async function autonomousBuild() {
    if (!report || !directionApproved || researchBlocked || !chosenComposition?.repos.length) return
    setBuilding(true); setError(''); setBuildResult(null)
    try {
      setStatus(`Building the approved “${chosenComposition.customerTitle}” plan…`)
      const result = await post<ApprovedBuildResult>('/api/factory/build/approved', {
        idea: compiledIdea,
        runId: strategize?.run_id,
        strategyId: selectedStrategy,
        selectedRepos: chosenComposition.repos.map((repo) => ({ fullName: repo.fullName, url: repo.url, description: repo.description, language: repo.language, license: repo.license, healthScore: repo.healthScore, capabilities: repo.capabilities, whySelected: repo.whySelected, integrationMode: repo.integrationMode })),
      })
      setBuildResult(result)
      setStatus(result.pipelineVerified ? 'Verified build pipeline complete. Approved sources stayed locked.' : 'Build completed, but verification still has open checks.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Approved build failed') } finally { setBuilding(false) }
  }

  async function copyPrompt() {
    if (!report?.idePrompt) return
    if (!handoffAligned || researchBlocked) { setError('Approve the selected plan first so the handoff matches that exact choice.'); return }
    await navigator.clipboard.writeText(report.idePrompt)
    setStatus('Developer handoff copied. It matches the approved plan.')
  }

  function chooseComposition(id: string) { setSelectedComposition(id); setDirectionApproved(false); setBuildResult(null); setError(''); setStatus('Plan changed. Review and approve it before building.') }

  return <main className="min-h-screen bg-[#f6f8fc] text-slate-800">
    <div className="pointer-events-none fixed inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_12%_4%,rgba(37,99,235,0.14),transparent_34%),radial-gradient(circle_at_86%_8%,rgba(124,58,237,0.12),transparent_32%),linear-gradient(to_bottom,rgba(255,255,255,0.9),transparent)]" />
    <div className="relative mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-5 flex flex-col gap-4 rounded-[26px] border border-white/90 bg-white/85 p-4 shadow-[0_22px_70px_-38px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-200/80"><WandSparkles className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><h1 className="text-lg font-semibold tracking-tight text-slate-950">AI Product Factory</h1><Pill tone="blue">Studio</Pill></div><p className="mt-0.5 text-xs text-slate-500">Plain-language idea → evidence-backed plan → verified build.</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"><button onClick={() => setExpertMode(false)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', !expertMode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500')}>Simple</button><button onClick={() => setExpertMode(true)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', expertMode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500')}>Expert</button></div><span className="hidden rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:inline-flex">● Evidence filtered before recommendation</span></div>
      </header>

      <div className="grid gap-2 sm:grid-cols-4">{STEPS.map((step, index) => { const done = journeyStep > index + 1; const active = journeyStep === index + 1; return <div key={step.number} className={cn('rounded-2xl border px-4 py-3', done ? 'border-emerald-100 bg-emerald-50/80' : active ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white/70')}><div className="flex items-center gap-2"><span className={cn('grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold', done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}>{done ? <Check className="h-3.5 w-3.5" /> : step.number}</span><span className="text-xs font-semibold text-slate-900">{step.title}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{step.text}</p></div> })}</div>

      <section className="mt-5 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_30px_90px_-46px_rgba(30,64,175,0.38)]">
        <div className="grid xl:grid-cols-[1.18fr_0.82fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <Pill tone="blue">No coding required</Pill>
            <h2 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-[52px] lg:leading-[1.04]">Tell us the outcome. <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">AI works out the product.</span></h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">The factory turns everyday language into requirements, searches relevant technology, rejects weak evidence and explains the best build choices before anything is locked.</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">{[
              { id: 'new' as const, title: 'Create something new', text: 'Start from an idea and let AI discover the safest route.' },
              { id: 'enhance' as const, title: 'Improve what I already have', text: 'Keep working behavior and add capabilities safely.' },
            ].map((item) => <button key={item.id} onClick={() => { setMode(item.id); setDirectionApproved(false) }} className={cn('rounded-2xl border p-4 text-left', mode === item.id ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white')}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-950">{item.title}</span>{mode === item.id && <CheckCircle2 className="h-5 w-5 text-blue-600" />}</div><p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p></button>)}</div>

            <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              {mode === 'enhance' && <label className="mb-4 block"><span className="mb-2 block text-xs font-semibold text-slate-700">What are you improving?</span><input value={existingContext} onChange={(e) => setExistingContext(e.target.value)} placeholder="GitHub URL, product name or short description" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>}
              <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">What should the product do for you?</span><textarea value={idea} onChange={(e) => { setIdea(e.target.value); setDirectionApproved(false) }} rows={5} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
              <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map((example) => <button key={example.title} onClick={() => { setIdea(example.text); setDirectionApproved(false) }} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{example.title}</button>)}</div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-semibold text-slate-700">Who will use it? <span className="font-normal text-slate-400">Optional</span></span><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Sales team, students, customers…" className="mt-2 w-full border-0 bg-transparent p-0 text-sm outline-none" /></label><label className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-semibold text-slate-700">Where will it be used?</span><select value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-2 w-full border-0 bg-transparent p-0 text-sm outline-none"><option>Web app</option><option>Mobile app</option><option>Desktop app</option><option>Web + mobile</option><option>Internal automation only</option></select></label></div>

            <div className="mt-5"><div className="mb-2 text-xs font-semibold text-slate-700">What matters most?</div><div className="grid gap-3 sm:grid-cols-3">{PRIORITIES.map((item) => <button key={item.id} onClick={() => { setPriority(item.id); setDirectionApproved(false) }} className={cn('rounded-2xl border p-4 text-left', priority === item.id ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white')}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-950">{item.title}</span>{priority === item.id && <Check className="h-4 w-4 text-violet-600" />}</div><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.text}</p></button>)}</div></div>

            <details className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"><summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">Optional privacy & cost preferences</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={privacy} onChange={(e) => setPrivacy(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Standard secure cloud</option><option>Privacy-first / minimal retention</option><option>Private deployment preferred</option><option>Local-first / offline where possible</option></select><select value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Keep recurring cost low</option><option>Balance cost and quality</option><option>Quality is more important than cost</option><option>Enterprise reliability first</option></select></div></details>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2 text-xs leading-5 text-slate-500">{loading || approving || building ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-blue-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />}<span>{status}</span></div><button onClick={analyze} disabled={loading || !productIdea} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 hover:bg-blue-700 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{loading ? 'AI is analyzing…' : report ? 'Analyze again' : 'Analyze my idea'}{!loading && <ArrowRight className="h-4 w-4" />}</button></div>
            {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
          </div>

          <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 via-blue-50/50 to-violet-50/50 p-6 sm:p-8 xl:border-l xl:border-t-0 xl:p-10"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500"><Stars className="h-4 w-4 text-blue-600" /> What AI does for you</div><h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Technical complexity stays underneath.</h3><div className="mt-7 space-y-3">{['Understand your goal and users','Map the capabilities the product actually needs','Research current tools and repositories','Reject irrelevant or weak evidence','Explain three practical plans','Lock only the plan you approve'].map((text, index) => <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-xs font-semibold text-white">{String(index + 1).padStart(2, '0')}</span><span className="text-sm font-medium text-slate-700">{text}</span></div>)}</div><div className="mt-6 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><LockKeyhole className="h-4 w-4 text-blue-600" /> You stay in control</div><p className="mt-2 text-xs leading-5 text-slate-500">AI cannot silently replace your approved product direction or source set.</p></div></div>
        </div>
      </section>

      {report && <div className="mt-7 space-y-6">
        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionTitle icon={BrainCircuit} eyebrow="AI understood your idea" title="Confirm the product brief" text="If this does not match what you meant, edit the idea above and analyze again." /><div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Goal</div><p className="mt-2 text-sm font-medium leading-6 text-slate-900">{report.customerBrief.goal}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Who it is for</div><p className="mt-2 text-sm text-slate-700">{report.customerBrief.audience}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Priority</div><p className="mt-2 text-sm text-slate-700">{report.customerBrief.priority}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{report.customerBrief.capabilities.map((capability) => <Pill key={capability} tone="blue">{capability}</Pill>)}</div></div>
          <div className={cn('rounded-[28px] border p-5 shadow-sm sm:p-6', researchBlocked ? 'border-amber-200 bg-amber-50 text-slate-900' : 'border-slate-900 bg-slate-950 text-white')}><div className="flex items-start justify-between"><div><div className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', researchBlocked ? 'text-amber-700' : 'text-blue-300')}>Recommendation quality</div><div className="mt-2 text-4xl font-semibold">{report.recommendationQuality.score}%</div></div><Pill tone={qualityTone}>{report.recommendationQuality.band}</Pill></div><div className={cn('mt-5 h-2 rounded-full', researchBlocked ? 'bg-amber-100' : 'bg-white/10')}><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${Math.max(4, report.recommendationQuality.score)}%` }} /></div><p className={cn('mt-4 text-sm leading-6', researchBlocked ? 'text-slate-700' : 'text-slate-300')}>{report.recommendationQuality.explanation}</p><div className="mt-5 grid grid-cols-2 gap-3"><div className={cn('rounded-2xl border p-3', researchBlocked ? 'border-amber-200 bg-white' : 'border-white/10 bg-white/5')}><div className="text-2xl font-semibold">{report.recommendationQuality.relevantSignals}</div><div className="text-[11px] opacity-60">relevant signals</div></div><div className={cn('rounded-2xl border p-3', researchBlocked ? 'border-amber-200 bg-white' : 'border-white/10 bg-white/5')}><div className="text-2xl font-semibold">{report.recommendationQuality.rejectedSignals}</div><div className="text-[11px] opacity-60">weak signals rejected</div></div></div><div className={cn('mt-4 rounded-xl border px-3 py-3 text-xs leading-5', researchBlocked ? 'border-amber-300 bg-white text-amber-900' : 'border-white/10 bg-white/5 text-slate-300')}>{researchBlocked ? <><strong>Build gate locked.</strong> Research must improve before approval.</> : <>Target: 90%+ recommendation relevance for supported categories. Verification still requires executable checks.</>}</div></div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionTitle icon={Layers3} eyebrow="Choose your plan" title="Three practical ways to build it" text="The first plan follows the priority you selected. Choose another if its trade-offs fit you better." /><div className="grid gap-4 xl:grid-cols-3">{report.compositionSuggestions.map((option, index) => { const selected = selectedComposition === option.id; return <button key={option.id} onClick={() => chooseComposition(option.id)} className={cn('relative rounded-[24px] border p-5 text-left transition', selected ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-white ring-4 ring-blue-50 shadow-lg' : 'border-slate-200 bg-white hover:-translate-y-1 hover:shadow-xl')}>
          {selected && <span className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white"><Check className="h-4 w-4" /></span>}<div className="flex flex-wrap gap-2 pr-8"><Pill tone={index === 0 ? 'blue' : 'slate'}>{index === 0 ? 'Recommended for your priority' : option.effort}</Pill><Pill>{option.integrationComplexity} complexity</Pill></div><h3 className="mt-4 text-xl font-semibold text-slate-950">{option.customerTitle}</h3><p className="mt-2 min-h-[42px] text-xs leading-5 text-slate-500">{option.bestFor}</p><div className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-4"><div><strong className="text-xl text-slate-950">{option.estimatedFit}%</strong><div className="text-[10px] text-slate-400">fit</div></div><div><strong className="text-xl text-slate-950">{option.capabilityCoverage}%</strong><div className="text-[10px] text-slate-400">coverage</div></div><div><strong className="text-xl text-slate-950">{option.confidence}%</strong><div className="text-[10px] text-slate-400">confidence</div></div></div><div className="mt-4 space-y-2">{option.customerBenefits.slice(0, 3).map((benefit) => <div key={benefit} className="flex gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{benefit}</div>)}</div>{option.missingCapabilities.length > 0 && <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">{option.missingCapabilities.length} capability area(s) stay product-owned rather than forcing an unrelated repository.</div>}</button> })}</div></section>

        {chosenComposition && <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionTitle icon={Rocket} eyebrow="Preview before build" title={`What “${chosenComposition.customerTitle}” gives you`} text="Review the product outcome and what remains uniquely yours before approval." /><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">User outcome</div><p className="mt-2 text-sm leading-6 text-slate-700">{chosenComposition.resultingProduct}</p></div><div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div className="text-sm font-semibold text-slate-950">What stays uniquely yours</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{chosenComposition.customCodeNeeded.slice(0, 8).map((item) => <div key={item} className="flex gap-2 text-xs leading-5 text-slate-600"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />{item}</div>)}</div></div></div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Ready to proceed?</div><h3 className="mt-2 text-2xl font-semibold text-slate-950">Approve first. Build second.</h3><p className="mt-2 text-sm leading-6 text-slate-500">Approval re-checks the exact selected plan, regenerates the developer handoff and locks its sources.</p>{researchBlocked && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />Evidence is too weak. Refine the brief or analyze again before approval.</div>}<div className="mt-5 grid gap-3"><button onClick={approve} disabled={Boolean(researchBlocked) || approving || building} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-blue-50 disabled:opacity-40">{approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4 text-blue-600" />}{approving ? 'Checking & locking…' : directionApproved ? 'Plan approved' : 'Approve this plan'}</button><button onClick={autonomousBuild} disabled={Boolean(researchBlocked) || !directionApproved || building || approving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 disabled:opacity-40">{building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}{building ? 'Building & verifying…' : 'Start verified build'}</button></div></div></section>}

        {buildResult && <section className={cn('rounded-[28px] border p-5 shadow-sm', buildResult.pipelineVerified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}><div className="flex items-start gap-3"><div className={cn('grid h-11 w-11 place-items-center rounded-2xl text-white', buildResult.pipelineVerified ? 'bg-emerald-500' : 'bg-amber-500')}>{buildResult.pipelineVerified ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</div><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Build result</div><h3 className="mt-1 text-xl font-semibold text-slate-950">{buildResult.pipelineVerified ? 'Verified build pipeline passed' : 'Build finished with checks still open'}</h3><p className="mt-1 text-sm text-slate-600">{buildResult.note || buildResult.status || 'Approved sources were preserved.'}</p></div></div></section>}

        <section className="grid gap-5 xl:grid-cols-2"><div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle icon={CircleDollarSign} eyebrow="Business view" title="Commercial starting point" text="A planning hypothesis—not a financial promise." /><div className="flex flex-wrap gap-2"><Pill tone={report.commercialPlan.pricingConfidence >= 60 ? 'green' : 'amber'}>{report.commercialPlan.pricingConfidence}% pricing confidence</Pill><Pill>{report.commercialPlan.status}</Pill></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{report.commercialPlan.tiers.slice(0, 3).map((tier) => <div key={tier.name} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-xs text-slate-500">{tier.name}</div><div className="mt-2 text-2xl font-semibold text-slate-950">${tier.monthlyPriceUsd}<span className="text-xs font-normal text-slate-400">/mo</span></div><div className="mt-2 text-[11px] text-slate-500">Modeled margin {tier.modeledGrossMarginPct}%</div></div>)}</div></div><div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle icon={ShieldCheck} eyebrow="Trust & safety" title="What must pass before verified" text="AI confidence alone is never enough." /><div className="grid gap-2 sm:grid-cols-2">{report.accuracyContract.gates.map((gate, index) => <div key={gate.gate} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-[10px] font-semibold">{index + 1}</span><span className="text-xs font-semibold text-slate-900">{gate.gate}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{gate.passCondition}</p></div>)}</div></div></section>

        {expertMode && <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm"><details open><summary className="flex cursor-pointer list-none items-center justify-between p-5 sm:p-6"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Expert mode</div><h3 className="mt-1 text-lg font-semibold text-slate-950">Repository evidence and developer handoff</h3></div><ChevronDown className="h-5 w-5 text-slate-400" /></summary><div className="border-t border-slate-100 p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Relevant evidence" value={report.sourceIntelligence.signalCount} helper={`${report.sourceIntelligence.rejectedSignalCount} weak signals filtered.`} icon={Zap} /><Metric label="GitHub candidates" value={report.sourceIntelligence.githubCandidates} helper="Capability-matched candidates." icon={Github} /><Metric label="Qualified repos" value={report.recommendationQuality.repositoriesQualified} helper={`From ${report.recommendationQuality.repositoriesConsidered} considered.`} icon={PackageSearch} /><Metric label="Average relevance" value={`${report.sourceIntelligence.averageRelevance}%`} helper="Only allowed evidence." icon={BarChart3} /></div>
        <div className="mt-6 grid gap-5 xl:grid-cols-2"><div><div className="mb-3 text-sm font-semibold text-slate-950">Qualified repositories</div><div className="space-y-2">{report.repoExplainers.slice(0, 10).map((repo) => <a key={repo.fullName} href={repo.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 p-4 hover:border-blue-200"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-slate-900">{repo.fullName} <ExternalLink className="inline h-3 w-3" /></div><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{repo.description}</p></div><Pill tone="blue">{repo.recommendationScore}%</Pill></div><div className="mt-2 text-[10px] text-slate-400">{repo.productRelevance}% product relevance · {repo.healthScore}% health · {repo.license}</div></a>)}</div></div><div><div className="mb-3 text-sm font-semibold text-slate-950">Relevant evidence</div><div className="space-y-2">{report.sourceIntelligence.topSignals.slice(0, 10).map((signal) => <a key={`${signal.source}-${signal.url}`} href={signal.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 p-4 hover:border-violet-200"><div className="flex gap-2"><Pill tone="purple">{signal.source}</Pill><Pill>{Math.round((signal.relevance || 0) * 100)}% relevance</Pill></div><div className="mt-2 text-xs font-semibold text-slate-900">{signal.title}</div></a>)}</div></div></div>
        <div className="mt-6 rounded-[22px] bg-slate-950 p-5 text-white"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Developer handoff</div><div className="mt-1 text-sm font-semibold">Source-locked implementation prompt</div></div><button onClick={copyPrompt} disabled={!handoffAligned || Boolean(researchBlocked)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-40"><Clipboard className="h-4 w-4" />{handoffAligned ? 'Copy developer prompt' : 'Approve selected plan first'}</button></div>{handoffAligned && <pre className="mt-4 max-h-[340px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-[11px] leading-5 text-slate-300"><code>{report.idePrompt}</code></pre>}</div>
        </div></details></section>}
      </div>}

      <footer className="py-8 text-center text-xs text-slate-400">AI Product Factory · Plain-language first · Evidence before recommendation · Human approval before locked build</footer>
    </div>
  </main>
}
