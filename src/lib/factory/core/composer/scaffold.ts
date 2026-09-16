import { ROLE_ORDER } from './constants'
import { reposForRole } from './architecture'
import type { SelectedRepo, ProductBlueprint, ProductSystemOutput } from './types'

export function makeBuildStarter(selected: SelectedRepo[], blueprint: ProductBlueprint): ProductSystemOutput['build_starter'] {
  const roleRepo = (role: import('./types').RepoRole) => reposForRole(selected, role).map(repo => repo.name).join(', ')

  return {
    folder_structure: [
      { path: 'apps/web', purpose: 'Operator dashboard, intake forms, review queues, and reporting surfaces.' },
      { path: 'apps/api', purpose: 'Typed API for case intake, status queries, and downstream integrations.' },
      { path: 'apps/worker', purpose: 'Workflow workers, execution jobs, and scheduled maintenance tasks.' },
      { path: 'packages/contracts', purpose: 'Shared JSON schemas and TypeScript types for every node contract.' },
      { path: 'packages/agents', purpose: 'Agent prompts, tool adapters, and retrieval policies.' },
      { path: 'packages/workflows', purpose: 'Planner graph definitions and long-running workflow specs.' },
      { path: 'packages/execution', purpose: 'Execution adapters for APIs, browser automation, and write-backs.' },
      { path: 'infra/docker', purpose: 'Local compose stack for app, workflow, storage, and monitoring services.' },
    ],
    services: [
      { name: 'web', responsibility: 'Case intake, reviewer workbench, and KPI dashboards.', repo: roleRepo('interface') },
      { name: 'agent-runtime', responsibility: 'Case understanding, tool selection, and decision support.', repo: roleRepo('agent') },
      { name: 'planner', responsibility: 'Stateful plan generation and orchestration graph control.', repo: roleRepo('orchestration') },
      { name: 'workflow-engine', responsibility: 'Durable execution state, retries, timers, and approvals.', repo: roleRepo('workflow') },
      { name: 'executor', responsibility: 'Runs background tasks, automations, and external system actions.', repo: roleRepo('execution') },
      { name: 'data-plane', responsibility: 'Persists cases, evidence, outputs, and retrieval indexes.', repo: roleRepo('storage') },
      { name: 'observability', responsibility: 'Dashboards, alerts, traces, and operational audit views.', repo: roleRepo('monitoring') },
      ...(reposForRole(selected, 'security').length > 0
        ? [{ name: 'identity', responsibility: 'SSO, RBAC, and audit-friendly access control.', repo: roleRepo('security') }]
        : []),
    ],
    implementation_steps: [
      `Create the monorepo skeleton and publish the shared contracts first so every service aligns to the same schemas.`,
      `Stand up ${roleRepo('storage')} for durable state and connect ${roleRepo('interface')} to the intake API.`,
      `Implement the agent runtime on ${roleRepo('agent')} and make it emit planner-ready JSON that matches the contracts package.`,
      `Model the planner and durable workflow states with ${roleRepo('orchestration')} plus ${roleRepo('workflow')}.`,
      `Wire ${roleRepo('execution')} into the workflow engine for side effects, retries, and human escalation checkpoints.`,
      `Add business dashboards and operational alerting with ${roleRepo('monitoring')} before production rollout.`,
      `Seed realistic cases for ${blueprint.productName}, validate end-to-end DAG execution, then canary the system with a review queue.`,
    ],
    validation_checks: [
      'Required roles present: agent, orchestration, execution, workflow, storage, interface, monitoring.',
      'DAG includes User Input -> Agent -> Planner -> Execution -> Output.',
      'Every node has explicit input and output schemas.',
      'Selected repositories are framework-grade building blocks, not tutorials or awesome lists.',
    ],
  }
}
