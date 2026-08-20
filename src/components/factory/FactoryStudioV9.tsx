'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, BrainCircuit, Check, CheckCircle2,
  ChevronDown, CircleDollarSign, Clipboard, Code2, ExternalLink, Github, Layers3,
  Loader2, LockKeyhole, Network, PackageSearch, Rocket, Search, ShieldCheck, Sparkles,
  Stars, WandSparkles, Zap,
} from 'lucide-react'
import type { FactoryManagerV8Report, LiveResearch } from '@/lib/factory/manager-v8'

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

const EXAMPLES = [
  {
    title: 'Smart shopping assistant',
    text: 'Build a product-price intelligence agent that compares shopping sites, verifies sellers, tracks price history and recommends the lowest trustworthy selling price.',
  },
  {
    title: 'AI sales automation',
    text: 'Create an AI automation that researches a company, finds relevant prospects, drafts personalized outreach and requires manager approval before sending.',
  },
  {
    title: 'Local AI video studio',
    text: 'Build a local-first AI video generation product using open-source models with a simple prompt-to-video workflow and optimized low-memory execution.',
  },
]

const CUSTOMER_STEPS = [
  { number: '01', title: 'Describe', text: 'Tell us what you want in normal language.' },
  { number: '02', title: 'Research', text: 'AI studies the market, capabilities and open-source options.' },
  { number: '03', title: 'Choose', text: 'Compare three practical product foundations.' },
  { number: '04', title: 'Build', text: 'Approve one direction, lock the sources and verify the build.' },
]

function score(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.round(value <= 1 ? value * 100 : value)
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
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

export default function FactoryStudioV9() {
  const [mode, setMode] = useState<'new' | 'enhance'>('new')
  const [idea, setIdea] = useState(EXAMPLES[0].text)
  const [existingContext, setExistingContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [building, setBuilding] = useState(false)
  const [status, setStatus] = useState('Ready to turn your idea into a build plan.')
  const [error, setError] = useState('')
  const [strategize, setStrategize] = useState<StrategizeResponse | null>(null)
  const [liveResearch, setLiveResearch] = useState<LiveResearch | null>(null)
  const [report, setReport] = useState<FactoryManagerV8Report | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState('')
  const [selectedComposition, setSelectedComposition] = useState('')
  const [buildResult, setBuildResult] = useState<ApprovedBuildResult | null>(null)

  const compiledIdea = useMemo(() => {
    if (mode === 'new') return idea.trim()
    return [
      'Enhance an existing product. Preserve working behavior and use incremental adapters/modules instead of destructive rewrites.',
      existingContext.trim() ? `Existing product/repository/context: ${existingContext.trim()}` : '',
      `Enhancement goal: ${idea.trim()}`,
    ].filter(Boolean).join('\n')
  }, [mode, idea, existingContext])

  const journeyStep = buildResult ? 4 : report ? 3 : loading ? 2 : 1

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
    if (!compiledIdea) return
    setLoading(true)
    setError('')
    setBuildResult(null)
    try {
      setStatus('Understanding your product idea and turning it into requirements…')
      const strategyData = await post<StrategizeResponse>('/api/factory/pi/strategize', { idea: compiledIdea })
      setStrategize(strategyData)

      const repoNames = Array.isArray(strategyData.graph?.repos)
        ? strategyData.graph.repos.map((repo: any) => repo?.full_name).filter(Boolean).slice(0, 8)
        : []
      setStatus('Researching current tools, repositories, market signals and technical evidence…')
      const research = await post<LiveResearch>('/api/factory/research/live', { idea: compiledIdea, repos: repoNames })
      setLiveResearch(research)

      setStatus('Comparing the strongest product foundations, business model and verification path…')
      const manager = await post<{ success: true; report: FactoryManagerV8Report }>('/api/factory/manager', {
        idea: compiledIdea,
        runId: strategyData.run_id,
        graph: strategyData.graph,
        liveResearch: research,
      })
      setReport(manager.report)
      setSelectedStrategy(manager.report.recommendedStrategy?.id || strategyData.strategies?.[0]?.id || '')
      setSelectedComposition(manager.report.compositionSuggestions?.[0]?.id || '')
      setStatus('Research complete. Review the recommendation and choose how you want to build it.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Factory analysis failed')
      setStatus('We could not complete the research. Review the message below and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    if (!strategize?.run_id || !selectedStrategy) return
    setApproving(true)
    setError('')
    try {
      setStatus('Turning your approved direction into an architecture and checking how the parts work together…')
      const approved = await post<ApproveResponse>('/api/factory/pi/approve', {
        runId: strategize.run_id,
        strategyId: selectedStrategy,
      })
      const manager = await post<{ success: true; report: FactoryManagerV8Report }>('/api/factory/manager', {
        idea: compiledIdea,
        runId: strategize.run_id,
        graph: approved.graph,
        liveResearch,
      })
      setReport(manager.report)
      if (!manager.report.compositionSuggestions.some((item) => item.id === selectedComposition)) {
        setSelectedComposition(manager.report.compositionSuggestions?.[0]?.id || '')
      }
      setStatus('Direction approved. The architecture has been re-checked against your selected approach.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setApproving(false)
    }
  }

  async function autonomousBuild() {
    if (!report) return
    const composition = report.compositionSuggestions.find((item) => item.id === selectedComposition) || report.compositionSuggestions[0]
    if (!composition?.repos?.length) {
      setError('Choose a product foundation before building.')
      return
    }

    setBuilding(true)
    setError('')
    setBuildResult(null)
    try {
      setStatus(`Building with the locked “${composition.title}” source set…`)
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
        ? 'Build pipeline verified. Your selected source set stayed locked throughout the run.'
        : 'Build pipeline completed, but a few verification checks still need attention.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approved-composition build failed')
      setStatus('The build could not finish. Your selected plan is still preserved.')
    } finally {
      setBuilding(false)
    }
  }

  async function copyPrompt() {
    if (!report?.idePrompt) return
    await navigator.clipboard.writeText(report.idePrompt)
    setStatus('Developer handoff prompt copied to your clipboard.')
  }

  const chosenComposition = report?.compositionSuggestions.find((item) => item.id === selectedComposition) || report?.compositionSuggestions?.[0]

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-800">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_32%)]" />

      <div className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
              <WandSparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg">AI Product Factory</h1>
                <Pill tone="blue">Studio</Pill>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">From idea to evidence-backed product architecture and verified build.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:inline-flex sm:items-center sm:gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Evidence-first workflow
            </span>
            <a href="https://github.com/logeshv586-code/AIproductfactory" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:shadow-sm">
              <Github className="h-4 w-4" /> Source <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>

        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_30px_80px_-42px_rgba(30,64,175,0.38)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <Sparkles className="h-3.5 w-3.5" /> No technical setup required to start
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
                Describe the product. <span className="text-blue-600">The factory works out how to build it.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Explain your idea in plain language. AI Product Factory researches what already exists, compares open-source foundations, proposes three implementation paths, estimates commercial potential, and keeps the final build locked to what you approved.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setMode('new')} className={cn('rounded-2xl border p-4 text-left transition', mode === 'new' ? 'border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-950">Create a new product</div>
                    {mode === 'new' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Start from an idea and let the factory discover the best building blocks.</p>
                </button>
                <button onClick={() => setMode('enhance')} className={cn('rounded-2xl border p-4 text-left transition', mode === 'enhance' ? 'border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-950">Improve an existing product</div>
                    {mode === 'enhance' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Preserve what works and add the new capability through safer incremental changes.</p>
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                {mode === 'enhance' && (
                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-semibold text-slate-700">What product or repository are you improving?</label>
                    <input value={existingContext} onChange={(e) => setExistingContext(e.target.value)} placeholder="Example: GitHub URL, product name, or short description" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                  </div>
                )}
                <label className="mb-2 block text-xs font-semibold text-slate-700">What do you want to build?</label>
                <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} placeholder="Describe the customer problem, the result you want, and any important limits…" className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => (
                    <button key={example.title} onClick={() => setIdea(example.text)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                      {example.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                  {loading || approving || building ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                  <span>{status}</span>
                </div>
                <button onClick={analyze} disabled={loading || !compiledIdea} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {loading ? 'Researching…' : 'Research my product'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertTriangle className="mr-2 inline h-4 w-4" />{error}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/60 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500"><Stars className="h-4 w-4 text-blue-600" /> How it works</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Four simple steps for the customer. Deep intelligence underneath.</h3>
              <div className="mt-7 space-y-3">
                {CUSTOMER_STEPS.map((step, index) => {
                  const active = journeyStep === index + 1
                  const complete = journeyStep > index + 1
                  return (
                    <div key={step.number} className={cn('flex gap-4 rounded-2xl border p-4 transition', active ? 'border-blue-200 bg-white shadow-sm' : complete ? 'border-emerald-100 bg-emerald-50/70' : 'border-transparent bg-white/45')}>
                      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold', active ? 'bg-blue-600 text-white' : complete ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 shadow-sm')}>
                        {complete ? <Check className="h-4 w-4" /> : step.number}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{step.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><LockKeyhole className="h-4 w-4 text-blue-600" /> Approval stays with you</div>
                <p className="mt-2 text-xs leading-5 text-slate-500">The system can research and recommend autonomously, but it does not silently switch the selected repositories after you approve the build plan.</p>
              </div>
            </div>
          </div>
        </section>

        {report && (
          <div className="mt-7 space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600"><BadgeCheck className="h-4 w-4" /> AI decision summary</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{report.managerVerdict.decision.replaceAll('_', ' ')}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{report.managerVerdict.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone="blue">{report.managerVerdict.estimatedFeasibility}% feasible</Pill>
                  <Pill tone="green">{report.managerVerdict.confidence}% confidence</Pill>
                  <Pill>{report.sourceIntelligence.signalCount} research signals</Pill>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Feasibility" value={`${report.managerVerdict.estimatedFeasibility}%`} helper="How achievable the product looks with current evidence." icon={CheckCircle2} />
              <MetricCard label="Manager confidence" value={`${report.managerVerdict.confidence}%`} helper="Confidence in the current recommendation, not a release guarantee." icon={BrainCircuit} />
              <MetricCard label="Live evidence" value={report.sourceIntelligence.signalCount} helper={`Signals from ${report.sourceIntelligence.sourcesWithResults} active source types.`} icon={Zap} />
              <MetricCard label="Repositories studied" value={report.repoExplainers.length} helper="Open-source candidates reviewed for product roles and health." icon={PackageSearch} />
              <MetricCard label="Best foundation fit" value={`${report.compositionSuggestions[0]?.estimatedFit ?? 0}%`} helper="Estimated fit of the leading composition before real build tests." icon={BarChart3} />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle icon={Layers3} eyebrow="Step 3 · Choose" title="Choose the product foundation" text="These are three different ways to build the same customer outcome. Select the one you want the factory to keep locked during the build." />
              <div className="grid gap-4 xl:grid-cols-3">
                {report.compositionSuggestions.map((option, index) => {
                  const selected = selectedComposition === option.id
                  const names = ['Recommended', 'Strong combination', 'Alternative path']
                  return (
                    <button key={option.id} onClick={() => setSelectedComposition(option.id)} className={cn('group relative rounded-2xl border p-5 text-left transition', selected ? 'border-blue-400 bg-blue-50/70 ring-4 ring-blue-50' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100')}>
                      {selected && <span className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white"><Check className="h-4 w-4" /></span>}
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Option {String.fromCharCode(65 + index)} · {names[index] || 'Evidence-backed'}</div>
                      <div className="mt-2 pr-9 text-lg font-semibold text-slate-950">{option.title}</div>
                      <div className="mt-4 flex items-end gap-2"><span className="text-3xl font-semibold tracking-tight text-slate-950">{option.estimatedFit}%</span><span className="pb-1 text-xs text-slate-500">estimated fit</span></div>
                      <p className="mt-3 line-clamp-4 text-xs leading-5 text-slate-600">{option.resultingProduct}</p>
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Uses</div>
                        <div className="space-y-2">
                          {option.repos.slice(0, 4).map((repo) => (
                            <div key={repo.fullName} className="flex items-center justify-between gap-3 text-xs">
                              <span className="min-w-0 truncate font-medium text-slate-700">{repo.fullName}</span>
                              <span className="shrink-0 text-slate-400">{repo.healthScore}% health</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {strategize && (
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionTitle icon={BrainCircuit} eyebrow="Product direction" title="Choose the strategy the architecture should optimize for" text="This changes the product direction, while the foundation choice above controls which open-source components are allowed into the build." />
                <div className="grid gap-3 lg:grid-cols-3">
                  {strategize.strategies.map((strategy) => {
                    const selected = selectedStrategy === strategy.id
                    return (
                      <button key={strategy.id} onClick={() => setSelectedStrategy(strategy.id)} className={cn('rounded-2xl border p-4 text-left transition', selected ? 'border-violet-300 bg-violet-50 ring-4 ring-violet-50/70' : 'border-slate-200 hover:border-slate-300')}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-600">{strategy.id}</span>
                          {selected && <CheckCircle2 className="h-5 w-5 text-violet-600" />}
                        </div>
                        <div className="mt-2 font-semibold text-slate-950">{strategy.name}</div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{strategy.tagline || strategy.description || strategy.why}</p>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                  <button onClick={approve} disabled={approving || !selectedStrategy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50">
                    {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4 text-violet-600" />}
                    {approving ? 'Simulating architecture…' : 'Approve direction & simulate'}
                  </button>
                  <button onClick={autonomousBuild} disabled={building || !chosenComposition} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:opacity-50">
                    {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {building ? 'Building selected plan…' : 'Build selected product plan'}
                  </button>
                </div>
              </section>
            )}

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionTitle icon={CircleDollarSign} eyebrow="Business view" title="Commercial model" text="A starting hypothesis for selling the product. Replace modeled costs with real usage data before making pricing commitments." />
                <div className="mb-4 flex flex-wrap gap-2"><Pill>{report.commercialPlan.status}</Pill><Pill tone="blue">{report.commercialPlan.pricingConfidence}% pricing confidence</Pill></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {report.commercialPlan.tiers.map((tier) => (
                    <div key={tier.name} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="text-xs font-medium text-slate-500">{tier.name}</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{money(tier.monthlyPriceUsd)}<span className="text-xs font-normal text-slate-500"> /mo</span></div>
                      <div className="mt-3 text-xs leading-5 text-slate-500">Modeled margin <span className="font-semibold text-slate-700">{tier.modeledGrossMarginPct}%</span><br />Break-even <span className="font-semibold text-slate-700">{tier.modeledBreakEvenCustomers ?? 'n/a'}</span> customers</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionTitle icon={ShieldCheck} eyebrow="Trust & safety" title="What must pass before “verified”" text="AI recommendations are only a plan. A real release must pass executable checks." />
                <div className="space-y-2">
                  {report.accuracyContract.gates.slice(0, 6).map((gate, index) => (
                    <div key={gate.gate} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-500 shadow-sm">{index + 1}</span>
                      <div><div className="text-xs font-semibold text-slate-800">{gate.gate}</div><p className="mt-1 text-[11px] leading-5 text-slate-500">{gate.passCondition}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <details className="group rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Advanced evidence</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">Research sources and repository due diligence</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">For technical reviewers who want to inspect why the factory made its recommendation.</p>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-6 border-t border-slate-100 p-5 sm:p-6">
                <div>
                  <div className="flex flex-wrap gap-2">{report.sourceIntelligence.sourceCatalog?.map((source) => <Pill key={source.id}>{source.name} · {source.mode}</Pill>)}</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {report.sourceIntelligence.topSignals.slice(0, 9).map((signal, index) => (
                      <a key={`${signal.url}-${index}`} href={signal.url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50">
                        <div className="text-[10px] font-semibold text-blue-600">{signal.source} · relevance {score(signal.relevance)}%</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{signal.title}</div>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{signal.summary}</p>
                      </a>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><PackageSearch className="h-4 w-4 text-blue-600" /> Repository roles</div>
                  <div className="space-y-2">
                    {report.repoExplainers.slice(0, 10).map((repo) => (
                      <details key={repo.fullName} className="rounded-xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-mono text-xs font-semibold text-slate-800">{repo.fullName}</span>
                            <span className="text-[11px] text-slate-400">{repo.healthScore}% health · {repo.language} · {repo.license}</span>
                          </div>
                        </summary>
                        <p className="mt-3 text-xs leading-5 text-slate-500">{repo.description}</p>
                        <div className="mt-3"><Pill tone="blue">{repo.integrationMode}</Pill></div>
                        <p className="mt-2 text-xs leading-5 text-slate-600">{repo.integrationExplanation}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{repo.exactCombinationRole}</p>
                        <a href={repo.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600">Open repository <ExternalLink className="h-3 w-3" /></a>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            <details className="group rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Developer handoff</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">Implementation prompt for an IDE coding agent</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Use this only when you want a developer or coding agent to continue from the approved architecture.</p>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 p-5 sm:p-6">
                <button onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"><Clipboard className="h-4 w-4" /> Copy developer prompt</button>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-950 p-4 text-[11px] leading-5 text-slate-300">{report.idePrompt.slice(0, 7000)}</pre>
              </div>
            </details>

            {buildResult && (
              <section className={cn('rounded-[28px] border p-5 shadow-sm sm:p-6', buildResult.pipelineVerified ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70')}>
                <SectionTitle icon={Code2} eyebrow="Step 4 · Build result" title={buildResult.pipelineVerified ? 'Build pipeline verification passed' : 'Build completed with checks still open'} text={buildResult.pipelineVerified ? 'The selected repository composition stayed locked and the current pipeline verification succeeded.' : 'The pipeline ran, but the result should not be labeled fully verified until the remaining checks are resolved.'} />
                <div className="flex flex-wrap gap-2"><Pill tone={buildResult.pipelineVerified ? 'green' : 'amber'}>Status: {buildResult.status || 'unknown'}</Pill>{buildResult.buildId && <Pill>Build: {buildResult.buildId}</Pill>}{buildResult.outputPath && <Pill>Output: {buildResult.outputPath}</Pill>}</div>
                {buildResult.verification && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(buildResult.verification).filter(([, value]) => typeof value === 'boolean').map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-white/70 bg-white/70 p-3 text-xs shadow-sm"><span className={value ? 'font-bold text-emerald-600' : 'font-bold text-amber-600'}>{value ? 'PASS' : 'CHECK'}</span><span className="ml-2 text-slate-600">{key}</span></div>
                    ))}
                  </div>
                )}
                {buildResult.errors?.length ? <ul className="mt-4 space-y-1 text-xs text-amber-800">{buildResult.errors.map((item) => <li key={item}>• {item}</li>)}</ul> : null}
                {buildResult.note && <p className="mt-4 text-xs leading-5 text-slate-600">{buildResult.note}</p>}
              </section>
            )}
          </div>
        )}

        <footer className="py-8 text-center text-xs text-slate-400">AI Product Factory · Evidence before implementation · Human approval before locked build</footer>
      </div>
    </main>
  )
}
