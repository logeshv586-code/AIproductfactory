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
  LayoutGrid, LucideIcon, Terminal, BookOpen, FolderOpen
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
  outputPath?: string
  combinedIntelligenceReport?: any | null
  capabilityGraphEngine?: any | null
  researchReport?: any | null
  feasibilityReport?: any | null
  executionPlan?: any | null
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
      if (data.researchReport) setResearchData(data.researchReport)
      if (data.executionPlan) setPlanData(data.executionPlan)

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
  const intelligenceReport = factoryResult?.combinedIntelligenceReport
  const intelligenceScores = intelligenceReport?.intelligence_scores || {}
  const skillCards = intelligenceReport?.capability_graph?.skill_cards || factoryResult?.capabilityGraphEngine?.skill_cards || []
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
              {/* Premium Background Elements */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(30,20,70,1)_0%,_rgba(2,2,10,1)_100%)]" />
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    x: [0, 100, 0],
                    y: [0, 50, 0],
                  }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-violet-600/20 rounded-full blur-[120px]" 
                />
                <motion.div 
                  animate={{ 
                    scale: [1.2, 1, 1.2],
                    x: [0, -100, 0],
                    y: [0, -50, 0],
                  }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px]" 
                />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay" />
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.8 }}
                className="z-10 text-center max-w-5xl w-full"
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] mb-8 shadow-2xl"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                  <span className="bg-gradient-to-r from-violet-200 via-indigo-200 to-cyan-200 bg-clip-text text-transparent">
                    Neural Orchestration Engine v2.5
                  </span>
                </motion.div>
                
                <h1 className="text-7xl md:text-[10rem] font-black mb-6 tracking-tighter leading-[0.8] bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent">
                  BUILD <br/> <span className="text-violet-500 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">BEYOND</span>.
                </h1>
                
                <p className="text-lg text-slate-400 mb-14 max-w-xl mx-auto leading-relaxed font-medium">
                  The world's first autonomous product engineering suite. <br/>
                  <span className="text-slate-500">From raw intent to production-ready architecture in seconds.</span>
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16 px-4">
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
                      className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center justify-center gap-4 relative overflow-hidden group backdrop-blur-3xl ${productType === type.name ? 'border-violet-500/50 bg-white/10 ring-4 ring-violet-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                    >
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center shadow-2xl group-hover:shadow-white/5 transition-all duration-500 group-hover:rotate-6`}>
                        <type.icon className="w-7 h-7 text-white" />
                      </div>
                      <span className="text-[10px] font-black tracking-[0.1em] uppercase opacity-60 group-hover:opacity-100 transition-opacity">{type.name}</span>
                      {productType === type.name && (
                        <motion.div layoutId="selection-glow" className="absolute inset-0 bg-gradient-to-tr from-violet-500/10 to-transparent pointer-events-none" />
                      )}
                    </motion.button>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-8 px-4">
                  <div className="relative w-full max-w-2xl group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                    <div className="relative flex items-center">
                      <Input 
                        placeholder="What are we building today?" 
                        value={factoryIdea}
                        onChange={(e) => setFactoryIdea(e.target.value)}
                        className="h-24 pl-10 pr-48 bg-black/60 backdrop-blur-3xl border-white/10 text-white placeholder:text-slate-600 rounded-[2.2rem] text-2xl font-medium focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 shadow-2xl transition-all"
                      />
                      <Button 
                        size="lg"
                        disabled={!factoryIdea.trim() || !productType}
                        onClick={() => runFactory()}
                        className="absolute right-3 bg-white text-black hover:bg-slate-200 rounded-3xl h-18 px-10 font-black text-sm tracking-widest uppercase transition-all active:scale-95 disabled:opacity-50 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                      >
                        {factoryBuilding ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Booting...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 fill-current" />
                            <span>Generate</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4">
                    {[
                      { label: 'Autonomous Research', icon: Search, color: 'text-violet-500' },
                      { label: 'Semantic Mapping', icon: Zap, color: 'text-indigo-500' },
                      { label: 'Neural Graphify', icon: Network, color: 'text-emerald-500' },
                      { label: 'Agentic Execution', icon: Terminal, color: 'text-blue-500' },
                    ].map((item, i) => (
                      <motion.div 
                        key={item.label}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        transition={{ delay: 1 + i * 0.1 }}
                        className="flex items-center gap-2.5 text-[9px] font-black tracking-[0.2em] uppercase"
                      >
                        <item.icon className={`w-3 h-3 ${item.color}`} />
                        <span>{item.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              key="workspace"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white"
            >
              <header className="sticky top-0 z-50 backdrop-blur-2xl bg-black/40 border-b border-white/5 shadow-2xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-600 to-cyan-600 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)] animate-pulse-slow">
                      <Github className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-gradient uppercase">Neural Workspace</h1>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span>{productType}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="text-slate-400">{factoryIdea.slice(0, 50)}...</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 px-6 py-2 rounded-2xl bg-white/5 border border-white/5">
                       <div className="flex flex-col items-end">
                         <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">System Load</span>
                         <span className="text-xs font-mono text-emerald-500">OPTIMAL</span>
                       </div>
                       <Separator orientation="vertical" className="h-6 bg-white/10" />
                       <div className="flex flex-col items-end">
                         <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Active Agents</span>
                         <span className="text-xs font-mono text-violet-400">04</span>
                       </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setFactoryLayer('selection')} className="gap-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4 rotate-180" /> <span className="text-[10px] font-black uppercase tracking-widest">Reset Factory</span>
                    </Button>
                  </div>
                </div>
              </header>

              <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                  <div className="flex items-center justify-between">
                    <TabsList className="bg-white/5 backdrop-blur-3xl p-1 rounded-2xl border border-white/5 h-auto min-h-14 flex flex-wrap">
                      <TabsTrigger value="overview" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Overview</TabsTrigger>
                      <TabsTrigger value="pipeline" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Pipeline</TabsTrigger>
                      <TabsTrigger value="research" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2">
                        <Search className="w-3 h-3" /> Research {researching && <Loader2 className="w-3 h-3 animate-spin text-violet-500" />}
                      </TabsTrigger>
                      <TabsTrigger value="plan" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2">
                        <Workflow className="w-3 h-3" /> Plan {planning && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                      </TabsTrigger>
                      <TabsTrigger value="execution" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2">
                        <Terminal className="w-3 h-3" /> Execution {executing && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
                      </TabsTrigger>
                      <TabsTrigger value="graph" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Capability Graph</TabsTrigger>
                      <TabsTrigger value="knowledge" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Knowledge</TabsTrigger>
                      <TabsTrigger value="skills" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Skills</TabsTrigger>
                      <TabsTrigger value="risks" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Risks</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 text-[9px] font-black uppercase tracking-tighter">Live Monitor</Badge>
                      <Badge variant="outline" className="bg-violet-500/10 text-violet-500 border-violet-500/20 px-3 py-1 text-[9px] font-black uppercase tracking-tighter">v2.5 Alpha</Badge>
                    </div>
                  </div>

                  <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {[
                        { label: 'Neural Health', value: 'OPTIMAL', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                        { label: 'Build Velocity', value: '142ms', icon: Zap, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                        { label: 'Knowledge Nodes', value: '1,284', icon: Network, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                        { label: 'Complexity Index', value: 'MID-LEVEL', icon: Boxes, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                      ].map((m) => (
                        <Card key={m.label} className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem] overflow-hidden group hover:border-white/10 transition-all duration-500">
                          <CardContent className="p-8 flex flex-col gap-6">
                            <div className={`p-4 rounded-2xl ${m.bg} ${m.color} w-fit group-hover:scale-110 transition-transform duration-500`}><m.icon className="w-6 h-6" /></div>
                            <div>
                              <p className="text-3xl font-black tracking-tighter">{m.value}</p>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{m.label}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <Card className="lg:col-span-2 border-white/5 bg-gradient-to-br from-violet-600/10 via-indigo-600/5 to-transparent backdrop-blur-3xl rounded-[2.5rem] overflow-hidden relative border-l-4 border-l-violet-500">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12"><Rocket className="w-64 h-64" /></div>
                        <CardHeader className="p-10 pb-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-black text-violet-400 uppercase tracking-widest mb-4">Autonomous Intelligence</div>
                          <CardTitle className="text-4xl font-black tracking-tighter leading-none mb-4">Pipeline Synchronized.</CardTitle>
                          <CardDescription className="text-slate-400 text-lg leading-relaxed max-w-2xl font-medium">
                            Our neural agents have mapped the capability landscape and constructed a high-fidelity system architecture. Ready for deep research and autonomous execution.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-10 pt-6 flex flex-wrap gap-4">
                          <Button onClick={() => setActiveTab('research')} className="bg-white text-black hover:bg-slate-200 rounded-2xl h-14 px-8 font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95">Enter Research Hub</Button>
                          <Button variant="outline" onClick={() => setActiveTab('pipeline')} className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-2xl h-14 px-8 font-black text-xs uppercase tracking-widest transition-all active:scale-95">Monitor Logic</Button>
                        </CardContent>
                      </Card>

                      <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden relative">
                         <CardHeader className="p-10 pb-4">
                            <CardTitle className="text-xl font-black tracking-tighter uppercase">Build Output</CardTitle>
                         </CardHeader>
                         <CardContent className="p-10 pt-2 space-y-6">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                              <FolderOpen className="w-8 h-8 text-violet-500 shrink-0" />
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Local Repository</p>
                                <p className="text-xs font-mono text-slate-300 break-all">{factoryResult?.outputPath || './output/latest_build'}</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Implementation Progress</span>
                                  <span className="text-xs font-bold text-emerald-500">READY</span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  {(factoryResult?.composedProducts?.[0]?.starterBlueprint?.folder_structure?.slice(1, 6) || ['SKILL.md', 'main.py', 'requirements.txt', '.env.example']).map((file: string) => (
                                    <Badge key={file} variant="outline" className="bg-white/5 border-white/10 text-[8px] font-black uppercase">{file.split('/').pop() || file}</Badge>
                                  ))}
                                </div>
                            </div>
                            <Button className="w-full bg-violet-600 hover:bg-violet-700 rounded-xl h-12 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-violet-600/20">
                              Explore Files
                            </Button>
                         </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="knowledge" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <Card className="lg:col-span-2 border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                        <CardHeader>
                          <CardTitle className="text-xl font-black tracking-tighter uppercase">Combined Intelligence Report</CardTitle>
                          <CardDescription>{intelligenceReport?.product_summary?.core_value || 'Run the pipeline to assemble knowledge, memory, research, and execution intelligence.'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(intelligenceScores).map(([metric, score]) => (
                              <div key={metric} className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-2xl font-black">{String(score)}</p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{metric.replace(/_/g, ' ')}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(intelligenceReport?.dynamic_workspace?.tabs || []).map((tab: string) => (
                              <Badge key={tab} variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black uppercase">{tab}</Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                        <CardHeader><CardTitle className="text-sm font-black uppercase">Memory Loop</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {(intelligenceReport?.knowledge_layer?.memory_policy || ['Prompts', 'Failures', 'Successful architectures']).map((item: string) => (
                            <div key={item} className="flex items-start gap-2 text-sm text-slate-400">
                              <Database className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" /> {item}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="skills" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {skillCards.length > 0 ? skillCards.map((skill: any) => (
                        <Card key={skill.id || skill.skill} className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-2xl">
                          <CardHeader>
                            <CardTitle className="text-sm font-black uppercase flex items-center justify-between">
                              {skill.skill}
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{skill.confidence}%</Badge>
                            </CardTitle>
                            <CardDescription>{skill.complexity} · GPU {skill.gpu_requirement}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Production</p>
                              <Progress value={skill.production_readiness || 0} className="h-2" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(skill.recommended_stack || []).map((item: string) => (
                                <Badge key={item} variant="outline" className="bg-white/5 border-white/10 text-[9px]">{item}</Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )) : (
                        <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-2xl md:col-span-2 xl:col-span-3">
                          <CardContent className="p-10 text-center text-slate-400">Run a full build to see Skill MDI cards.</CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="risks" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                        <CardHeader><CardTitle className="text-sm font-black uppercase">Domain Risks</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {(intelligenceReport?.risk_analysis?.domain_risks || ['Run the pipeline to calculate domain risk.']).map((risk: string) => (
                            <div key={risk} className="flex items-start gap-3 text-sm text-slate-400">
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> {risk}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                        <CardHeader><CardTitle className="text-sm font-black uppercase">Compliance</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {(intelligenceReport?.risk_analysis?.compliance || []).map((item: string) => (
                            <div key={item} className="flex items-start gap-3 text-sm text-slate-400">
                              <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {item}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
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
                          <CardContent><ul className="space-y-2">{(researchData.key_findings || []).map((f: string, i: number) => <li key={i} className="text-sm text-slate-600 flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {f}</li>)}</ul></CardContent>
                        </Card>
                        <Card className="border-0 shadow-sm">
                          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Patterns</CardTitle></CardHeader>
                          <CardContent><div className="space-y-3">{(researchData.recommended_patterns || []).map((p: any, i: number) => <div key={i} className="p-3 bg-slate-50 rounded-lg"><p className="text-sm font-bold">{p.name}</p><p className="text-xs text-slate-500">{p.description}</p></div>)}</div></CardContent>
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
                    <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
                      <CardHeader className="p-10 pb-4">
                        <CardTitle className="text-xl font-black tracking-tighter uppercase">Engineering Pipeline Monitor</CardTitle>
                        <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Real-time neural state synchronization</CardDescription>
                      </CardHeader>
                      <CardContent className="p-10 pt-6">
                        <div className="space-y-12 relative">
                          <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-violet-500 via-indigo-500 to-transparent opacity-20" />
                          {PIPELINE_STEPS.map((step, i) => (
                            <div key={step.id} className={`flex items-start gap-8 transition-all duration-700 relative z-10 ${pipelineStep >= i ? 'opacity-100' : 'opacity-20 grayscale'}`}>
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shrink-0 shadow-2xl relative`}>
                                {pipelineStep === i && (
                                  <motion.div 
                                    layoutId="pipeline-active-glow" 
                                    className="absolute -inset-2 bg-white/20 rounded-2xl blur-lg" 
                                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                )}
                                <step.icon className={`w-5 h-5 text-white ${pipelineStep === i ? 'animate-pulse' : ''}`} />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-black tracking-tight uppercase">{step.label}</h4>
                                  {pipelineStep > i && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                                      <span className="text-[8px] font-black text-emerald-500 tracking-tighter uppercase">Verified</span>
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    </motion.div>
                                  )}
                                  {pipelineStep === i && (
                                    <div className="flex items-center gap-3">
                                      <span className="text-[8px] font-black text-blue-400 tracking-tighter uppercase animate-pulse">Processing...</span>
                                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md">{step.desc}</p>
                                {pipelineStep === i && (
                                  <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: '100%' }} 
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="h-1 bg-white/10 rounded-full overflow-hidden mt-4"
                                  >
                                    <div className={`h-full bg-gradient-to-r ${step.color}`} />
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="graph" className="h-[700px] border border-white/5 rounded-[3rem] bg-white/5 backdrop-blur-3xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(139,92,246,0.1)_0%,_transparent_70%)]" />
                    <div ref={graphCanvasRef} className="w-full h-full relative z-10">
                      <svg className="w-full h-full">
                        <defs>
                          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.1)" />
                          </marker>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                          </filter>
                        </defs>
                        {graphEdges.map(edge => {
                          const source = graphNodes.find(n => n.id === edge.source)
                          const target = graphNodes.find(n => n.id === edge.target)
                          if (!source || !target) return null
                          const x1 = getNodeX(source, graphNodes); const y1 = getNodeY(source, graphNodes)
                          const x2 = getNodeX(target, graphNodes); const y2 = getNodeY(target, graphNodes)
                          return (
                            <motion.line 
                              key={edge.id} 
                              x1={x1} y1={y1} x2={x2} y2={y2} 
                              stroke={edge.color} 
                              strokeWidth="1.5" 
                              strokeDasharray="4 4"
                              markerEnd="url(#arrowhead)" 
                              initial={{ pathLength: 0, opacity: 0 }} 
                              animate={{ pathLength: 1, opacity: 0.15 }} 
                            />
                          )
                        })}
                        {graphNodes.map(node => (
                          <motion.g 
                            key={node.id} 
                            initial={{ scale: 0, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            whileHover={{ scale: 1.15 }} 
                            onClick={() => setSelectedNode(node)} 
                            className="cursor-pointer"
                          >
                            <circle 
                              cx={getNodeX(node, graphNodes)} 
                              cy={getNodeY(node, graphNodes)} 
                              r="28" 
                              fill="rgba(15, 23, 42, 0.8)" 
                              stroke={node.color} 
                              strokeWidth="2" 
                              filter="url(#glow)"
                            />
                            <foreignObject x={getNodeX(node, graphNodes) - 12} y={getNodeY(node, graphNodes) - 12} width="24" height="24">
                              <div style={{ color: node.color }} className="flex items-center justify-center">
                                {node.type === 'repo' ? <Github size={20} /> : node.type === 'capability' ? <Zap size={20} /> : <Rocket size={20} />}
                              </div>
                            </foreignObject>
                            <text 
                              x={getNodeX(node, graphNodes)} 
                              y={getNodeY(node, graphNodes) + 45} 
                              textAnchor="middle" 
                              className="text-[9px] font-black fill-slate-400 uppercase tracking-widest"
                            >
                              {node.label}
                            </text>
                            {selectedNode?.id === node.id && (
                              <circle 
                                cx={getNodeX(node, graphNodes)} 
                                cy={getNodeY(node, graphNodes)} 
                                r="34" 
                                fill="none" 
                                stroke={node.color} 
                                strokeWidth="1" 
                                strokeDasharray="4 4"
                                className="animate-slow-spin"
                              />
                            )}
                          </motion.g>
                        ))}
                      </svg>
                    </div>

                    <AnimatePresence>
                      {selectedNode && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          className="absolute bottom-10 left-10 right-10 glass-dark p-8 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-10"
                        >
                          <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center" style={{ color: selectedNode.color }}>
                              {selectedNode.type === 'repo' ? <Github size={32} /> : selectedNode.type === 'capability' ? <Zap size={32} /> : <Rocket size={32} />}
                            </div>
                            <div>
                              <h3 className="text-2xl font-black tracking-tighter uppercase">{selectedNode.label}</h3>
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{selectedNode.type} Node · {selectedNode.capability || 'Core Capability'}</p>
                            </div>
                          </div>
                          <div className="flex-1 max-w-xl">
                            <p className="text-slate-400 text-sm font-medium leading-relaxed">
                              {selectedNode.description || "Synthesizing relational data for this node. Capability mapping shows high affinity with existing architecture components."}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setSelectedNode(null)} className="rounded-xl border-white/10 hover:bg-white/10">Dismiss</Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
