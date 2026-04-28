// ============================================================
// Product Generator Agent
// Generates product ideas with 3-tier build variants
// ============================================================

import { Capability, MappedRepo, BuildVariant, ProductBuild, ProductScore, ExampleOutput, MonetizationPhase, TechLayer, AgentRole, ArchitectureBlock, FlowStep, CapabilityCategory } from "./types";
import { AnalyzedRepo } from "./repo-analyzer";
import { buildProductCompositionPlan } from "./composition-plan";

const BUILD_TEMPLATES: Record<string, {
  simple: { repos: CapabilityCategory[]; tech: TechLayer[]; agents: AgentRole[] };
  intermediate: { repos: CapabilityCategory[]; tech: TechLayer[]; agents: AgentRole[] };
  advanced: { repos: CapabilityCategory[]; tech: TechLayer[]; agents: AgentRole[] };
}> = {
  "AI Knowledge Assistant": {
    simple: {
      repos: ["rag", "model-serving"],
      tech: [
        { layer: "Frontend", technologies: ["React", "Next.js"] },
        { layer: "RAG", technologies: ["LlamaIndex"] },
        { layer: "LLM", technologies: ["OpenAI GPT"] },
      ],
      agents: [
        { name: "Retriever Agent", role: "Fetches relevant documents", description: "Queries the knowledge base and retrieves relevant context" },
      ],
    },
    intermediate: {
      repos: ["rag", "model-serving", "memory", "agent"],
      tech: [
        { layer: "Frontend", technologies: ["Next.js", "Tailwind CSS"] },
        { layer: "Backend", technologies: ["FastAPI"] },
        { layer: "Agent", technologies: ["LangGraph"] },
        { layer: "Memory", technologies: ["ChromaDB"] },
        { layer: "RAG", technologies: ["LlamaIndex"] },
        { layer: "LLM", technologies: ["OpenAI / Claude"] },
      ],
      agents: [
        { name: "Planner Agent", role: "Breaks down user query", description: "Analyzes user intent and creates retrieval plan" },
        { name: "Retriever Agent", role: "Fetches documents", description: "Queries knowledge base with optimized search" },
        { name: "Memory Agent", role: "Stores context", description: "Manages conversation history and learned facts" },
      ],
    },
    advanced: {
      repos: ["rag", "model-serving", "memory", "agent", "automation", "ui"],
      tech: [
        { layer: "Frontend", technologies: ["Next.js", "shadcn/ui", "Framer Motion"] },
        { layer: "API", technologies: ["FastAPI", "GraphQL"] },
        { layer: "Agent Orchestration", technologies: ["CrewAI", "LangGraph"] },
        { layer: "Memory", technologies: ["Neo4j", "ChromaDB"] },
        { layer: "RAG", technologies: ["LlamaIndex", "Custom Reranker"] },
        { layer: "Automation", technologies: ["n8n", "Webhooks"] },
        { layer: "LLM", technologies: ["GPT-4 / Claude / Local Models"] },
        { layer: "Infra", technologies: ["Docker", "Kubernetes"] },
      ],
      agents: [
        { name: "Planner Agent", role: "Strategic planning", description: "Analyzes complex queries and creates multi-step execution plans" },
        { name: "Research Agent", role: "Deep research", description: "Fetches data from multiple sources and synthesizes findings" },
        { name: "Memory Agent", role: "Context management", description: "Maintains persistent memory graph and context windows" },
        { name: "Execution Agent", role: "Task execution", description: "Carries out planned actions and generates outputs" },
        { name: "Quality Agent", role: "Output validation", description: "Reviews and validates outputs before delivery" },
      ],
    },
  },
};

function getTemplateForCapabilities(caps: CapabilityCategory[]): string {
  if (caps.includes("rag") && caps.includes("agent")) return "AI Knowledge Assistant";
  if (caps.includes("agent") && caps.includes("automation")) return "Autonomous Workflow Engine";
  if (caps.includes("memory") && caps.includes("rag")) return "Intelligent Knowledge Platform";
  if (caps.includes("agent") && caps.includes("model-serving")) return "AI Agent Platform";
  if (caps.includes("ui") && caps.includes("model-serving")) return "AI-Powered Dashboard";
  return "AI Knowledge Assistant";
}

export function generateProducts(
  capabilities: Capability[],
  analyzedRepos: AnalyzedRepo[],
  focus?: string
): ProductBuild[] {
  const products: ProductBuild[] = [];

  // Generate 2-3 product ideas based on capabilities
  const combos = generateCapabilityCombos(capabilities);

  for (const combo of combos.slice(0, 5)) {
    const templateName = getTemplateForCapabilities(combo.map(c => c.category));
    const template = BUILD_TEMPLATES[templateName] || BUILD_TEMPLATES["AI Knowledge Assistant"];

    const title = generateProductName(combo, analyzedRepos);
    const tagline = generateTagline(combo);
    const simpleRepos = getReposForBuild(combo, template.simple.repos, { maxRepos: 3, maxPerCapability: 1 });
    const intermediateRepos = getReposForBuild(combo, template.intermediate.repos, { maxRepos: 5, maxPerCapability: 2 });
    const advancedRepos = getReposForBuild(combo, template.advanced.repos, { maxRepos: 8, maxPerCapability: 2 });
    const description = generateDescription(combo, analyzedRepos, advancedRepos);

    const buildVariants: BuildVariant[] = [
      {
        tier: "simple",
        label: "MVP Build",
        description: `Minimal viable product using ${simpleRepos.length} key repos. Quick launch to validate the concept.`,
        repos: simpleRepos,
        techStack: template.simple.tech,
        agents: template.simple.agents,
        architecture: generateArchitecture(template.simple.tech, "simple"),
        systemFlow: generateSystemFlow(template.simple.agents, "simple"),
        estimatedTime: "1-2 weeks",
        difficulty: "beginner",
      },
      {
        tier: "intermediate",
        label: "Scalable Build",
        description: `Feature-rich product using ${intermediateRepos.length} repos. Production-ready with memory and multi-agent support.`,
        repos: intermediateRepos,
        techStack: template.intermediate.tech,
        agents: template.intermediate.agents,
        architecture: generateArchitecture(template.intermediate.tech, "intermediate"),
        systemFlow: generateSystemFlow(template.intermediate.agents, "intermediate"),
        estimatedTime: "4-6 weeks",
        difficulty: "intermediate",
      },
      {
        tier: "advanced",
        label: "Advanced AI System",
        description: `Full multi-agent system using ${advancedRepos.length} repos with Memory + Planning + Execution pipeline.`,
        repos: advancedRepos,
        techStack: template.advanced.tech,
        agents: template.advanced.agents,
        architecture: generateArchitecture(template.advanced.tech, "advanced"),
        systemFlow: generateSystemFlow(template.advanced.agents, "advanced"),
        estimatedTime: "8-12 weeks",
        difficulty: "advanced",
      },
    ];

    const productScore = calculateProductScore(combo, analyzedRepos);
    const exampleOutput = generateExampleOutput(title, combo, template.intermediate.agents);

    const monetization: MonetizationPhase[] = [
      { phase: 1, label: "Community Launch", description: "Free tier + open-source community building", timeline: "0-3 months", revenue: "$0 (growth phase)" },
      { phase: 2, label: "Pro AI Features", description: "Premium agents, advanced RAG, custom models", timeline: "3-6 months", revenue: "$1K-5K MRR" },
      { phase: 3, label: "API & Platform", description: "API access, custom integrations, white-label", timeline: "6-12 months", revenue: "$10K-50K MRR" },
      { phase: 4, label: "Enterprise SaaS", description: "Self-hosted, compliance, SLA, dedicated support", timeline: "12+ months", revenue: "$50K+ MRR" },
    ];

    const compositionPlan = buildProductCompositionPlan({
      productTitle: title,
      capabilities: combo.map(c => c.category),
      repos: advancedRepos,
      techStack: template.advanced.tech,
      agents: template.advanced.agents,
    });

    products.push({
      title,
      tagline,
      description,
      targetAudience: generateTargetAudience(combo),
      uniqueValue: generateUniqueValue(combo),
      capabilities: combo,
      buildVariants,
      productScore,
      exampleOutput,
      monetization,
      keyFeatures: generateKeyFeatures(combo),
      inspiredBy: compositionPlan.selectedRepos.map(repo => repo.fullName),
      strategy: "ai-product-builder",
      compositionPlan,
    });
  }

  return products;
}

function generateCapabilityCombos(capabilities: Capability[]): Capability[][] {
  const combos: Capability[][] = [];

  // Strategy 1: Cross-pollination (2 capabilities)
  for (let i = 0; i < capabilities.length - 1; i++) {
    for (let j = i + 1; j < Math.min(capabilities.length, i + 3); j++) {
      combos.push([capabilities[i], capabilities[j]]);
    }
  }

  // Strategy 2: Full-stack (3-4 capabilities)
  if (capabilities.length >= 3) {
    const core = capabilities.filter(c =>
      ["agent", "rag", "memory", "ui"].includes(c.category)
    );
    if (core.length >= 2) {
      combos.push(core.slice(0, 4));
    }
  }

  // Strategy 3: AI-native (agent + model-serving + memory)
  const aiCores = capabilities.filter(c =>
    ["agent", "model-serving", "memory", "rag"].includes(c.category)
  );
  if (aiCores.length >= 3) {
    combos.push(aiCores);
  }

  return combos;
}

function generateProductName(combo: Capability[], repos: AnalyzedRepo[]): string {
  const prefixes = ["Neo", "Meta", "Synth", "Quantum", "Hyper", "Omni", "Nova", "Flux", "Nexus", "Prism"];
  const suffixes: Record<string, string[]> = {
    memory: ["Vault", "Store", "Cache"],
    agent: ["Mind", "Pilot", "Operator"],
    rag: ["Lens", "Insight", "Search"],
    ui: ["Board", "View", "Portal"],
    automation: ["Flow", "Gear", "Engine"],
    "model-serving": ["Core", "Brain", "Model"],
    data: ["Analytics", "Metrics", "Data"],
    security: ["Shield", "Guard", "Safe"],
    infra: ["Cloud", "Stack", "Node"],
    communication: ["Chat", "Link", "Hub"],
  };

  const primaryCap = combo[0]?.category || "agent";
  const suffix = suffixes[primaryCap]?.[Math.floor(Math.random() * 3)] || "System";
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}${suffix}`;
}

function generateTagline(combo: Capability[]): string {
  const labels = combo.map(c => c.label);
  if (labels.length === 2) return `Bridging ${labels[0]} and ${labels[1]} in one AI-native platform`;
  return `The unified platform for ${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function generateDescription(combo: Capability[], repos: AnalyzedRepo[], selectedRepos: MappedRepo[]): string {
  const topRepos = selectedRepos.length > 0
    ? selectedRepos.slice(0, 4).map(r => r.name)
    : repos.slice(0, 3).map(r => r.name.split("/").pop() || r.name);
  const capLabels = combo.map(c => c.label);
  return `This product synthesizes the best open-source innovations from ${topRepos.join(", ")} into a unified AI-native system. By combining ${capLabels.join(", ")} capabilities and supporting repos across orchestration, execution, and delivery, it creates a seamless product that is greater than the sum of its parts. The system leverages modern AI stack patterns including agents, RAG pipelines, memory, and workflow automation to deliver a build-ready product architecture.`;
}

function generateTargetAudience(combo: Capability[]): string {
  const audiences: Record<CapabilityCategory, string> = {
    memory: "data engineers and knowledge managers",
    agent: "AI developers and automation engineers",
    rag: "research teams and knowledge workers",
    ui: "product teams and end users",
    automation: "DevOps and workflow automation teams",
    "model-serving": "ML engineers and AI platform teams",
    data: "data scientists and analysts",
    security: "security engineers and compliance teams",
    infra: "platform and infrastructure engineers",
    communication: "team leads and collaboration specialists",
  };
  const primary = combo[0]?.category || "agent";
  return audiences[primary] || "tech professionals";
}

function generateUniqueValue(combo: Capability[]): string {
  const labels = combo.map(c => c.label);
  return `First to combine ${labels.join(" + ")} with intelligent agent orchestration and persistent memory`;
}

function generateKeyFeatures(combo: Capability[]): string[] {
  const featureMap: Record<CapabilityCategory, string[]> = {
    memory: ["Persistent knowledge graph", "Semantic search across all data", "Auto-indexing and embedding"],
    agent: ["Multi-agent orchestration", "Autonomous task planning", "Tool-use and function calling"],
    rag: ["Document ingestion pipeline", "Semantic retrieval with reranking", "Source attribution"],
    ui: ["Interactive dashboard", "Real-time data visualization", "Responsive design"],
    automation: ["Event-driven workflows", "Scheduled automation", "CI/CD integration"],
    "model-serving": ["Multi-model support", "Streaming inference", "Cost optimization"],
    data: ["ETL pipelines", "Real-time analytics", "Data warehousing"],
    security: ["Role-based access control", "Audit logging", "Data encryption"],
    infra: ["Auto-scaling", "Health monitoring", "One-click deploy"],
    communication: ["Real-time messaging", "Smart notifications", "API gateway"],
  };

  return combo.flatMap(c => featureMap[c.category]?.slice(0, 2) || []);
}

function getReposForBuild(
  combo: Capability[],
  requiredCaps: CapabilityCategory[],
  options: { maxRepos: number; maxPerCapability: number }
): MappedRepo[] {
  const repos: MappedRepo[] = [];
  const seen = new Set<string>();
  const orderedCaps = Array.from(new Set([...requiredCaps, ...combo.map(c => c.category)]));

  for (let round = 0; round < options.maxPerCapability; round++) {
    for (const cap of orderedCaps) {
      const matching = combo.find(c => c.category === cap);
      const repo = matching?.repos?.[round];
      if (repo && !seen.has(repo.fullName)) {
        repos.push(repo);
        seen.add(repo.fullName);
      }
      if (repos.length >= options.maxRepos) {
        return repos;
      }
    }
  }

  for (const cap of orderedCaps) {
    const matching = combo.find(c => c.category === cap);
    for (const repo of matching?.repos || []) {
      if (!seen.has(repo.fullName)) {
        repos.push(repo);
        seen.add(repo.fullName);
      }
      if (repos.length >= options.maxRepos) {
        return repos;
      }
    }
  }
  return repos;
}

function generateArchitecture(techStack: TechLayer[], tier: string): ArchitectureBlock[] {
  const blocks: ArchitectureBlock[] = [];
  const layers = ["Frontend", "API", "Agent Orchestration", "Agent", "Memory", "RAG", "Automation", "LLM", "Infra"];
  const typeMap: Record<string, ArchitectureBlock["type"]> = {
    "Frontend": "frontend", "API": "api", "Agent Orchestration": "agent", "Agent": "agent",
    "Memory": "memory", "RAG": "data", "Automation": "automation", "LLM": "llm", "Infra": "infra",
    "Service": "service", "Backend": "api",
  };

  for (const tech of techStack) {
    const id = `arch-${tech.layer.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const connections: string[] = [];

    // Connect to next layer
    const layerIndex = layers.indexOf(tech.layer);
    if (layerIndex < layers.length - 1) {
      for (let i = layerIndex + 1; i < layers.length; i++) {
        const nextTech = techStack.find(t => t.layer === layers[i]);
        if (nextTech) {
          connections.push(`arch-${nextTech.layer.toLowerCase().replace(/[^a-z0-9]/g, "-")}`);
          break;
        }
      }
    }

    blocks.push({
      id,
      label: tech.layer,
      type: typeMap[tech.layer] || "service",
      technology: tech.technologies.join(" + "),
      description: `${tech.layer} layer using ${tech.technologies.join(", ")}`,
      connections,
    });
  }

  return blocks;
}

function generateSystemFlow(agents: AgentRole[], tier: string): FlowStep[] {
  const steps: FlowStep[] = [
    { id: "flow-input", label: "User Query", type: "input", description: "User submits a query or task", next: ["flow-planner"] },
    { id: "flow-planner", label: "Planner Agent", type: "agent", description: "Analyzes intent and creates execution plan", next: ["flow-retriever"] },
    { id: "flow-retriever", label: "Retriever (RAG)", type: "process", description: "Searches knowledge base for relevant context", next: ["flow-memory"] },
  ];

  if (tier !== "simple") {
    steps.push({ id: "flow-memory", label: "Memory Check", type: "memory", description: "Checks persistent memory for relevant past context", next: ["flow-executor"] });
  } else {
    steps[2].next = ["flow-executor"];
  }

  steps.push({ id: "flow-executor", label: "Execution Agent", type: "agent", description: "Executes planned actions with retrieved context", next: ["flow-generator"] });

  if (tier === "advanced") {
    steps.push({ id: "flow-validator", label: "Quality Check", type: "decision", description: "Validates output quality and accuracy", next: ["flow-generator"] });
    steps[3].next = ["flow-validator"];
  }

  steps.push({ id: "flow-generator", label: "Response Generator", type: "process", description: "Synthesizes final output", next: ["flow-output"] });
  steps.push({ id: "flow-output", label: "Final Output", type: "output", description: "Delivers response to user", next: [] });

  return steps;
}

function calculateProductScore(combo: Capability[], repos: AnalyzedRepo[]): ProductScore {
  const totalStars = combo.reduce((sum, c) => sum + c.repos.reduce((s, r) => s + r.stars, 0), 0);
  const repoCount = combo.reduce((sum, c) => sum + c.repos.length, 0);

  const marketDemand = Math.min(10, 5 + combo.length * 1.2);
  const technicalFeasibility = Math.min(10, 4 + Math.min(totalStars / 20000, 4) + (repoCount > 3 ? 1 : 0));
  const innovation = Math.min(10, 6 + (combo.length > 2 ? 2 : 0) + (combo.some(c => c.category === "agent") ? 1 : 0));
  const competition = totalStars > 100000 ? "high" : totalStars > 30000 ? "medium" : "low";
  const ecosystemMaturity = Math.min(10, 3 + Math.min(totalStars / 30000, 5) + (combo.some(c => c.repos.length > 3) ? 1 : 0));

  const finalScore = Math.round(((marketDemand * 0.3 + technicalFeasibility * 0.25 + innovation * 0.25 + ecosystemMaturity * 0.2) + (competition === "low" ? 0.5 : competition === "medium" ? 0 : -0.5)) * 10) / 10;
  const competitionSuccess = competition === "low" ? 0.75 : competition === "medium" ? 0.6 : 0.45;
  const successProbability = Math.min(
    0.98,
    Math.max(
      0.05,
      (Math.min(10, finalScore) / 10) * 0.55 +
      (technicalFeasibility / 10) * 0.30 +
      competitionSuccess * 0.15
    )
  );
  const successPercentage = Math.round(successProbability * 100);

  return {
    marketDemand: Math.round(marketDemand * 10) / 10,
    technicalFeasibility: Math.round(technicalFeasibility * 10) / 10,
    innovation: Math.round(innovation * 10) / 10,
    competition,
    ecosystemMaturity: Math.round(ecosystemMaturity * 10) / 10,
    finalScore: Math.min(10, finalScore),
    successProbability: Number(successProbability.toFixed(3)),
    successPercentage,
  };
}

function generateExampleOutput(title: string, combo: Capability[], agents: AgentRole[]): ExampleOutput {
  const steps = [
    "Receives and parses user query",
    "Planner Agent breaks down the request into sub-tasks",
    "Retriever searches knowledge base for relevant context",
  ];

  if (combo.some(c => c.category === "memory")) {
    steps.push("Memory Agent checks for related past interactions");
  }

  steps.push("Execution Agent generates comprehensive response");
  steps.push("Response synthesized and delivered with source attribution");

  return {
    input: "Give me latest AI research trends and suggest product ideas",
    steps,
    output: `Structured analysis with trending repos, capability mapping, 3 product build variants, architecture diagrams, and actionable next steps.`,
  };
}
