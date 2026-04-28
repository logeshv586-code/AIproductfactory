// ============================================================
// Architecture Composer
// Transforms repository selections into coherent system designs
// ============================================================

import { Capability } from "@/lib/agents/types";
import { RankedRepo, UserIntent } from "@/engine/repoSelector";

// Define architectural roles
export type ArchitecturalRole = 
  | 'entry'
  | 'exit'
  | 'agent'
  | 'orchestration' 
  | 'rpa'
  | 'execution'
  | 'workflow'
  | 'storage'
  | 'monitoring'
  | 'security'
  | 'database'
  | 'api';

export interface RoleContractSchema {
  type: string;
  schema: string;
}

export interface RoleContract {
  input: RoleContractSchema;
  output: RoleContractSchema;
}

// Role-based repo mapping
export type RoleBasedMapping = Partial<Record<ArchitecturalRole, string>>;

// Architecture validation result
export interface ArchitectureValidation {
  isValid: boolean;
  missingRoles: ArchitecturalRole[];
  issues: string[];
}

export interface CoherenceScore {
  score: number;
  breakdown: {
    compatibility: number;
    synergy: number;
    consistency: number;
  };
  comments: string[];
}

export interface ArchitectureNode {
  id: string; // usually role or repo name
  role: ArchitecturalRole;
  component: string;
  description: string;
  contract: RoleContract;
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  type: "data_flow" | "control_flow" | "dependency";
}

// System architecture output
export interface SystemArchitecture {
  layers: { // retained for backward UI compatibility
    role: ArchitecturalRole;
    component: string;
    description: string;
  }[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  flow: string[]; // backward compat
  coherenceScore: CoherenceScore;
  validation: ArchitectureValidation;
  confidence: number;
  status: "production_ready" | "prototype" | "low_confidence";
}

// Mapping of repos to architectural roles
const ROLE_MAPPINGS: Record<string, ArchitecturalRole> = {
  // Agents
  'autogen': 'agent',
  'langchain': 'agent',
  'llamaindex': 'agent',
  'crewai': 'agent',
  
  // Orchestration
  'langgraph': 'orchestration',
  'temporal': 'orchestration',
  'apache-airflow': 'orchestration',
  
  // RPA
  'robocorp': 'rpa',
  'puppeteer': 'rpa',
  
  // Execution
  'playwright': 'execution',
  'selenium': 'execution',
  'webdriver': 'execution',
  
  // Workflow
  'n8n': 'workflow',
  'zapier': 'workflow',
  
  // Storage (redirect repos map here)
  'redis': 'storage',
  'mongodb': 'storage',
  
  // Database
  'postgresql': 'database',
  'mysql': 'database',
  'sqlite': 'database'
};

// Machine usable contracts
export const ROLE_CONTRACTS: Record<ArchitecturalRole, RoleContract> = {
  entry: { input: { type: "system_trigger", schema: "any" }, output: { type: "task", schema: "json" } },
  exit: { input: { type: "result", schema: "json" }, output: { type: "response", schema: "any" } },
  agent: { input: { type: "task", schema: "string" }, output: { type: "plan", schema: "json" } },
  orchestration: { input: { type: "plan", schema: "json" }, output: { type: "execution_commands", schema: "json" } },
  rpa: { input: { type: "command", schema: "string" }, output: { type: "ui_state", schema: "json" } },
  execution: { input: { type: "action", schema: "json" }, output: { type: "result", schema: "json" } },
  workflow: { input: { type: "event", schema: "json" }, output: { type: "triggered_jobs", schema: "string[]" } },
  storage: { input: { type: "data", schema: "blob" }, output: { type: "reference", schema: "string" } },
  monitoring: { input: { type: "telemetry", schema: "stream" }, output: { type: "alerts", schema: "json" } },
  security: { input: { type: "credentials", schema: "string" }, output: { type: "token", schema: "string" } },
  database: { input: { type: "query", schema: "sql" }, output: { type: "dataset", schema: "json" } },
  api: { input: { type: "request", schema: "http" }, output: { type: "response", schema: "http" } }
};

// Cardinality and dependencies
export const ROLE_DEPENDENCIES: Partial<Record<ArchitecturalRole, { requires: ArchitecturalRole[], optional: ArchitecturalRole[], maxInstances: number }>> = {
  execution: { requires: ["agent"], optional: ["workflow"], maxInstances: 2 },
  agent: { requires: [], optional: ["orchestration", "memory" as ArchitecturalRole, "storage"], maxInstances: 3 },
  orchestration: { requires: ["agent"], optional: ["execution"], maxInstances: 1 }
};

// Required roles for a complete system
export const REQUIRED_ROLES: ArchitecturalRole[] = ['agent', 'execution', 'workflow'];

/**
 * Maps repositories to architectural roles
 */
export function mapToArchitecturalRoles(repos: RankedRepo[]): RoleBasedMapping {
  const mapping: RoleBasedMapping = {};
  
  repos.forEach(repo => {
    // repo.name might be in the format 'owner/repo' depending on the input, so normalize it or use lowercased name.
    const repoName = repo.name.split('/').pop()?.toLowerCase() || repo.name.toLowerCase();
    
    // Check direct mapping first
    let role = ROLE_MAPPINGS[repoName];
    
    // Fallback: check if the repo's assigned LLM role explicitly matches our arch roles
    if (!role) {
      if (['agent', 'execution', 'workflow', 'orchestration', 'database', 'api'].includes(repo.role.toLowerCase())) {
        role = repo.role.toLowerCase() as ArchitecturalRole;
      }
    }
    
    if (role && !mapping[role]) {
      mapping[role] = repo.name;
    }
  });
  
  return mapping;
}

/**
 * Validates architecture coverage
 */
export function validateArchitectureCoverage(mapping: RoleBasedMapping): ArchitectureValidation {
  const missingRoles: ArchitecturalRole[] = [];
  const issues: string[] = [];
  
  REQUIRED_ROLES.forEach(role => {
    if (!mapping[role]) {
      missingRoles.push(role);
    }
  });
  
  if (missingRoles.length > 0) {
    issues.push(`Missing required components: ${missingRoles.join(', ')}`);
  }
  
  return {
    isValid: missingRoles.length === 0,
    missingRoles,
    issues
  };
}

/**
 * Calculates stack coherence score
 */
export function calculateCoherenceScore(repos: RankedRepo[]): CoherenceScore {
  let compatibility = 0;
  let synergy = 0;
  let consistency = 0;
  const comments: string[] = [];
  
  const repoNames = repos.map(r => r.name.toLowerCase());
  const repoSet = new Set(repoNames);
  
  // Check for compatible pairs
  const compatiblePairs = [
    ['langchain', 'langgraph'],
    ['robocorp', 'playwright'],
    ['puppeteer', 'playwright'],
    ['apache-airflow', 'n8n']
  ];
  
  compatiblePairs.forEach(([first, second]) => {
    const hasFirst = repoNames.some(n => n.includes(first));
    const hasSecond = repoNames.some(n => n.includes(second));
    if (hasFirst && hasSecond) {
      compatibility += 20;
      comments.push(`Compatible pair: ${first} + ${second}`);
    }
  });
  
  // Check for potential mismatches
  const hasTensorflow = repoNames.some(n => n.includes('tensorflow'));
  if (hasTensorflow && !repoNames.some(name => 
    name.includes('ml') || name.includes('machine') || name.includes('ai'))) {
    consistency -= 15;
    comments.push('TensorFlow used without ML intent - penalized');
  }
  
  // Calculate final scores
  const totalScore = Math.max(0, Math.min(100, compatibility + synergy + consistency));
  
  return {
    score: totalScore,
    breakdown: { compatibility, synergy, consistency },
    comments
  };
}

/**
 * Generates system architecture from repository mappings
 */
export function generateSystemArchitecture(
  repos: RankedRepo[], 
  mapping: RoleBasedMapping,
  validation: ArchitectureValidation
): SystemArchitecture {
  
  const nodes: ArchitectureNode[] = [];
  const edges: ArchitectureEdge[] = [];
  
  // Entry node
  nodes.push({
    id: "input",
    role: "entry",
    component: "User Input",
    description: "System entry point",
    contract: ROLE_CONTRACTS["entry"]
  });

  // Dynamically build mapped nodes
  for (const [role, component] of Object.entries(mapping)) {
    const archRole = role as ArchitecturalRole;
    nodes.push({
      id: archRole,
      role: archRole,
      component,
      description: getRoleDescription(archRole, component),
      contract: ROLE_CONTRACTS[archRole] || { input: { type: "any", schema: "any" }, output: { type: "any", schema: "any" } }
    });
  }

  // Exit node
  nodes.push({
    id: "output",
    role: "exit",
    component: "System Output",
    description: "System exit point",
    contract: ROLE_CONTRACTS["exit"]
  });

  // Construct edges based on dependencies
  let previousRole = "input";
  const sequentialRoles: ArchitecturalRole[] = ["agent", "orchestration", "rpa", "execution", "workflow"];
  
  for (const role of sequentialRoles) {
    if (mapping[role]) {
      edges.push({
        from: previousRole,
        to: role,
        type: "data_flow"
      });
      previousRole = role;
    }
  }
  
  edges.push({
    from: previousRole,
    to: "output",
    type: "data_flow"
  });

  // Add dependency edges
  for (const [role, component] of Object.entries(mapping)) {
    const archRole = role as ArchitecturalRole;
    const deps = ROLE_DEPENDENCIES[archRole];
    if (deps) {
      deps.requires.forEach(req => {
        if (mapping[req]) {
          edges.push({
            from: req,
            to: archRole,
            type: "dependency"
          });
        }
      });
    }
  }

  const layers = nodes
    .filter(n => n.role !== "entry" && n.role !== "exit")
    .map(n => ({
      role: n.role,
      component: n.component,
      description: n.description
    }));
  
  // Format compat
  const flow = ["User Task → Agent → Planner → Execution → Result"];
  
  const coherenceData = calculateCoherenceScore(repos);
  
  // --- Failure Simulation (Lightweight) ---
  let failurePenalty = 0;
  const hasWorkflow = !!mapping["workflow"];
  const hasOrchestration = !!mapping["orchestration"];
  
  if (!hasWorkflow && !hasOrchestration) {
    failurePenalty += 10; // No retry mechanism natively provided by these layers
    coherenceData.comments.push('Missing retry mechanism (no workflow/orchestrator)');
  }
  
  if (mapping["execution"] && !hasOrchestration) {
    failurePenalty += 15; // Single point of failure logic - execution without orchestrator
    coherenceData.comments.push('Single point of failure (execution runs unmanaged)');
  }
  // ----------------------------------------
  
  // Subtract penalties from coherence
  coherenceData.score = Math.max(0, coherenceData.score - failurePenalty);
  
  // Formulate explicitly calculated confidence
  const coherenceScoreNormalized = (coherenceData.score / 100);
  const coverageScore = validation.isValid ? 1.0 : (1.0 - (validation.missingRoles.length * 0.3));
  
  // Using repo score/confidence average as a proxy for "maturity" since stars aren't dynamically mapped
  // in RankedRepo, it already folds in rank scores.
  const topReposAverageConfidence = repos.reduce((acc, r) => acc + (r.confidence || 0.5), 0) / (repos.length || 1);
  const maturityScore = topReposAverageConfidence; 
  
  // confidence = coherence*0.4 + coverage*0.3 + maturity*0.3
  const rawConfidence = (coherenceScoreNormalized * 0.4) + (Math.max(0, coverageScore) * 0.3) + (maturityScore * 0.3);
  const confidence = Math.min(1.0, Math.max(0.0, rawConfidence));

  let status: "production_ready" | "prototype" | "low_confidence" = "low_confidence";
  if (confidence >= 0.7) status = "production_ready";
  else if (confidence >= 0.4) status = "prototype";
  
  return {
    layers,
    nodes,
    edges,
    flow,
    coherenceScore: coherenceData,
    validation,
    confidence,
    status
  };
}

/**
 * Gets descriptive text for role
 */
function getRoleDescription(role: ArchitecturalRole, component: string): string {
  switch (role) {
    case 'agent': return 'Intelligent agent framework for task execution and decision making';
    case 'orchestration': return 'Workflow orchestration and coordination engine';
    case 'rpa': return 'Robotic Process Automation framework for task automation';
    case 'execution': return 'Execution environment for automated tasks and processes';
    case 'workflow': return 'Workflow management system for process automation';
    case 'storage': return 'Data storage solution for persistent information';
    case 'monitoring': return 'Monitoring and observability platform';
    case 'security': return 'Security and authentication framework';
    case 'database': return 'Database management system';
    case 'api': return 'API gateway and service integration layer';
    default: return `Component for ${role} functionality`;
  }
}