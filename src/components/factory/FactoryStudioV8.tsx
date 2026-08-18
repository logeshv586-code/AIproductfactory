'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, Bot, BrainCircuit, CheckCircle2,
  CircleDollarSign, Clipboard, Code2, ExternalLink, Github, Layers3, Loader2,
  Network, PackageSearch, RefreshCw, Rocket, Search, ShieldCheck, Sparkles,
  SquareTerminal, Workflow, Zap,
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

const EXAMPLES = [
  'Build a product-price intelligence agent that compares shopping sites, verifies sellers, tracks price history and recommends the lowest trustworthy selling price.',
  'Create an AI automation that researches a company, finds relevant prospects, drafts personalized outreach and requires manager approval before sending.',
  'Build a local-first AI video generation product using open-source models with a simple prompt-to-video workflow and optimized low-memory execution.',
]

function score(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.round(value <= 1 ? value * 100 : value)
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function SectionTitle({ icon: Icon, eyebrow, title, text }: { icon: any; eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-200"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        {text && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{text}</p>}
      </div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">{children}</span>
}

function Metric({ label, value, suffix = '%' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}{suffix}</div>
    </div>
  )
}

export default function FactoryStudioV8() {
  const [mode, setMode] = useState<'new' | 'enhance'>('new')
  const [idea, setIdea] = useState(EXAMPLES[0])
  const [existingContext, setExistingContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [building, setBuilding] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState('')
  const [strategize, setStrategize] = useState<StrategizeResponse | null>(null)
  const [liveResearch, setLiveResearch] = useState<LiveResearch | null>(null)
  const [report, setReport] = useState<FactoryManagerV8Report | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState('')
  const [buildResult, setBuildResult] = useState<Record<string, any> | null>(null)

  const compiledIdea = useMemo(() => {
    if (mode === 'new') return idea.trim()
    return [
      'Enhance an existing product. Preserve working behavior and use incremental adapters/modules instead of destructive rewrites.',
      existingContext.trim() ? `Existing product/repository/context: ${existingContext.trim()}` : '',
      `Enhancement goal: ${idea.trim()}`,
    ].filter(Boolean).join('\n')
  }, [mode, idea, existingContext])

  async function post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok || data?.success === false) throw new Error(data?.error || `Request failed: ${response.status}`)
    return data as T
  }

  async function analyze() {
    if (!compiledIdea) return
    setLoading(true); setError(''); setBuildResult(null)
    try {
      setStatus('Multi-agent reasoning: intent, market, innovation, capabilities, GitHub and strategy tournament…')
      const strategyData = await post<StrategizeResponse>('/api/factory/pi/strategize', { idea: compiledIdea })
      setStrategize(strategyData)
      const repoNames = Array.isArray(strategyData.graph?.repos)
        ? strategyData.graph.repos.map((repo: any) => repo?.full_name).filter(Boolean).slice(0, 8)
        : []

      setStatus('Live research: GitLab, Hugging Face, developer news, Stack Overflow, arXiv, releases and pricing signals…')
      const research = await post<LiveResearch>('/api/factory/research/live', { idea: compiledIdea, repos: repoNames })
      setLiveResearch(research)

      setStatus('Final Manager: explaining repositories, comparing compositions, commercial modeling and verification gates…')
      const manager = await post<{ success: true; report: FactoryManagerV8Report }>('/api/factory/manager', {
        idea: compiledIdea, runId: strategyData.run_id, graph: strategyData.graph, liveResearch: research,
      })
      setReport(manager.report)
      setSelectedStrategy(manager.report.recommendedStrategy?.id || strategyData.strategies?.[0]?.id || '')
      setStatus('Analysis complete — review evidence, composition and pricing before approval.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Factory analysis failed')
      setStatus('Analysis failed')
    } finally { setLoading(false) }
  }

  async function approve() {
    if (!strategize?.run_id || !selectedStrategy) return
    setApproving(true); setError('')
    try {
      setStatus('Engineering agents are composing the approved architecture and simulating it…')
      const approved = await post<ApproveResponse>('/api/factory/pi/approve', { runId: strategize.run_id, strategyId: selectedStrategy })
      const manager = await post<{ success: true; report: FactoryManagerV8Report }>('/api/factory/manager', {
        idea: compiledIdea, runId: strategize.run_id, graph: approved.graph, liveResearch,
      })
      setReport(manager.report)
      setStatus('Strategy approved and architecture re-evaluated with simulation evidence.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally { setApproving(false) }
  }

  async function autonomousBuild() {
    setBuilding(true); setError('')
    try {
      setStatus('Autonomous build pipeline is generating and validating a runnable implementation…')
      const data = await post<Record<string, any>>('/api/factory/build', { idea: compiledIdea, mode: 'full', maxRepos: 3, outputFormat: 'pipeline' })
      setBuildResult(data)
      setStatus('Build pipeline returned. Inspect its validation output before release.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build failed')
    } finally { setBuilding(false) }
  }

  async function copyPrompt() {
    if (!report?.idePrompt) return
    await navigator.clipboard.writeText(report.idePrompt)
    setStatus('Implementation prompt copied — paste it into your IDE agent.')
  }

  const verdictClass = report?.managerVerdict.decision === 'GO'
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
    : report?.managerVerdict.decision === 'GO_WITH_GUARDS'
      ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
      : 'border-rose-400/25 bg-rose-400/10 text-rose-100'

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-200">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.10),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(99,102,241,0.10),transparent_28%)]" />
      <div className="relative mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300"><Sparkles className="h-4 w-4" /> AI Product Factory v8</div>
            <h1 className="mt-3 max-w-5xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">Research what exists. Explain why. Compose what is missing. Build the innovation layer.</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">The Factory now separates evidence from estimates: current source research, repository due diligence, three composition paths, architecture, pricing hypotheses and executable verification gates.</p>
          </div>
          <a href="https://github.com/logeshv586-code/AIproductfactory" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm hover:bg-white/[0.07]"><Github className="h-4 w-4" /> Source repository <ExternalLink className="h-3.5 w-3.5" /></a>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setMode('new')} className={`rounded-xl px-4 py-2 text-sm ${mode === 'new' ? 'bg-cyan-300 text-slate-950' : 'border border-white/10 bg-white/[0.03]'}`}>New product</button>
            <button onClick={() => setMode('enhance')} className={`rounded-xl px-4 py-2 text-sm ${mode === 'enhance' ? 'bg-cyan-300 text-slate-950' : 'border border-white/10 bg-white/[0.03]'}`}>Enhance existing</button>
          </div>
          {mode === 'enhance' && <input value={existingContext} onChange={(e) => setExistingContext(e.target.value)} placeholder="Existing GitHub URL, product name, architecture or context" className="mb-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />}
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm leading-6 text-slate-100 outline-none focus:border-cyan-300/40" />
          <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map((example, i) => <button key={example} onClick={() => setIdea(example)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white">Example {i + 1}</button>)}</div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">{loading || approving || building ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}{status}</div>
            <button onClick={analyze} disabled={loading || !compiledIdea} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Research & design product <ArrowRight className="h-4 w-4" /></button>
          </div>
          {error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
        </section>

        {report && (
          <div className="mt-8 space-y-8">
            <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <div className={`rounded-3xl border p-6 ${verdictClass}`}>
                <div className="text-xs font-semibold uppercase tracking-[0.18em]">Final manager verdict</div>
                <div className="mt-2 flex flex-wrap items-baseline gap-3"><div className="text-3xl font-semibold">{report.managerVerdict.decision.replaceAll('_', ' ')}</div><Pill>{report.managerVerdict.confidence}% manager confidence</Pill></div>
                <p className="mt-4 text-sm leading-6 opacity-90">{report.managerVerdict.summary}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Feasibility" value={report.managerVerdict.estimatedFeasibility} /><Metric label="Manager confidence" value={report.managerVerdict.confidence} /><Metric label="Live signals" value={report.sourceIntelligence.signalCount} suffix="" /><Metric label="Source families" value={report.sourceIntelligence.sourcesWithResults} suffix="" /></div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-white"><BadgeCheck className="h-5 w-5 text-cyan-300" /> Accuracy contract</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{report.accuracyContract.promise}</p>
                <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs leading-5 text-slate-300">{report.accuracyContract.releaseRule}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <SectionTitle icon={Zap} eyebrow="Current intelligence" title="Live sources and recent signals" text="GitHub remains the core code source, but the final manager now receives evidence from multiple developer, model, research and market sources." />
              <div className="flex flex-wrap gap-2">{report.sourceIntelligence.sourceCatalog?.map((source) => <Pill key={source.id}>{source.name} · {source.mode}</Pill>)}</div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {report.sourceIntelligence.topSignals.slice(0, 12).map((signal, index) => (
                  <a key={`${signal.url}-${index}`} href={signal.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 hover:border-cyan-300/25">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500"><span>{signal.source} · {signal.kind}</span><span>{score(signal.relevance)}%</span></div>
                    <div className="mt-2 font-medium text-slate-100">{signal.title}</div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{signal.summary}</p>
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <SectionTitle icon={PackageSearch} eyebrow="Repository intelligence" title="What each collected repository can actually contribute" text="Every repository is treated as one replaceable component. The Factory explains its capability, evidence, likely integration boundary and what still must be built by your product." />
              <div className="space-y-4">
                {report.repoExplainers.slice(0, 12).map((repo, index) => (
                  <details key={repo.fullName} open={index < 3} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Github className="h-4 w-4 text-slate-400" /><span className="font-mono text-sm text-white">{repo.fullName}</span><Pill>{repo.language}</Pill><Pill>{repo.license}</Pill></div><p className="mt-2 text-xs leading-5 text-slate-400">{repo.description}</p></div>
                        <div className="text-right"><div className="text-2xl font-semibold text-white">{repo.healthScore}%</div><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">health signal</div></div>
                      </div>
                    </summary>
                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">What it does</div><ul className="mt-2 space-y-2 text-xs leading-5 text-slate-300">{repo.whatItCanDo.map((x) => <li key={x}>• {x}</li>)}</ul></div>
                      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">How to integrate</div><div className="mt-2 text-sm font-medium text-white">{repo.integrationMode}</div><p className="mt-2 text-xs leading-5 text-slate-400">{repo.integrationExplanation}</p></div>
                      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Exact role in the product</div><p className="mt-2 text-xs leading-5 text-slate-300">{repo.exactCombinationRole}</p></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">{repo.capabilities.map((cap) => <Pill key={cap}>{cap}</Pill>)}</div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2"><div><div className="text-xs font-medium text-emerald-200">Strengths</div><ul className="mt-2 space-y-1 text-xs text-slate-400">{repo.strengths.map((x) => <li key={x}>+ {x}</li>)}</ul></div><div><div className="text-xs font-medium text-amber-200">Weaknesses / checks</div><ul className="mt-2 space-y-1 text-xs text-slate-400">{repo.weaknesses.map((x) => <li key={x}>− {x}</li>)}</ul></div></div>
                    <div className="mt-4 flex flex-wrap gap-3"><a href={repo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300">Open repository <ExternalLink className="h-3 w-3" /></a>{typeof repo.evidence?.deps_dev === 'string' && repo.evidence.deps_dev && <a href={repo.evidence.deps_dev} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300">deps.dev evidence <ExternalLink className="h-3 w-3" /></a>}</div>
                  </details>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <SectionTitle icon={Layers3} eyebrow="Composition intelligence" title="Three ways to turn open source into one sellable product" text="Combine means stable boundaries and orchestration—not copying repositories into one folder. Option C deliberately seeks a different source set when evidence permits." />
              <div className="grid gap-5 xl:grid-cols-3">
                {report.compositionSuggestions.map((option, index) => (
                  <article key={option.id} className={`rounded-2xl border p-5 ${index === 0 ? 'border-cyan-300/30 bg-cyan-300/[0.06]' : 'border-white/10 bg-slate-950/35'}`}>
                    <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300">Option {String.fromCharCode(65 + index)} · {option.type}</div><h3 className="mt-1 text-lg font-semibold text-white">{option.title}</h3></div><div className="text-right"><div className="text-3xl font-semibold text-white">{option.estimatedFit}%</div><div className="text-[9px] uppercase tracking-[0.13em] text-slate-500">estimated fit</div></div></div>
                    <div className="mt-4 space-y-2">{option.repos.map((repo) => <a key={repo.fullName} href={repo.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"><span className="truncate font-mono text-slate-200">{repo.fullName}</span><ExternalLink className="h-3 w-3 text-slate-500" /></a>)}</div>
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-[0.13em] text-slate-500">Combination pattern</div><div className="mt-1 text-sm text-slate-200">{option.combinationPattern}</div></div>
                    <div className="mt-4 text-xs font-medium text-white">What product comes from this?</div><p className="mt-2 text-xs leading-5 text-slate-400">{option.resultingProduct}</p>
                    <div className="mt-4 text-xs font-medium text-white">Runtime flow</div><ol className="mt-2 space-y-2 text-xs leading-5 text-slate-400">{option.dataFlow.map((step, i) => <li key={step}>{i + 1}. {step}</li>)}</ol>
                    <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-xs font-medium text-slate-200">Build steps, custom code & gates</summary><div className="mt-3 text-[11px] font-medium text-cyan-300">Product-owned code</div><ul className="mt-2 space-y-1 text-xs text-slate-400">{option.customCodeNeeded.map((x) => <li key={x}>• {x}</li>)}</ul><div className="mt-3 text-[11px] font-medium text-cyan-300">Validation gates</div><ul className="mt-2 space-y-1 text-xs text-slate-400">{option.validationGates.map((x) => <li key={x}>• {x}</li>)}</ul></details>
                  </article>
                ))}
              </div>
            </section>

            {strategize && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                <SectionTitle icon={BrainCircuit} eyebrow="Strategy tournament" title="Choose the product direction before engineering" />
                <div className="grid gap-3 lg:grid-cols-3">{strategize.strategies.map((strategy) => <button key={strategy.id} onClick={() => setSelectedStrategy(strategy.id)} className={`rounded-2xl border p-4 text-left ${selectedStrategy === strategy.id ? 'border-cyan-300/40 bg-cyan-300/[0.07]' : 'border-white/10 bg-slate-950/40'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-cyan-300">{strategy.id}</span><Pill>{strategy.complexity || 'balanced'}</Pill></div><div className="mt-2 font-semibold text-white">{strategy.name}</div><p className="mt-2 text-xs leading-5 text-slate-400">{strategy.tagline || strategy.description || strategy.why}</p><div className="mt-3 flex gap-2"><Pill>Feasibility {score(strategy.feasibility)}%</Pill><Pill>Innovation {score(strategy.innovation_score)}%</Pill></div></button>)}</div>
                <div className="mt-4 flex flex-wrap gap-3"><button onClick={approve} disabled={approving || !selectedStrategy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />} Approve & generate architecture</button><button onClick={autonomousBuild} disabled={building} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm disabled:opacity-50">{building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Run autonomous build</button></div>
              </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <SectionTitle icon={CircleDollarSign} eyebrow="Commercial intelligence" title="Suggested selling price and modeled profitability" text="These are decision-support scenarios. The Factory must replace modeled costs with measured compute/token/storage/support costs after the first runnable build." />
              <div className="mb-4 flex flex-wrap items-center gap-2"><Pill>{report.commercialPlan.status}</Pill><Pill>{report.commercialPlan.pricingConfidence}% pricing confidence</Pill><Pill>{report.commercialPlan.evidence.length} numeric price evidence items</Pill></div>
              <div className="grid gap-4 lg:grid-cols-3">{report.commercialPlan.tiers.map((tier) => <div key={tier.name} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><div className="text-xs uppercase tracking-[0.14em] text-slate-500">{tier.name}</div><div className="mt-2 text-3xl font-semibold text-white">{fmtMoney(tier.monthlyPriceUsd)}<span className="text-sm font-normal text-slate-500"> /mo</span></div><p className="mt-2 text-xs text-slate-400">{tier.bestFor}</p><div className="mt-4 space-y-1 text-xs text-slate-400"><div>Annual: <span className="text-slate-200">{fmtMoney(tier.annualPriceUsd)}</span></div><div>Modeled COGS/customer: <span className="text-slate-200">{fmtMoney(tier.modeledCogsPerCustomerUsd)}</span></div><div>Modeled gross margin: <span className="text-slate-200">{tier.modeledGrossMarginPct}%</span></div><div>Modeled break-even: <span className="text-slate-200">{tier.modeledBreakEvenCustomers ?? 'not positive'} customers</span></div></div></div>)}</div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><div className="text-sm font-semibold text-white">Implementation / white-label sale</div><div className="mt-2 text-2xl font-semibold text-cyan-200">{fmtMoney(report.commercialPlan.implementationSaleRangeUsd.low)} – {fmtMoney(report.commercialPlan.implementationSaleRangeUsd.high)}</div><p className="mt-2 text-xs text-slate-400">Use for custom integration, deployment, migration or white-label services—not as a guaranteed market value.</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><div className="text-sm font-semibold text-white">Modeled scenarios</div>{report.commercialPlan.scenarios.map((s) => <div key={s.name} className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><div className="text-slate-500">{s.name}</div><div className="mt-1 text-slate-200">{fmtMoney(s.monthlyRevenueUsd)}</div></div><div><div className="text-slate-500">Cost</div><div className="mt-1 text-slate-200">{fmtMoney(s.modeledMonthlyCostUsd)}</div></div><div><div className="text-slate-500">Contribution</div><div className={`mt-1 ${s.modeledContributionUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtMoney(s.modeledContributionUsd)}</div></div></div>)}</div></div>
              <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100"><AlertTriangle className="mr-2 inline h-4 w-4" />{report.commercialPlan.warning}</div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"><SectionTitle icon={ShieldCheck} eyebrow="Release verification" title="The gates required before the Factory can call a build verified" /><div className="grid gap-3 sm:grid-cols-2">{report.accuracyContract.gates.map((gate) => <div key={gate.gate} className="rounded-xl border border-white/10 bg-slate-950/40 p-3"><div className="text-sm font-medium text-white">{gate.gate}</div><p className="mt-1 text-xs leading-5 text-slate-400">{gate.passCondition}</p></div>)}</div></div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"><SectionTitle icon={SquareTerminal} eyebrow="IDE handoff" title="Use the same factory plan in any coding agent" text="The prompt contains the selected open-source boundaries, source policy, architecture and validation gates." /><button onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950"><Clipboard className="h-4 w-4" /> Copy implementation prompt</button><pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-slate-400">{report.idePrompt.slice(0, 5000)}</pre></div>
            </section>

            {buildResult && <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.05] p-6"><SectionTitle icon={Code2} eyebrow="Autonomous build output" title={buildResult.success === false ? 'Build returned errors' : 'Build pipeline completed'} /><div className="flex flex-wrap gap-2"><Pill>Status: {String(buildResult.status || 'unknown')}</Pill>{buildResult.buildId && <Pill>Build: {String(buildResult.buildId)}</Pill>}{buildResult.outputPath && <Pill>Output: {String(buildResult.outputPath)}</Pill>}</div>{Array.isArray(buildResult.errors) && buildResult.errors.length > 0 && <ul className="mt-4 space-y-1 text-xs text-rose-200">{buildResult.errors.map((x: string) => <li key={x}>• {x}</li>)}</ul>}</section>}
          </div>
        )}
      </div>
    </main>
  )
}
