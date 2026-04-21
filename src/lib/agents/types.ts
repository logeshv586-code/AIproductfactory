// ============================================================
// Agent System Types
// ============================================================

export interface RepoInput {
  name: string;
  description: string | null;
  stars: number;
  language: string | null;
  topics: string[];
  category: string;
  trendScore: number;
  growthRate: number;
  innovationSignals: string[];
  url?: string;
}

export type CapabilityCategory =
  | "memory"
  | "agent"
  | "rag"
  | "ui"
  | "automation"
  | "model-serving"
  | "data"
  | "security"
  | "infra"
  | "communication";

export interface Capability {
  category: CapabilityCategory;
  label: string;
  repos: MappedRepo[];
  description: string;
  icon: string;
}

export interface MappedRepo {
  name: string;
  fullName: string;
  url: string;
  role: string;
  why: string;
  stars: number;
  category: CapabilityCategory;
}

export interface BuildVariant {
  tier: "simple" | "intermediate" | "advanced";
  label: string;
  description: string;
  repos: MappedRepo[];
  techStack: TechLayer[];
  agents: AgentRole[];
  architecture: ArchitectureBlock[];
  systemFlow: FlowStep[];
  estimatedTime: string;
  difficulty: string;
}

export interface TechLayer {
  layer: string;
  technologies: string[];
}

export interface AgentRole {
  name: string;
  role: string;
  description: string;
}

export interface ArchitectureBlock {
  id: string;
  label: string;
  type: "frontend" | "api" | "agent" | "memory" | "llm" | "data" | "infra" | "service";
  technology: string;
  description: string;
  connections: string[];
}

export interface FlowStep {
  id: string;
  label: string;
  type: "input" | "agent" | "process" | "memory" | "output" | "decision";
  description: string;
  next: string[];
}

export interface ProductScore {
  marketDemand: number;
  technicalFeasibility: number;
  innovation: number;
  competition: "low" | "medium" | "high";
  ecosystemMaturity: number;
  finalScore: number;
}

export interface ExampleOutput {
  input: string;
  steps: string[];
  output: string;
}

export interface MonetizationPhase {
  phase: number;
  label: string;
  description: string;
  timeline: string;
  revenue: string;
}

export interface ProductBuild {
  title: string;
  tagline: string;
  description: string;
  targetAudience: string;
  uniqueValue: string;
  capabilities: Capability[];
  buildVariants: BuildVariant[];
  productScore: ProductScore;
  exampleOutput: ExampleOutput;
  monetization: MonetizationPhase[];
  keyFeatures: string[];
  inspiredBy: string[];
  strategy: string;
}

export interface AnalysisResult {
  repos: RepoInput[];
  capabilities: Capability[];
  products: ProductBuild[];
  knowledgeGraph: KnowledgeGraphData;
  pipeline: PipelineStep[];
}

export interface PipelineStep {
  agent: string;
  status: "pending" | "running" | "completed" | "error";
  duration?: number;
  result?: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: "repo" | "capability" | "product" | "tech" | "category";
  size?: number;
  color?: string;
  data?: Record<string, any>;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type?: "provides" | "inspires" | "combines" | "requires" | "related";
}
