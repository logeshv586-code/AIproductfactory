'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Github, Star, TrendingUp, Lightbulb, Search, Sparkles,
  RefreshCw, Brain, Rocket, Target, Zap, BarChart3, Globe, Code2,
  Layers, Shield, ExternalLink, CheckCircle2, Activity,
  ArrowRight, GitBranch, Database, Cpu,
  Boxes, Network, FileCode, Settings, AlertTriangle, Loader2,
  ChevronDown, Play, Eye, Clock, Tag, Users, Award, Flame,
  X, Download, Copy, Maximize2, Minimize2, Code, GitMerge,
  Workflow, Monitor, Server, HardDrive, Cloud, Container,
  PieChart, LineChart, Type, Hash, BookmarkPlus, CircleDot,
  LayoutGrid, LucideIcon, Terminal, BookOpen
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

interface RepoData {
  name: string; full_name: string; description: string | null; stars: number
  forks: number; language: string | null; url: string; topics: string[]
  trendScore: number; growthRate: number; category: string
  innovationSignals: string[]; owner: string; ownerAvatar: string
  lastPushed: string; homepage?: string | null; license?: string
}

interface ComposedProduct {
  name: string; description: string; systemFlow: string
  capabilities: string[]; targetUsers: string[]; keyFeatures: string[]
  reposUsed: string[]; scores: { trend: number; innovation: number; feasibility: number; competition: number; final_score: number; success_probability?: number; success_percentage?: number }
  architecture: any; starterBlueprint: any; strategy: string
  compositionPlan?: {
    selectedRepos: Array<{ fullName: string; capability: string; why: string; role: string; language?: string | null }>
    combinationSteps: Array<{ order: number; title: string; repos: string[]; summary: string; requirements: string[]; output: string }>
    requirements: Array<{ category: string; items: string[] }>
    codingType: { languages: string[]; frameworks: string[]; interfaces: string[] }
    structures: {
      services: Array<{ name: string; purpose: string; repos: string[] }>
      folders: Array<{ path: string; purpose: string }>
    }
  }
}

interface GraphNode {
  id: string; label: string; type: string; color: string; icon: string
  description?: string; stars?: number; capability?: string; confidence?: number; score?: number
}

interface GraphEdge {
  id: string; source: string; target: string; label: string; type: string; color: string; animated: boolean
}

type FactoryMode = 'full' | 'fast'

interface PythonHealthStatus {
  available: boolean
  status: string
  url: string
  version?: string | null
  error?: string | null
}

interface FactoryResult {
  success: boolean; requestId: string; runId: string | null; mode: FactoryMode; buildId: string; status: string; source: string; currentStep: string; progress: number
  intent: { domain: string; required_capabilities: string[]; keywords: string[]; description: string } | null
  probScore: { feasibility: number; novelty: number; demand: number; composite: number; directives: string[]; rationale: string } | null
  expandedIdea: { market: string; targetUsers: string[]; features: string[]; usp: string; risks: string[]; suggestedStack: string[] } | null
  repoProfiles: { fullName: string; stars: number; language: string; summary: string; relevanceScore: number; reason: string }[]
  architecture: any | null
  integrationPlan: any | null
  generatedComponents: any[]
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] }
  graphStats: { total_nodes: number; total_edges: number; node_types: Record<string, number>; edge_types: Record<string, number> }
  composedProducts: ComposedProduct[]
  capabilities: any[]
  timeline: { step: string; ts: number; detail: string }[]
  errors: string[]
}

// ============================================================
// Pipeline step config
// ============================================================

const PIPELINE_STEPS = [
  { id: 'IntentExtraction', label: 'Intent Extraction', icon: Target, color: 'from-violet-500 to-purple-500', desc: 'Extract user intent & select best repos' },
  { id: 'CapabilityMapping', label: 'Capability Mapping', icon: Zap, color: 'from-blue-500 to-indigo-500', desc: 'Semantic capability mapping with embeddings' },
  { id: 'Graphify', label: 'Graphify', icon: Network, color: 'from-emerald-500 to-teal-500', desc: 'Build knowledge graph' },
  { id: 'ProductComposition', label: 'Product Composition', icon: Sparkles, color: 'from-amber-500 to-orange-500', desc: 'Generate products with AI strategies' },
  { id: 'Scoring', label: 'Product Scoring', icon: BarChart3, color: 'from-rose-500 to-pink-500', desc: 'Score and rank products' },
  { id: 'StarterRepoGeneration', label: 'Starter Repo', icon: Rocket, color: 'from-cyan-500 to-blue-500', desc: 'Generate starter codebase blueprint' },
]

const PIPELINE_MODE_META: Record<FactoryMode, { label: string; summary: string; note: string }> = {
  full: {
    label: 'Full Mode',
    summary: '30-90 second advanced pipeline with validated architecture, scored outputs, and GitHub-ready results.',
    note: 'Uses the multi-step Python intelligence engine and stays disabled when that pipeline is unavailable.',
  },
  fast: {
    label: 'Fast Mode',
    summary: 'Under-5-second lightweight idea expansion and scaffold generation for fast iteration.',
    note: 'Useful for rough exploration, but not the canonical production-quality path.',
  },
}

// ============================================================
// Main Component
// ============================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview')
  const [repos, setRepos] = useState<RepoData[]>([])
  const [loading, setLoading] = useState(false)

  // Pipeline state
  const [factoryLayer, setFactoryLayer] = useState<'selection' | 'workspace'>('selection')
  const [productType, setProductType] = useState<string | null>(null)
  const [researchData, setResearchData] = useState<any | null>(null)
  const [planData, setPlanData] = useState<any | null>(null)
  const [researching, setResearching] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executionLogs, setExecutionLogs] = useState<string[]>([])
  const [factoryIdea, setFactoryIdea] = useState('')
  const [factoryMode, setFactoryMode] = useState<FactoryMode>('full')
  const [factoryBuilding, setFactoryBuilding] = useState(false)
  const [factoryResult, setFactoryResult] = useState<FactoryResult | null>(null)
  const [pipelineStep, setPipelineStep] = useState(-1)
  const [selectedProduct, setSelectedProduct] = useState<ComposedProduct | null>(null)
  const [pythonHealth, setPythonHealth] = useState<PythonHealthStatus | null>(null)
  const [pythonHealthLoading, setPythonHealthLoading] = useState(true)

  // Graph state
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const graphCanvasRef = useRef<HTMLDivElement>(null)

  const checkPythonHealth = useCallback(async () => {
    setPythonHealthLoading(true)
    try {
      const res = await fetch('/api/health/python', { cache: 'no-store' })
      const data: PythonHealthStatus = await res.json()
      setPythonHealth(data)
    } catch (error: any) {
      setPythonHealth({
        available: false,
        status: 'unreachable',
        url: '',
        error: error?.message || 'Health check failed',
      })
    } finally {
      setPythonHealthLoading(false)
    }
  }, [])

  // Fetch trending repos
  const fetchRepos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/github/repos?limit=20')
      const data = await res.json()
      if (data.success) {
        setRepos(data.repos)
        toast.success(`Loaded ${data.count} trending repos`)
      }
    } catch { toast.error('Failed to fetch repos') }
    finally { setLoading(false) }
  }, [])

  const conductResearch = useCallback(async (idea: string, domain: string) => {
    setResearching(true)
    try {
      const res = await fetch('/api/research/conduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, domain }),
      })
      const data = await res.json()
      if (data.success) {
        setResearchData(data.research)
        toast.success('Autonomous research complete')
      }
    } catch { toast.error('Research failed') }
    finally { setResearching(false) }
  }, [])

  const generatePlan = useCallback(async () => {
    if (!factoryResult || !selectedProduct) return
    setPlanning(true)
    try {
      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: factoryIdea,
          architecture: selectedProduct.architecture || factoryResult.architecture,
          repos: factoryResult.repoProfiles
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPlanData(data.plan)
        toast.success('Implementation plan generated')
      }
    } catch { toast.error('Planning failed') }
    finally { setPlanning(false) }
  }, [factoryResult, selectedProduct, factoryIdea])

  const runExecutionTask = useCallback(async (task: any) => {
    setExecuting(true)
    setExecutionLogs(prev => [...prev, `[INIT] Starting task: ${task.title}`])
    try {
      const res = await fetch('/api/execution/run_task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: `ws_${Date.now()}`,
          task: task
        }),
      })
      const data = await res.json()
      if (data.success) {
        setExecutionLogs(prev => [...prev, ...data.logs, `[SUCCESS] Task "${task.title}" completed`])
        toast.success(`Task "${task.title}" executed in sandbox`)
      }
    } catch { 
      setExecutionLogs(prev => [...prev, `[ERROR] Failed to execute task: ${task.title}`])
      toast.error('Execution failed') 
    }
    finally { setExecuting(false) }
  }, [])

  // Run Pipeline
  const runFactory = useCallback(async (overrideIdea?: string) => {
    const finalIdea = overrideIdea || factoryIdea
    if (!finalIdea.trim()) { toast.error('Enter a product idea!'); return }
    if (factoryMode === 'full' && pythonHealth && !pythonHealth.available) {
      toast.error(`Full Mode is restricted: ${pythonHealth.error || 'Pipeline unreachable'}. Ensure Python backend is on port 8001.`, {
        duration: 5000,
        action: { label: 'Retry Sync', onClick: () => checkPythonHealth() }
      })
      return
    }
    setFactoryBuilding(true)
    setFactoryResult(null)
    setSelectedProduct(null)
    setPipelineStep(0)
    setFactoryLayer('workspace')
    
    // Start research in background
    conductResearch(finalIdea, productType || 'Technology')

    try {
      const res = await fetch('/api/factory/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: finalIdea, maxRepos: 5, mode: factoryMode }),
      })
      const data: FactoryResult = await res.json()
      setFactoryResult(data)

      if (data.composedProducts?.length > 0) {
        setSelectedProduct(data.composedProducts[0])
      }

      // Set graph data
      if (data.graphData) {
        setGraphNodes(data.graphData.nodes || [])
        setGraphEdges(data.graphData.edges || [])
      }

      setPipelineStep(PIPELINE_STEPS.length)
      if (!res.ok || !data.success) {
        toast.error((data as any).error || data.errors?.join(', ') || 'Pipeline failed')
        return
      }
      toast.success(`${PIPELINE_MODE_META[data.mode].label} complete`)
    } catch (err: any) {
      toast.error(err?.message || 'Pipeline failed')
    } finally {
      setFactoryBuilding(false)
    }
  }, [factoryIdea, factoryMode, pythonHealth, productType, conductResearch, checkPythonHealth])

  // Animate pipeline steps
  useEffect(() => {
    if (!factoryBuilding) return
    const interval = setInterval(() => {
      setPipelineStep(prev => {
        if (prev >= PIPELINE_STEPS.length - 1) return prev
        return prev + 1
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [factoryBuilding])

  // Auto-fetch on mount
  useEffect(() => { fetchRepos(); checkPythonHealth() }, [fetchRepos, checkPythonHealth])

  // ── Derived data ────────────────────────────────────────────────────
  const topProduct = factoryResult?.composedProducts?.[0]
  const graphStats = factoryResult?.graphStats
  const selectedRepoRecipe = selectedProduct
    ? (selectedProduct.compositionPlan?.selectedRepos?.length
      ? selectedProduct.compositionPlan.selectedRepos.map(repo => ({
          name: repo.fullName,
          capability: repo.capability,
          why: repo.why,
          role: repo.role,
        }))
      : (selectedProduct.reposUsed || []).map((repoName, idx) => {
          const repoProfile = factoryResult?.repoProfiles.find(r => r.fullName === repoName || r.fullName.includes(repoName))
          return {
            name: repoName,
            capability: selectedProduct.capabilities[idx % Math.max(selectedProduct.capabilities.length, 1)] || 'general',
            why: repoProfile?.reason || 'Source capability framework',
            role: repoProfile?.summary || 'Product building block',
          }
        }))
    : []
  const selectedStructures = selectedProduct?.compositionPlan?.structures || null

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-50 via-white to-blue-50/40">
        <AnimatePresence mode="wait">
          {factoryLayer === 'selection' ? (
            <motion.div 
              key="selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-white overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.8 }}
                className="z-10 text-center max-w-5xl w-full"
              >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold mb-8 backdrop-blur-xl shadow-2xl">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span className="bg-gradient-to-r from-violet-200 to-indigo-200 bg-clip-text text-transparent">Engineering Operating System v2.0</span>
                </div>
                
                <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tight leading-[0.9] bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
                  The Future of <br/> <span className="text-violet-500">Autonomous</span> Build.
                </h1>
                
                <p className="text-xl text-slate-400 mb-14 max-w-2xl mx-auto leading-relaxed">
                  Transform high-level vision into production-ready software using multi-agent intelligence and automated reasoning.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
                  {[
                    { id: 'agent', name: 'AI Agent', icon: Brain, color: 'from-violet-500 to-indigo-600' },
                    { id: 'rag', name: 'RAG System', icon: Search, color: 'from-blue-500 to-cyan-600' },
                    { id: 'fullstack', name: 'Fullstack App', icon: LayoutGrid, color: 'from-emerald-500 to-teal-600' },
                    { id: 'devops', name: 'DevOps Tool', icon: Workflow, color: 'from-orange-500 to-amber-600' },
                    { id: 'vision', name: 'Computer Vision', icon: Eye, color: 'from-rose-500 to-pink-600' },
                    { id: 'research', name: 'Research AI', icon: BookOpen, color: 'from-indigo-500 to-purple-600' },
                  ].map((type, i) => (
                    <motion.button
                      key={type.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      whileHover={{ scale: 1.05, translateY: -8 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setProductType(type.name); }}
                      className={`p-5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden group ${productType === type.name ? 'border-white bg-white/20 ring-2 ring-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center shadow-lg group-hover:shadow-white/10 transition-shadow`}>
                        <type.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold tracking-wide uppercase opacity-80">{type.name}</span>
                      {productType === type.name && (
                        <motion.div layoutId="selection-glow" className="absolute inset-0 bg-white/5 pointer-events-none" />
                      )}
                    </motion.button>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-6">
                  <div className="relative w-full max-w-2xl group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                    <Input 
                      placeholder="Enter your product vision... (e.g. 'Build a scalable RAG agent for legal documents')" 
                      value={factoryIdea}
                      onChange={(e) => setFactoryIdea(e.target.value)}
                      className="relative h-20 px-8 bg-black border-white/10 text-white placeholder:text-slate-600 rounded-2xl text-xl pr-44 focus:ring-violet-500 shadow-2xl"
                    />
                    <Button 
                      size="lg"
                      disabled={!factoryIdea.trim() || !productType}
                      onClick={() => runFactory()}
                      className="absolute right-2 top-2 bottom-2 bg-white text-black hover:bg-slate-200 rounded-xl px-8 font-black text-sm tracking-tight transition-all active:scale-95"
                    >
                      DEPLOY AGENTS
                    </Button>
                  </div>
                  <div className="flex items-center gap-6 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> RESEARCH</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> PLAN</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> DESIGN</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> EXECUTE</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              key="workspace"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="min-h-screen"
            >
              <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Github className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Engineering Workspace</h1>
                      <p className="text-xs text-muted-foreground">{productType} · {factoryIdea.slice(0, 40)}...</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setFactoryLayer('selection')} className="gap-2">
                    <ArrowRight className="w-4 h-4 rotate-180" /> Back to Factory
                  </Button>
                </div>
              </header>

              <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList className="bg-slate-100/50 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="research" className="gap-2">
                      <Search className="w-4 h-4" /> Research {researching && <Loader2 className="w-3 h-3 animate-spin" />}
                    </TabsTrigger>
                    <TabsTrigger value="plan" className="gap-2">
                      <Workflow className="w-4 h-4" /> Plan {planning && <Loader2 className="w-3 h-3 animate-spin" />}
                    </TabsTrigger>
                    <TabsTrigger value="execution" className="gap-2">
                      <Terminal className="w-4 h-4" /> Execution {executing && <Loader2 className="w-3 h-3 animate-spin" />}
                    </TabsTrigger>
                    <TabsTrigger value="graph">Capability Graph</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Agent Health', value: 'Optimal', icon: Activity, color: 'text-emerald-500' },
                        { label: 'Plan Progress', value: '12%', icon: TrendingUp, color: 'text-blue-500' },
                        { label: 'Security Score', value: '98/100', icon: Shield, color: 'text-violet-500' },
                        { label: 'Complexity', value: 'Medium', icon: Zap, color: 'text-amber-500' },
                      ].map((m) => (
                        <Card key={m.label} className="border-0 shadow-sm bg-white/60 backdrop-blur-md">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className={`p-2 rounded-lg bg-slate-100 ${m.color}`}><m.icon className="w-5 h-5" /></div>
                            <div>
                              <p className="text-2xl font-bold">{m.value}</p>
                              <p className="text-xs text-muted-foreground">{m.label}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden relative">
                      <div className="absolute top-0 right-0 p-8 opacity-10"><Rocket className="w-32 h-32" /></div>
                      <CardHeader>
                        <CardTitle className="text-2xl font-black text-slate-900">Autonomous Pipeline Initialized</CardTitle>
                        <CardDescription className="text-slate-600 max-w-xl">
                          Our multi-agent system is currently researching your product vision, mapping repository capabilities, and designing the optimal system architecture.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-4">
                        <Button onClick={() => setActiveTab('research')} className="bg-violet-600 hover:bg-violet-700">View Research</Button>
                        <Button variant="outline" onClick={() => setActiveTab('pipeline')}>Monitor Pipeline</Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="research" className="space-y-4">
                    {!researchData && researching ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
                        <p className="text-slate-500 font-medium animate-pulse">Research Agent gathering intelligence...</p>
                      </div>
                    ) : researchData ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-0 shadow-sm">
                          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /> Key Findings</CardTitle></CardHeader>
                          <CardContent><ul className="space-y-2">{researchData.key_findings.map((f: string, i: number) => <li key={i} className="text-sm text-slate-600 flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {f}</li>)}</ul></CardContent>
                        </Card>
                        <Card className="border-0 shadow-sm">
                          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Patterns</CardTitle></CardHeader>
                          <CardContent><div className="space-y-3">{researchData.recommended_patterns.map((p: any, i: number) => <div key={i} className="p-3 bg-slate-50 rounded-lg"><p className="text-sm font-bold">{p.name}</p><p className="text-xs text-slate-500">{p.description}</p></div>)}</div></CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                        <Search className="w-12 h-12 opacity-20" />
                        <p>No research data. Run pipeline to begin.</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="plan" className="space-y-4">
                    {!planData && planning ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                        <p className="text-slate-500 font-medium animate-pulse">Planning Agent synthesizing strategy...</p>
                      </div>
                    ) : planData ? (
                      <div className="space-y-4">
                        {planData.phases.map((phase: any, i: number) => (
                          <Card key={i} className="border-0 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                              <h3 className="font-bold text-slate-700">Phase {i+1}: {phase.name}</h3>
                              <Badge variant="secondary" className="text-[10px]">IN PLANNING</Badge>
                            </div>
                            <CardContent className="p-0">
                              <div className="divide-y divide-slate-100">
                                {phase.tasks.map((task: any, j: number) => (
                                  <div key={j} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                    <div className="space-y-1">
                                      <p className="text-sm font-bold">{task.title}</p>
                                      <p className="text-xs text-slate-500">{task.description}</p>
                                    </div>
                                    <Button size="sm" onClick={() => { setActiveTab('execution'); runExecutionTask(task); }} className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 hover:bg-black text-white h-8 text-xs">Execute</Button>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Button onClick={generatePlan} disabled={!factoryResult} size="lg" className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                          <Workflow className="w-5 h-5" /> Generate Implementation Plan
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="execution" className="space-y-4">
                    <Card className="border-0 shadow-sm bg-slate-950 text-emerald-500 font-mono text-sm overflow-hidden min-h-[500px] flex flex-col">
                      <div className="bg-slate-900 px-4 py-2 border-b border-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-slate-400 font-bold uppercase tracking-wider">Sandbox Terminal</span>
                        </div>
                      </div>
                      <ScrollArea className="flex-1 p-6">
                        <div className="space-y-2">
                          {executionLogs.map((log, i) => (
                            <p key={i} className={log.startsWith('[ERROR]') ? 'text-rose-400' : log.startsWith('[SUCCESS]') ? 'text-emerald-400' : 'text-slate-300'}>
                              {log.startsWith('[') ? log : `> ${log}`}
                            </p>
                          ))}
                          {executing && <div className="flex items-center gap-2 animate-pulse"><span className="w-2 h-4 bg-emerald-500" /><span>Processing...</span></div>}
                        </div>
                      </ScrollArea>
                    </Card>
                  </TabsContent>

                  <TabsContent value="pipeline">
                    <Card className="border-0 shadow-sm bg-white/60 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-lg">Engineering Pipeline Monitor</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-8">
                          {PIPELINE_STEPS.map((step, i) => (
                            <div key={step.id} className={`flex items-start gap-4 transition-all duration-500 ${pipelineStep >= i ? 'opacity-100' : 'opacity-30'}`}>
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shrink-0 shadow-lg`}>
                                <step.icon className={`w-5 h-5 text-white ${pipelineStep === i ? 'animate-bounce' : ''}`} />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-bold">{step.label}</h4>
                                  {pipelineStep > i && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                  {pipelineStep === i && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                                </div>
                                <p className="text-xs text-slate-500">{step.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="graph" className="h-[600px] border rounded-xl bg-white/40 backdrop-blur-md relative overflow-hidden">
                    <div ref={graphCanvasRef} className="w-full h-full">
                      <svg className="w-full h-full">
                        <defs>
                          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                          </marker>
                        </defs>
                        {graphEdges.map(edge => {
                          const source = graphNodes.find(n => n.id === edge.source)
                          const target = graphNodes.find(n => n.id === edge.target)
                          if (!source || !target) return null
                          const x1 = getNodeX(source, graphNodes); const y1 = getNodeY(source, graphNodes)
                          const x2 = getNodeX(target, graphNodes); const y2 = getNodeY(target, graphNodes)
                          return <motion.line key={edge.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={edge.color} strokeWidth="1.5" markerEnd="url(#arrowhead)" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.3 }} />
                        })}
                        {graphNodes.map(node => (
                          <motion.g key={node.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.1 }} onClick={() => setSelectedNode(node)} className="cursor-pointer">
                            <circle cx={getNodeX(node, graphNodes)} cy={getNodeY(node, graphNodes)} r="22" fill="white" stroke={node.color} strokeWidth="2" className="shadow-xl" />
                            <foreignObject x={getNodeX(node, graphNodes) - 10} y={getNodeY(node, graphNodes) - 10} width="20" height="20">
                              <div className={`text-[${node.color}] flex items-center justify-center`}>
                                {node.type === 'repo' ? <Github size={16} /> : node.type === 'capability' ? <Zap size={16} /> : <Rocket size={16} />}
                              </div>
                            </foreignObject>
                            <text x={getNodeX(node, graphNodes)} y={getNodeY(node, graphNodes) + 35} textAnchor="middle" className="text-[10px] font-bold fill-slate-700">{node.label}</text>
                          </motion.g>
                        ))}
                      </svg>
                    </div>
                  </TabsContent>
                </Tabs>
              </main>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  )
}

// ── Graph layout helpers ──────────────────────────────────────────────
function getNodeX(node: GraphNode, allNodes: GraphNode[]): number {
  const typeNodes = allNodes.filter(n => n.type === node.type)
  const index = typeNodes.indexOf(node)
  const total = typeNodes.length
  const typeOffset: Record<string, number> = { repo: 150, capability: 450, product: 750 }
  const base = typeOffset[node.type] || 450
  if (total <= 1) return base
  const spacing = Math.min(120, 400 / (total - 1))
  return base - ((total - 1) * spacing / 2) + index * spacing
}

function getNodeY(node: GraphNode, allNodes: GraphNode[]): number {
  const typeNodes = allNodes.filter(n => n.type === node.type)
  const index = typeNodes.indexOf(node)
  const total = typeNodes.length
  const base = 250
  if (total <= 1) return base
  const spacing = Math.min(80, 300 / (total - 1))
  return base - ((total - 1) * spacing / 2) + index * spacing
}
