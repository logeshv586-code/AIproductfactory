import type { SelectedRepo, RepoRole, ProductBlueprint, ArchitectureNode, ArchitectureEdge } from './types'

export function reposForRole(selected: SelectedRepo[], role: RepoRole): SelectedRepo[] {
  return selected.filter(repo => repo.role === role)
}

export function buildArchitecture(selected: SelectedRepo[], blueprint: ProductBlueprint): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  const nodes: ArchitectureNode[] = [
    {
      id: 'user_input',
      label: 'User Input',
      role: 'input',
      component: 'Case intake event',
      repos: [],
    },
    {
      id: 'interface',
      label: 'Interface',
      role: 'interface',
      component: 'Operator workspace and case review UI',
      repos: reposForRole(selected, 'interface').map(repo => repo.name),
    },
    {
      id: 'agent',
      label: 'Agent',
      role: 'agent',
      component: 'Case understanding and decision agent',
      repos: reposForRole(selected, 'agent').map(repo => repo.name),
    },
    {
      id: 'planner',
      label: 'Planner',
      role: 'planner',
      component: 'Structured workflow planner',
      repos: reposForRole(selected, 'orchestration').map(repo => repo.name),
    },
    {
      id: 'workflow',
      label: 'Workflow',
      role: 'workflow',
      component: 'Durable workflow and SLA engine',
      repos: reposForRole(selected, 'workflow').map(repo => repo.name),
    },
    {
      id: 'execution',
      label: 'Execution',
      role: 'execution',
      component: 'Task runner and external system automation',
      repos: reposForRole(selected, 'execution').map(repo => repo.name),
    },
    {
      id: 'storage',
      label: 'Storage',
      role: 'storage',
      component: 'Operational state and evidence store',
      repos: reposForRole(selected, 'storage').map(repo => repo.name),
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      role: 'monitoring',
      component: 'Run health, audit, and KPI visibility',
      repos: reposForRole(selected, 'monitoring').map(repo => repo.name),
    },
    {
      id: 'output',
      label: 'Output',
      role: 'output',
      component: blueprint.finalOutput,
      repos: [],
    },
  ]

  if (reposForRole(selected, 'security').length > 0) {
    nodes.splice(7, 0, {
      id: 'security',
      label: 'Security',
      role: 'security',
      component: 'Identity, access control, and audit policy',
      repos: reposForRole(selected, 'security').map(repo => repo.name),
    })
  }

  const edges: ArchitectureEdge[] = [
    {
      from: 'user_input',
      to: 'interface',
      type: 'data_flow',
      description: 'Operators submit or review a case.',
    },
    {
      from: 'user_input',
      to: 'agent',
      type: 'data_flow',
      description: 'Raw work item enters the AI reasoning layer.',
    },
    {
      from: 'interface',
      to: 'agent',
      type: 'control_flow',
      description: 'Human context and overrides are passed to the agent.',
    },
    {
      from: 'agent',
      to: 'planner',
      type: 'data_flow',
      description: 'The agent emits a structured plan request.',
    },
    {
      from: 'planner',
      to: 'workflow',
      type: 'control_flow',
      description: 'The planner translates intent into durable workflow state.',
    },
    {
      from: 'workflow',
      to: 'execution',
      type: 'control_flow',
      description: 'Workflow steps dispatch execution jobs.',
    },
    {
      from: 'execution',
      to: 'storage',
      type: 'data_flow',
      description: 'Execution writes evidence, state changes, and outputs.',
    },
    {
      from: 'storage',
      to: 'output',
      type: 'data_flow',
      description: 'Stored results are exposed through dashboards, APIs, and notifications.',
    },
    {
      from: 'workflow',
      to: 'monitoring',
      type: 'data_flow',
      description: 'Workflow state and SLA signals feed operational monitoring.',
    },
    {
      from: 'execution',
      to: 'monitoring',
      type: 'data_flow',
      description: 'Execution traces and failure signals feed observability.',
    },
  ]

  if (nodes.some(node => node.id === 'security')) {
    edges.push({
      from: 'security',
      to: 'interface',
      type: 'control_flow',
      description: 'Access policy and identity enforcement protect the operator surface.',
    })
    edges.push({
      from: 'security',
      to: 'workflow',
      type: 'control_flow',
      description: 'Role-based approvals gate sensitive workflow actions.',
    })
  }

  return { nodes, edges }
}
