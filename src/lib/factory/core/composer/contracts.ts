import type { ProductBlueprint, SelectedRepo, NodeContract } from './types'
import { reposForRole } from './architecture'

export function buildContracts(blueprint: ProductBlueprint, selected: SelectedRepo[]): Record<string, NodeContract> {
  const securityEnabled = reposForRole(selected, 'security').length > 0

  return {
    user_input: {
      input: {
        type: 'json',
        schema: blueprint.caseSchema,
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload', 'submitted_by'],
          properties: {
            case_payload: blueprint.caseSchema,
            submitted_by: { type: 'string' },
            channel: { type: 'string' },
          },
        },
      },
    },
    interface: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload', 'submitted_by'],
          properties: {
            case_payload: blueprint.caseSchema,
            submitted_by: { type: 'string' },
            draft_notes: { type: 'string' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload', 'operator_context'],
          properties: {
            case_payload: blueprint.caseSchema,
            operator_context: {
              type: 'object',
              properties: {
                assignee: { type: 'string' },
                priority_override: { type: 'string' },
              },
            },
          },
        },
      },
    },
    agent: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload'],
          properties: {
            case_payload: blueprint.caseSchema,
            operator_context: { type: 'object' },
            retrieval_context: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_summary', 'proposed_plan'],
          properties: {
            case_summary: { type: 'string' },
            proposed_plan: blueprint.planSchema,
            confidence: { type: 'number' },
            citations: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    planner: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_summary', 'proposed_plan'],
          properties: {
            case_summary: { type: 'string' },
            proposed_plan: blueprint.planSchema,
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_id', 'jobs'],
          properties: {
            workflow_id: { type: 'string' },
            jobs: { type: 'array', items: blueprint.executionSchema },
            retry_policy: { type: 'string' },
          },
        },
      },
    },
    workflow: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_id', 'jobs'],
          properties: {
            workflow_id: { type: 'string' },
            jobs: { type: 'array', items: blueprint.executionSchema },
            approval_token: securityEnabled ? { type: 'string' } : { type: 'null' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_id', 'dispatch_batch'],
          properties: {
            workflow_id: { type: 'string' },
            dispatch_batch: { type: 'array', items: blueprint.executionSchema },
            sla_due_at: { type: 'string' },
          },
        },
      },
    },
    execution: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['dispatch_batch'],
          properties: {
            dispatch_batch: { type: 'array', items: blueprint.executionSchema },
            execution_context: { type: 'object' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['execution_results'],
          properties: {
            execution_results: { type: 'array', items: blueprint.outputSchema },
            error_events: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    storage: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['execution_results'],
          properties: {
            execution_results: { type: 'array', items: blueprint.outputSchema },
            event_log: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['record_ids', 'materialized_output'],
          properties: {
            record_ids: { type: 'array', items: { type: 'string' } },
            materialized_output: blueprint.outputSchema,
            dashboard_projection_uri: { type: 'string' },
          },
        },
      },
    },
    monitoring: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_metrics'],
          properties: {
            workflow_metrics: { type: 'array', items: { type: 'string' } },
            error_events: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['dashboards', 'alerts'],
          properties: {
            dashboards: { type: 'array', items: { type: 'string' } },
            alerts: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    output: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['materialized_output'],
          properties: {
            materialized_output: blueprint.outputSchema,
            dashboard_projection_uri: { type: 'string' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['delivery_channel', 'result'],
          properties: {
            delivery_channel: { type: 'string', enum: ['dashboard', 'api', 'automation'] },
            result: blueprint.outputSchema,
          },
        },
      },
    },
  }
}
