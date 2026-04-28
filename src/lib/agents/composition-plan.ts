import {
  type AgentRole,
  type CapabilityCategory,
  type CompositionFolder,
  type CompositionRepo,
  type CompositionRequirement,
  type CompositionService,
  type MappedRepo,
  type ProductCompositionPlan,
  type TechLayer,
} from "./types";

type InputRepo = Partial<MappedRepo> & {
  name: string;
  fullName?: string;
  summary?: string | null;
  description?: string | null;
  language?: string | null;
};

interface CompositionPlanInput {
  productTitle: string;
  capabilities: string[];
  repos: InputRepo[];
  techStack?: TechLayer[] | string[];
  agents?: AgentRole[];
  architecture?: {
    components?: Array<{ name?: string; role?: string; tech?: string; interface?: string }>;
    dataFlows?: Array<{ from?: string; to?: string; data?: string }>;
  } | null;
}

const CAPABILITY_KEYWORDS: Record<string, CapabilityCategory> = {
  vector: "memory",
  memory: "memory",
  storage: "memory",
  database: "memory",
  agent: "agent",
  orchestration: "agent",
  planner: "agent",
  rag: "rag",
  retrieval: "rag",
  search: "rag",
  ui: "ui",
  dashboard: "ui",
  frontend: "ui",
  automation: "automation",
  workflow: "automation",
  schedule: "automation",
  llm: "model-serving",
  inference: "model-serving",
  model: "model-serving",
  data: "data",
  analytics: "data",
  auth: "security",
  security: "security",
  infra: "infra",
  kubernetes: "infra",
  docker: "infra",
  chat: "communication",
  api: "communication",
  websocket: "communication",
};

const CAPABILITY_RESPONSIBILITIES: Record<string, { responsibility: string; integration: string }> = {
  memory: {
    responsibility: "Stores long-lived state, embeddings, and evidence.",
    integration: "Read/write through typed data access adapters.",
  },
  agent: {
    responsibility: "Handles reasoning, planning, and coordination between services.",
    integration: "Invoked through orchestrator and tool adapters.",
  },
  rag: {
    responsibility: "Retrieves relevant context and documents for decision making.",
    integration: "Connected to ingestion jobs and query services.",
  },
  ui: {
    responsibility: "Provides the operator dashboard and product interaction layer.",
    integration: "Consumes API routes and live status streams.",
  },
  automation: {
    responsibility: "Executes workflows, jobs, and external automations.",
    integration: "Triggered by event queues, schedulers, or workflow engines.",
  },
  "model-serving": {
    responsibility: "Runs model inference and prompt execution for AI features.",
    integration: "Exposed behind internal service endpoints.",
  },
  data: {
    responsibility: "Aggregates metrics, pipelines, and reporting data.",
    integration: "Fed by application events and ETL jobs.",
  },
  security: {
    responsibility: "Protects access, secrets, and audit boundaries.",
    integration: "Applied via auth middleware and policy checks.",
  },
  infra: {
    responsibility: "Packages deployment, observability, and runtime operations.",
    integration: "Shared by all services through infrastructure config.",
  },
  communication: {
    responsibility: "Handles APIs, notifications, and user-facing delivery channels.",
    integration: "Connected to frontend clients and downstream systems.",
  },
};

const ORDERED_CAPABILITIES: string[] = [
  "ui",
  "communication",
  "agent",
  "rag",
  "memory",
  "data",
  "model-serving",
  "automation",
  "security",
  "infra",
];

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeName(repo: InputRepo): string {
  return repo.fullName || repo.name;
}

function inferCapability(repo: InputRepo, fallbackCapabilities: string[]): string {
  if (repo.category) return repo.category;
  const haystack = `${repo.role || ""} ${repo.why || ""} ${repo.summary || ""} ${repo.description || ""} ${normalizeName(repo)}`.toLowerCase();

  for (const [keyword, capability] of Object.entries(CAPABILITY_KEYWORDS)) {
    if (haystack.includes(keyword)) return capability;
  }

  return fallbackCapabilities[0] || "agent";
}

function normalizeRepos(repos: InputRepo[], fallbackCapabilities: string[]): CompositionRepo[] {
  const seen = new Set<string>();
  const normalized: CompositionRepo[] = [];

  for (const repo of repos) {
    const fullName = normalizeName(repo);
    if (seen.has(fullName)) continue;
    seen.add(fullName);

    const capability = inferCapability(repo, fallbackCapabilities);
    const defaults = CAPABILITY_RESPONSIBILITIES[capability] || CAPABILITY_RESPONSIBILITIES.agent;
    normalized.push({
      name: repo.name,
      fullName,
      capability,
      role: repo.role || defaults.responsibility,
      why: repo.why || defaults.integration,
      language: repo.language,
      url: repo.url,
      stars: repo.stars,
    });
  }

  return normalized;
}

function techStackToFrameworks(techStack?: TechLayer[] | string[]): string[] {
  if (!techStack) return [];
  if (Array.isArray(techStack) && typeof techStack[0] === "string") {
    return unique((techStack as string[]).filter(Boolean));
  }

  return unique(
    (techStack as TechLayer[]).flatMap(layer => layer.technologies || []).filter(Boolean)
  );
}

function inferLanguages(repos: CompositionRepo[], frameworks: string[], architecture?: CompositionPlanInput["architecture"]): string[] {
  const explicitLanguages = repos.map(repo => repo.language).filter(Boolean) as string[];
  const frameworkLanguages = frameworks.flatMap(framework => {
    const lower = framework.toLowerCase();
    if (["next.js", "react", "typescript", "javascript", "node.js", "node"].some(token => lower.includes(token))) {
      return ["TypeScript"];
    }
    if (["python", "fastapi", "langchain", "langgraph", "crewai", "autogen"].some(token => lower.includes(token))) {
      return ["Python"];
    }
    if (lower.includes("postgresql") || lower.includes("sql")) {
      return ["SQL"];
    }
    return [];
  });

  const architectureLanguages = (architecture?.components || []).flatMap(component => {
    const tech = (component.tech || "").toLowerCase();
    if (!tech) return [];
    if (tech.includes("python")) return ["Python"];
    if (tech.includes("typescript") || tech.includes("javascript") || tech.includes("next.js") || tech.includes("react")) return ["TypeScript"];
    return [component.tech || ""];
  });

  return unique([...explicitLanguages, ...frameworkLanguages, ...architectureLanguages].filter(Boolean));
}

function inferInterfaces(repos: CompositionRepo[], architecture?: CompositionPlanInput["architecture"]): string[] {
  const interfaces = new Set<string>();
  if (repos.some(repo => repo.capability === "ui")) interfaces.add("Web Dashboard");
  if (repos.some(repo => repo.capability === "communication")) interfaces.add("API Layer");
  if (repos.some(repo => repo.capability === "automation")) interfaces.add("Worker Jobs");

  for (const component of architecture?.components || []) {
    if (component.interface) interfaces.add(component.interface.toUpperCase());
  }

  return Array.from(interfaces);
}

function buildRepoRoles(repos: CompositionRepo[]) {
  return repos.map(repo => {
    const defaults = CAPABILITY_RESPONSIBILITIES[repo.capability] || CAPABILITY_RESPONSIBILITIES.agent;
    return {
      repo: repo.fullName,
      capability: repo.capability,
      responsibility: repo.role || defaults.responsibility,
      integrationType: repo.why || defaults.integration,
    };
  });
}

function groupReposByCapability(repos: CompositionRepo[]): Record<string, CompositionRepo[]> {
  const groups: Record<string, CompositionRepo[]> = {};
  for (const repo of repos) {
    if (!groups[repo.capability]) groups[repo.capability] = [];
    groups[repo.capability].push(repo);
  }
  return groups;
}

function buildCombinationSteps(
  productTitle: string,
  repos: CompositionRepo[],
  capabilities: string[]
): ProductCompositionPlan["combinationSteps"] {
  const groups = groupReposByCapability(repos);
  const orderedCaps = ORDERED_CAPABILITIES.filter(cap => groups[cap]?.length).concat(
    capabilities.filter(cap => !ORDERED_CAPABILITIES.includes(cap) && groups[cap]?.length)
  );

  return orderedCaps.map((capability, index) => {
    const capRepos = groups[capability] || [];
    const defaults = CAPABILITY_RESPONSIBILITIES[capability] || CAPABILITY_RESPONSIBILITIES.agent;
    return {
      order: index + 1,
      title: `${capability.replace(/-/g, " ")} layer`,
      repos: capRepos.map(repo => repo.fullName),
      summary: `${productTitle} uses ${capRepos.map(repo => repo.name).join(", ")} to power the ${capability} layer. ${defaults.responsibility}`,
      requirements: [
        defaults.integration,
        `Typed contracts between ${capability} services and the adjacent layers.`,
      ],
      output: capability === "ui"
        ? "Validated user input and dashboard actions."
        : capability === "agent"
          ? "Structured plan and decision context."
          : capability === "automation"
            ? "Executed jobs and external system updates."
            : `Stable ${capability} services connected to the product flow.`,
    };
  });
}

function buildRequirements(repos: CompositionRepo[], languages: string[], frameworks: string[]): CompositionRequirement[] {
  const requirements: CompositionRequirement[] = [
    {
      category: "runtime",
      items: unique([
        ...(languages.includes("TypeScript") ? ["Node.js 20+"] : []),
        ...(languages.includes("Python") ? ["Python 3.11+"] : []),
        "Environment-based secret management",
      ]),
    },
    {
      category: "integration",
      items: unique([
        "HTTP/JSON contracts between services",
        ...(repos.some(repo => repo.capability === "communication") ? ["Webhook or API gateway configuration"] : []),
        ...(repos.some(repo => repo.capability === "automation") ? ["Background worker queue and retry policy"] : []),
      ]),
    },
    {
      category: "data",
      items: unique([
        ...(repos.some(repo => repo.capability === "memory") ? ["Transactional database plus cache/vector storage"] : ["Primary relational database"]),
        ...(repos.some(repo => repo.capability === "rag") ? ["Document ingestion and retrieval indexing pipeline"] : []),
        ...(repos.some(repo => repo.capability === "data") ? ["Analytics event pipeline"] : []),
      ]),
    },
    {
      category: "security",
      items: unique([
        "Role-based access control",
        "Secret rotation for external APIs",
        ...(repos.some(repo => repo.capability === "security") ? ["SSO/OAuth provider integration"] : []),
      ]),
    },
    {
      category: "deployment",
      items: unique([
        "Dockerized services",
        "CI pipeline for lint, tests, and build",
        ...(frameworks.some(framework => framework.toLowerCase().includes("kubernetes")) ? ["Cluster-level deployment manifests"] : ["Docker Compose or container platform deployment"]),
      ]),
    },
  ];

  return requirements.filter(requirement => requirement.items.length > 0);
}

function buildServices(repos: CompositionRepo[]): CompositionService[] {
  const groups = groupReposByCapability(repos);
  const services: CompositionService[] = [];

  if (groups.ui?.length) {
    services.push({
      name: "web-app",
      purpose: "User-facing dashboard and workflows.",
      repos: groups.ui.map(repo => repo.fullName),
    });
  }

  if (groups.agent?.length || groups["model-serving"]?.length) {
    services.push({
      name: "agent-service",
      purpose: "Reasoning, planning, and LLM-backed orchestration.",
      repos: [...(groups.agent || []), ...(groups["model-serving"] || [])].map(repo => repo.fullName),
    });
  }

  if (groups.rag?.length || groups.memory?.length) {
    services.push({
      name: "knowledge-service",
      purpose: "Retrieval, memory, and evidence storage.",
      repos: [...(groups.rag || []), ...(groups.memory || [])].map(repo => repo.fullName),
    });
  }

  if (groups.automation?.length || groups.communication?.length) {
    services.push({
      name: "workflow-service",
      purpose: "Automation, jobs, notifications, and external system sync.",
      repos: [...(groups.automation || []), ...(groups.communication || [])].map(repo => repo.fullName),
    });
  }

  if (groups.data?.length || groups.infra?.length || groups.security?.length) {
    services.push({
      name: "platform-service",
      purpose: "Data pipelines, infra controls, and security boundaries.",
      repos: [...(groups.data || []), ...(groups.infra || []), ...(groups.security || [])].map(repo => repo.fullName),
    });
  }

  return services;
}

function buildFolders(repos: CompositionRepo[]): CompositionFolder[] {
  const capabilities = new Set(repos.map(repo => repo.capability));
  const folders: CompositionFolder[] = [
    { path: "apps/api", purpose: "Public and internal API routes." },
    { path: "packages/shared", purpose: "Shared types, schemas, and utilities." },
    { path: "infra", purpose: "Deployment, Docker, and environment configuration." },
    { path: "tests", purpose: "Integration and end-to-end validation." },
  ];

  if (capabilities.has("ui")) folders.push({ path: "apps/web", purpose: "Dashboard, product UI, and client state." });
  if (capabilities.has("agent") || capabilities.has("model-serving")) folders.push({ path: "services/agents", purpose: "Agent orchestration, prompts, and model adapters." });
  if (capabilities.has("rag")) folders.push({ path: "services/retrieval", purpose: "Document loaders, chunking, and retrieval chains." });
  if (capabilities.has("memory")) folders.push({ path: "services/memory", purpose: "Persistence, vector stores, and state caches." });
  if (capabilities.has("automation")) folders.push({ path: "services/workflows", purpose: "Workers, schedulers, and automation handlers." });
  if (capabilities.has("data")) folders.push({ path: "services/data", purpose: "Analytics processing and reporting pipelines." });
  if (capabilities.has("security")) folders.push({ path: "services/security", purpose: "Auth middleware, policy, and audit tooling." });

  return folders;
}

export function buildProductCompositionPlan(input: CompositionPlanInput): ProductCompositionPlan {
  const normalizedRepos = normalizeRepos(input.repos, input.capabilities);
  const frameworks = techStackToFrameworks(input.techStack);
  const languages = inferLanguages(normalizedRepos, frameworks, input.architecture);
  const interfaces = inferInterfaces(normalizedRepos, input.architecture);

  return {
    selectedRepos: normalizedRepos,
    repoRoles: buildRepoRoles(normalizedRepos),
    combinationSteps: buildCombinationSteps(input.productTitle, normalizedRepos, input.capabilities),
    requirements: buildRequirements(normalizedRepos, languages, frameworks),
    codingType: {
      languages,
      frameworks,
      interfaces,
    },
    structures: {
      services: buildServices(normalizedRepos),
      folders: buildFolders(normalizedRepos),
    },
  };
}
