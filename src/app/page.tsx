'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Github, Star, GitFork, TrendingUp, Search, RefreshCw, Brain, Rocket,
  Target, Zap, BarChart3, Code2, Layers, Shield, ArrowRight, X,
  CheckCircle2, Bookmark, Eye, Tag, Users, DollarSign, Award, Flame,
  Cpu, LayoutGrid, List, ChevronRight, Download, Database, Bot,
  BookOpen, Palette, Workflow, Server, MessageSquare, Play, FileJson,
  FileText, ArrowDown, Box, Network, Activity, ChevronLeft, EyeOff,
  Sparkles, LucideIcon, Circle, MousePointerClick, GitBranch, Timer,
  DollarSign as MoneyIcon, Globe, BoxSelect, LayoutDashboard, Save,
  Filter
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes,
  Handle, Position, type NodeProps
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip
} from 'recharts'

// ============================================================
// Types
// ============================================================

interface RepoData {
  id: number; name: string; description: string | null; stars: number; forks: number;
  language: string | null; url: string; homepage?: string | null; topics: string[];
  trendScore: number; growthRate: number; category: string; innovationSignals: string[];
  owner: string; ownerAvatar: string; lastPushed: string; license?: string;
}

interface Capability { category: string; label: string; repos: MappedRepo[]; description: string; icon: string }
interface MappedRepo { name: string; fullName: string; url: string; role: string; why: string; stars: number; category: string }
interface BuildVariant { tier: 'simple' | 'intermediate' | 'advanced'; label: string; description: string; repos: MappedRepo[]; techStack: TechLayer[]; agents: AgentRole[]; architecture: ArchitectureBlock[]; systemFlow: FlowStep[]; estimatedTime: string; difficulty: string }
interface TechLayer { layer: string; technologies: string[] }
interface AgentRole { name: string; role: string; description: string }
interface ArchitectureBlock { id: string; label: string; type: string; technology: string; description: string; connections: string[] }
interface FlowStep { id: string; label: string; type: string; description: string; next: string[] }
interface ProductScore { marketDemand: number; technicalFeasibility: number; innovation: number; competition: string; ecosystemMaturity: number; finalScore: number }
interface ExampleOutput { input: string; steps: string[]; output: string }
interface MonetizationPhase { phase: number; label: string; description: string; timeline: string; revenue: string }
interface ProductBuild { title: string; tagline: string; description: string; targetAudience: string; uniqueValue: string; capabilities: Capability[]; buildVariants: BuildVariant[]; productScore: ProductScore; exampleOutput: ExampleOutput; monetization: MonetizationPhase[]; keyFeatures: string[]; inspiredBy: string[]; strategy: string }
interface PipelineStep { agent: string; status: 'pending' | 'running' | 'completed' | 'error'; duration?: number; result?: string }
interface KnowledgeGraphNode { id: string; label: string; type: 'repo' | 'capability' | 'product' | 'tech' | 'category'; size?: number; color?: string }
interface KnowledgeGraphEdge { id: string; source: string; target: string; label: string; type?: string }
interface TrendData { topLanguages: { language: string; count: number; avgStars: number }[]; topTopics: { topic: string; count: number; growth: number }[]; hotCategories: { name: string; count: number }[]; emergingTech: string[]; insights: string[] }

// ============================================================
// Color & Utility Maps
// ============================================================

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
  Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF', C: '#555555',
  'C#': '#178600', PHP: '#4F5D95', Shell: '#89e051', Dart: '#00B4AB',
  Scala: '#c22d40', Elixir: '#6e4a7e', Vue: '#41b883', HTML: '#e34c26',
  CSS: '#563d7c', Lua: '#000080', R: '#198CE7', Perl: '#0298c3',
}

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'AI/ML': 'bg-purple-100 text-purple-800',
    'DevTools': 'bg-blue-100 text-blue-800',
    'Web Framework': 'bg-green-100 text-green-800',
    'Data/Analytics': 'bg-orange-100 text-orange-800',
    'Security': 'bg-red-100 text-red-800',
    'Cloud/Infra': 'bg-cyan-100 text-cyan-800',
    'Mobile': 'bg-pink-100 text-pink-800',
    'Productivity': 'bg-yellow-100 text-yellow-800',
    'Other': 'bg-gray-100 text-gray-800',
  }
  return colors[category] || colors['Other']
}

const getCapabilityIcon = (category: string): LucideIcon => {
  const icons: Record<string, LucideIcon> = {
    memory: Database, agent: Bot, rag: BookOpen, ui: Palette,
    automation: Workflow, 'model-serving': Cpu, data: BarChart3,
    security: Shield, infra: Server, communication: MessageSquare,
  }
  return icons[category] || Box
}

const getCapabilityColor = (category: string): string => {
  const colors: Record<string, string> = {
    memory: 'from-violet-500 to-purple-600', agent: 'from-amber-500 to-orange-600',
    rag: 'from-emerald-500 to-teal-600', ui: 'from-blue-500 to-cyan-600',
    automation: 'from-rose-500 to-red-600', 'model-serving': 'from-indigo-500 to-violet-600',
    data: 'from-orange-500 to-amber-600', security: 'from-red-500 to-rose-600',
    infra: 'from-slate-500 to-gray-600', communication: 'from-cyan-500 to-sky-600',
  }
  return colors[category] || 'from-slate-500 to-gray-600'
}

const getCapabilityBgColor = (category: string): string => {
  const colors: Record<string, string> = {
    memory: 'bg-violet-50 border-violet-200',
    agent: 'bg-amber-50 border-amber-200',
    rag: 'bg-emerald-50 border-emerald-200',
    ui: 'bg-blue-50 border-blue-200',
    automation: 'bg-rose-50 border-rose-200',
    'model-serving': 'bg-indigo-50 border-indigo-200',
    data: 'bg-orange-50 border-orange-200',
    security: 'bg-red-50 border-red-200',
    infra: 'bg-slate-50 border-slate-200',
    communication: 'bg-cyan-50 border-cyan-200',
  }
  return colors[category] || 'bg-gray-50 border-gray-200'
}

const getCapabilityHexColor = (category: string): string => {
  const colors: Record<string, string> = {
    memory: '#8b5cf6', agent: '#f59e0b', rag: '#10b981', ui: '#3b82f6',
    automation: '#f43f5e', 'model-serving': '#6366f1', data: '#f97316',
    security: '#ef4444', infra: '#64748b', communication: '#06b6d4',
  }
  return colors[category] || '#6366f1'
}

const getTierStyle = (tier: string) => {
  switch (tier) {
    case 'simple': return { bg: 'bg-emerald-50 border-emerald-300', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', ring: 'ring-emerald-500', hex: '#10b981', label: 'MVP' }
    case 'intermediate': return { bg: 'bg-amber-50 border-amber-300', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', ring: 'ring-amber-500', hex: '#f59e0b', label: 'Scalable' }
    case 'advanced': return { bg: 'bg-rose-50 border-rose-300', badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', ring: 'ring-rose-500', hex: '#f43f5e', label: 'Advanced' }
    default: return { bg: 'bg-gray-50 border-gray-300', badge: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500', ring: 'ring-gray-500', hex: '#6b7280', label: 'Unknown' }
  }
}

const getArchBlockColor = (type: string) => {
  const colors: Record<string, string> = {
    frontend: 'from-sky-400 to-blue-500', api: 'from-emerald-400 to-teal-500',
    agent: 'from-amber-400 to-orange-500', memory: 'from-violet-400 to-purple-500',
    llm: 'from-indigo-400 to-violet-500', data: 'from-orange-400 to-red-500',
    infra: 'from-slate-400 to-gray-500', service: 'from-cyan-400 to-sky-500',
    automation: 'from-rose-400 to-pink-500',
  }
  return colors[type] || 'from-gray-400 to-slate-500'
}

const getArchBlockHex = (type: string): string => {
  const colors: Record<string, string> = {
    frontend: '#38bdf8', api: '#34d399', agent: '#fb923c', memory: '#a78bfa',
    llm: '#818cf8', data: '#fb923c', infra: '#94a3b8', service: '#22d3ee', automation: '#fb7185',
  }
  return colors[type] || '#94a3b8'
}

const getFlowStepColor = (type: string): string => {
  const colors: Record<string, string> = {
    input: '#10b981', agent: '#8b5cf6', process: '#3b82f6',
    memory: '#f59e0b', output: '#f43f5e', decision: '#06b6d4',
  }
  return colors[type] || '#64748b'
}

const formatStars = (n: number): string => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString()

// ============================================================
// Custom React Flow Node for Knowledge Graph
// ============================================================

function KnowledgeFlowNode({ data }: NodeProps) {
  const nodeTypeColors: Record<string, string> = {
    repo: 'border-blue-400 bg-blue-50/90',
    capability: 'border-violet-400 bg-violet-50/90',
    product: 'border-emerald-400 bg-emerald-50/90',
    tech: 'border-cyan-400 bg-cyan-50/90',
    category: 'border-amber-400 bg-amber-50/90',
  }
  const nodeTypeIcons: Record<string, LucideIcon> = {
    repo: Github, capability: Layers, product: Rocket, tech: Code2, category: Tag,
  }
  const Icon = nodeTypeIcons[data.nodeType as string] || Box
  const nodeTypeDotColors: Record<string, string> = {
    repo: 'bg-blue-500', capability: 'bg-violet-500', product: 'bg-emerald-500', tech: 'bg-cyan-500', category: 'bg-amber-500',
  }

  return (
    <div className={`px-4 py-2.5 rounded-xl border-2 shadow-lg min-w-[120px] backdrop-blur-sm ${nodeTypeColors[data.nodeType as string] || 'border-gray-400 bg-gray-50'}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${nodeTypeDotColors[data.nodeType as string] || 'bg-gray-500'}`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  )
}

const nodeTypes: NodeTypes = { custom: KnowledgeFlowNode }

// ============================================================
// Score Gauge Component (Circular SVG)
// ============================================================

function ScoreGauge({ score, size = 120, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percent = score / 10
  const offset = circumference - percent * circumference
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : score >= 4 ? '#f97316' : '#ef4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-slate-200" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground font-medium">/10</span>
      </div>
    </div>
  )
}

// ============================================================
// Mini Score Gauge (for cards)
// ============================================================

function MiniScoreGauge({ score }: { score: number }) {
  const size = 52
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 10) * circumference
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-slate-200" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

// ============================================================
// Agent Flow Pipeline Component
// ============================================================

const AGENT_FLOW_STEPS = [
  { id: 'user', label: 'User Input', icon: MousePointerClick, color: '#10b981' },
  { id: 'planner', label: 'Planner', icon: Brain, color: '#8b5cf6' },
  { id: 'research', label: 'Research', icon: Search, color: '#3b82f6' },
  { id: 'memory', label: 'Memory', icon: Database, color: '#f59e0b' },
  { id: 'execution', label: 'Execution', icon: Zap, color: '#f43f5e' },
  { id: 'output', label: 'Output', icon: Rocket, color: '#06b6d4' },
]

function AgentFlowPipeline({ flowSteps }: { flowSteps: FlowStep[] }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
        {AGENT_FLOW_STEPS.map((step, i) => (
          <React.Fragment key={step.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, duration: 0.4 }}
              className="flex flex-col items-center gap-2 min-w-[80px]"
            >
              <div className="relative group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl"
                  style={{ backgroundColor: step.color + '20', border: `2px solid ${step.color}` }}>
                  <step.icon className="w-6 h-6" style={{ color: step.color }} />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: step.color }}>
                  {i + 1}
                </div>
              </div>
              <span className="text-xs font-semibold text-center" style={{ color: step.color }}>{step.label}</span>
              {flowSteps[i] && (
                <span className="text-[10px] text-muted-foreground text-center max-w-[90px] leading-tight">{flowSteps[i].description.slice(0, 40)}</span>
              )}
            </motion.div>
            {i < AGENT_FLOW_STEPS.length - 1 && (
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.12 + 0.1, duration: 0.3 }} className="flex-shrink-0">
                <ArrowRight className="w-5 h-5 text-slate-300" />
              </motion.div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Repo Graph Node for Composition Engine
// ============================================================

function RepoCompositionNode({ data }: NodeProps) {
  const catColor = getCapabilityHexColor((data.capCategory as string) || 'infra')
  return (
    <div className="px-3 py-2 rounded-xl border-2 shadow-md min-w-[140px] backdrop-blur-sm"
      style={{ borderColor: catColor, backgroundColor: catColor + '10' }}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: catColor }}>
          <Github className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-bold truncate max-w-[120px]">{data.label as string}</span>
      </div>
      <div className="text-[10px] px-1.5 py-0.5 rounded-full inline-block font-medium" style={{ backgroundColor: catColor + '20', color: catColor }}>
        {(data.repoRole as string) || 'Component'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  )
}

const repoNodeTypes: NodeTypes = { repoNode: RepoCompositionNode }

// ============================================================
// Architecture Diagram Component
// ============================================================

function ArchitectureDiagram({ blocks }: { blocks: ArchitectureBlock[] }) {
  const layers = ['frontend', 'api', 'agent', 'memory', 'llm', 'infra', 'data', 'service']
  const sortedBlocks = [...blocks].sort((a, b) => layers.indexOf(a.type) - layers.indexOf(b.type))

  return (
    <div className="space-y-1">
      {sortedBlocks.map((block, i) => (
        <motion.div
          key={block.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06, duration: 0.3 }}
          className="flex items-stretch gap-3 group"
        >
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getArchBlockColor(block.type)} flex items-center justify-center shadow-md transition-transform group-hover:scale-105`}>
              <span className="text-xs font-black text-white">{block.label.slice(0, 3).toUpperCase()}</span>
            </div>
            {i < sortedBlocks.length - 1 && (
              <div className="w-0.5 h-3 bg-slate-300" />
            )}
          </div>
          <div className="flex-1 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm">{block.label}</span>
              <Badge variant="outline" className="text-xs font-mono">{block.technology}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{block.description}</p>
            {block.connections.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {block.connections.map(c => (
                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">→ {c}</span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ============================================================
// Simulation Chat Component
// ============================================================

function SimulationChat({ exampleOutput }: { exampleOutput: ExampleOutput }) {
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [showOutput, setShowOutput] = useState(false)
  const prevKeyRef = useRef('')
  const key = exampleOutput.input + exampleOutput.steps.join('')

  useEffect(() => {
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key
    if (!exampleOutput.steps.length) return
    const timers: NodeJS.Timeout[] = []
    exampleOutput.steps.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleSteps(i + 1), (i + 1) * 600))
    })
    timers.push(setTimeout(() => setShowOutput(true), (exampleOutput.steps.length + 1) * 600))
    return () => timers.forEach(clearTimeout)
  }, [key, exampleOutput.steps.length])

  return (
    <div className="space-y-3">
      {/* Input */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-600 mb-0.5">User Input</p>
          <p className="text-sm">{exampleOutput.input}</p>
        </div>
      </motion.div>

      {/* Processing Steps */}
      {exampleOutput.steps.slice(0, visibleSteps).map((step, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 p-3 rounded-xl bg-violet-50 border border-violet-200">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-bold text-violet-500">Step {i + 1}</span>
              <RefreshCw className="w-3 h-3 text-violet-400 animate-spin" />
            </div>
            <p className="text-sm">{step}</p>
          </div>
        </motion.div>
      ))}

      {/* Output */}
      {showOutput && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center shrink-0">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 p-3 rounded-xl bg-cyan-50 border border-cyan-200">
            <p className="text-xs font-semibold text-cyan-600 mb-0.5">Output</p>
            <p className="text-sm">{exampleOutput.output}</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ============================================================
// Monetization Timeline Component
// ============================================================

function MonetizationTimeline({ phases }: { phases: MonetizationPhase[] }) {
  const phaseColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f43f5e']
  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 via-blue-400 via-violet-400 to-rose-400" />
      <div className="space-y-4">
        {phases.map((phase, i) => (
          <motion.div
            key={phase.phase}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="relative flex gap-4 pl-2"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 z-10" style={{ backgroundColor: phaseColors[i % 4] }}>
              <span className="text-xs font-black text-white">P{phase.phase}</span>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-white border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">{phase.label}</span>
                <Badge variant="outline" className="text-xs">{phase.timeline}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{phase.description}</p>
              <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: phaseColors[i % 4] }}>
                <DollarSign className="w-3 h-3" /> {phase.revenue}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Enhanced Product Card (Preview Mode)
// ============================================================

function ProductCard({ product, onSelect }: { product: ProductBuild; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -4 }}
      className="cursor-pointer"
      onClick={onSelect}
    >
      <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden bg-white">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-tight">{product.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{product.tagline}</p>
            </div>
            <MiniScoreGauge score={product.productScore.finalScore} />
          </div>

          {/* Build Complexity Badges */}
          <div className="flex gap-1.5">
            {product.buildVariants.map((v) => {
              const style = getTierStyle(v.tier)
              return (
                <div key={v.tier} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${style.badge}`}>
                  <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                  {style.label}
                </div>
              )
            })}
          </div>

          {/* Capability Chips */}
          <div className="flex flex-wrap gap-1.5">
            {product.capabilities.slice(0, 5).map((cap) => {
              const CapIcon = getCapabilityIcon(cap.category)
              return (
                <div key={cap.category} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${getCapabilityBgColor(cap.category)}`}>
                  <CapIcon className="w-3 h-3" />
                  <span className="font-medium">{cap.label}</span>
                </div>
              )
            })}
          </div>

          {/* Hover Preview */}
          <AnimatePresence>
            {hovered && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="pt-2 border-t border-slate-200/60 space-y-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Github className="w-3 h-3" /> {product.capabilities.reduce((a, c) => a + c.repos.length, 0)} repos</span>
                    <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> {product.buildVariants[1]?.agents.length || 0} agents</span>
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {product.buildVariants[1]?.architecture.length || 0} layers</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {product.buildVariants[1]?.architecture.slice(0, 4).map((block) => (
                      <div key={block.id} className={`h-6 rounded bg-gradient-to-r ${getArchBlockColor(block.type)} opacity-60`} title={block.label} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA */}
          <Button className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/20 group" size="sm">
            <Eye className="w-4 h-4 mr-2" /> View System Architecture
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================================
// Full System View (Product Detail Page)
// ============================================================

function SystemView({
  product, selectedTier, onTierChange, onExport, onGenerate, onBack, exporting
}: {
  product: ProductBuild
  selectedTier: 'simple' | 'intermediate' | 'advanced'
  onTierChange: (tier: 'simple' | 'intermediate' | 'advanced') => void
  onExport: (product: ProductBuild, format: 'json' | 'yaml') => void
  onGenerate: (product: ProductBuild, variant: string) => void
  onBack: () => void
  exporting: boolean
}) {
  const variant = product.buildVariants.find(v => v.tier === selectedTier) || product.buildVariants[1]
  const [archTab, setArchTab] = useState<'visual' | 'stack'>('visual')
  const [selectedRepoNode, setSelectedRepoNode] = useState<MappedRepo | null>(null)

  // Build repo graph nodes
  const repoFlowNodes: Node[] = product.capabilities.flatMap((cap, ci) =>
    cap.repos.map((repo, ri) => {
      const angle = (ci / product.capabilities.length) * 2 * Math.PI
      const layerOffset = ri * 120
      return {
        id: `repo-${ci}-${ri}`,
        type: 'repoNode',
        position: {
          x: 300 + Math.cos(angle) * (180 + layerOffset * 0.5) + ri * 50,
          y: 200 + Math.sin(angle) * (150 + layerOffset * 0.3) + ri * 30
        },
        data: { label: repo.name, capCategory: cap.category, repoRole: repo.role },
      }
    })
  )

  // Capability center nodes
  product.capabilities.forEach((cap, ci) => {
    const angle = (ci / product.capabilities.length) * 2 * Math.PI
    repoFlowNodes.push({
      id: `cap-${ci}`,
      type: 'repoNode',
      position: { x: 300 + Math.cos(angle) * 100, y: 200 + Math.sin(angle) * 80 },
      data: { label: cap.label, capCategory: cap.category, repoRole: 'Hub' },
    })
  })

  const repoFlowEdges: Edge[] = product.capabilities.flatMap((cap, ci) =>
    cap.repos.map((_, ri) => ({
      id: `edge-${ci}-${ri}`,
      source: `cap-${ci}`,
      target: `repo-${ci}-${ri}`,
      type: 'smoothstep' as const,
      animated: true,
      style: { stroke: getCapabilityHexColor(cap.category), strokeWidth: 1.5 },
    }))
  )

  // Score radar data
  const radarData = [
    { metric: 'Market Demand', value: product.productScore.marketDemand },
    { metric: 'Feasibility', value: product.productScore.technicalFeasibility },
    { metric: 'Innovation', value: product.productScore.innovation },
    { metric: 'Ecosystem', value: product.productScore.ecosystemMaturity },
    { metric: 'Competition', value: product.productScore.competition === 'low' ? 9 : product.productScore.competition === 'medium' ? 6 : 3 },
  ]

  const sectionClass = "p-6 rounded-2xl bg-white border border-slate-200/70 shadow-sm"
  const sectionTitle = "text-base font-bold flex items-center gap-2 mb-4"

  return (
    <div className="relative min-h-screen">
      {/* Scrollable Content */}
      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">

          {/* SECTION 1: SYSTEM OVERVIEW (HERO) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={sectionClass}>
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-1">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to Products
                </Button>
                <h1 className="text-3xl font-black bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                  {product.title}
                </h1>
                <p className="text-lg text-muted-foreground mt-1">{product.tagline}</p>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-2xl">{product.description}</p>
                <div className="flex gap-4 mt-4">
                  <div className="p-3 rounded-xl bg-slate-50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Target</p>
                    <p className="text-sm font-semibold">{product.targetAudience}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Unique Value</p>
                    <p className="text-sm font-semibold">{product.uniqueValue}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ScoreGauge score={product.productScore.finalScore} size={140} strokeWidth={10} />
                <span className="text-xs text-muted-foreground font-medium">Product Score</span>
              </div>
            </div>
          </motion.div>

          {/* SECTION 2: AGENT FLOW VISUALIZATION */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              Agent Flow Pipeline
            </h3>
            <AgentFlowPipeline flowSteps={variant.systemFlow} />
          </motion.div>

          {/* SECTION 3: GITHUB COMPOSITION ENGINE */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Github className="w-4 h-4 text-white" />
              </div>
              GitHub Composition Engine
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 h-[350px] rounded-xl overflow-hidden border border-slate-200/60 bg-slate-50/50">
                <ReactFlow nodes={repoFlowNodes} edges={repoFlowEdges} nodeTypes={repoNodeTypes} fitView minZoom={0.3} maxZoom={2}>
                  <Background color="#e2e8f0" gap={20} />
                  <Controls />
                </ReactFlow>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Repo Assignments</p>
                {product.capabilities.map((cap) => {
                  const CapIcon = getCapabilityIcon(cap.category)
                  return (
                    <div key={cap.category} className={`p-3 rounded-xl border ${getCapabilityBgColor(cap.category)}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${getCapabilityColor(cap.category)} flex items-center justify-center`}>
                          <CapIcon className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-semibold text-sm">{cap.label}</span>
                      </div>
                      {cap.repos.slice(0, 2).map((repo) => (
                        <div key={repo.fullName} className="ml-8 mb-1">
                          <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-violet-600 hover:underline flex items-center gap-1">
                            {repo.name} <ArrowRight className="w-2.5 h-2.5" />
                          </a>
                          <p className="text-[10px] text-muted-foreground">{repo.role}: {repo.why}</p>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {/* SECTION 5: BUILD VARIANTS SWITCHER */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              Build Variants
            </h3>
            <div className="flex gap-3 mb-6">
              {product.buildVariants.map((bv) => {
                const style = getTierStyle(bv.tier)
                const isSelected = selectedTier === bv.tier
                return (
                  <button key={bv.tier} onClick={() => onTierChange(bv.tier)}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 ${isSelected ? style.bg + ' ring-2 ring-offset-2 ' + style.ring : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${style.dot}`} />
                      <span className="font-bold">{style.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{bv.description.slice(0, 80)}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Github className="w-3 h-3" /> {bv.repos.length} repos</span>
                      <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> {bv.agents.length} agents</span>
                      <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {bv.estimatedTime}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* SECTION 4: ARCHITECTURE VIEW (TABBED) */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setArchTab('visual')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${archTab === 'visual' ? 'bg-violet-100 text-violet-700' : 'text-muted-foreground hover:bg-slate-100'}`}>
                Visual Diagram
              </button>
              <button onClick={() => setArchTab('stack')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${archTab === 'stack' ? 'bg-violet-100 text-violet-700' : 'text-muted-foreground hover:bg-slate-100'}`}>
                Layered Stack
              </button>
            </div>

            {archTab === 'visual' ? (
              <ArchitectureDiagram blocks={variant.architecture} />
            ) : (
              <div className="space-y-2">
                {variant.techStack.map((tech) => (
                  <div key={tech.layer} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50/80 border border-slate-200/50">
                    <span className="text-sm font-bold text-slate-500 w-28 shrink-0">{tech.layer}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tech.technologies.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs font-mono">{t}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* SECTION 6: PRODUCT SCORE */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              Product Score Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid strokeDasharray="3 3" stroke="#475569" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Radar name="Score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Market Demand', value: product.productScore.marketDemand, color: '#10b981' },
                  { label: 'Technical Feasibility', value: product.productScore.technicalFeasibility, color: '#3b82f6' },
                  { label: 'Innovation', value: product.productScore.innovation, color: '#8b5cf6' },
                  { label: 'Ecosystem Maturity', value: product.productScore.ecosystemMaturity, color: '#f59e0b' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{item.value}/10</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.value * 10}%` }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                  <span className="text-sm text-muted-foreground">Competition Level:</span>
                  <Badge className={product.productScore.competition === 'low' ? 'bg-emerald-100 text-emerald-800' : product.productScore.competition === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}>
                    {product.productScore.competition}
                  </Badge>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECTION 7: LIVE SIMULATION */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              Live Simulation
            </h3>
            <SimulationChat exampleOutput={product.exampleOutput} />
          </motion.div>

          {/* SECTION 8: AGENT ROLES */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              Agent Roles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {variant.agents.map((agent, i) => {
                const agentColors = ['#8b5cf6', '#3b82f6', '#f59e0b', '#f43f5e']
                const agentIcons: LucideIcon[] = [Brain, Search, Database, Zap]
                return (
                  <motion.div key={agent.name} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
                    className="p-4 rounded-xl border bg-white border-slate-200/60 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: agentColors[i % 4] }}>
                        {React.createElement(agentIcons[i % 4], { className: 'w-5 h-5 text-white' })}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.role}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* SECTION 9: TECH STACK (LAYERED) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Code2 className="w-4 h-4 text-white" />
              </div>
              Tech Stack
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {variant.techStack.map((tech, i) => {
                const layerColors: Record<string, string> = {
                  Frontend: '#38bdf8', Backend: '#34d399', Agents: '#fb923c', Memory: '#a78bfa',
                  LLM: '#818cf8', Infrastructure: '#94a3b8', Data: '#fb923c', Services: '#22d3ee',
                }
                return (
                  <motion.div key={tech.layer} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/50">
                    <div className="w-2 h-full min-h-[32px] rounded-full shrink-0" style={{ backgroundColor: layerColors[tech.layer] || '#6366f1' }} />
                    <div>
                      <p className="text-sm font-bold mb-1" style={{ color: layerColors[tech.layer] || '#6366f1' }}>{tech.layer}</p>
                      <div className="flex flex-wrap gap-1">
                        {tech.technologies.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs font-mono">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* SECTION 10: MONETIZATION ROADMAP */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              Monetization Roadmap
            </h3>
            <MonetizationTimeline phases={product.monetization} />
          </motion.div>

          {/* Key Features */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className={sectionClass}>
            <h3 className={sectionTitle}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              Key Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {product.keyFeatures.map((feature, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </ScrollArea>

      {/* SECTION 11: STICKY BUILD BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200/70 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MiniScoreGauge score={product.productScore.finalScore} />
              <div>
                <p className="font-bold text-sm">{product.title}</p>
                <p className="text-xs text-muted-foreground">{getTierStyle(selectedTier).label} Build</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={() => onGenerate(product, selectedTier)} className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
                <Rocket className="w-4 h-4 mr-1.5" /> Generate Starter Repo
              </Button>
              <Button variant="outline" size="sm" onClick={() => onExport(product, 'json')} disabled={exporting}>
                <FileJson className="w-4 h-4 mr-1.5" /> JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => onExport(product, 'yaml')} disabled={exporting}>
                <FileText className="w-4 h-4 mr-1.5" /> YAML
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Knowledge Graph Tab Component
// ============================================================

function KnowledgeGraphTab({ nodes, edges }: { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filteredNodes = filter === 'all' ? nodes : nodes.filter(n => n.type === filter)
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))

  const flowNodes: Node[] = filteredNodes.map((node, index) => {
    const angle = (index / filteredNodes.length) * 2 * Math.PI
    const radius = 180 + (node.type === 'product' ? 0 : node.type === 'capability' ? 80 : 200)
    return {
      id: node.id, type: 'custom',
      position: { x: 400 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius },
      data: { label: node.label, nodeType: node.type },
    }
  })

  const flowEdges: Edge[] = filteredEdges.map((edge) => ({
    id: edge.id, source: edge.source, target: edge.target, label: edge.label,
    type: 'smoothstep' as const, animated: edge.type === 'provides',
    style: { stroke: edge.type === 'related' ? '#94a3b8' : edge.type === 'requires' ? '#8b5cf6' : '#3b82f6', strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: '#64748b' },
  }))

  const filterOptions = [
    { value: 'all', label: 'All', color: '#6366f1' },
    { value: 'repo', label: 'Repos', color: '#3b82f6' },
    { value: 'capability', label: 'Capabilities', color: '#8b5cf6' },
    { value: 'product', label: 'Products', color: '#10b981' },
    { value: 'tech', label: 'Tech', color: '#06b6d4' },
    { value: 'category', label: 'Categories', color: '#f59e0b' },
  ]

  return (
    <div className="space-y-4">
      {/* Filters + Legend */}
      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map((opt) => (
          <button key={opt.value} onClick={() => setFilter(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === opt.value ? 'ring-2 ring-offset-1 shadow-sm' : 'opacity-60 hover:opacity-100'}`}
            style={{ backgroundColor: opt.color + '20', color: opt.color, borderColor: opt.color, ringColor: opt.color }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
            {opt.label}
          </button>
        ))}
      </div>

      <div className="h-[550px] rounded-xl overflow-hidden border border-slate-200/60 bg-slate-50/50">
        <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} fitView minZoom={0.3} maxZoom={2}>
          <Background color="#e2e8f0" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const colors: Record<string, string> = { repo: '#3b82f6', capability: '#8b5cf6', product: '#10b981', tech: '#06b6d4', category: '#f59e0b' }
              return colors[(node.data as any)?.nodeType as string] || '#6366f1'
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>
      </div>
    </div>
  )
}

// ============================================================
// Main Home Component
// ============================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState('builder')
  const [repos, setRepos] = useState<RepoData[]>([])
  const [products, setProducts] = useState<ProductBuild[]>([])
  const [trends, setTrends] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [language, setLanguage] = useState('')
  const [topic, setTopic] = useState('')
  const [since, setSince] = useState('weekly')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductBuild | null>(null)
  const [selectedTier, setSelectedTier] = useState<'simple' | 'intermediate' | 'advanced'>('intermediate')
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [pipeline, setPipeline] = useState<PipelineStep[]>([])
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeGraphNode[]>([])
  const [knowledgeEdges, setKnowledgeEdges] = useState<KnowledgeGraphEdge[]>([])
  const [exporting, setExporting] = useState(false)

  // Fetch trending repos
  const fetchRepos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (language) params.set('language', language)
      if (topic) params.set('topic', topic)
      params.set('since', since)
      params.set('limit', '25')
      const res = await fetch(`/api/github/repos?${params}`)
      const data = await res.json()
      if (data.success) {
        setRepos(data.repos)
        toast.success(`Loaded ${data.count} trending repos`)
      } else {
        toast.error(data.error || 'Failed to fetch repos')
      }
    } catch {
      toast.error('Failed to fetch repos from GitHub')
    } finally {
      setLoading(false)
    }
  }, [language, topic, since])

  // Search repos
  const searchRepos = useCallback(async () => {
    if (!searchQuery.trim()) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('q', searchQuery)
      if (language) params.set('language', language)
      params.set('limit', '25')
      const res = await fetch(`/api/github/search?${params}`)
      const data = await res.json()
      if (data.success) {
        setRepos(data.repos)
        toast.success(`Found ${data.total_count?.toLocaleString()} repos`)
      } else {
        toast.error(data.error || 'Search failed')
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, language])

  // Fetch trends
  const fetchTrends = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (language) params.set('language', language)
      if (topic) params.set('topic', topic)
      const res = await fetch(`/api/github/trends?${params}`)
      const data = await res.json()
      if (data.success) {
        setTrends(data.trends)
        toast.success('Trend analysis complete')
      }
    } catch {
      toast.error('Failed to analyze trends')
    } finally {
      setLoading(false)
    }
  }, [language, topic])

  // Run full enhanced 6-step agent analysis pipeline
  const runAnalysis = useCallback(async (userIdea?: string) => {
    if (repos.length === 0) {
      toast.error('Fetch some repos first!')
      return
    }
    setAnalyzing(true)
    setPipeline([
      { agent: 'Intent Analyzer', status: 'pending' },
      { agent: 'Repo Analyzer', status: 'pending' },
      { agent: 'Capability Mapper', status: 'pending' },
      { agent: 'Graphify Engine', status: 'pending' },
      { agent: 'Product Generator', status: 'pending' },
      { agent: 'Architecture Designer', status: 'pending' },
    ])
    try {
      const res = await fetch('/api/github/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repos: repos.map(r => ({
            name: r.name, description: r.description, stars: r.stars,
            language: r.language, topics: r.topics, category: r.category,
            trendScore: r.trendScore, growthRate: r.growthRate, innovationSignals: r.innovationSignals,
            url: r.url,
          })),
          focus: userIdea || topic || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setProducts(data.products || [])
        setCapabilities(data.capabilities || [])
        setPipeline(data.pipeline || [])
        setKnowledgeNodes(data.knowledgeGraph?.nodes || [])
        setKnowledgeEdges(data.knowledgeGraph?.edges || [])
        const strategyCount = (data.crossPollination?.length || 0) + (data.gapAnalysis?.length || 0) + (data.trendBased?.length || 0) + (data.compositionalAI?.length || 0)
        toast.success(`Generated ${data.products?.length || 0} products with ${strategyCount} strategy insights!`)
        setActiveTab('builder')
      } else {
        toast.error(data.error || 'Analysis failed')
      }
    } catch {
      toast.error('Agent analysis pipeline failed')
    } finally {
      setAnalyzing(false)
    }
  }, [repos, topic])

  // Export architecture
  const exportArchitecture = useCallback(async (product: ProductBuild, format: 'json' | 'yaml') => {
    setExporting(true)
    try {
      const res = await fetch('/api/github/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, format }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${product.title.toLowerCase().replace(/\s+/g, '-')}-architecture.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }, [])

  // Generate starter repo
  const generateStarterRepo = useCallback(async (product: ProductBuild, variant: string) => {
    try {
      const res = await fetch('/api/github/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, variant }),
      })
      const data = await res.json()
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.scaffold, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${product.title.toLowerCase().replace(/\s+/g, '-')}-starter.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Starter repo scaffold generated!')
      }
    } catch {
      toast.error('Failed to generate starter repo')
    }
  }, [])

  // Toggle repo selection
  const toggleRepoSelection = useCallback((repoId: number) => {
    setSelectedRepos(prev => {
      const next = new Set(prev)
      if (next.has(repoId)) next.delete(repoId)
      else next.add(repoId)
      return next
    })
  }, [])

  // Auto-fetch on mount
  useEffect(() => {
    fetchRepos()
  }, [])

  // ============================================================
  // FULL SYSTEM VIEW (when product selected)
  // ============================================================
  if (selectedProduct) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
          {/* Mini Header */}
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/70">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI Product Builder</span>
              </div>
              {/* Pipeline status */}
              <div className="flex items-center gap-1.5">
                {pipeline.map((step, i) => (
                  <Tooltip key={step.agent}>
                    <TooltipTrigger>
                      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        step.status === 'completed' ? 'bg-emerald-500' :
                        step.status === 'running' ? 'bg-violet-500 animate-pulse' :
                        step.status === 'error' ? 'bg-red-500' : 'bg-slate-300'
                      }`} />
                    </TooltipTrigger>
                    <TooltipContent>{step.agent}: {step.status}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </header>

          <SystemView
            product={selectedProduct}
            selectedTier={selectedTier}
            onTierChange={setSelectedTier}
            onExport={exportArchitecture}
            onGenerate={generateStarterRepo}
            onBack={() => setSelectedProduct(null)}
            exporting={exporting}
          />
        </div>
      </TooltipProvider>
    )
  }

  // ============================================================
  // MAIN DASHBOARD VIEW
  // ============================================================
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Logo */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                    <Zap className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI Product Builder</h1>
                  <p className="text-xs text-muted-foreground">Multi-Agent Architecture Engine</p>
                </div>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-xl hidden sm:flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search repos, capabilities, or describe what you want to build..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchRepos()}
                    className="pl-9 h-10 bg-white/80 rounded-xl"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={fetchRepos} disabled={loading} className="h-9">
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh Repos</TooltipContent>
                </Tooltip>
                <Button size="sm" onClick={runAnalysis} disabled={analyzing || repos.length === 0}
                  className="h-9 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25">
                  {analyzing ? (
                    <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Brain className="w-4 h-4 mr-1.5" /> Build Products</>
                  )}
                </Button>
                {/* Pipeline Status Dots */}
                {pipeline.length > 0 && (
                  <div className="flex items-center gap-1 ml-1">
                    {pipeline.map((step) => (
                      <Tooltip key={step.agent}>
                        <TooltipTrigger>
                          <div className={`w-2 h-2 rounded-full ${
                            step.status === 'completed' ? 'bg-emerald-500' :
                            step.status === 'running' ? 'bg-violet-500 animate-pulse' :
                            step.status === 'error' ? 'bg-red-500' : 'bg-slate-300'
                          }`} />
                        </TooltipTrigger>
                        <TooltipContent>{step.agent}: {step.status}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Agent Pipeline Status Bar */}
        <AnimatePresence>
          {analyzing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
                <Card className="border-violet-200 bg-violet-50/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Brain className="w-5 h-5 text-violet-600 animate-pulse" />
                      <span className="font-semibold text-violet-700">Agent Pipeline Running</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pipeline.map((step, i) => (
                        <React.Fragment key={step.agent}>
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-sm ${
                              step.status === 'completed' ? 'bg-emerald-500 text-white' :
                              step.status === 'running' ? 'bg-violet-500 text-white animate-pulse' :
                              step.status === 'error' ? 'bg-red-500 text-white' :
                              'bg-slate-200 text-slate-500'
                            }`}>
                              {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
                               step.status === 'running' ? <RefreshCw className="w-3 h-3 animate-spin" /> : i + 1}
                            </div>
                            <span className={`text-xs font-medium ${step.status === 'completed' ? 'text-emerald-600' : step.status === 'running' ? 'text-violet-600' : 'text-slate-400'}`}>
                              {step.agent}
                            </span>
                            {step.duration && <span className="text-xs text-muted-foreground">{step.duration}ms</span>}
                          </div>
                          {i < pipeline.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Repos Loaded', value: repos.length, icon: Github, color: 'from-violet-500 to-indigo-500' },
              { label: 'Products Built', value: products.length, icon: Rocket, color: 'from-emerald-500 to-teal-500' },
              { label: 'Capabilities', value: capabilities.length, icon: Layers, color: 'from-amber-500 to-orange-500' },
              { label: 'Categories', value: new Set(repos.map(r => r.category)).size, icon: Tag, color: 'from-rose-500 to-pink-500' },
              { label: 'Innovation', value: repos.reduce((acc, r) => acc + r.innovationSignals.length, 0), icon: Zap, color: 'from-cyan-500 to-sky-500' },
            ].map((stat) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-sm`}>
                        <stat.icon className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <Card className="mb-6 border-0 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue placeholder="Language" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="rust">Rust</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Topic (e.g., machine-learning)" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-[200px] h-8 text-sm" />
                <Select value={since} onValueChange={setSince}>
                  <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue placeholder="Time range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={fetchRepos} disabled={loading} className="h-8">Apply</Button>
                {(language || topic) && (
                  <Button variant="ghost" size="sm" onClick={() => { setLanguage(''); setTopic('') }} className="h-8">
                    <X className="w-3 h-3 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList className="bg-white shadow-sm">
                <TabsTrigger value="explorer" className="gap-1.5"><Flame className="w-4 h-4" /> Explorer</TabsTrigger>
                <TabsTrigger value="builder" className="gap-1.5">
                  <Rocket className="w-4 h-4" /> Builder
                  {products.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{products.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="graph" className="gap-1.5"><Network className="w-4 h-4" /> Knowledge Graph</TabsTrigger>
                <TabsTrigger value="saved" className="gap-1.5"><Save className="w-4 h-4" /> Saved</TabsTrigger>
              </TabsList>

              {activeTab === 'explorer' && (
                <div className="flex items-center gap-2">
                  <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="h-8 w-8 p-0"><LayoutGrid className="w-4 h-4" /></Button>
                  <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-8 w-8 p-0"><List className="w-4 h-4" /></Button>
                </div>
              )}
            </div>

            {/* Explorer Tab (Trending Repos) */}
            <TabsContent value="explorer" className="space-y-4">
              {loading ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="border-0 shadow-sm bg-white">
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <div className="flex gap-2"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-16" /></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : repos.length === 0 ? (
                <Card className="border-0 shadow-sm bg-white">
                  <CardContent className="p-12 text-center">
                    <Github className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Repos Loaded</h3>
                    <p className="text-muted-foreground mb-4">Fetch trending repos to get started</p>
                    <Button onClick={fetchRepos}><RefreshCw className="w-4 h-4 mr-2" /> Fetch Trending Repos</Button>
                  </CardContent>
                </Card>
              ) : (
                <motion.div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`} initial={false}>
                  <AnimatePresence mode="popLayout">
                    {repos.map((repo, index) => (
                      <motion.div key={repo.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, delay: index * 0.03 }} layout>
                        <Card className={`border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group bg-white ${selectedRepos.has(repo.id) ? 'ring-2 ring-violet-500' : ''}`}>
                          <CardContent className={`${viewMode === 'list' ? 'p-3' : 'p-4'} space-y-3`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={repo.ownerAvatar} alt={repo.owner} className="w-6 h-6 rounded-full shrink-0" />
                                <a href={repo.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm truncate hover:text-violet-600 transition-colors flex items-center gap-1">
                                  {repo.name} <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </a>
                              </div>
                              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 shrink-0 ${selectedRepos.has(repo.id) ? 'text-violet-600' : ''}`} onClick={(e) => { e.stopPropagation(); toggleRepoSelection(repo.id) }}>
                                {selectedRepos.has(repo.id) ? <CheckCircle2 className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                              </Button>
                            </div>
                            {repo.description && <p className="text-xs text-muted-foreground line-clamp-2">{repo.description}</p>}
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="secondary" className="text-xs h-5"><Star className="w-3 h-3 mr-0.5 text-amber-500" />{formatStars(repo.stars)}</Badge>
                              <Badge variant="secondary" className="text-xs h-5"><GitFork className="w-3 h-3 mr-0.5" />{formatStars(repo.forks)}</Badge>
                              {repo.language && <Badge className="text-xs h-5" style={{ backgroundColor: languageColors[repo.language] + '20', color: languageColors[repo.language], borderColor: languageColors[repo.language] + '40' }} variant="outline">{repo.language}</Badge>}
                              <Badge className={`${getCategoryColor(repo.category)} text-xs h-5`}>{repo.category}</Badge>
                            </div>
                            {repo.innovationSignals.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {repo.innovationSignals.slice(0, 2).map((signal) => (
                                  <span key={signal} className="text-xs text-violet-600 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{signal}</span>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </TabsContent>

            {/* Builder Tab */}
            <TabsContent value="builder" className="space-y-4">
              {products.length === 0 ? (
                <Card className="border-0 shadow-sm bg-white">
                  <CardContent className="p-16 text-center">
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
                      className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-400 via-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-violet-500/30">
                      <Rocket className="w-12 h-12 text-white" />
                    </motion.div>
                    <h3 className="text-2xl font-black mb-2 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI Product Builder</h3>
                    <p className="text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
                      Load trending repos and click &quot;Build Products&quot; to run the multi-agent pipeline. Get full system architecture, build variants, agent flows, and more.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Button onClick={fetchRepos} disabled={loading} variant="outline">
                        <Github className="w-4 h-4 mr-2" /> Load Repos
                      </Button>
                      <Button onClick={runAnalysis} disabled={analyzing || repos.length === 0} className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
                        <Brain className="w-4 h-4 mr-2" /> Build Products
                      </Button>
                    </div>
                    {/* Pipeline preview */}
                    <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      {['Intent Analyzer', 'Repo Analyzer', 'Capability Mapper', 'Graphify Engine', 'Product Generator', 'Architecture Designer'].map((agent, i) => (
                        <React.Fragment key={agent}>
                          <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                            className="px-3 py-1.5 rounded-full bg-slate-100">{agent}</motion.span>
                          {i < 5 && <ArrowRight className="w-4 h-4" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Capabilities Summary */}
                  {capabilities.length > 0 && (
                    <Card className="border-0 shadow-sm bg-white">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Layers className="w-5 h-5 text-violet-500" /> Detected Capabilities
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {capabilities.map((cap) => {
                            const CapIcon = getCapabilityIcon(cap.category)
                            return (
                              <Tooltip key={cap.category}>
                                <TooltipTrigger>
                                  <Badge className={`${getCapabilityBgColor(cap.category)} border cursor-default`}>
                                    <CapIcon className="w-3.5 h-3.5 mr-1.5" />
                                    {cap.label}
                                    <span className="ml-1.5 text-muted-foreground">({cap.repos.length})</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">{cap.description}</TooltipContent>
                              </Tooltip>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Enhanced Product Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {products.map((product, index) => (
                      <motion.div key={product.title + index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
                        <ProductCard product={product} onSelect={() => { setSelectedProduct(product); setSelectedTier('intermediate') }} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Knowledge Graph Tab */}
            <TabsContent value="graph" className="space-y-4">
              {knowledgeNodes.length === 0 ? (
                <Card className="border-0 shadow-sm bg-white">
                  <CardContent className="p-12 text-center">
                    <Network className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Knowledge Graph</h3>
                    <p className="text-muted-foreground mb-4">Run &quot;Build Products&quot; to generate the knowledge graph</p>
                    <Button onClick={runAnalysis} disabled={analyzing || repos.length === 0} className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white">
                      <Brain className="w-4 h-4 mr-2" /> Build Products
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-0 shadow-sm bg-white overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Network className="w-5 h-5 text-violet-500" /> Capability Knowledge Graph
                    </CardTitle>
                    <CardDescription>Visualize how repos connect to capabilities and product ideas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <KnowledgeGraphTab nodes={knowledgeNodes} edges={knowledgeEdges} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Saved Tab */}
            <TabsContent value="saved" className="space-y-4">
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-12 text-center">
                  <Save className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Saved Products</h3>
                  <p className="text-muted-foreground mb-4">Save products from the Builder tab to access them here later</p>
                  <Button onClick={() => setActiveTab('builder')} variant="outline">
                    <Rocket className="w-4 h-4 mr-2" /> Go to Builder
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </main>
      </div>
    </TooltipProvider>
  )
}
