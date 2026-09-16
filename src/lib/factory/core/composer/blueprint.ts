import { toTitleCase, includesAny } from './utils'
import type { NormalizedBrief, ProductBlueprint } from './types'

export function buildBlueprint(brief: NormalizedBrief): ProductBlueprint {
  const name = toTitleCase(brief.industry)

  if (includesAny(brief.industrySlug, ['health', 'hospital', 'payer', 'pharma'])) {
    return {
      productName: `${name} Prior Authorization Orchestrator`,
      problem: 'Revenue-cycle and care-ops teams still assemble payer evidence by hand, bounce across portals, and lose time on missing documentation, which increases denial risk and slows patient access.',
      solution: 'An agentic authorization control plane that ingests a case, plans payer-specific evidence steps, runs workflow and browser automation against external portals, stores every artifact, and routes only true exceptions to human reviewers.',
      finalOutput: 'A dashboard plus API and workflow automation layer that turns a raw authorization request into a submission packet, review queue, and audit-ready status timeline.',
      userOutcome: 'Users reduce manual touch time, shorten authorization turnaround, and improve first-pass approval rates.',
      caseSchema: {
        type: 'object',
        required: ['case_id', 'patient_id', 'payer', 'procedure_codes'],
        properties: {
          case_id: { type: 'string' },
          patient_id: { type: 'string' },
          payer: { type: 'string' },
          procedure_codes: { type: 'array', items: { type: 'string' } },
          clinical_packet_uri: { type: 'string' },
          priority: { type: 'string', enum: ['routine', 'urgent'] },
        },
      },
      planSchema: {
        type: 'object',
        required: ['case_id', 'steps', 'missing_evidence'],
        properties: {
          case_id: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          missing_evidence: { type: 'array', items: { type: 'string' } },
          escalation_rule: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['case_id', 'job_id', 'actions'],
        properties: {
          case_id: { type: 'string' },
          job_id: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          portal_session_required: { type: 'boolean' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['case_id', 'submission_status', 'review_flags'],
        properties: {
          case_id: { type: 'string' },
          submission_status: { type: 'string' },
          review_flags: { type: 'array', items: { type: 'string' } },
          evidence_bundle_uri: { type: 'string' },
          next_action_at: { type: 'string' },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['finance', 'bank', 'fintech', 'payments'])) {
    return {
      productName: `${name} Exception Resolution Copilot`,
      problem: 'Finance operations teams juggle payment exceptions, ledger breaks, and suspicious anomalies across fragmented systems, so high-value cases sit unresolved and audit trails stay incomplete.',
      solution: 'A finance exception orchestration platform that uses an agent to classify the case, a planner to assemble remediation steps, workflows to manage approvals, and execution adapters to gather evidence and post safe downstream actions.',
      finalOutput: 'A case-resolution dashboard and API that converts raw exception alerts into a disposition package, routed tasks, and reconciled execution history.',
      userOutcome: 'Users clear backlogs faster, improve control coverage, and cut reconciliation time without weakening approvals.',
      caseSchema: {
        type: 'object',
        required: ['exception_id', 'account_id', 'source_system', 'amount'],
        properties: {
          exception_id: { type: 'string' },
          account_id: { type: 'string' },
          source_system: { type: 'string' },
          amount: { type: 'number' },
          anomaly_signals: { type: 'array', items: { type: 'string' } },
          attachments_uri: { type: 'string' },
        },
      },
      planSchema: {
        type: 'object',
        required: ['exception_id', 'resolution_steps', 'approval_policy'],
        properties: {
          exception_id: { type: 'string' },
          resolution_steps: { type: 'array', items: { type: 'string' } },
          approval_policy: { type: 'string' },
          control_checks: { type: 'array', items: { type: 'string' } },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['exception_id', 'actions'],
        properties: {
          exception_id: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          writeback_targets: { type: 'array', items: { type: 'string' } },
          human_approval_token: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['exception_id', 'disposition', 'audit_packet_uri'],
        properties: {
          exception_id: { type: 'string' },
          disposition: { type: 'string' },
          audit_packet_uri: { type: 'string' },
          journal_actions: { type: 'array', items: { type: 'string' } },
          reviewer_queue: { type: 'string' },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['insurance', 'claims'])) {
    return {
      productName: `${name} Claims Triage Engine`,
      problem: 'Claims teams lose time reading submissions, chasing missing documents, and coordinating approvals across adjusters, carriers, and external systems.',
      solution: 'An AI-assisted claims command center that structures intake, plans the next-best actions, drives workflows through adjuster queues, triggers execution tasks, and centralizes evidence for every claim.',
      finalOutput: 'A dashboard and automation service that produces claim routing, next-best-action recommendations, and a complete claim evidence ledger.',
      userOutcome: 'Users shorten cycle times, improve straight-through processing, and surface risky claims earlier.',
      caseSchema: {
        type: 'object',
        required: ['claim_id', 'policy_id', 'loss_type'],
        properties: {
          claim_id: { type: 'string' },
          policy_id: { type: 'string' },
          loss_type: { type: 'string' },
          intake_bundle_uri: { type: 'string' },
          severity_signal: { type: 'string' },
        },
      },
      planSchema: {
        type: 'object',
        required: ['claim_id', 'triage_path'],
        properties: {
          claim_id: { type: 'string' },
          triage_path: { type: 'array', items: { type: 'string' } },
          missing_documents: { type: 'array', items: { type: 'string' } },
          reserve_recommendation: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['claim_id', 'jobs'],
        properties: {
          claim_id: { type: 'string' },
          jobs: { type: 'array', items: { type: 'string' } },
          external_party_updates: { type: 'array', items: { type: 'string' } },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['claim_id', 'status', 'owner'],
        properties: {
          claim_id: { type: 'string' },
          status: { type: 'string' },
          owner: { type: 'string' },
          evidence_timeline_uri: { type: 'string' },
          settlement_blockers: { type: 'array', items: { type: 'string' } },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['manufacturing', 'factory', 'industrial'])) {
    return {
      productName: `${name} Quality Deviation Control Tower`,
      problem: 'Manufacturing teams investigate quality incidents across MES, ERP, and manual spreadsheets, which delays containment and makes root-cause work inconsistent.',
      solution: 'A deviation response platform that assembles production evidence, plans the investigation path, runs workflow assignments, triggers corrective-action tasks, and keeps a single record for every incident.',
      finalOutput: 'A command dashboard and workflow layer that turns a production deviation into an owned action plan, evidence packet, and closure report.',
      userOutcome: 'Users contain incidents faster, improve traceability, and cut the time from detection to corrective action.',
      caseSchema: {
        type: 'object',
        required: ['incident_id', 'line_id', 'sku'],
        properties: {
          incident_id: { type: 'string' },
          line_id: { type: 'string' },
          sku: { type: 'string' },
          sensor_window_uri: { type: 'string' },
          defect_signals: { type: 'array', items: { type: 'string' } },
        },
      },
      planSchema: {
        type: 'object',
        required: ['incident_id', 'containment_steps'],
        properties: {
          incident_id: { type: 'string' },
          containment_steps: { type: 'array', items: { type: 'string' } },
          root_cause_hypotheses: { type: 'array', items: { type: 'string' } },
          escalation_owner: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['incident_id', 'tasks'],
        properties: {
          incident_id: { type: 'string' },
          tasks: { type: 'array', items: { type: 'string' } },
          system_writebacks: { type: 'array', items: { type: 'string' } },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['incident_id', 'status', 'closure_report_uri'],
        properties: {
          incident_id: { type: 'string' },
          status: { type: 'string' },
          closure_report_uri: { type: 'string' },
          quality_kpis: { type: 'array', items: { type: 'string' } },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['logistics', 'transport', 'supply-chain'])) {
    return {
      productName: `${name} Shipment Exception Orchestrator`,
      problem: 'Logistics teams monitor delays, handoffs, and missing milestone events across multiple carriers and portals, which leads to slow interventions and poor customer communication.',
      solution: 'A shipment exception platform that classifies disruptions, plans the best remediation path, automates updates and escalations, and stores a complete runbook for every shipment.',
      finalOutput: 'A dashboard, API, and automation backbone that transforms raw delay signals into owner assignments, customer updates, and recovery workflows.',
      userOutcome: 'Users resolve disruptions faster, improve SLA adherence, and reduce manual carrier follow-up.',
      caseSchema: {
        type: 'object',
        required: ['shipment_id', 'carrier', 'milestone_gap'],
        properties: {
          shipment_id: { type: 'string' },
          carrier: { type: 'string' },
          milestone_gap: { type: 'string' },
          order_id: { type: 'string' },
          customer_tier: { type: 'string' },
        },
      },
      planSchema: {
        type: 'object',
        required: ['shipment_id', 'recovery_steps'],
        properties: {
          shipment_id: { type: 'string' },
          recovery_steps: { type: 'array', items: { type: 'string' } },
          notification_plan: { type: 'array', items: { type: 'string' } },
          fallback_carrier_policy: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['shipment_id', 'actions'],
        properties: {
          shipment_id: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          partner_updates: { type: 'array', items: { type: 'string' } },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['shipment_id', 'status', 'next_update_at'],
        properties: {
          shipment_id: { type: 'string' },
          status: { type: 'string' },
          next_update_at: { type: 'string' },
          exception_owner: { type: 'string' },
          audit_timeline_uri: { type: 'string' },
        },
      },
    }
  }

  return {
    productName: `${name} Operations Decision Engine`,
    problem: `Teams in ${brief.industry} still move high-friction cases through email, spreadsheets, and disconnected systems, which slows decisions and hides operational risk.`,
    solution: `A domain-specific control plane that receives work items, uses agents to structure the case, plans the right actions, executes integrations safely, stores evidence, and exposes a dashboard plus API for humans and downstream systems.`,
    finalOutput: 'A dashboard, API, and automation service that converts a raw work item into an actionable plan, execution trail, and review-ready result.',
    userOutcome: `Users in ${brief.industry} reduce manual triage, standardize execution, and improve throughput for high-value cases.`,
    caseSchema: {
      type: 'object',
      required: ['work_item_id', 'account_id', 'summary'],
      properties: {
        work_item_id: { type: 'string' },
        account_id: { type: 'string' },
        summary: { type: 'string' },
        attachments_uri: { type: 'string' },
        priority: { type: 'string' },
      },
    },
    planSchema: {
      type: 'object',
      required: ['work_item_id', 'steps'],
      properties: {
        work_item_id: { type: 'string' },
        steps: { type: 'array', items: { type: 'string' } },
        blockers: { type: 'array', items: { type: 'string' } },
        reviewer_queue: { type: 'string' },
      },
    },
    executionSchema: {
      type: 'object',
      required: ['work_item_id', 'actions'],
      properties: {
        work_item_id: { type: 'string' },
        actions: { type: 'array', items: { type: 'string' } },
        writeback_targets: { type: 'array', items: { type: 'string' } },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['work_item_id', 'status', 'artifacts'],
      properties: {
        work_item_id: { type: 'string' },
        status: { type: 'string' },
        artifacts: { type: 'array', items: { type: 'string' } },
        next_action_at: { type: 'string' },
      },
    },
  }
}
