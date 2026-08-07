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
  LayoutGrid, LucideIcon, Terminal, BookOpen, FolderOpen,
  Dna, Gauge, Swords, ScanSearch, FlaskConical, Waypoints, History, Library, GitFork, Route as RouteIcon, GitCompare, Trophy, Medal
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

// ── v3 Product Intelligence Engine types ──────────────────────────────
interface V3Strategy {
  id: string
  name: string
  tagline: string
  description: string
  features: string[]
  capabilities: string[]
  architecture: string
  timeline: string
  estimated_cost: string
  complexity: 'low' | 'medium' | 'high'
  innovation_score: number
  feasibility: number
  market_opportunity: number
  risk_level: 'low' | 'medium' | 'high'
  risks: string[]
  repository_map: Record<string, string>
  differentiation: string
  why: string
}

interface V3Graph {
  intent: any
  requirements: any[]
  market: any
  existing_products: any[]
  gaps: any[]
  capabilities: { capabilities: any[]; edges: any[]; domain: string }
  repos: any[]
  capability_mappings: any[]
  strategies: V3Strategy[]
  approved_strategy: any
  deep_research: any
  composition_plan: any
  architecture: any
  architecture_views: any
  blueprint: any
  engineering: any
  execution_plan: any
  opportunity_statement: string
  trace: any[]
  // v4 — Product Intelligence Operating System sections
  product_thinking: any
  competitors: any[]
  innovation: any
  evolution: any
  repository_intelligence: { reports: any[]; summary: any; note?: string }
  review: any
  evidence: any[]
  decisions: any[]
  learning: any
  // v5 — Collaborative Reasoning & Evidence Graph sections
  confidences: any
  debates: any[]
  product_dna: any
  self_critique: any
  architecture_simulation: any
  // v6 — Experience-Based Learning
  learning_evidence?: any
  // v6 Phase 6 — Product Memory retrieval (entry-point retrieval results)
  product_memory?: any
  // v6 Phase 4 — Strategy Tournament (winner, ranking, dimension scores, comparisons)
  tournament?: any
}

interface V3StrategizeResult {
  success: boolean
  run_id: string
  graph: V3Graph
  strategies: V3Strategy[]
  review: any
  confidences?: any
  self_critique?: any
  product_dna?: any
  debates?: any[]
  status: string
  error?: string
}

interface V3ApproveResult {
  success: boolean
  run_id: string
  graph: V3Graph
  approved_strategy: any
  product_dna?: any
  architecture_simulation?: any
  status: string
  error?: string
}

interface PiExplainResult {
  success: boolean
  run_id: string
  explanation: string
  decisions: any[]
  debates: any[]
  evidence: any[]
  confidences: any
  self_critique: any
  product_dna: any
  error?: string
}

// v6 · Experience-Based Learning — what the system has learned across products
interface PiLearningResult {
  success: boolean
  learning: {
    repositories: Record<string, {
      used_in: number; approved: number; failures: number
      success_rate: number; quality_score: number; boosted: number; learned_score: number
    }>
    repository_count: number
    capability_rankings: Record<string, {
      best_repo: string; successes: number; failures: number; success_rate: number; evidence_count: number
    }>
    capability_count: number
    architecture_stats: Record<string, {
      outcome: string; count: number; success_rate: number; outcomes: Record<string, number>
    }>
    architecture_count: number
    confidence_calibration: {
      count: number; mean_prediction: number; mean_observed: number
      correction: number; reliability: number; note: string
    }
    store_summary: Record<string, number>
    has_evidence: boolean
  }
  error?: string
}

// v6 Phase 6 · Product Memory — retrieval of similar past products
interface PiMemoryResult {
  success: boolean
  draft?: {
    draft: boolean; domain: string; capabilities: string[]
    capability_count: number; complexity: string; idea: string
  }
  matches?: Array<{
    run_id: string
    idea: string
    domain: string
    similarity: number
    dna_similarity: number
    capability_overlap: number
    matching_capabilities: string[]
    shared_repositories: string[]
    shared_architectures: string[]
    differences: string[]
    historical_outcome: {
      approved_strategy: string; strategy_name: string
      final_score: number | null; self_critique_passed: boolean
      self_critique_score: number; overall_confidence: number
    }
    record: any
  }>
  has_memory?: boolean
  total_memory?: number
  note?: string
  count?: number
  error?: string
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

const INTEL_STAGES = [
  'Product Thinking',
  'Intent Intelligence',
  'Requirement Intelligence',
  'Market Intelligence',
  'Competitor Intelligence',
  'Innovation Intelligence',
  'Evolution Analysis',
  'Gap Analysis',
  'Capability Intelligence',
  'GitHub Intelligence',
  'Repository Intelligence',
  'Agent Debate',
  'Strategy Generation',
  'Review Agent',
  'Confidence Propagation',
  'Self-Critique',
  'Product DNA',
]

const STRATEGY_ICON: Record<string, LucideIcon> = {
  'STRAT-A': Target,
  'STRAT-B': Brain,
  'STRAT-C': Layers,
  'STRAT-D': Zap,
}

const STRATEGY_COLOR: Record<string, string> = {
  'STRAT-A': 'from-emerald-500 to-teal-600',
  'STRAT-B': 'from-violet-500 to-indigo-600',
  'STRAT-C': 'from-rose-500 to-pink-600',
  'STRAT-D': 'from-amber-500 to-orange-600',
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

  // v3 Product Intelligence Engine state
  const [intelLoading, setIntelLoading] = useState(false)
  const [intelStep, setIntelStep] = useState(-1)
  const [strategizeResult, setStrategizeResult] = useState<V3StrategizeResult | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approvalResult, setApprovalResult] = useState<V3ApproveResult | null>(null)

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
        setPlanData(normalizePlanForUi(data.plan))
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

  // v5 state — Evidence Graph explanation drawer
  const [explainResult, setExplainResult] = useState<PiExplainResult | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)

  // v6 state — Experience-Based Learning evidence
  const [learningResult, setLearningResult] = useState<PiLearningResult | null>(null)
  const [learningLoading, setLearningLoading] = useState(false)

  // v6 Phase 6 state — Product Memory retrieval
  const [memorySearch, setMemorySearch] = useState<PiMemoryResult | null>(null)
  const [memoryLoading, setMemoryLoading] = useState(false)

  // ── v4 Reasoning-first pipeline (pi/strategize → pi/approve) ──────────
  const runStrategize = useCallback(async () => {
    if (!factoryIdea.trim()) { toast.error('Enter a product idea first!'); return }
    if (pythonHealth && !pythonHealth.available) {
      toast.error(`Reasoning Engine needs the Python backend: ${pythonHealth.error || 'unreachable'}`, { duration: 5000 })
      return
    }
    setIntelLoading(true)
    setIntelStep(0)
    setStrategizeResult(null)
    setApprovalResult(null)
    setFactoryLayer('workspace')
    setActiveTab('intelligence')
    try {
      const res = await fetch('/api/factory/pi/strategize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: factoryIdea.trim(), githubToken: undefined, tavilyKey: undefined }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Reasoning failed')
      } else {
        setStrategizeResult(data)
        toast.success(`Reasoning complete — ${data.strategies?.length || 0} strategies ready for review`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Reasoning engine failed')
    } finally {
      setIntelLoading(false)
      setIntelStep(INTEL_STAGES.length)
    }
  }, [factoryIdea, pythonHealth])

  const approveStrategy = useCallback(async (strategy: V3Strategy) => {
    if (!strategizeResult?.run_id) return
    setApprovingId(strategy.id)
    try {
      const res = await fetch('/api/factory/pi/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: strategizeResult.run_id, strategyId: strategy.id }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Approval failed')
      } else {
        setApprovalResult(data)
        toast.success(`Strategy ${strategy.id} approved — blueprint built`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Approval failed')
    } finally {
      setApprovingId(null)
    }
  }, [strategizeResult])

  const fetchExplain = useCallback(async (runId: string) => {
    setExplainLoading(true)
    try {
      const res = await fetch('/api/factory/pi/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Could not load explanation')
      } else {
        setExplainResult(data)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not load explanation')
    } finally {
      setExplainLoading(false)
    }
  }, [])

  // v6 · Experience-Based Learning — fetch what the system has learned
  const fetchLearning = useCallback(async () => {
    setLearningLoading(true)
    try {
      const res = await fetch('/api/factory/pi/learning', { cache: 'no-store' })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Could not load learning evidence')
      } else {
        setLearningResult(data)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not load learning evidence')
    } finally {
      setLearningLoading(false)
    }
  }, [])

  // v6 Phase 6 · Product Memory — search past products similar to the idea
  const searchMemory = useCallback(async (idea: string) => {
    if (!idea.trim()) { toast.error('Enter a product idea to search memory'); return }
    setMemoryLoading(true)
    try {
      const res = await fetch('/api/factory/pi/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Could not search product memory')
      } else {
        setMemorySearch(data)
        toast.success(`Memory search: ${data.matches?.length || 0} similar past product${(data.matches?.length || 0) === 1 ? '' : 's'}`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not search product memory')
    } finally {
      setMemoryLoading(false)
    }
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
      if (data.executionPlan) setPlanData(normalizePlanForUi(data.executionPlan))

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

  // Animate intelligence stages
  useEffect(() => {
    if (!intelLoading) return
    const interval = setInterval(() => {
      setIntelStep(prev => {
        if (prev >= INTEL_STAGES.length - 1) return prev
        return prev + 1
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [intelLoading])

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
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={!factoryIdea.trim() || intelLoading}
                    onClick={() => runStrategize()}
                    className="mt-4 border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-3xl h-12 px-8 font-black text-xs tracking-widest uppercase transition-all active:scale-95 disabled:opacity-50"
                  >
                    {intelLoading ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                        <span>Reasoning...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Brain className="w-4 h-4 text-violet-400" />
                        <span>Reason First · Plan Products</span>
                      </div>
                    )}
                  </Button>
                  
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
                      <TabsTrigger value="intelligence" className="px-6 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2">
                        <Brain className="w-3 h-3" /> Intelligence {intelLoading && <Loader2 className="w-3 h-3 animate-spin text-violet-500" />}
                      </TabsTrigger>
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

                  <TabsContent value="intelligence" className="space-y-6">
                    {!strategizeResult && intelLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-8">
                        <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
                        <p className="text-slate-500 font-medium animate-pulse">Reasoning First: 12 agents thinking through your product...</p>
                        <div className="w-full max-w-md space-y-3">
                          {INTEL_STAGES.map((stage, i) => (
                            <div key={stage} className={`flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-all ${intelStep >= i ? 'text-slate-300' : 'text-slate-700'}`}>
                              {intelStep > i ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : intelStep === i ? <Loader2 className="w-4 h-4 animate-spin text-violet-500" /> : <CircleDot className="w-4 h-4" />}
                              <span>{stage}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : !strategizeResult ? (
                      <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2.5rem]">
                        <CardContent className="p-12 text-center space-y-4">
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-2xl">
                            <Brain className="w-8 h-8 text-white" />
                          </div>
                          <h3 className="text-2xl font-black tracking-tighter uppercase">Product Intelligence OS</h3>
                          <p className="text-slate-400 max-w-md mx-auto text-sm font-medium">
                            Understand → Reason → Research → Compare → Innovate → Decompose → Discover → Validate → Compose →
                            Approve → Engineer → Learn. 12 agents reason over a shared knowledge graph — nothing is built until you approve.
                          </p>
                          <Button onClick={() => runStrategize()} disabled={!factoryIdea.trim()} className="bg-violet-600 hover:bg-violet-700 rounded-2xl h-12 px-8 font-black text-xs uppercase tracking-widest gap-2">
                            <Brain className="w-4 h-4" /> {factoryIdea.trim() ? 'Reason from my idea' : 'Enter an idea first'}
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-8">
                        {/* v6 Phase 6 · Product Memory — retrieval entry point */}
                        {strategizeResult.graph?.product_memory && (
                          <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-600/10 to-transparent backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Library className="w-4 h-4 text-indigo-400" /> Product Memory · Retrieved First</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] font-black uppercase">reasoning entry point</Badge>
                                  <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 text-[9px] font-black uppercase">
                                    {strategizeResult.graph.product_memory.matches?.length || 0} similar · {strategizeResult.graph.product_memory.total_memory || 0} in memory
                                  </Badge>
                                </div>
                              </div>
                              <CardDescription className="text-indigo-200/60 text-[10px] font-bold uppercase tracking-widest pt-1">Past products were retrieved before reasoning and influenced debate & strategy</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-3 space-y-3">
                              {(strategizeResult.graph.product_memory.matches?.length || 0) > 0 ? (
                                strategizeResult.graph.product_memory.matches.slice(0, 3).map((m: any, i: number) => (
                                  <div key={i} className="rounded-2xl border border-indigo-500/20 bg-slate-950/50 p-4 space-y-2.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <p className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                        <GitCompare className="w-3.5 h-3.5 text-indigo-400" /> {m.idea || m.domain || 'Past product'}
                                      </p>
                                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] font-black uppercase">{Math.round((m.similarity || 0) * 100)}% similar</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                      <span className="text-slate-400">#{m.run_id?.slice(0, 8)}</span>
                                      <span className="text-indigo-300">{m.domain}</span>
                                      {m.historical_outcome?.approved_strategy && <span>· {m.historical_outcome.approved_strategy}</span>}
                                      {m.historical_outcome?.self_critique_passed !== undefined && <span>· critique {m.historical_outcome.self_critique_passed ? 'passed' : 'flagged'}</span>}
                                    </div>
                                    {(m.matching_capabilities?.length || 0) > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {m.matching_capabilities.slice(0, 5).map((cap: string, j: number) => (
                                          <Badge key={j} variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-[8px] font-bold uppercase">✓ {cap}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {(m.shared_repositories?.length || 0) > 0 && (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <GitFork className="w-3 h-3 text-emerald-500 shrink-0" />
                                        {m.shared_repositories.slice(0, 4).map((repo: string, j: number) => (
                                          <Badge key={j} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] font-mono">{repo}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {(m.shared_architectures?.length || 0) > 0 && (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <RouteIcon className="w-3 h-3 text-cyan-500 shrink-0" />
                                        {m.shared_architectures.slice(0, 3).map((arch: string, j: number) => (
                                          <Badge key={j} variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[8px] font-mono">{arch}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {(m.differences?.length || 0) > 0 && (
                                      <div className="flex items-start gap-2 text-[10px] text-amber-300/80">
                                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                        <span>{m.differences[0]}{m.differences.length > 1 ? ` · ${m.differences.length - 1} more` : ''}</span>
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-start gap-3">
                                  <Library className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-bold text-slate-300">{strategizeResult.graph.product_memory.note || 'No similar past products found.'}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Reasoning runs from first principles — this run can be the first memory.</p>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Opportunity statement banner */}
                        {strategizeResult.graph?.opportunity_statement && (
                          <Card className="border-violet-500/20 bg-gradient-to-r from-violet-600/10 to-transparent backdrop-blur-3xl rounded-[2rem] border-l-4 border-l-violet-500">
                            <CardContent className="p-6 flex items-start gap-4">
                              <Lightbulb className="w-8 h-8 text-violet-400 shrink-0 mt-1" />
                              <div>
                                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">Opportunity Statement</p>
                                <p className="text-slate-200 font-medium leading-relaxed">{strategizeResult.graph.opportunity_statement}</p>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* v4 · Product Thinking (PM reasoning) */}
                        {strategizeResult.graph?.product_thinking && (
                          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-transparent backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Brain className="w-4 h-4 text-violet-500" /> Product Thinking</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black uppercase">{strategizeResult.graph.product_thinking.market_maturity} market</Badge>
                                  <Badge variant="outline" className={`${(strategizeResult.graph.product_thinking.confidence || 0) >= 0.6 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'} text-[9px] font-black uppercase`}>confidence {Math.round((strategizeResult.graph.product_thinking.confidence || 0) * 100)}%</Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Business Objective</p>
                                  <p className="text-xs text-slate-300 font-medium leading-relaxed">{strategizeResult.graph.product_thinking.business_objective}</p>
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Value Proposition</p>
                                  <p className="text-xs text-slate-300 font-medium leading-relaxed">{strategizeResult.graph.product_thinking.value_proposition}</p>
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Revenue Model</p>
                                  <p className="text-xs text-slate-300 font-medium leading-relaxed">{strategizeResult.graph.product_thinking.revenue_model}</p>
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Product Vision</p>
                                  <p className="text-xs text-slate-300 font-medium leading-relaxed">{strategizeResult.graph.product_thinking.product_vision}</p>
                                </div>
                              </div>
                              {(strategizeResult.graph.product_thinking.customer_segments?.length || 0) > 0 && (
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Customer Segments</p>
                                  <div className="flex flex-wrap gap-2">
                                    {strategizeResult.graph.product_thinking.customer_segments.map((seg: any, i: number) => (
                                      <Badge key={i} variant="outline" className="bg-violet-500/10 border-violet-500/20 text-violet-300 text-[9px] font-bold uppercase">{seg.name}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(strategizeResult.graph.product_thinking.success_metrics?.length || 0) > 0 && (
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Success Metrics</p>
                                  <div className="flex flex-wrap gap-2">
                                    {strategizeResult.graph.product_thinking.success_metrics.map((m: string, i: number) => (
                                      <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-slate-300 text-[9px] font-bold uppercase">{m}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {strategizeResult.graph.product_thinking.clarifying_questions?.length > 0 && (
                                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3">
                                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1.5">Clarifying Questions</p>
                                  <ul className="space-y-1">
                                    {strategizeResult.graph.product_thinking.clarifying_questions.map((q: string, i: number) => (
                                      <li key={i} className="text-xs text-amber-200/80">• {q}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v4 · Review Agent — validates the whole graph before approval */}
                        {strategizeResult.review && (
                          <Card className={`border-2 ${strategizeResult.review.verdict === 'approve' ? 'border-emerald-500/30' : strategizeResult.review.verdict === 'review' ? 'border-amber-500/30' : 'border-rose-500/30'} bg-white/5 backdrop-blur-3xl rounded-[2rem]`}>
                            <CardHeader className="p-6 pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Shield className={`w-4 h-4 ${strategizeResult.review.verdict === 'approve' ? 'text-emerald-500' : strategizeResult.review.verdict === 'review' ? 'text-amber-500' : 'text-rose-500'}`} /> Review Agent · Graph Validation</CardTitle>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score</p>
                                    <p className={`text-2xl font-black ${strategizeResult.review.score >= 80 ? 'text-emerald-500' : strategizeResult.review.score >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>{strategizeResult.review.score}<span className="text-xs text-slate-500">/100</span></p>
                                  </div>
                                  <Badge variant="outline" className={`${strategizeResult.review.verdict === 'approve' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : strategizeResult.review.verdict === 'review' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'} text-[9px] font-black uppercase`}>{strategizeResult.review.verdict}</Badge>
                                </div>
                              </div>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-1">Every decision is evidence-backed before you approve</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-3">
                              {(strategizeResult.review.findings?.length || 0) > 0 && (
                                <div className="space-y-2">
                                  {strategizeResult.review.findings.map((f: any, i: number) => (
                                    <div key={i} className={`flex items-start gap-3 rounded-xl p-2.5 ${f.severity === 'critical' ? 'bg-rose-500/10 border border-rose-500/20' : f.severity === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/5 border border-white/10'}`}>
                                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${f.severity === 'critical' ? 'text-rose-500' : f.severity === 'warning' ? 'text-amber-500' : 'text-slate-400'}`} />
                                      <div>
                                        <p className="text-xs font-bold text-slate-300">{f.message}</p>
                                        {f.recommendation && <p className="text-[10px] text-slate-500 mt-0.5">→ {f.recommendation}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(strategizeResult.review.recommendations?.length || 0) > 0 && !(strategizeResult.review.findings?.length) && (
                                <div className="flex flex-wrap gap-2">
                                  {strategizeResult.review.recommendations.map((r: string, i: number) => (
                                    <Badge key={i} variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-bold uppercase">{r}</Badge>
                                  ))}
                                </div>
                              )}
                              {strategizeResult.review.reasoning && (
                                <p className="text-[10px] text-slate-500 italic">{strategizeResult.review.reasoning}</p>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v5 · Confidence Propagation — every node carries confidence */}
                        {(strategizeResult.graph?.confidences || strategizeResult.confidences) && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Gauge className="w-4 h-4 text-cyan-500" /> Confidence Propagation</CardTitle>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Confidence flows root → leaf · low nodes trigger refinement</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-3 space-y-4">
                              {(strategizeResult.graph?.confidences?.low_confidence?.length || 0) > 0 && (
                                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3">
                                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1.5">Low-confidence nodes — triggered refinement</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {strategizeResult.graph.confidences.low_confidence.map((s: string, i: number) => (
                                      <Badge key={i} variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[9px] font-bold uppercase">{s}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="space-y-2.5">
                                {Object.entries(strategizeResult.graph?.confidences || {}).filter(([k]) => k !== 'low_confidence' && k !== 'overall').map(([stage, conf]: [string, any]) => (
                                  <div key={stage}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stage.replace(/_/g, ' ')}</span>
                                      <span className={`text-[10px] font-black ${conf >= 0.8 ? 'text-emerald-400' : conf >= 0.6 ? 'text-slate-300' : 'text-amber-400'}`}>{Math.round(conf * 100)}%</span>
                                    </div>
                                    <Progress value={conf * 100} className={`h-1.5 bg-white/5 ${conf < 0.6 ? '[&>div]:bg-amber-500' : '[&>div]:bg-cyan-500'}`} />
                                  </div>
                                ))}
                                {typeof (strategizeResult.graph?.confidences?.overall ?? strategizeResult.confidences?.overall) === 'number' && (
                                  <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3 mt-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Overall confidence</span>
                                    <span className="text-xl font-black text-cyan-400">{Math.round((strategizeResult.graph?.confidences?.overall ?? strategizeResult.confidences?.overall) * 100)}%</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* v6 · Experience-Based Learning — prior outcomes bias this run */}
                        {(strategizeResult.graph?.learning_evidence?.has_evidence) && (
                          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-600/10 to-transparent backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><History className="w-4 h-4 text-emerald-500" /> Experience-Based Learning</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black uppercase">closed loop</Badge>
                                  <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 text-[9px] font-black uppercase">
                                    {strategizeResult.graph.learning_evidence.repository_count || 0} repos · {strategizeResult.graph.learning_evidence.capability_count || 0} caps · {strategizeResult.graph.learning_evidence.architecture_count || 0} arch
                                  </Badge>
                                </div>
                              </div>
                              <CardDescription className="text-emerald-200/60 text-[10px] font-bold uppercase tracking-widest pt-1">Past approved products biased discovery, debate & strategy selection</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-3 space-y-4">
                              {/* Top learned repositories */}
                              {Object.keys(strategizeResult.graph.learning_evidence.repositories || {}).length > 0 && (
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Proven Repositories</p>
                                  <div className="space-y-1.5">
                                    {Object.entries(strategizeResult.graph.learning_evidence.repositories).slice(0, 5).map(([name, r]: [string, any]) => (
                                      <div key={name} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                          <History className="w-3.5 h-3.5 text-emerald-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-slate-200 font-mono truncate">{name}</p>
                                          <p className="text-[9px] text-slate-500">{r.used_in} uses · {r.approved} ok · {r.failures} fail</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                          <p className="text-[10px] font-black text-emerald-400">{Math.round((r.success_rate || 0) * 100)}%</p>
                                          <p className="text-[8px] text-slate-500 uppercase tracking-widest">success</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Learned capability → repository rankings */}
                              {Object.keys(strategizeResult.graph.learning_evidence.capability_rankings || {}).length > 0 && (
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Capability → Repo Rankings</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(strategizeResult.graph.learning_evidence.capability_rankings).slice(0, 8).map(([cap, rank]: [string, any]) => (
                                      <Badge key={cap} variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-[9px] font-bold uppercase">
                                        {cap} → <span className="text-emerald-400 font-mono">{rank.best_repo}</span>
                                        <span className="text-slate-500 ml-1">({rank.evidence_count})</span>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Confidence calibration */}
                              {strategizeResult.graph.learning_evidence.confidence_calibration?.count > 0 && (
                                <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Confidence Calibration</p>
                                    <p className="text-[10px] text-slate-400">{strategizeResult.graph.learning_evidence.confidence_calibration.note}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-lg font-black text-emerald-400">{Math.round((strategizeResult.graph.learning_evidence.confidence_calibration.reliability || 0) * 100)}%</p>
                                    <p className="text-[8px] text-slate-500 uppercase tracking-widest">reliability</p>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v5 · Product DNA — a comparable signature for this product */}
                        {(strategizeResult.graph?.product_dna || strategizeResult.product_dna) && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Dna className="w-4 h-4 text-emerald-500" /> Product DNA</CardTitle>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">A comparable signature for future products</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-3 space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  { label: 'Capabilities', value: String(strategizeResult.graph?.product_dna?.capabilities ?? strategizeResult.product_dna?.capabilities ?? 0) },
                                  { label: 'Repositories', value: String(strategizeResult.graph?.product_dna?.repositories ?? strategizeResult.product_dna?.repositories ?? 0) },
                                  { label: 'Innovation', value: `${Math.round((strategizeResult.graph?.product_dna?.innovation_score ?? strategizeResult.product_dna?.innovation_score ?? 0) * 100)}%` },
                                  { label: 'Market Gap', value: `${Math.round((strategizeResult.graph?.product_dna?.market_gap ?? strategizeResult.product_dna?.market_gap ?? 0) * 100)}%` },
                                  { label: 'Complexity', value: strategizeResult.graph?.product_dna?.complexity ?? strategizeResult.product_dna?.complexity ?? '—' },
                                  { label: 'Confidence', value: `${Math.round((strategizeResult.graph?.product_dna?.confidence ?? strategizeResult.product_dna?.confidence ?? 0) * 100)}%` },
                                  { label: 'Domain', value: strategizeResult.graph?.product_dna?.domain ?? strategizeResult.product_dna?.domain ?? '—' },
                                ].map((s) => (
                                  <div key={s.label} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                    <p className="text-sm font-black text-slate-200 capitalize truncate">{s.value}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <Hash className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[10px] font-mono text-emerald-400">{(strategizeResult.graph?.product_dna?.signature ?? strategizeResult.product_dna?.signature ?? '').toUpperCase()}</span>
                              </div>
                              {(strategizeResult.graph?.product_dna?.summary || strategizeResult.product_dna?.summary) && (
                                <p className="text-[10px] text-slate-500 italic">{(strategizeResult.graph?.product_dna?.summary ?? strategizeResult.product_dna?.summary ?? '')}</p>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v5 · Self-Critique — the AI questions itself before presenting */}
                        {(strategizeResult.graph?.self_critique || strategizeResult.self_critique) && (
                          <Card className={`border-2 ${(strategizeResult.graph?.self_critique?.passed ?? strategizeResult.self_critique?.passed) ? 'border-emerald-500/20' : 'border-amber-500/30'} bg-white/5 backdrop-blur-3xl rounded-[2rem]`}>
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><ScanSearch className="w-4 h-4 text-rose-400" /> Self-Critique</CardTitle>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score</span>
                                  <span className={`text-xl font-black ${(strategizeResult.graph?.self_critique?.score ?? strategizeResult.self_critique?.score ?? 0) >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{strategizeResult.graph?.self_critique?.score ?? strategizeResult.self_critique?.score ?? 0}</span>
                                  {(strategizeResult.graph?.self_critique?.passed ?? strategizeResult.self_critique?.passed) ? (
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black uppercase">Passed</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-black uppercase">Needs work</Badge>
                                  )}
                                </div>
                              </div>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-1">Did I misunderstand · miss a competitor · simplify? Checked before presenting</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-2">
                              {(strategizeResult.graph?.self_critique?.concerns?.length || strategizeResult.self_critique?.concerns?.length || 0) > 0 && (
                                <div className="space-y-2">
                                  {(strategizeResult.graph?.self_critique?.concerns ?? strategizeResult.self_critique?.concerns ?? []).map((c: any, i: number) => (
                                    <div key={i} className={`rounded-xl p-2.5 border ${c.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                                      <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{c.question}</p>
                                      <p className="text-xs text-slate-300 mt-0.5">{c.finding}</p>
                                      {c.action && <p className="text-[10px] text-slate-500 mt-0.5">→ {c.action}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(strategizeResult.graph?.self_critique?.improvements?.length || 0) > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {(strategizeResult.graph?.self_critique?.improvements ?? []).map((imp: string, i: number) => (
                                    <Badge key={i} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-bold uppercase">✓ {imp}</Badge>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v5 · Agent Debate — every architectural decision has reasoning */}
                        {(strategizeResult.graph?.debates?.length || strategizeResult.debates?.length || 0) > 0 && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Swords className="w-4 h-4 text-orange-400" /> Agent Debate · Decision Engine</CardTitle>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Capability ↔ Repository ↔ Architecture challenged, then decided</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-4">
                              {(strategizeResult.graph?.debates ?? strategizeResult.debates ?? []).slice(0, 3).map((d: any, di: number) => (
                                <div key={di} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 space-y-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{d.topic}</p>
                                    <Badge variant="outline" className={`${d.confidence >= 0.7 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'} text-[9px] font-black uppercase`}>{Math.round(d.confidence * 100)}% confidence</Badge>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {d.positions?.map((p: any, pi: number) => (
                                      <Badge key={pi} variant="outline" className="bg-white/5 border-white/10 text-[9px] font-bold uppercase text-slate-300">
                                        {p.agent} · {Math.round((p.confidence || 0) * 100)}%
                                      </Badge>
                                    ))}
                                  </div>
                                  {d.rebuttals?.map((r: any, ri: number) => (
                                    <div key={ri} className="flex items-start gap-2 text-[10px] text-slate-500">
                                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                      <span><span className="font-bold text-slate-400">{r.agent}:</span> {r.rebuttal}</span>
                                    </div>
                                  ))}
                                  <div className={`rounded-xl p-3 border ${d.winner_agent === 'Capability Agent' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-violet-500/10 border-violet-500/20'}`}>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Decision Engine → {d.winner_agent}</p>
                                    <p className="text-xs text-slate-300 mt-0.5 font-medium">{d.winner_stance}</p>
                                    {d.rationale && <p className="text-[10px] text-slate-500 mt-1 italic">{d.rationale}</p>}
                                  </div>
                                </div>
                              ))}
                              {(strategizeResult.graph?.debates?.length || 0) > 3 && (
                                <p className="text-[10px] text-slate-500">+{strategizeResult.graph.debates.length - 3} more debates</p>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v6 Phase 4 · Strategy Tournament — candidates compete across 8 weighted dimensions */}
                        {strategizeResult.graph?.tournament && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Strategy Tournament</CardTitle>
                                <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black uppercase">
                                  {strategizeResult.graph.tournament.challenger ? `${strategizeResult.graph.tournament.methodology?.candidates ?? 4} candidates · ${strategizeResult.graph.tournament.methodology?.pairwise_comparisons ?? 0} head-to-head` : 'scored candidates'}
                                </Badge>
                              </div>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Current reasoning + historical experience + product memory · winner + ranked alternatives</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-6">
                              {/* Podium — winner + runners-up */}
                              {(strategizeResult.graph.tournament.ranking || []).length > 0 && (
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Ranking · Evidence-Weighted</p>
                                  <div className="space-y-2.5">
                                    {(strategizeResult.graph.tournament.ranking || []).map((entry: any) => {
                                      const rankIcon = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`
                                      const isWinner = entry.rank === 1
                                      return (
                                        <div key={entry.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${isWinner ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/50 border-white/10'}`}>
                                          <span className="text-lg w-7 text-center">{rankIcon}</span>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${STRATEGY_COLOR[entry.id] || 'from-violet-500 to-indigo-600'}`} />
                                              <p className={`text-sm font-black uppercase tracking-tight ${isWinner ? 'text-amber-300' : 'text-slate-200'}`}>
                                                {entry.id} · {entry.name}
                                              </p>
                                              {isWinner && <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[8px] font-black uppercase">Winner</Badge>}
                                            </div>
                                            {entry.rationale && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{entry.rationale}</p>}
                                          </div>
                                          <div className="text-right shrink-0">
                                            <p className={`text-xl font-black ${isWinner ? 'text-amber-300' : 'text-slate-300'}`}>{Math.round(entry.aggregate || 0)}</p>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase">wins {entry.wins || 0} / {entry.losses || 0}</p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Dimension bars per strategy */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {(strategizeResult.graph.tournament.ranking || []).map((entry: any) => (
                                  <div key={`${entry.id}-dims`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 space-y-2.5">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${STRATEGY_COLOR[entry.id] || 'from-violet-500 to-indigo-600'}`} />
                                      {entry.id} · {entry.name}
                                    </p>
                                    {(entry.dimensions || []).map((d: any) => (
                                      <div key={d.id}>
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{d.label}</span>
                                          <span className="text-[10px] font-black text-slate-300">{Math.round(d.value || 0)}</span>
                                        </div>
                                        <Progress value={(d.value || 0)} className="h-1.5 bg-white/5" />
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>

                              {/* Head-to-head comparisons */}
                              {(strategizeResult.graph.tournament.comparisons || []).length > 0 && (
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Head-to-Head · Decision Engine Adjudication</p>
                                  <div className="space-y-2">
                                    {(strategizeResult.graph.tournament.comparisons || []).map((cmp: any, ci: number) => (
                                      <div key={ci} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className={`font-black uppercase ${cmp.winner_id === cmp.a ? 'text-emerald-400' : 'text-slate-400'}`}>{cmp.a}</span>
                                          <span className="text-slate-600">vs</span>
                                          <span className={`font-black uppercase ${cmp.winner_id === cmp.b ? 'text-emerald-400' : 'text-slate-400'}`}>{cmp.b}</span>
                                          <Badge variant="outline" className="ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-black uppercase">
                                            {cmp.winner_id} wins · +{Math.round(cmp.margin || 0)}
                                          </Badge>
                                        </div>
                                        {cmp.judge_comment && <p className="text-[10px] text-slate-500 mt-1.5 italic">{cmp.judge_comment}</p>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Decision report — why the winner won, why losers lost */}
                              {strategizeResult.graph.tournament.decision_report && (
                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-2">Decision Report</p>
                                  {strategizeResult.graph.tournament.decision_report.winner_reason && (
                                    <p className="text-xs text-slate-300 font-medium leading-relaxed">✓ {strategizeResult.graph.tournament.decision_report.winner_reason}</p>
                                  )}
                                  {Object.entries(strategizeResult.graph.tournament.decision_report.rejected || {}).map(([id, reason]) => (
                                    <p key={id} className="text-[10px] text-slate-500 mt-1">✗ Rejected <span className="font-black uppercase text-slate-400">{id}</span> — {String(reason)}</p>
                                  ))}
                                </div>
                              )}

                              {/* Challenger rationale */}
                              {strategizeResult.graph.tournament.challenger_rationale && (
                                <div className="flex items-start gap-2 text-[10px] text-slate-500">
                                  <Zap className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                  <span>
                                    <span className="font-bold text-amber-400">Challenger (STRAT-D)</span> built from {strategizeResult.graph.tournament.challenger_rationale.based_on}: {strategizeResult.graph.tournament.challenger_rationale.swapped_repositories?.length || 0} repos swapped to proven alternatives, architecture {strategizeResult.graph.tournament.challenger_rationale.architecture_simplified ? 'simplified' : 'kept'}, {strategizeResult.graph.tournament.challenger_rationale.features_trimmed || 0} features trimmed, innovation +{Math.round((strategizeResult.graph.tournament.challenger_rationale.innovation_delta || 0) * 100)}.
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Strategy comparison cards */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black uppercase tracking-tighter">Choose a Strategy</h3>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black uppercase">Approval Gate · Nothing built yet</Badge>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {strategizeResult.strategies?.map((strategy) => {
                              const Icon = STRATEGY_ICON[strategy.id] || Target
                              const isApproving = approvingId === strategy.id
                              return (
                                <Card key={strategy.id} className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem] overflow-hidden relative group hover:border-white/15 transition-all duration-500">
                                  <div className={`h-1.5 bg-gradient-to-r ${STRATEGY_COLOR[strategy.id] || 'from-violet-500 to-indigo-600'}`} />
                                  <CardHeader className="p-6 pb-2">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${STRATEGY_COLOR[strategy.id] || 'from-violet-500 to-indigo-600'} flex items-center justify-center shadow-xl`}>
                                        <Icon className="w-6 h-6 text-white" />
                                      </div>
                                      <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black uppercase">{strategy.id}</Badge>
                                    </div>
                                    <CardTitle className="text-lg font-black tracking-tighter uppercase mt-4">{strategy.name}</CardTitle>
                                    <CardDescription className="text-violet-300/80 text-xs font-bold uppercase tracking-widest">{strategy.tagline}</CardDescription>
                                  </CardHeader>
                                  <CardContent className="p-6 space-y-5">
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-3">{strategy.description}</p>

                                    {/* Metric bars */}
                                    <div className="space-y-3">
                                      {[
                                        { label: 'Innovation', value: strategy.innovation_score || 0 },
                                        { label: 'Feasibility', value: strategy.feasibility || 0 },
                                        { label: 'Market Opportunity', value: strategy.market_opportunity || 0 },
                                      ].map((m) => (
                                        <div key={m.label}>
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{m.label}</span>
                                            <span className="text-[10px] font-black text-slate-300">{Math.round((m.value || 0) * 100)}%</span>
                                          </div>
                                          <Progress value={(m.value || 0) * 100} className="h-1.5 bg-white/5" />
                                        </div>
                                      ))}
                                    </div>

                                    {/* Meta chips */}
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black uppercase">⏱ {strategy.timeline}</Badge>
                                      <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black uppercase">${strategy.estimated_cost}</Badge>
                                      <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black uppercase">{strategy.complexity}</Badge>
                                      <Badge variant="outline" className={`${strategy.risk_level === 'low' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : strategy.risk_level === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'} text-[9px] font-black uppercase`}>
                                        {strategy.risk_level} risk
                                      </Badge>
                                    </div>

                                    {/* Repo map preview */}
                                    {Object.keys(strategy.repository_map || {}).length > 0 && (
                                      <div>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Repository Map ({Object.keys(strategy.repository_map).length} capabilities)</p>
                                        <div className="space-y-1.5">
                                          {Object.entries(strategy.repository_map).slice(0, 4).map(([cap, repo]) => (
                                            <div key={cap} className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                              <CircleDot className="w-3 h-3 text-violet-500 shrink-0" />
                                              <span className="truncate max-w-[140px] text-slate-500">{cap}:</span>
                                              <span className="truncate text-emerald-400">{repo}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <Button
                                      className={`w-full ${STRATEGY_COLOR[strategy.id] || 'bg-violet-600'} text-white rounded-2xl h-12 font-black text-xs uppercase tracking-widest gap-2`}
                                      disabled={!!approvingId}
                                      onClick={() => approveStrategy(strategy)}
                                    >
                                      {isApproving ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" /> Building...
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-4 h-4" /> Approve & Build
                                        </>
                                      )}
                                    </Button>
                                  </CardContent>
                                </Card>
                              )
                            })}
                          </div>
                        </div>

                        {/* Market intelligence strip */}
                        {strategizeResult.graph?.market && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-500" /> Market Intelligence</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Trends</p>
                                {(strategizeResult.graph.market.market_trends || []).slice(0, 4).map((t: string, i: number) => (
                                  <p key={i} className="text-xs text-slate-400">• {t}</p>
                                ))}
                              </div>
                              <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pain Points</p>
                                {(strategizeResult.graph.market.pain_points || []).slice(0, 4).map((p: string, i: number) => (
                                  <p key={i} className="text-xs text-slate-400">• {p}</p>
                                ))}
                              </div>
                              <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Opportunities</p>
                                {(strategizeResult.graph.market.opportunities || []).slice(0, 4).map((o: string, i: number) => (
                                  <p key={i} className="text-xs text-slate-400">• {o}</p>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* v4 · Competitor Matrix */}
                        {(strategizeResult.graph?.competitors?.length || 0) > 0 && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Target className="w-4 h-4 text-cyan-500" /> Competitor Matrix ({strategizeResult.graph.competitors.length})</CardTitle>
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 text-[9px] font-black uppercase">Competitor Knowledge Graph</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {strategizeResult.graph.competitors.slice(0, 6).map((c: any, i: number) => (
                                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-black text-slate-200 uppercase tracking-wider">{c.name}</p>
                                      <Badge variant="outline" className={`${c.market_position === 'leader' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : c.market_position === 'challenger' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'} text-[8px] font-black uppercase`}>{c.market_position}</Badge>
                                    </div>
                                    {(c.strengths?.length || 0) > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {c.strengths.slice(0, 3).map((s: string, j: number) => (
                                          <Badge key={j} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] font-bold">✓ {s}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {(c.weaknesses?.length || 0) > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {c.weaknesses.slice(0, 3).map((w: string, j: number) => (
                                          <Badge key={j} variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[8px] font-bold">✗ {w}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {(c.missing_features?.length || 0) > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {c.missing_features.slice(0, 3).map((mf: string, j: number) => (
                                          <Badge key={j} variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[8px] font-bold">missing: {mf}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {c.pricing && <p className="text-[9px] text-slate-500 font-mono">pricing · {c.pricing}</p>}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* v4 · Innovation + Evolution */}
                        {(strategizeResult.graph?.innovation || strategizeResult.graph?.evolution) && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {strategizeResult.graph?.innovation && (
                              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-600/10 to-transparent backdrop-blur-3xl rounded-[2rem]">
                                <CardHeader className="p-6 pb-2">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Innovation Intelligence</CardTitle>
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-black uppercase">score {Math.round((strategizeResult.graph.innovation.innovation_score || 0) * 100)}</Badge>
                                  </div>
                                  {strategizeResult.graph.innovation.innovation_statement && (
                                    <CardDescription className="text-amber-200/70 text-xs font-medium">{strategizeResult.graph.innovation.innovation_statement}</CardDescription>
                                  )}
                                </CardHeader>
                                <CardContent className="p-6 pt-2 space-y-2.5">
                                  {(strategizeResult.graph.innovation.novel_features || []).slice(0, 6).map((f: any, i: number) => (
                                    <div key={i} className="rounded-xl bg-white/5 border border-amber-500/10 p-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-black text-slate-200 uppercase tracking-wider">{f.name}</p>
                                        <span className="text-[9px] font-black text-amber-400 uppercase">feasibility {Math.round((f.feasibility || 0) * 100)}%</span>
                                      </div>
                                      {f.why && <p className="text-[10px] text-slate-400 mt-1">{f.why}</p>}
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            )}
                            {strategizeResult.graph?.evolution && (
                              <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-600/10 to-transparent backdrop-blur-3xl rounded-[2rem]">
                                <CardHeader className="p-6 pb-2">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-500" /> Product Evolution</CardTitle>
                                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 text-[9px] font-black uppercase">not replication · evolution</Badge>
                                  </div>
                                  <CardDescription className="text-cyan-200/70 text-xs font-medium">{strategizeResult.graph.evolution.evolution_statement}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 pt-2 space-y-2.5">
                                  {(strategizeResult.graph.evolution.evolution_opportunities || []).slice(0, 6).map((o: any, i: number) => (
                                    <div key={i} className="rounded-xl bg-white/5 border border-cyan-500/10 p-3">
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="font-black text-slate-300 uppercase">{o.from}</span>
                                        <ArrowRight className="w-3 h-3 text-cyan-500 shrink-0" />
                                        <span className="font-black text-cyan-400 uppercase">{o.to}</span>
                                      </div>
                                      {o.description && <p className="text-[10px] text-slate-400 mt-1">{o.description}</p>}
                                    </div>
                                  ))}
                                  {(strategizeResult.graph.evolution.evolution_chain?.length || 0) > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 pt-1">
                                      {strategizeResult.graph.evolution.evolution_chain.map((c: string, i: number) => (
                                        <React.Fragment key={i}>
                                          {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                                          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-[8px] font-bold uppercase">{c}</Badge>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        )}

                        {/* v4 · Repository Intelligence */}
                        {(strategizeResult.graph?.repository_intelligence?.reports?.length || 0) > 0 && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Database className="w-4 h-4 text-emerald-500" /> Repository Intelligence · 12-Dimension Ranking</CardTitle>
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black uppercase">{strategizeResult.graph.repository_intelligence.summary?.total || 0} ranked</Badge>
                              </div>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">stars · forks · contributors · commits · issues · releases · docs · security · license · API stability · extensibility · adoption</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-2.5">
                              {strategizeResult.graph.repository_intelligence.reports.slice(0, 8).map((r: any, i: number) => (
                                <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-start gap-3">
                                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-black text-emerald-400">#{r.rank}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-xs font-bold text-slate-200 font-mono truncate">{r.full_name}</p>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <Star className="w-3 h-3 text-amber-500" />
                                        <span className="text-[9px] font-bold text-slate-400">{r.stars}</span>
                                        <span className="text-[10px] font-black text-emerald-400">{Math.round(r.explainable_score * 1000) / 1000}</span>
                                      </div>
                                    </div>
                                    {(r.reasons?.length || 0) > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {r.reasons.slice(0, 4).map((reason: string, j: number) => (
                                          <Badge key={j} variant="outline" className="bg-emerald-500/5 text-slate-400 border-white/5 text-[8px] font-bold">{reason}</Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}

                        {/* Capability graph strip */}
                        {(strategizeResult.graph?.capabilities?.capabilities?.length || 0) > 0 && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                                <Boxes className="w-4 h-4 text-violet-500" /> Capability Graph ({strategizeResult.graph.capabilities.capabilities.length} capabilities · {strategizeResult.graph.capabilities.edges.length} dependencies)
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 flex flex-wrap gap-2">
                              {strategizeResult.graph.capabilities.capabilities.map((cap: any) => (
                                <Badge key={cap.id} variant="outline" className={`${cap.priority === 'core' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : cap.priority === 'important' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-white/5 text-slate-400 border-white/10'} text-[9px] font-black uppercase`}>
                                  {cap.name}
                                </Badge>
                              ))}
                            </CardContent>
                          </Card>
                        )}

                        {/* Approved blueprint */}
                        {approvalResult?.graph && (
                          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-600/10 to-transparent backdrop-blur-3xl rounded-[2.5rem] border-l-4 border-l-emerald-500">
                            <CardHeader className="p-8 pb-2">
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">Blueprint Ready</div>
                              <CardTitle className="text-2xl font-black tracking-tighter uppercase">{approvalResult.approved_strategy?.name}</CardTitle>
                              <CardDescription className="text-slate-400 font-medium">
                                Architecture · {approvalResult.graph.blueprint?.folder_structure?.length || 0} folders · {approvalResult.graph.execution_plan?.milestones?.length || 0} milestones
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 pt-4 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Architecture Components</p>
                                  <div className="space-y-1.5">
                                    {(approvalResult.graph.architecture?.components || []).slice(0, 6).map((c: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                        <Cpu className="w-3 h-3 text-emerald-500 shrink-0" /> <span className="font-bold text-slate-300">{c.name}</span> <span className="text-slate-600">· {c.role}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Milestones</p>
                                  <div className="space-y-2">
                                    {(approvalResult.graph.execution_plan?.milestones || []).map((m: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                        <CircleDot className="w-3 h-3 text-violet-500 shrink-0" /> <span className="font-bold text-slate-300">{m.title}</span> <span className="text-slate-600">· {m.timeframe}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(approvalResult.graph.blueprint?.folder_structure || []).slice(0, 10).map((f: string, i: number) => (
                                  <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-[8px] font-black uppercase">{f.split('/').pop()}</Badge>
                                ))}
                              </div>
                              <div className="flex gap-3">
                                <Button variant="outline" onClick={() => { setActiveTab('plan'); setPlanData(normalizePlanForUi(approvalResult.graph.execution_plan)) }} className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest">
                                  <Workflow className="w-4 h-4 mr-2" /> View Execution Plan
                                </Button>
                                <Button variant="outline" onClick={() => { setActiveTab('research'); setResearchData(approvalResult.graph.deep_research) }} className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest">
                                  <Search className="w-4 h-4 mr-2" /> Deep Research
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* v4 · Architecture Intelligence (multi-view) */}
                        {approvalResult?.graph?.architecture_views && (
                          <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-600/10 to-transparent backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Network className="w-4 h-4 text-indigo-500" /> Architecture Intelligence · Multi-View</CardTitle>
                                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[9px] font-black uppercase">{Object.keys(approvalResult.graph.architecture_views).length} views</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
                              {approvalResult.graph.architecture_views.logical_architecture && (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Logical</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(approvalResult.graph.architecture_views.logical_architecture.modules || []).slice(0, 8).map((m: string, i: number) => (
                                      <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-slate-300 text-[8px] font-bold">{m}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {approvalResult.graph.architecture_views.physical_architecture && (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Physical</p>
                                  <div className="space-y-1">
                                    {(approvalResult.graph.architecture_views.physical_architecture.services || []).slice(0, 8).map((s: string, i: number) => (
                                      <p key={i} className="text-[10px] text-slate-300 font-mono">• {s}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {approvalResult.graph.architecture_views.deployment_architecture && (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Deployment</p>
                                  <div className="space-y-1">
                                    {(approvalResult.graph.architecture_views.deployment_architecture.infrastructure || []).slice(0, 8).map((inf: string, i: number) => (
                                      <p key={i} className="text-[10px] text-slate-300 font-mono">• {inf}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {approvalResult.graph.architecture_views.infrastructure_diagram && (
                                <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Infrastructure Diagram</p>
                                  <pre className="text-[10px] leading-relaxed text-emerald-400/90 font-mono overflow-x-auto whitespace-pre">{approvalResult.graph.architecture_views.infrastructure_diagram}</pre>
                                </div>
                              )}
                              {(approvalResult.graph.architecture_views.data_flow?.flows?.length || 0) > 0 && (
                                <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Data Flow</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {approvalResult.graph.architecture_views.data_flow.flows.slice(0, 8).map((f: any, i: number) => (
                                      <div key={i} className="flex items-center gap-1 text-[9px] font-mono">
                                        <span className="text-slate-300">{f.from}</span>
                                        <ArrowRight className="w-3 h-3 text-indigo-500" />
                                        <span className="text-slate-300">{f.to}</span>
                                        {f.data && <span className="text-slate-500">({f.data})</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v5 · Product DNA — recomputed after approval */}
                        {(approvalResult?.graph?.product_dna || approvalResult?.product_dna) && (
                          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <Dna className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Product DNA</span>
                            <span className="text-xs text-slate-300 font-medium">{(approvalResult.graph?.product_dna?.summary ?? approvalResult.product_dna?.summary ?? '')}</span>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-mono uppercase">{(approvalResult.graph?.product_dna?.signature ?? approvalResult.product_dna?.signature ?? '').toUpperCase()}</Badge>
                          </div>
                        )}

                        {/* v5 · Architecture Simulation — simulated before approval, auto-revised */}
                        {(approvalResult?.graph?.architecture_simulation || approvalResult?.architecture_simulation) && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><FlaskConical className="w-4 h-4 text-amber-400" /> Architecture Simulation</CardTitle>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score</span>
                                  <span className={`text-xl font-black ${(approvalResult.graph?.architecture_simulation?.score ?? 0) >= 80 ? 'text-emerald-500' : (approvalResult.graph?.architecture_simulation?.score ?? 0) >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>{approvalResult.graph?.architecture_simulation?.score ?? approvalResult.architecture_simulation?.score ?? 0}</span>
                                </div>
                              </div>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-1">Missing services · circular deps · SPOF · scalability · bottlenecks · security</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-3">
                              <div className="flex flex-wrap gap-1.5">
                                {(approvalResult.graph?.architecture_simulation?.checks ?? approvalResult.architecture_simulation?.checks ?? []).map((c: any, i: number) => (
                                  <Badge key={i} variant="outline" className={`${c.status === 'fail' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'} text-[9px] font-black uppercase`}>
                                    {c.status === 'fail' ? '✗' : '✓'} {c.name}
                                  </Badge>
                                ))}
                              </div>
                              {(approvalResult.graph?.architecture_simulation?.revision_summary?.length || approvalResult.architecture_simulation?.revision_summary?.length || 0) > 0 && (
                                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3">
                                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1.5">Auto-revised after simulation ({(approvalResult.graph?.architecture_simulation?.simulation_rounds ?? []).length || approvalResult.architecture_simulation?.simulation_rounds?.length || 0} rounds)</p>
                                  <ul className="space-y-1">
                                    {(approvalResult.graph?.architecture_simulation?.revision_summary ?? approvalResult.architecture_simulation?.revision_summary ?? []).map((r: string, i: number) => (
                                      <li key={i} className="text-xs text-amber-200/80">• {r}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(approvalResult.graph?.architecture_simulation?.findings?.length || 0) > 0 && (
                                <div className="space-y-2">
                                  {(approvalResult.graph?.architecture_simulation?.findings ?? []).slice(0, 6).map((f: any, i: number) => (
                                    <div key={i} className={`flex items-start gap-2.5 rounded-xl p-2.5 border ${f.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20' : f.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/10'}`}>
                                      <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${f.severity === 'critical' ? 'text-rose-500' : f.severity === 'warning' ? 'text-amber-500' : 'text-slate-400'}`} />
                                      <div>
                                        <p className="text-xs font-bold text-slate-300">{f.category}</p>
                                        <p className="text-[10px] text-slate-500">{f.message}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* v5 · Evidence Graph — why was this recommended? */}
                        {(strategizeResult?.run_id && ((strategizeResult.graph?.evidence?.length || 0) > 0 || (strategizeResult.graph?.decisions?.length || 0) > 0 || (strategizeResult.graph?.debates?.length || 0) > 0)) && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Waypoints className="w-4 h-4 text-fuchsia-400" /> Why this recommendation?</CardTitle>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Traceable reasoning from the evidence graph</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-3">
                              <Button
                                variant="outline"
                                className="w-full rounded-2xl bg-fuchsia-500/10 border-fuchsia-500/20 hover:bg-fuchsia-500/20 text-fuchsia-300 text-[10px] font-black uppercase tracking-widest h-10"
                                onClick={() => fetchExplain(strategizeResult.run_id)}
                                disabled={explainLoading}
                              >
                                {explainLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                                {explainLoading ? 'Reading the evidence graph...' : 'Explain the reasoning'}
                              </Button>
                              {explainResult?.explanation && (
                                <div className="rounded-2xl bg-slate-950/50 border border-white/10 p-4 space-y-2">
                                  {explainResult.explanation.split('\n').map((line: string, i: number) => (
                                    <p key={i} className={`text-xs ${line.startsWith('  ') ? 'text-slate-500 pl-4' : line.startsWith('•') ? 'text-slate-300 font-medium' : 'font-black text-fuchsia-300 uppercase tracking-widest text-[10px]'}`}>{line}</p>
                                  ))}
                                </div>
                              )}
                              {explainResult?.decisions?.slice(-3).map((d: any, i: number) => (
                                <div key={i} className="flex items-start gap-2.5 text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">{d.stage}: {d.decision}</p>
                                    <p className="text-slate-500 text-[10px]">{d.rationale}</p>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}

                        {/* v4 · Evidence & Decisions */}
                        {((strategizeResult.graph?.evidence?.length || 0) > 0 || (approvalResult?.graph?.decisions?.length || 0) > 0 || (strategizeResult.graph?.decisions?.length || 0) > 0) && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><BookOpen className="w-4 h-4 text-violet-500" /> Evidence & Decisions</CardTitle>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Traceable decision history</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-4">
                              {(approvalResult?.graph?.decisions?.length || 0) > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Decision History</p>
                                  {approvalResult?.graph?.decisions.slice(0, 5).map((d: any, i: number) => (
                                    <div key={i} className="flex items-start gap-3 text-xs">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="font-bold text-slate-300">{d.decision}</p>
                                        {d.rationale && <p className="text-slate-500 text-[10px]">{d.rationale}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(strategizeResult.graph?.evidence?.length || 0) > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Evidence Log</p>
                                  {strategizeResult.graph.evidence.slice(0, 8).map((e: any, i: number) => (
                                    <div key={i} className="flex items-start gap-3 text-xs">
                                      <CircleDot className="w-3 h-3 text-violet-500 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">{e.stage}</p>
                                        <p className="text-slate-500">{e.claim}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Reasoning trace */}
                        {strategizeResult.graph?.trace?.length > 0 && (
                          <Card className="border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader className="p-6 pb-2">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Activity className="w-4 h-4 text-violet-500" /> Reasoning Trace</CardTitle>
                              <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Every stage explained</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-2">
                              {strategizeResult.graph.trace.map((t, i) => (
                                <div key={i} className="flex items-start gap-3 text-xs">
                                  <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                                  <div>
                                    <p className="font-bold text-slate-300 uppercase tracking-wider">{t.stage}</p>
                                    <p className="text-slate-500">{t.detail}</p>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
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
  const typeOffset: Record<string, number> = {
    request: 80,
    domain: 190,
    repo: 300,
    capability: 420,
    skill: 540,
    framework: 650,
    architecture_pattern: 760,
    product: 870,
    paper: 650,
    research_finding: 760,
    memory: 870,
  }
  const base = typeOffset[node.type] || 450
  if (total <= 1) return base
  const spacing = Math.min(90, 320 / (total - 1))
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

function normalizePlanForUi(plan: any) {
  if (!plan) return null
  if (Array.isArray(plan.phases)) {
    return {
      ...plan,
      phases: plan.phases.map((phase: any, index: number) => ({
        name: phase?.name || `Phase ${index + 1}`,
        tasks: normalizeTasksForUi(phase?.tasks),
      })),
    }
  }

  if (Array.isArray(plan.tasks)) {
    return {
      ...plan,
      phases: [
        {
          name: 'Execution Plan',
          tasks: normalizeTasksForUi(plan.tasks),
        },
      ],
    }
  }

  if (Array.isArray(plan.phases?.[0]?.tasks)) return plan

  return {
    ...plan,
    phases: [
      {
        name: 'Foundation',
        tasks: normalizeTasksForUi([
          {
            title: 'Create vertical slice',
            description: 'Implement the first API, memory, graph, and UI path from the generated architecture.',
            complexity: 'medium',
          },
        ]),
      },
    ],
  }
}

function normalizeTasksForUi(tasks: any[] = []) {
  return tasks.map((task, index) => ({
    ...task,
    title: task?.title || task?.name || `Task ${index + 1}`,
    description: task?.description || task?.summary || task?.detail || 'Implement this backend-generated plan step.',
    complexity: task?.complexity || task?.estimated_complexity || 'medium',
  }))
}
