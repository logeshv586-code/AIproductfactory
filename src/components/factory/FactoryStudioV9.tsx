'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BadgeCheck, BrainCircuit, CheckCircle2, CircleDollarSign,
  Clipboard, Code2, ExternalLink, Github, Layers3, Loader2, Network, PackageSearch,
  Rocket, Search, ShieldCheck, Sparkles, SquareTerminal, Zap,
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
  'Build a product-price intelligence agent that compares shopping sites, verifies sellers, tracks price history and recommends the lowest trustworthy selling price.',
  'Create an AI automation that researches a company, finds relevant prospects, drafts personalized outreach and requires manager approval before sending.',
  'Build a local-first AI video generation product using open-source models with a simple prompt-to-video workflow and optimized low-memory execution.',
]

function score(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.round(value <= 1 ? value * 100 : value)
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">{children}</span>
}

function SectionTitle({ icon: Icon, eyebrow, title, text }: { icon: any; eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-200"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        {text && <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">{text}</p>}
      </div>
    </div>
  )
}

export default function FactoryStudioV9() {
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
      setStatus('Running product reasoning, market intelligence, innovation analysis and GitHub discovery…')
      const strategyData = await post<StrategizeResponse>('/api/factory/pi/strategize', { idea: compiledIdea })
      setStrategize(strategyData)

      const repoNames = Array.isArray(strategyData.graph?.repos)
        ? strategyData.graph.repos.map((repo: any) => repo?.full_name).filter(Boolean).slice(0, 8)
        : []
      setStatus('Collecting current GitLab, Hugging Face, developer-news, Stack Overflow, arXiv, release and pricing evidence…')
      const research = await post<LiveResearch>('/api/factory/research/live', { idea: compiledIdea, repos: repoNames })
      setLiveResearch(research)

      setStatus('Final Manager is explaining repositories, composition paths, commercial assumptions and verification gates…')
      const manager = await post<{ success: true; report: FactoryManagerV8Report }>('/api/factory/manager', {
        idea: compiledIdea,
        runId: strategyData.run_id,
        graph: strategyData.graph,
        liveResearch: research,
      })
      setReport(manager.report)
      setSelectedStrategy(manager.report.recommendedStrategy?.id || strategyData.strategies?.[0]?.id || '')
      setSelectedComposition(manager.report.compositionSuggestions?.[0]?.id || '')
      setStatus('Analysis complete. Choose a composition and strategy before build.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Factory analysis failed')
      setStatus('Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    if (!strategize?.run_id || !selectedStrategy) return
    setApproving(true)
    setError('')
    try {
      setStatus('Composing the approved architecture and running architecture simulation…')
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
      setStatus('Strategy approved. Final architecture and composition have been re-evaluated.')
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
      setError('Choose a repository composition before building.')
      return
    }

    setBuilding(true)
    setError('')
    setBuildResult(null)
    try {
      setStatus(`Building with the locked ${composition.title} repository set…`)
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
        ? 'Approved repository lock and Python product-composition pipeline verified.'
        : 'Pipeline completed, but one or more verification gates still need attention.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approved-composition build failed')
      setStatus('Build failed')
    } finally {
      setBuilding(false)
    }
  }

  async function copyPrompt() {
    if (!report?.idePrompt) return
    await navigator.clipboard.writeText(report.idePrompt)
    setStatus('Implementation prompt copied.')
  }

  const chosenComposition = report?.compositionSuggestions.find((item) => item.id === selectedComposition) || report?.compositionSuggestions?.[0]

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-200">
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300"><Sparkles className="h-4 w-4" /> AI Product Factory v9 flow verification</div>
            <h1 className="mt-3 max-w-5xl text-3xl font-semibold text-white sm:text-5xl">Research → decide → lock repos → architect → build → verify.</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">Autonomous Build now receives the exact composition selected by the Final Manager. If the Python pipeline drifts to an unapproved repository, the build fails instead of silently creating a different product.</p>
          </div>
          <a href="https://github.com/logeshv586-code/AIproductfactory" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm"><Github className="h-4 w-4" /> Repository <ExternalLink className="h-3 w-3" /></a>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
          <div className="mb-4 flex gap-2">
            <button onClick={() => setMode('new')} className={`rounded-xl px-4 py-2 text-sm ${mode === 'new' ? 'bg-cyan-300 text-slate-950' : 'border border-white/10'}`}>New product</button>
            <button onClick={() => setMode('enhance')} className={`rounded-xl px-4 py-2 text-sm ${mode === 'enhance' ? 'bg-cyan-300 text-slate-950' : 'border border-white/10'}`}>Enhance existing</button>
          </div>
          {mode === 'enhance' && <input value={existingContext} onChange={(e) => setExistingContext(e.target.value)} placeholder="Existing repository/product/architecture" className="mb-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm" />}
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm leading-6" />
          <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map((example, index) => <button key={example} onClick={() => setIdea(example)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">Example {index + 1}</button>)}</div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">{loading || approving || building ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}{status}</div>
            <button onClick={analyze} disabled={loading || !compiledIdea} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"><Search className="h-4 w-4" /> Research & design <ArrowRight className="h-4 w-4" /></button>
          </div>
          {error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
        </section>

        {report && <div className="mt-8 space-y-8">
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.05] p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Final Manager</div>
              <div className="mt-2 text-3xl font-semibold text-white">{report.managerVerdict.decision.replaceAll('_', ' ')}</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{report.managerVerdict.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2"><Pill>{report.managerVerdict.estimatedFeasibility}% feasibility</Pill><Pill>{report.managerVerdict.confidence}% confidence</Pill><Pill>{report.sourceIntelligence.signalCount} live signals</Pill></div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-white"><BadgeCheck className="h-5 w-5 text-cyan-300" /> Accuracy contract</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{report.accuracyContract.promise}</p>
              <p className="mt-3 text-xs leading-5 text-slate-300">{report.accuracyContract.releaseRule}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <SectionTitle icon={Zap} eyebrow="Current intelligence" title="Live research evidence" />
            <div className="flex flex-wrap gap-2">{report.sourceIntelligence.sourceCatalog?.map((source) => <Pill key={source.id}>{source.name} · {source.mode}</Pill>)}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{report.sourceIntelligence.topSignals.slice(0, 9).map((signal, index) => <a key={`${signal.url}-${index}`} href={signal.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><div className="text-[10px] text-cyan-300">{signal.source} · relevance {score(signal.relevance)}%</div><div className="mt-2 text-sm font-medium text-white">{signal.title}</div><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{signal.summary}</p></a>)}</div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <SectionTitle icon={PackageSearch} eyebrow="Repository due diligence" title="Collected repositories and exact product roles" />
            <div className="space-y-3">{report.repoExplainers.slice(0, 10).map((repo) => <details key={repo.fullName} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><summary className="cursor-pointer"><span className="font-mono text-sm text-white">{repo.fullName}</span> <span className="ml-2 text-xs text-slate-500">{repo.healthScore}% health · {repo.language} · {repo.license}</span></summary><p className="mt-3 text-xs leading-5 text-slate-400">{repo.description}</p><div className="mt-3 text-xs text-cyan-300">{repo.integrationMode}</div><p className="mt-1 text-xs leading-5 text-slate-300">{repo.integrationExplanation}</p><p className="mt-2 text-xs leading-5 text-slate-400">{repo.exactCombinationRole}</p><a href={repo.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300">Open source <ExternalLink className="h-3 w-3" /></a></details>)}</div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <SectionTitle icon={Layers3} eyebrow="Composition lock" title="Choose exactly which repository composition will be built" text="The selected option is sent to the approved-composition endpoint. The Python pipeline is allowed to rank only inside this set." />
            <div className="grid gap-4 xl:grid-cols-3">{report.compositionSuggestions.map((option, index) => <button key={option.id} onClick={() => setSelectedComposition(option.id)} className={`rounded-2xl border p-5 text-left ${selectedComposition === option.id ? 'border-cyan-300/50 bg-cyan-300/[0.08]' : 'border-white/10 bg-slate-950/35'}`}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.15em] text-cyan-300">Option {String.fromCharCode(65 + index)} · {option.type}</div><div className="mt-1 font-semibold text-white">{option.title}</div></div><div className="text-2xl font-semibold text-white">{option.estimatedFit}%</div></div><div className="mt-3 space-y-1">{option.repos.map((repo) => <div key={repo.fullName} className="font-mono text-xs text-slate-300">{repo.fullName}</div>)}</div><p className="mt-3 text-xs leading-5 text-slate-400">{option.resultingProduct}</p><div className="mt-3 text-[11px] text-cyan-200">{option.combinationPattern}</div></button>)}</div>
          </section>

          {strategize && <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <SectionTitle icon={BrainCircuit} eyebrow="Strategy tournament" title="Approve product direction" />
            <div className="grid gap-3 lg:grid-cols-3">{strategize.strategies.map((strategy) => <button key={strategy.id} onClick={() => setSelectedStrategy(strategy.id)} className={`rounded-2xl border p-4 text-left ${selectedStrategy === strategy.id ? 'border-indigo-300/50 bg-indigo-300/[0.08]' : 'border-white/10 bg-slate-950/35'}`}><div className="text-xs text-indigo-300">{strategy.id}</div><div className="mt-1 font-semibold text-white">{strategy.name}</div><p className="mt-2 text-xs leading-5 text-slate-400">{strategy.tagline || strategy.description || strategy.why}</p></button>)}</div>
            <div className="mt-4 flex flex-wrap gap-3"><button onClick={approve} disabled={approving || !selectedStrategy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><Network className="h-4 w-4" /> Approve & simulate architecture</button><button onClick={autonomousBuild} disabled={building || !chosenComposition} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><Rocket className="h-4 w-4" /> Build selected composition</button></div>
          </section>}

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <SectionTitle icon={CircleDollarSign} eyebrow="Commercial intelligence" title="Selling price and modeled profitability" />
            <div className="mb-4 flex flex-wrap gap-2"><Pill>{report.commercialPlan.status}</Pill><Pill>{report.commercialPlan.pricingConfidence}% pricing confidence</Pill></div>
            <div className="grid gap-4 lg:grid-cols-3">{report.commercialPlan.tiers.map((tier) => <div key={tier.name} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><div className="text-xs text-slate-500">{tier.name}</div><div className="mt-2 text-3xl font-semibold text-white">{money(tier.monthlyPriceUsd)}<span className="text-sm text-slate-500"> /mo</span></div><div className="mt-3 text-xs text-slate-400">Modeled margin {tier.modeledGrossMarginPct}% · break-even {tier.modeledBreakEvenCustomers ?? 'n/a'} customers</div></div>)}</div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"><SectionTitle icon={ShieldCheck} eyebrow="Release gates" title="What must pass before VERIFIED BUILD" /><div className="space-y-2">{report.accuracyContract.gates.map((gate) => <div key={gate.gate} className="rounded-xl border border-white/10 p-3"><div className="text-sm font-medium text-white">{gate.gate}</div><p className="mt-1 text-xs leading-5 text-slate-400">{gate.passCondition}</p></div>)}</div></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"><SectionTitle icon={SquareTerminal} eyebrow="IDE handoff" title="Implementation prompt" /><button onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"><Clipboard className="h-4 w-4" /> Copy prompt</button><pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-slate-400">{report.idePrompt.slice(0, 7000)}</pre></div>
          </section>

          {buildResult && <section className={`rounded-3xl border p-6 ${buildResult.pipelineVerified ? 'border-emerald-300/30 bg-emerald-300/[0.06]' : 'border-amber-300/30 bg-amber-300/[0.06]'}`}>
            <SectionTitle icon={Code2} eyebrow="Approved-composition build" title={buildResult.pipelineVerified ? 'Pipeline verification passed' : 'Pipeline completed with remaining gates'} />
            <div className="flex flex-wrap gap-2"><Pill>Status: {buildResult.status || 'unknown'}</Pill>{buildResult.buildId && <Pill>Build: {buildResult.buildId}</Pill>}{buildResult.outputPath && <Pill>Output: {buildResult.outputPath}</Pill>}</div>
            {buildResult.verification && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(buildResult.verification).filter(([, value]) => typeof value === 'boolean').map(([key, value]) => <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs"><span className={value ? 'text-emerald-300' : 'text-amber-200'}>{value ? 'PASS' : 'CHECK'}</span><span className="ml-2 text-slate-300">{key}</span></div>)}</div>}
            {buildResult.errors?.length ? <ul className="mt-4 space-y-1 text-xs text-amber-100">{buildResult.errors.map((item) => <li key={item}>• {item}</li>)}</ul> : null}
            {buildResult.note && <p className="mt-4 text-xs leading-5 text-slate-400">{buildResult.note}</p>}
          </section>}
        </div>}
      </div>
    </main>
  )
}
