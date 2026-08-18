'use client'

import { useMemo, useState } from 'react'
import type { FactoryManagerReport, FactoryPortfolio } from '@/lib/factory/manager'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clipboard,
  Code2,
  Cpu,
  ExternalLink,
  GitBranch,
  Github,
  Layers3,
  Loader2,
  Network,
  PackageCheck,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  WandSparkles,
  Workflow,
  XCircle,
} from 'lucide-react'

type StudioMode = 'new' | 'enhance'
type Phase = 'brief' | 'research' | 'decision' | 'architecture' | 'build' | 'export'

type Strategy = {
  id: string
  name: string
  tagline?: string
  description?: string
  why?: string
  feasibility?: number
  innovation_score?: number
  complexity?: string
  repository_map?: Record<string, string>
}

type StrategizeResponse = {
  success: boolean
  run_id: string
  graph: Record<string, unknown>
  strategies: Strategy[]
  review?: Record<string, unknown>
  tournament?: Record<string, unknown>
  error?: string
}

type ApproveResponse = {
  success: boolean
  run_id: string
  graph: Record<string, unknown>
  approved_strategy?: Strategy
  status?: string
  error?: string
}

type BuildResponse = {
  success?: boolean
  status?: string
  buildId?: string
  outputPath?: string
  generatedComponents?: unknown[]
  composedProducts?: unknown[]
  timeline?: Array<{ step: string; detail: string }>
  errors?: string[]
  error?: string
  [key: string]: unknown
}

const STEPS: Array<{ id: Phase; label: string; icon: typeof Search }> = [
  { id: 'brief', label: 'Define', icon: Sparkles },
  { id: 'research', label: 'Research', icon: Search },
  { id: 'decision', label: 'Decide', icon: BrainCircuit },
  { id: 'architecture', label: 'Architect', icon: Network },
  { id: 'build', label: 'Build', icon: Code2 },
  { id: 'export', label: 'Export', icon: SquareTerminal },
]

const EXAMPLES = [
  'Build a product-price intelligence agent that compares multiple shopping sites and recommends the lowest trustworthy selling price.',
  'Create an AI support automation that reads tickets, searches internal knowledge, drafts replies, escalates risky cases, and learns from resolved tickets.',
  'Enhance an existing CRM with autonomous lead research, personalized outreach drafts, follow-up scheduling, and manager approval gates.',
]

function phaseIndex(phase: Phase) {
  return STEPS.findIndex((step) => step.id === phase)
}

function percent(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

function compileIdea(mode: StudioMode, idea: string, existingProduct: string) {
  if (mode === 'new') return idea.trim()
  const reference = existingProduct.trim()
  return [
    'Enhance an existing product rather than designing a disconnected replacement.',
    reference ? `Existing product / repository / context: ${reference}` : '',
    `Enhancement goal: ${idea.trim()}`,
    'Preserve working behavior, identify extension points first, and prefer adapters or incremental modules over destructive rewrites.',
  ].filter(Boolean).join('\n')
}

function statusClass(decision: FactoryManagerReport['managerVerdict']['decision']) {
  if (decision === 'GO') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
  if (decision === 'GO_WITH_GUARDS') return 'border-amber-400/30 bg-amber-400/10 text-amber-100'
  return 'border-rose-400/30 bg-rose-400/10 text-rose-100'
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  const shown = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>{label}</span>
        <span className={danger && shown >= 55 ? 'text-amber-200' : 'text-slate-200'}>{shown}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={danger ? 'h-full rounded-full bg-amber-300' : 'h-full rounded-full bg-cyan-300'}
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  )
}

function PortfolioCard({
  portfolio,
  recommended,
}: {
  portfolio: FactoryPortfolio
  recommended: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${recommended ? 'border-cyan-300/35 bg-cyan-300/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{portfolio.title}</h3>
            {recommended && (
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                Manager pick
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">{portfolio.repoCount} open-source repo{portfolio.repoCount === 1 ? '' : 's'} composed behind clean interfaces</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold text-white">{portfolio.fitPercentage}%</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">estimated fit</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Metric label="Coverage" value={portfolio.coverage * 100} />
        <Metric label="Compatibility" value={portfolio.compatibility * 100} />
        <Metric label="Integration risk" value={portfolio.integrationRisk * 100} danger />
      </div>

      <div className="mt-4 space-y-2">
        {portfolio.repos.map((repo) => (
          <div key={repo.fullName} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Github className="h-4 w-4 text-slate-400" />
                <span className="truncate font-mono text-sm text-slate-100">{repo.fullName}</span>
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{repo.license}</span>
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{repo.language}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">{repo.roles.slice(0, 3).join(' · ') || 'Foundation / reference implementation'}</div>
            </div>
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-cyan-200 hover:text-cyan-100"
            >
              Open GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>

      {portfolio.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-100/90">
          <div className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Integration guards</div>
          {portfolio.warnings.slice(0, 3).map((warning) => <div key={warning}>• {warning}</div>)}
        </div>
      )}
    </div>
  )
}

export default function FactoryStudioPage() {
  const [mode, setMode] = useState<StudioMode>('new')
  const [idea, setIdea] = useState('')
  const [existingProduct, setExistingProduct] = useState('')
  const [phase, setPhase] = useState<Phase>('brief')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [strategize, setStrategize] = useState<StrategizeResponse | null>(null)
  const [manager, setManager] = useState<FactoryManagerReport | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState('')
  const [approved, setApproved] = useState<ApproveResponse | null>(null)
  const [build, setBuild] = useState<BuildResponse | null>(null)
  const [autoBuild, setAutoBuild] = useState(true)
  const [copied, setCopied] = useState(false)

  const compiledIdea = useMemo(() => compileIdea(mode, idea, existingProduct), [mode, idea, existingProduct])
  const activeIndex = phaseIndex(phase)
  const strategies = strategize?.strategies || []

  async function managerReport(graph: Record<string, unknown>, runId: string) {
    const response = await fetch('/api/factory/manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: compiledIdea, runId, graph }),
    })
    const data = await response.json()
    if (!response.ok || !data.success) throw new Error(data.error || 'Manager synthesis failed')
    return data.report as FactoryManagerReport
  }

  async function analyze() {
    if (!idea.trim()) {
      setError('Describe what you want the product to do first.')
      return
    }
    setBusy(true)
    setError('')
    setStrategize(null)
    setApproved(null)
    setBuild(null)
    setManager(null)
    setSelectedStrategy('')
    setPhase('research')

    try {
      const response = await fetch('/api/factory/pi/strategize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: compiledIdea }),
      })
      const data = await response.json() as StrategizeResponse
      if (!response.ok || !data.success) throw new Error(data.error || 'Product intelligence research failed')
      setStrategize(data)

      const report = await managerReport(data.graph, data.run_id)
      setManager(report)
      const strategyId = report.recommendedStrategy?.id
      const validManagerPick = data.strategies.some((strategy) => strategy.id === strategyId)
      setSelectedStrategy(validManagerPick && strategyId ? strategyId : data.strategies[0]?.id || '')
      setPhase('decision')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Research failed')
      setPhase('brief')
    } finally {
      setBusy(false)
    }
  }

  async function runAutonomousBuild() {
    setPhase('build')
    const maxRepos = manager?.recommendedPortfolio?.repoCount || 3
    const response = await fetch('/api/factory/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: compiledIdea, maxRepos, mode: 'full', outputFormat: 'pipeline' }),
    })
    const data = await response.json() as BuildResponse
    setBuild(data)
    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.errors?.[0] || 'Autonomous build failed')
    }
    setPhase('export')
  }

  async function approveAndArchitect() {
    if (!strategize?.run_id || !selectedStrategy) {
      setError('Choose a strategy before approval.')
      return
    }
    setBusy(true)
    setError('')
    setPhase('architecture')
    try {
      const response = await fetch('/api/factory/pi/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: strategize.run_id, strategyId: selectedStrategy }),
      })
      const data = await response.json() as ApproveResponse
      if (!response.ok || !data.success) throw new Error(data.error || 'Architecture approval failed')
      setApproved(data)

      const report = await managerReport(data.graph, data.run_id)
      setManager(report)

      if (autoBuild) {
        await runAutonomousBuild()
      } else {
        setPhase('export')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approval/build failed')
      setPhase('decision')
    } finally {
      setBusy(false)
    }
  }

  async function copyPrompt() {
    if (!manager?.idePrompt) return
    await navigator.clipboard.writeText(manager.idePrompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="min-h-screen bg-[#070a10] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[48rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-18rem] right-[-8rem] h-[32rem] w-[32rem] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
              <WandSparkles className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-white">AI Product Factory Studio</h1>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">v7 manager flow</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">Research → compose open source → decide → architect → build → export</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06]">Classic dashboard</a>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-200">
              <CircleDot className="h-3.5 w-3.5" /> Manager-first orchestration
            </span>
          </div>
        </header>

        <section className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025] p-2">
          <div className="flex min-w-[720px] items-center">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const active = index === activeIndex
              const complete = index < activeIndex
              return (
                <div key={step.id} className="flex min-w-0 flex-1 items-center">
                  <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 ${active ? 'bg-cyan-300/10 text-cyan-100' : complete ? 'text-emerald-200' : 'text-slate-500'}`}>
                    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${active ? 'border-cyan-300/30 bg-cyan-300/10' : complete ? 'border-emerald-300/20 bg-emerald-300/10' : 'border-white/10 bg-white/[0.025]'}`}>
                      {complete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="truncate text-xs font-medium"><span className="mr-1 text-[10px] opacity-50">0{index + 1}</span>{step.label}</div>
                  </div>
                  {index < STEPS.length - 1 && <ChevronRight className="mx-0.5 h-4 w-4 shrink-0 text-white/10" />}
                </div>
              )
            })}
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Product brief</div>
                  <h2 className="mt-1 text-xl font-semibold text-white">What should we create?</h2>
                </div>
                <Rocket className="h-5 w-5 text-slate-500" />
              </div>

              <div className="mt-4 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
                {(['new', 'enhance'] as StudioMode[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setMode(item)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${mode === item ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {item === 'new' ? 'New product' : 'Enhance existing'}
                  </button>
                ))}
              </div>

              {mode === 'enhance' && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Existing product / GitHub URL / stack</label>
                  <input
                    value={existingProduct}
                    onChange={(event) => setExistingProduct(event.target.value)}
                    placeholder="https://github.com/org/project or product context"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30"
                  />
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Goal and must-have behavior</label>
                <textarea
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  rows={8}
                  placeholder="Example: Compare the same product across marketplaces, normalize seller/shipping data, detect suspicious listings, and recommend the lowest trustworthy final price..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {EXAMPLES.map((example, index) => (
                  <button
                    key={example}
                    onClick={() => setIdea(example)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                  >
                    Example {index + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={analyze}
                disabled={busy || !idea.trim()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy && phase === 'research' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                Research & design product
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-slate-500">
                The engine searches GitHub per capability, ranks current candidates, runs agent debates and a strategy tournament, then the manager scores 1–3-repo compositions. Percentages are estimates, not guarantees.
              </div>
            </section>

            {manager && (
              <section className={`rounded-2xl border p-4 ${statusClass(manager.managerVerdict.decision)}`}>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em]">Final manager</div>
                    <div className="mt-1 text-lg font-semibold">{manager.managerVerdict.decision.replaceAll('_', ' ')}</div>
                    <p className="mt-1 text-xs leading-5 opacity-80">{manager.managerVerdict.summary}</p>
                    <div className="mt-3 flex gap-3 text-xs">
                      <span>Feasibility <b>{manager.managerVerdict.estimatedFeasibility}%</b></span>
                      <span>Confidence <b>{manager.managerVerdict.confidence}%</b></span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </aside>

          <section className="min-w-0 space-y-5">
            {!strategize && !busy && (
              <div className="grid min-h-[620px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <div className="max-w-xl">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/[0.035]">
                    <Workflow className="h-7 w-7 text-cyan-200" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-white">One brief becomes an evidence-backed build plan</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    The Studio exposes the factory as a clear sequence instead of a giant dashboard: understand the request, research open source, compare repository combinations, make a manager decision, generate architecture, run the build agent, then export an IDE-ready prompt.
                  </p>
                  <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                    {[
                      [Search, 'Live GitHub research', 'Capability-specific repository search and explainable ranking.'],
                      [Layers3, 'Composition', 'Pick one foundation or combine two/three only when coverage justifies it.'],
                      [Bot, 'Manager gate', 'A final deterministic manager checks feasibility, risk, licenses and confidence.'],
                    ].map(([Icon, title, description]) => {
                      const ItemIcon = Icon as typeof Search
                      return (
                        <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                          <ItemIcon className="h-4 w-4 text-slate-400" />
                          <div className="mt-3 text-sm font-medium text-slate-200">{String(title)}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {busy && phase === 'research' && (
              <div className="grid min-h-[620px] place-items-center rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-center">
                <div>
                  <div className="relative mx-auto h-20 w-20">
                    <div className="absolute inset-0 rounded-full border border-cyan-300/20" />
                    <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-cyan-200" />
                    <BrainCircuit className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-cyan-200" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-white">Multi-agent research is running</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Product thinking, requirements, market, competitors, capabilities, GitHub discovery, repository intelligence, debates, tournament, review and self-critique are building one shared knowledge graph.</p>
                </div>
              </div>
            )}

            {strategize && manager && (
              <>
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"><GitBranch className="h-3.5 w-3.5" /> Run {strategize.run_id}</div>
                      <h2 className="mt-2 text-xl font-semibold text-white">Manager-ranked open-source compositions</h2>
                      <p className="mt-1 text-sm text-slate-500">Up to three practical ways to build the product, scored for capability coverage, repo quality, licenses, maintenance, compatibility and integration risk.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                      <Github className="h-4 w-4" /> {manager.recommendedPortfolio?.repos.length || 0} repo manager pick
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 2xl:grid-cols-3">
                    {manager.portfolioRecommendations.map((portfolio, index) => (
                      <PortfolioCard key={portfolio.id} portfolio={portfolio} recommended={index === 0} />
                    ))}
                  </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-violet-200" />
                      <h2 className="font-semibold text-white">Strategy tournament</h2>
                    </div>
                    <div className="mt-4 space-y-3">
                      {strategies.map((strategy) => {
                        const selected = selectedStrategy === strategy.id
                        const managerPick = manager.recommendedStrategy?.id === strategy.id
                        return (
                          <button
                            key={strategy.id}
                            onClick={() => setSelectedStrategy(strategy.id)}
                            className={`w-full rounded-2xl border p-4 text-left transition ${selected ? 'border-violet-300/35 bg-violet-300/[0.07]' : 'border-white/10 bg-black/20 hover:bg-white/[0.04]'}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs text-slate-500">{strategy.id}</span>
                                  <span className="font-semibold text-white">{strategy.name}</span>
                                  {managerPick && <span className="rounded-full bg-violet-300/10 px-2 py-0.5 text-[10px] text-violet-200">manager strategy</span>}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{strategy.tagline || strategy.description || strategy.why}</p>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                {strategy.feasibility !== undefined && <span>Feasibility {percent(strategy.feasibility)}%</span>}
                                {selected && <CheckCircle2 className="h-4 w-4 text-violet-200" />}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-cyan-200" /><h2 className="font-semibold text-white">Factory build flow</h2></div>
                    <div className="mt-4 space-y-2">
                      {manager.buildFlow.map((item) => (
                        <div key={item.step} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-slate-300">{item.step}</div>
                          <div>
                            <div className="text-sm font-medium text-slate-200">{item.name} <span className="ml-1 text-[10px] font-normal text-slate-600">{item.owner}</span></div>
                            <div className="mt-0.5 text-xs text-slate-500">{item.output}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2"><Network className="h-4 w-4 text-emerald-200" /><h2 className="font-semibold text-white">Approval → architecture → autonomous build</h2></div>
                      <p className="mt-1 text-sm text-slate-500">Approve the selected strategy. The existing architecture simulator and engineering agents run next; optionally the current full build route runs immediately afterward.</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                      <input type="checkbox" checked={autoBuild} onChange={(event) => setAutoBuild(event.target.checked)} className="accent-cyan-300" />
                      Auto-build after approval
                    </label>
                  </div>
                  <button
                    onClick={approveAndArchitect}
                    disabled={busy || !selectedStrategy}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-200 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-100 disabled:opacity-40"
                  >
                    {busy && phase !== 'research' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                    Approve strategy & continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </section>
              </>
            )}

            {approved && manager && (
              <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.035] p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">Architecture approved</div>
                    <h2 className="mt-1 text-xl font-semibold text-white">{manager.architecturePreview.style}</h2>
                    <p className="mt-1 text-sm text-slate-400">Deployment: {manager.architecturePreview.deployment}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {manager.architecturePreview.components.map((component) => (
                        <span key={component} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-slate-300">{component}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {build && (
              <section className={`rounded-3xl border p-5 ${build.success === false ? 'border-rose-300/20 bg-rose-300/[0.04]' : 'border-cyan-300/20 bg-cyan-300/[0.04]'}`}>
                <div className="flex items-start gap-3">
                  {build.success === false ? <XCircle className="mt-0.5 h-5 w-5 text-rose-200" /> : <Rocket className="mt-0.5 h-5 w-5 text-cyan-200" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Autonomous build</div>
                    <h2 className="mt-1 text-xl font-semibold text-white">{build.success === false ? 'Build needs attention' : 'Build pipeline completed'}</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Build ID</div><div className="mt-1 truncate font-mono text-xs text-slate-300">{build.buildId || '—'}</div></div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Components</div><div className="mt-1 text-sm text-slate-300">{build.generatedComponents?.length || 0}</div></div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Output</div><div className="mt-1 truncate font-mono text-xs text-slate-300">{String(build.outputPath || 'See build response')}</div></div>
                    </div>
                    {(build.errors?.length || build.error) && <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.05] p-3 text-xs text-rose-100">{build.error || build.errors?.join(' · ')}</div>}
                  </div>
                </div>
              </section>
            )}

            {manager && (phase === 'export' || approved) && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2"><SquareTerminal className="h-4 w-4 text-cyan-200" /><h2 className="font-semibold text-white">IDE-ready implementation prompt</h2></div>
                    <p className="mt-1 text-sm text-slate-500">Copy this into Cursor, VS Code/Codex, Claude Code, Windsurf, Trae or another coding agent. It includes the chosen GitHub links, roles, source-license rules, build flow and quality gates.</p>
                  </div>
                  <button onClick={copyPrompt} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.08]">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-200" /> : <Clipboard className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy prompt'}
                  </button>
                </div>
                <pre className="mt-4 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/35 p-4 font-mono text-[11px] leading-5 text-slate-300">{manager.idePrompt}</pre>
              </section>
            )}
          </section>
        </div>

        {error && (
          <div className="fixed bottom-5 right-5 z-50 max-w-lg rounded-2xl border border-rose-300/25 bg-[#181015]/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
              <div className="flex-1 text-sm text-rose-100">{error}</div>
              <button onClick={() => setError('')} className="text-slate-500 hover:text-white"><XCircle className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
