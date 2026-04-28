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
  LayoutGrid, LucideIcon
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

const CAPABILITY_COLORS: Record<string, string> = {
  memory: '#8b5cf6', agent: '#3b82f6', rag: '#14b8a6',
  ui: '#f59e0b', backend: '#ef4444', automation: '#22c55e', general: '#94a3b8',
}

const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  memory: Database, agent: Brain, rag: Search,
  ui: Monitor, backend: Server, automation: Workflow, general: CircleDot,
}

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

const formatStars = (n: number): string => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString()
const getSuccessPercentage = (product: ComposedProduct): number =>
  typeof product.scores.success_percentage === 'number'
    ? product.scores.success_percentage
    : Math.round(product.scores.final_score * 100)

// ============================================================
// Main Component
// ============================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview')
  const [repos, setRepos] = useState<RepoData[]>([])
  const [loading, setLoading] = useState(false)

  // Pipeline state
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

  // Run Pipeline
  const runFactory = useCallback(async () => {
    if (!factoryIdea.trim()) { toast.error('Enter a product idea!'); return }
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

    try {
      const res = await fetch('/api/factory/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: factoryIdea, maxRepos: 5, mode: factoryMode }),
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
  }, [factoryIdea, factoryMode, pythonHealth])

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
  const selectedRequirements = selectedProduct?.compositionPlan?.requirements || []
  const selectedCodingType = selectedProduct?.compositionPlan?.codingType || null
  const selectedCombinationSteps = selectedProduct?.compositionPlan?.combinationSteps || []
  const selectedStructures = selectedProduct?.compositionPlan?.structures || null

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-50 via-white to-blue-50/40">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/50 shadow-sm transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <Github className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                    <Zap className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    AI Product Builder Engine
                  </h1>
                  <p className="text-xs text-muted-foreground">6-Step Pipeline · Graphify · 4 Agents · Python + TypeScript</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { fetchRepos(); checkPythonHealth(); }} 
                  disabled={loading || pythonHealthLoading}
                  className="bg-white/50 backdrop-blur-sm border-slate-200/60 hover:bg-white transition-all shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${loading || pythonHealthLoading ? 'animate-spin' : ''}`} />
                  <span className="text-xs font-medium">Sync</span>
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className={`gap-1.5 text-[10px] h-7 px-2.5 border-slate-200/60 bg-white/50 backdrop-blur-sm cursor-help transition-all duration-500 ${!pythonHealthLoading && pythonHealth?.available ? 'border-emerald-200/50 text-emerald-700' : 'hover:bg-rose-50'}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${pythonHealthLoading ? 'bg-amber-500 animate-pulse' : pythonHealth?.available ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                      {pythonHealthLoading ? 'Probing...' : pythonHealth?.available ? 'Core Pipeline Ready' : 'Core Unavailable'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-[10px]">
                    {pythonHealthLoading ? 'Pinging Python backend at http://localhost:8001...' : 
                     pythonHealth?.available ? `Python backend reachable at ${pythonHealth.url}. Version: ${pythonHealth.version}` : 
                     `Unreachable: ${pythonHealth?.error || 'Check if python-backend/main.py is running on port 8001'}`}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-slate-100/50 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50 shadow-inner">
              <TabsTrigger value="overview" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><LayoutGrid className="w-4 h-4" /> Overview</TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Workflow className="w-4 h-4" /> Pipeline</TabsTrigger>
              <TabsTrigger value="graph" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Network className="w-4 h-4" /> Capability Graph</TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Sparkles className="w-4 h-4" /> Products {factoryResult?.composedProducts?.length ? <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-indigo-100 text-indigo-700">{factoryResult.composedProducts.length}</Badge> : null}</TabsTrigger>
              <TabsTrigger value="architecture" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Boxes className="w-4 h-4" /> Architecture</TabsTrigger>
            </TabsList>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* OVERVIEW TAB */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <TabsContent value="overview" className="space-y-6">
              {/* System Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Pipeline Agents', value: 4, icon: Brain, color: 'from-violet-500 to-indigo-500', sub: 'Planner, Designer, Composer, Generator' },
                  { label: 'Capabilities', value: 6, icon: Zap, color: 'from-teal-500 to-emerald-500', sub: 'Memory, Agent, RAG, UI, Backend, Automation' },
                  { label: 'MCP Tools', value: 8, icon: GitMerge, color: 'from-orange-500 to-amber-500', sub: 'GitHub, Web, RAG, Analysis, Generate' },
                  { label: 'Build Variants', value: 4, icon: Rocket, color: 'from-rose-500 to-pink-500', sub: 'CrossPoll, Gap, Trend, Compositional' },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                    <Card className="border-0 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 bg-white/60 backdrop-blur-md">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-sm`}>
                            <stat.icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 truncate">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Pipeline Flow + MCP Tools */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Pipeline Flow */}
                <Card className="lg:col-span-2 border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Workflow className="w-4 h-4 text-violet-500" /> 6-Step Pipeline Protocol</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {PIPELINE_STEPS.map((step, i) => (
                        <React.Fragment key={step.id}>
                          <div className="flex flex-col items-center gap-1 min-w-[100px]">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md`}>
                              <step.icon className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-[10px] text-center font-medium leading-tight">{step.label}</span>
                            <span className="text-[9px] text-center text-muted-foreground leading-tight">{step.desc}</span>
                          </div>
                          {i < PIPELINE_STEPS.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* MCP Tools */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><GitMerge className="w-4 h-4 text-orange-500" /> MCP Tools</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { name: 'fetch_top_repos', tag: 'github' },
                      { name: 'search_repos', tag: 'github' },
                      { name: 'get_repo_details', tag: 'github' },
                      { name: 'analyze_trends', tag: 'analysis' },
                      { name: 'generate_ideas', tag: 'ai' },
                      { name: 'collect_repos', tag: 'github' },
                      { name: 'web_search', tag: 'web' },
                      { name: 'rag_query', tag: 'memory' },
                    ].map(tool => (
                      <div key={tool.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <span className="text-xs font-mono">{tool.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{tool.tag}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Tech Stack + Latest Build */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4 text-cyan-500" /> Tech Stack</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium mb-2 text-muted-foreground">Frontend</p>
                        <div className="flex flex-wrap gap-1">
                          {['Next.js 16', 'React 19', 'Tailwind CSS', 'shadcn/ui', 'Framer Motion', 'Recharts'].map(t => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-2 text-muted-foreground">Backend (Python)</p>
                        <div className="flex flex-wrap gap-1">
                          {['FastAPI', 'Pydantic', 'NumPy', 'OpenAI SDK', 'Anthropic SDK', 'Uvicorn'].map(t => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-2 text-muted-foreground">Database & Infra</p>
                        <div className="flex flex-wrap gap-1">
                          {['Prisma', 'SQLite', 'Docker', 'MCP Protocol'].map(t => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> Latest Build</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {factoryResult ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={factoryResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                              {factoryResult.success ? 'SUCCESS' : 'FAILED'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{PIPELINE_MODE_META[factoryResult.mode].label}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">via {factoryResult.source}</span>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground">request {factoryResult.requestId}</p>
                        {factoryResult.intent && (
                          <div>
                            <p className="text-xs font-medium">Domain: {factoryResult.intent.domain}</p>
                            <p className="text-xs text-muted-foreground">{factoryResult.intent.description}</p>
                          </div>
                        )}
                        {topProduct && (
                          <div className="p-3 rounded-lg bg-violet-50">
                            <p className="text-sm font-semibold">{topProduct.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{topProduct.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="bg-emerald-100 text-emerald-800 text-xs">Score: {(topProduct.scores.final_score * 100).toFixed(0)}%</Badge>
                              <Badge className="bg-blue-100 text-blue-800 text-xs">Success: {getSuccessPercentage(topProduct).toFixed(0)}%</Badge>
                              <Badge variant="outline" className="text-xs">{topProduct.strategy}</Badge>
                            </div>
                          </div>
                        )}
                        <Button size="sm" className="w-full" onClick={() => setActiveTab('products')}>
                          View All Products <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Rocket className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No builds yet</p>
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveTab('pipeline')}>
                          Run Pipeline
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Trending Repos Quick View */}
              {repos.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> Trending Repos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {repos.slice(0, 6).map((repo, idx) => (
                        <div key={repo.full_name || repo.name || `repo-${idx}`} className="p-3 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shrink-0">
                              <GitBranch className="w-3 h-3 text-white" />
                            </div>
                            <p className="text-sm font-medium truncate">{repo.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{repo.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] py-0">{repo.language}</Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Star className="w-3 h-3" /> {formatStars(repo.stars)}</span>
                            <Badge className={`text-[10px] py-0 ${repo.category === 'AI/ML' ? 'bg-purple-100 text-purple-800' : repo.category === 'DevTools' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>{repo.category}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* PIPELINE TAB */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <TabsContent value="pipeline" className="space-y-6">
              {/* Input */}
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-purple-500/10 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                      <Workflow className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">AI Product Pipeline</h2>
                      <p className="text-sm text-muted-foreground">Intent → Capability → Graphify → Product → Score → Starter Repo</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(['full', 'fast'] as const).map(mode => (
                      <Button
                        key={mode}
                        type="button"
                        variant={factoryMode === mode ? 'default' : 'outline'}
                        size="sm"
                        disabled={factoryBuilding || (mode === 'full' && pythonHealth?.available === false)}
                        onClick={() => setFactoryMode(mode)}
                        className={factoryMode === mode ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white/80'}
                      >
                        {PIPELINE_MODE_META[mode].label}
                      </Button>
                    ))}
                  </div>
                  <div className="mb-4 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3">
                    <p className="text-sm font-medium">{PIPELINE_MODE_META[factoryMode].summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">{PIPELINE_MODE_META[factoryMode].note}</p>
                    {factoryMode === 'full' && pythonHealth?.available === false && (
                      <p className="text-xs text-rose-700 mt-2">Full Mode is currently unavailable: {pythonHealth.error || pythonHealth.status}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Describe your product idea (e.g., 'AI coding assistant that reads GitHub PRs')"
                      value={factoryIdea}
                      onChange={e => setFactoryIdea(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !factoryBuilding && runFactory()}
                      className="flex-1 h-11 text-base bg-white/90"
                      disabled={factoryBuilding}
                    />
                    <Button
                      onClick={runFactory}
                      disabled={factoryBuilding || !factoryIdea.trim()}
                      className="h-11 px-6 bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white shadow-[0_4px_15px_-3px_rgba(124,58,237,0.4)] transition-all active:scale-95 disabled:grayscale"
                    >
                      {factoryBuilding ? (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <div className="absolute inset-0 blur-sm animate-pulse bg-white/20 rounded-full" />
                          </div>
                          <span className="font-semibold italic">Processing Logic...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Play className="w-5 h-5 fill-current" />
                          <span className="font-semibold">Synthesize Product</span>
                        </div>
                      )}
                    </Button>
                  </div>
                  {factoryBuilding && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="text-[10px] text-center mt-3 text-indigo-600 font-medium animate-pulse"
                    >
                      ✨ Note: High-fidelity generation usually takes 30-60s for reasoning.
                    </motion.p>
                  )}
                </div>
              </Card>

              {/* Pipeline Steps Progress */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-violet-500" /> Pipeline Progress
                  </h3>
                  <div className="space-y-4">
                    {PIPELINE_STEPS.map((step, i) => {
                      const isComplete = factoryBuilding ? i < pipelineStep : (factoryResult?.success && i < PIPELINE_STEPS.length)
                      const isActive = factoryBuilding && i === pipelineStep
                      return (
                        <motion.div 
                          key={step.id} 
                          initial={false}
                          animate={{ 
                            opacity: isComplete || isActive ? 1 : 0.5,
                            x: isActive ? 4 : 0
                          }}
                          className="flex items-center gap-4 relative"
                        >
                          {i < PIPELINE_STEPS.length - 1 && (
                            <div className={`absolute left-5 top-10 bottom-0 w-0.5 ${isComplete ? 'bg-emerald-200' : 'bg-slate-100'}`} />
                          )}
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 z-10 ${
                            isComplete ? 'bg-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] text-white' :
                            isActive ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_20px_-3px_rgba(99,102,241,0.5)] text-white' :
                            'bg-slate-50 text-slate-400 border border-slate-100'
                          }`}>
                            {isComplete ? <CheckCircle2 className="w-5 h-5" /> :
                             isActive ? <Loader2 className="w-5 h-5 animate-spin" /> :
                             <step.icon className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold tracking-tight ${isComplete ? 'text-slate-700' : isActive ? 'text-indigo-700' : 'text-slate-400'}`}>
                                {step.label}
                              </p>
                              {isActive && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-medium">{step.desc}</p>
                          </div>
                          {isComplete && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Valid
                            </motion.div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              {factoryResult && (
                <div className="space-y-4">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Run State</p>
                          <p className="text-xs text-muted-foreground">Current step: {factoryResult.currentStep}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{factoryResult.progress}%</Badge>
                      </div>
                      <Progress value={factoryResult.progress} className="h-2" />
                    </CardContent>
                  </Card>
                  {!factoryResult.success && (
                    <Card className="border-0 shadow-sm border border-rose-200 bg-rose-50/70">
                      <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-rose-900">Pipeline run failed in {PIPELINE_MODE_META[factoryResult.mode].label}</p>
                          <p className="text-xs text-rose-800 mt-1">{factoryResult.errors?.join(', ') || 'Unknown pipeline failure'}</p>
                          <p className="text-[10px] font-mono text-rose-700 mt-2">request {factoryResult.requestId}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {/* Intent + Scores */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {factoryResult.intent && (
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-violet-500" /> Extracted Intent</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Domain</p>
                            <p className="text-sm font-semibold">{factoryResult.intent.domain}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Description</p>
                            <p className="text-sm">{factoryResult.intent.description}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Required Capabilities</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {factoryResult.intent.required_capabilities.map(cap => (
                                <Badge key={cap} style={{ backgroundColor: CAPABILITY_COLORS[cap] + '20', color: CAPABILITY_COLORS[cap], borderColor: CAPABILITY_COLORS[cap] }} variant="outline" className="text-xs gap-1">
                                  {React.createElement(CAPABILITY_ICONS[cap] || CircleDot, { className: 'w-3 h-3' })} {cap}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Repos Used */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Github className="w-4 h-4" /> Selected Repos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {factoryResult.repoProfiles.map(repo => (
                          <div key={repo.fullName} className="p-2 rounded-lg bg-slate-50 flex items-start gap-2">
                            <GitBranch className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium">{repo.fullName}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{repo.summary}</p>
                              {repo.reason && <p className="text-[10px] text-violet-600 mt-0.5">{repo.reason}</p>}
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0 flex items-center gap-0.5"><Star className="w-3 h-3" /> {formatStars(repo.stars)}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Capabilities */}
                  {factoryResult.capabilities?.length > 0 && (
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-teal-500" /> Mapped Capabilities</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          {factoryResult.capabilities.map((cap: any) => {
                            const CapIcon = CAPABILITY_ICONS[cap.capability] || CircleDot
                            return (
                              <div key={cap.repo} className="p-3 rounded-lg border border-slate-200 text-center hover:shadow-sm transition-shadow">
                                <div className="w-10 h-10 rounded-lg mx-auto flex items-center justify-center" style={{ backgroundColor: CAPABILITY_COLORS[cap.capability] + '20' }}>
                                  <CapIcon className="w-5 h-5" style={{ color: CAPABILITY_COLORS[cap.capability] }} />
                                </div>
                                <p className="text-xs font-medium mt-2">{cap.capability}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{cap.name}</p>
                                <p className="text-[10px] text-emerald-600">{(cap.confidence * 100).toFixed(0)}% conf</p>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Timeline */}
                  {factoryResult.timeline?.length > 0 && (
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> Build Timeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {factoryResult.timeline.map((entry, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500" />
                              <span className="font-medium text-xs">{entry.step}</span>
                              {entry.detail && <span className="text-muted-foreground text-xs">— {entry.detail}</span>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Empty State */}
              {!factoryBuilding && !factoryResult && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-violet-500/25">
                      <Workflow className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">AI Product Builder Pipeline</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Enter a product idea and choose between the canonical Python pipeline or the explicit TypeScript fast path
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mb-6">
                      {PIPELINE_STEPS.map(step => (
                        <Badge key={step.id} variant="outline" className="gap-1">
                          <step.icon className="w-3 h-3" /> {step.label}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {['AI coding assistant', 'Trading dashboard with AI signals', 'DevOps automation platform'].map(example => (
                        <Button key={example} variant="outline" size="sm" onClick={() => setFactoryIdea(example)}>
                          {example}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* CAPABILITY GRAPH TAB */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <TabsContent value="graph" className="space-y-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Network className="w-4 h-4 text-teal-500" /> Capability Knowledge Graph</CardTitle>
                    {graphStats && (
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{graphStats.total_nodes} nodes</Badge>
                        <Badge variant="outline" className="text-xs">{graphStats.total_edges} edges</Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {graphNodes.length > 0 ? (
                    <>
                      {/* Legend */}
                      <div className="flex gap-3 mb-4">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-xs">Repo</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-teal-500" /><span className="text-xs">Capability</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs">Product</span></div>
                      </div>

                      {/* Interactive Graph Canvas */}
                      <div ref={graphCanvasRef} className="relative w-full h-[500px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <svg className="w-full h-full" viewBox="0 0 900 500">
                          {/* Edges */}
                          {graphEdges.map(edge => {
                            const sourceNode = graphNodes.find(n => n.id === edge.source)
                            const targetNode = graphNodes.find(n => n.id === edge.target)
                            if (!sourceNode || !targetNode) return null
                            const sx = getNodeX(sourceNode, graphNodes)
                            const sy = getNodeY(sourceNode, graphNodes)
                            const tx = getNodeX(targetNode, graphNodes)
                            const ty = getNodeY(targetNode, graphNodes)
                            return (
                              <g key={edge.id}>
                                <line x1={sx} y1={sy} x2={tx} y2={ty} stroke={edge.color} strokeWidth={2} strokeOpacity={0.5} strokeDasharray={edge.animated ? '5,5' : 'none'}>
                                  {edge.animated && <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1s" repeatCount="indefinite" />}
                                </line>
                                <text x={(sx + tx) / 2} y={(sy + ty) / 2 - 5} textAnchor="middle" fill="#64748b" fontSize={9}>{edge.label}</text>
                              </g>
                            )
                          })}
                          {/* Nodes */}
                          {graphNodes.map(node => {
                            const x = getNodeX(node, graphNodes)
                            const y = getNodeY(node, graphNodes)
                            const isSelected = selectedNode?.id === node.id
                            return (
                              <g key={node.id} onClick={() => setSelectedNode(isSelected ? null : node)} style={{ cursor: 'pointer' }}>
                                <circle cx={x} cy={y} r={isSelected ? 28 : 22} fill={node.color} fillOpacity={isSelected ? 0.3 : 0.1} stroke={node.color} strokeWidth={isSelected ? 3 : 2} />
                                <circle cx={x} cy={y} r={16} fill={node.color} />
                                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10} fontWeight="bold">{node.label.charAt(0)}</text>
                                <text x={x} y={y + 32} textAnchor="middle" fill="#334155" fontSize={10} fontWeight="500">{node.label}</text>
                                {node.type === 'repo' && node.stars != null && (
                                  <text x={x} y={y + 44} textAnchor="middle" fill="#94a3b8" fontSize={8}>{formatStars(node.stars)} stars</text>
                                )}
                                {node.type === 'capability' && node.confidence != null && (
                                  <text x={x} y={y + 44} textAnchor="middle" fill="#94a3b8" fontSize={8}>{(node.confidence * 100).toFixed(0)}%</text>
                                )}
                                {node.type === 'product' && node.score != null && (
                                  <text x={x} y={y + 44} textAnchor="middle" fill="#94a3b8" fontSize={8}>Score: {(node.score * 100).toFixed(0)}%</text>
                                )}
                              </g>
                            )
                          })}
                        </svg>

                        {/* Node Detail Panel */}
                        {selectedNode && (
                          <div className="absolute top-4 right-4 w-64 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <Badge style={{ backgroundColor: selectedNode.color + '20', color: selectedNode.color, borderColor: selectedNode.color }} variant="outline" className="text-xs">{selectedNode.type}</Badge>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedNode(null)}><X className="w-3 h-3" /></Button>
                            </div>
                            <p className="font-semibold text-sm">{selectedNode.label}</p>
                            {selectedNode.description && <p className="text-xs text-muted-foreground mt-1">{selectedNode.description}</p>}
                            {selectedNode.stars != null && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Star className="w-3 h-3" /> {formatStars(selectedNode.stars)} stars</p>}
                            {selectedNode.confidence != null && <p className="text-xs text-muted-foreground mt-1">Confidence: {(selectedNode.confidence * 100).toFixed(0)}%</p>}
                            {selectedNode.score != null && <p className="text-xs text-muted-foreground mt-1">Score: {(selectedNode.score * 100).toFixed(0)}%</p>}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <Network className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">Run the pipeline to generate the capability graph</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveTab('pipeline')}>Go to Pipeline</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* PRODUCTS TAB */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <TabsContent value="products" className="space-y-4">
              {(factoryResult?.composedProducts?.length ?? 0) > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Composed Products</h3>
                    <Badge variant="outline" className="text-xs">{factoryResult?.composedProducts?.length || 0} products generated</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {factoryResult?.composedProducts?.map((product, idx) => (
                      <motion.div key={product.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                        <Card className={`border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${selectedProduct?.name === product.name ? 'ring-2 ring-violet-500' : ''}`} onClick={() => setSelectedProduct(product)}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-semibold">{product.name}</h4>
                                {product.strategy && <Badge variant="outline" className="text-[10px] mt-1">{product.strategy}</Badge>}
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-emerald-600">{(product.scores.final_score * 100).toFixed(0)}%</p>
                                <p className="text-[10px] text-muted-foreground">Final Score</p>
                                <p className="text-[10px] font-medium text-blue-600 mt-1">Success {getSuccessPercentage(product).toFixed(0)}%</p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{product.description}</p>

                            {/* Score bars */}
                            <div className="grid grid-cols-4 gap-2 mb-3">
                              {[
                                { label: 'Trend', value: product.scores.trend, color: 'bg-blue-500' },
                                { label: 'Innovation', value: product.scores.innovation, color: 'bg-purple-500' },
                                { label: 'Feasibility', value: product.scores.feasibility, color: 'bg-emerald-500' },
                                { label: 'Competition', value: product.scores.competition, color: 'bg-amber-500' },
                              ].map(s => (
                                <div key={s.label}>
                                  <p className="text-[9px] text-muted-foreground text-center">{s.label}</p>
                                  <div className="h-1.5 rounded-full bg-slate-100 mt-0.5">
                                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.value * 100}%` }} />
                                  </div>
                                  <p className="text-[9px] text-center text-muted-foreground">{(s.value * 100).toFixed(0)}%</p>
                                </div>
                              ))}
                            </div>

                            {/* Capabilities */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {product.capabilities.map(cap => (
                                <Badge key={cap} style={{ backgroundColor: CAPABILITY_COLORS[cap] + '20', color: CAPABILITY_COLORS[cap], borderColor: CAPABILITY_COLORS[cap] }} variant="outline" className="text-[10px] gap-0.5">
                                  {React.createElement(CAPABILITY_ICONS[cap] || CircleDot, { className: 'w-2.5 h-2.5' })} {cap}
                                </Badge>
                              ))}
                            </div>

                            {/* Key features */}
                            {product.keyFeatures?.length > 0 && (
                              <div className="mt-2">
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">Key Features</p>
                                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                                  {product.keyFeatures.slice(0, 3).map(f => <li key={f}>• {f}</li>)}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>

                  {/* Selected Product Detail */}
                  {selectedProduct && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Left: Basic Details */}
                      <Card className="border-0 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] bg-white/60 backdrop-blur-md lg:col-span-1">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /> Key Features</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            {selectedProduct.keyFeatures?.map((f, i) => (
                              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50/50 border border-slate-100">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                <p className="text-xs font-medium">{f}</p>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-blue-500" /> Target Audience</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedProduct.targetUsers?.map(u => <Badge key={u} variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">{u}</Badge>)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                            <p className="text-xs font-medium flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-emerald-600" /> Product Success Chance</p>
                            <p className="text-2xl font-bold text-emerald-700 mt-1">{getSuccessPercentage(selectedProduct).toFixed(0)}%</p>
                            <p className="text-[10px] text-emerald-800/80 mt-1">Derived from overall score, feasibility, and competition strength.</p>
                          </div>
                          {selectedRequirements.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-amber-500" /> Requirements</p>
                              <div className="space-y-1.5">
                                {selectedRequirements.slice(0, 3).map(req => (
                                  <div key={req.category} className="rounded-lg border border-slate-100 bg-white/70 p-2">
                                    <p className="text-[11px] font-semibold capitalize">{req.category}</p>
                                    <p className="text-[10px] text-muted-foreground">{req.items.slice(0, 2).join(' • ')}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedCodingType && (
                            <div>
                              <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Code className="w-3.5 h-3.5 text-violet-500" /> Coding Type</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedCodingType.languages.map(lang => (
                                  <Badge key={lang} variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-100">{lang}</Badge>
                                ))}
                                {selectedCodingType.frameworks.slice(0, 3).map(framework => (
                                  <Badge key={framework} variant="outline" className="text-[10px] bg-slate-50">{framework}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Middle/Right: Composition Reasoning */}
                      <Card className="border-0 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-lg lg:col-span-2 border border-violet-100/50">
                        <CardHeader className="pb-3 border-b border-slate-100/50">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Workflow className="w-4 h-4 text-indigo-500" /> Composition Architecture: {selectedProduct.name}
                            </CardTitle>
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => setActiveTab('architecture')}>
                              Detailed Blueprint <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="p-4 bg-gradient-to-br from-indigo-50/20 to-violet-50/20">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Combination Recipe</h4>
                            
                            {/* Ingredients section */}
                            <div className="relative">
                              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-dashed bg-slate-200" style={{ backgroundImage: 'linear-gradient(to bottom, #e2e8f0 50%, transparent 50%)', backgroundSize: '1px 8px' }} />
                              
                              <div className="space-y-6 relative">
                                {selectedRepoRecipe.map((repo, idx) => {
                                  return (
                                    <div key={`${repo.name}-${idx}`} className="flex gap-4 items-start translate-z-0">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm z-10 ${idx % 2 === 0 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {React.createElement(CAPABILITY_ICONS[repo.capability] || Github, { className: 'w-6 h-6' })}
                                      </div>
                                      <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="text-sm font-bold truncate">{repo.name}</p>
                                          <Badge className="text-[9px] py-0 h-4 bg-white/80 border-slate-200 capitalize" variant="outline">{repo.capability}</Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground line-clamp-1 italic mb-2">
                                          {repo.why}
                                        </p>
                                        
                                        {/* Show what this repo contributes to the target product */}
                                        <div className="flex items-center gap-2 text-[10px] font-medium text-indigo-600 bg-indigo-50/50 w-fit px-2 py-0.5 rounded-full border border-indigo-100/50">
                                          <Zap className="w-3 h-3" /> 
                                          Contributes: {repo.role}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}

                                {/* The Resulting Product Node */}
                                <div className="flex gap-4 items-start relative pt-2">
                                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/25 z-10 border-2 border-white">
                                    <Sparkles className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 pt-1">
                                    <h4 className="text-sm font-bold text-violet-700">Result: {selectedProduct.name}</h4>
                                    <div className="mt-2 p-2.5 rounded-xl bg-white border border-violet-100 shadow-sm">
                                      <p className="text-xs text-slate-600 leading-relaxed">
                                        {selectedProduct.systemFlow}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {selectedCombinationSteps.length > 0 && (
                                  <div className="pt-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">How They Combine</h4>
                                    <div className="space-y-2">
                                      {selectedCombinationSteps.map(step => (
                                        <div key={step.order} className="rounded-xl border border-slate-100 bg-white/80 p-3">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-[10px]">{step.order}</Badge>
                                            <p className="text-xs font-semibold capitalize">{step.title}</p>
                                          </div>
                                          <p className="text-[11px] text-muted-foreground">{step.summary}</p>
                                          <p className="text-[10px] text-indigo-600 mt-1">Output: {step.output}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              ) : (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground mb-3">No products generated yet</p>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('pipeline')}>Run Pipeline</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ARCHITECTURE TAB */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <TabsContent value="architecture" className="space-y-4">
              {selectedProduct?.architecture ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Architecture: {selectedProduct.name}</h3>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('products')}>
                      <Sparkles className="w-4 h-4 mr-1" /> Back to Products
                    </Button>
                  </div>

                  {/* 4-Section Blueprint */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Frontend */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Monitor className="w-4 h-4 text-blue-500" /> Frontend</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedProduct.architecture.components
                          ?.filter((c: any) => ['react', 'next.js', 'typescript', 'javascript', 'vue', 'ui'].some(t => (c.tech || '').toLowerCase().includes(t)))
                          .map((comp: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm">{comp.name}</p>
                                <Badge variant="outline" className="text-[10px]">{comp.tech}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{comp.role}</p>
                              <p className="text-[10px] text-blue-500 mt-1">Interface: {comp.interface}</p>
                            </div>
                          ))
                        }
                        {selectedProduct.architecture.components?.filter((c: any) => ['react', 'next.js', 'typescript', 'javascript', 'vue', 'ui'].some(t => (c.tech || '').toLowerCase().includes(t))).length === 0 && (
                          <p className="text-sm text-muted-foreground">No frontend components in this architecture</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Backend */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4 text-emerald-500" /> Backend</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedProduct.architecture.components
                          ?.filter((c: any) => ['python', 'fastapi', 'node', 'express', 'go', 'rust', 'api', 'rest', 'graphql'].some(t => (c.tech || '').toLowerCase().includes(t) || (c.interface || '').toLowerCase().includes(t)))
                          .map((comp: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm">{comp.name}</p>
                                <Badge variant="outline" className="text-[10px]">{comp.tech}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{comp.role}</p>
                              <p className="text-[10px] text-emerald-500 mt-1">Interface: {comp.interface}</p>
                            </div>
                          ))
                        }
                      </CardContent>
                    </Card>

                    {/* AI Agents */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4 text-purple-500" /> AI Agents</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedProduct.architecture.components
                          ?.filter((c: any) => ['ai', 'llm', 'ml', 'model', 'service'].some(t => (c.tech || '').toLowerCase().includes(t) || (c.role || '').toLowerCase().includes(t)))
                          .map((comp: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm">{comp.name}</p>
                                <Badge variant="outline" className="text-[10px]">{comp.tech}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{comp.role}</p>
                              <p className="text-[10px] text-purple-500 mt-1">Interface: {comp.interface}</p>
                            </div>
                          ))
                        }
                        {selectedProduct.architecture.components?.filter((c: any) => ['ai', 'llm', 'ml', 'model', 'service'].some(t => (c.tech || '').toLowerCase().includes(t) || (c.role || '').toLowerCase().includes(t))).length === 0 && (
                          <div className="p-3 rounded-lg bg-purple-50 text-xs text-purple-800">
                            AI capabilities are handled by the Python backend pipeline agents
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Data / Memory */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4 text-amber-500" /> Data / Memory</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedProduct.architecture.components
                          ?.filter((c: any) => ['postgres', 'redis', 'mongo', 'sql', 'database', 'storage', 'data', 'cache', 'orm'].some(t => (c.tech || '').toLowerCase().includes(t) || (c.role || '').toLowerCase().includes(t)))
                          .map((comp: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm">{comp.name}</p>
                                <Badge variant="outline" className="text-[10px]">{comp.tech}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{comp.role}</p>
                              <p className="text-[10px] text-amber-500 mt-1">Interface: {comp.interface}</p>
                            </div>
                          ))
                        }
                      </CardContent>
                    </Card>
                  </div>

                  {/* Data Flows */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2"><ArrowRight className="w-4 h-4 text-pink-500" /> Data Flows</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedProduct.architecture.dataFlows?.map((flow: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                          <Badge variant="secondary" className="text-xs">{flow.from}</Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <Badge variant="secondary" className="text-xs">{flow.to}</Badge>
                          <span className="text-xs text-muted-foreground truncate flex-1">{flow.data}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Tech Stack + Deployment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Tech Stack</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1">
                          {selectedProduct.architecture.techStack?.map((t: string) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Deployment</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge className="bg-cyan-100 text-cyan-800">{selectedProduct.architecture.deployment}</Badge>
                        {selectedProduct.architecture.diagramDescription && (
                          <p className="text-xs text-muted-foreground mt-3">{selectedProduct.architecture.diagramDescription}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {selectedStructures && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4 text-violet-500" /> Code Structure</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {selectedStructures.folders.map(folder => (
                            <div key={folder.path} className="p-3 rounded-lg border border-slate-200">
                              <p className="font-mono text-xs font-semibold">{folder.path}</p>
                              <p className="text-xs text-muted-foreground mt-1">{folder.purpose}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4 text-emerald-500" /> Services</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {selectedStructures.services.map(service => (
                            <div key={service.name} className="p-3 rounded-lg border border-slate-200">
                              <p className="font-medium text-sm">{service.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">{service.purpose}</p>
                              <p className="text-[10px] text-emerald-600 mt-1">{service.repos.join(', ')}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              ) : factoryResult?.architecture ? (
                <>
                  <h3 className="text-lg font-semibold">System Architecture</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Boxes className="w-4 h-4 text-cyan-500" /> Components</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {factoryResult.architecture.components?.map((comp: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-sm">{comp.name}</p>
                              <Badge variant="outline" className="text-[10px]">{comp.tech}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{comp.role}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Network className="w-4 h-4 text-pink-500" /> Data Flows</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {factoryResult.architecture.dataFlows?.map((flow: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary" className="text-xs">{flow.from}</Badge>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            <Badge variant="secondary" className="text-xs">{flow.to}</Badge>
                            <span className="text-xs text-muted-foreground truncate">{flow.data}</span>
                          </div>
                        ))}
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-1">Tech Stack</p>
                          <div className="flex flex-wrap gap-1">
                            {factoryResult.architecture.techStack?.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                          </div>
                        </div>
                        <Badge className="bg-cyan-100 text-cyan-800">{factoryResult.architecture.deployment}</Badge>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <Boxes className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground mb-3">No architecture data yet</p>
                    <p className="text-xs text-muted-foreground">Select a product from the Products tab, or run the pipeline first</p>
                    <div className="flex gap-2 justify-center mt-3">
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('pipeline')}>Run Pipeline</Button>
                      {(factoryResult?.composedProducts?.length ?? 0) > 0 && (
                        <Button size="sm" variant="outline" onClick={() => { if (factoryResult?.composedProducts) { setSelectedProduct(factoryResult.composedProducts[0]); setActiveTab('architecture'); } }}>View Product Arch</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
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
