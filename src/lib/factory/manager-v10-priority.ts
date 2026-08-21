import {
  createFactoryManagerV10Report,
  type CustomerComposition,
  type FactoryManagerV10Input,
  type FactoryManagerV10Report,
  type RankedRepo,
} from '@/lib/factory/manager-v10'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function desiredEffort(priority: unknown): CustomerComposition['effort'] {
  const value = text(priority).toLowerCase()
  if (value === 'speed') return 'Fastest'
  if (value === 'scale') return 'Most robust'
  return 'Balanced'
}

function reorderPlans(report: FactoryManagerV10Report, input: FactoryManagerV10Input) {
  const wanted = desiredEffort(input.customerContext?.priority)
  const chosen = report.compositionSuggestions.find((plan) => plan.effort === wanted)
  if (!chosen) return report.compositionSuggestions

  return [chosen, ...report.compositionSuggestions.filter((plan) => plan.id !== chosen.id)]
    .map((plan, index) => ({
      ...plan,
      type: index === 0 ? 'recommended' : plan.type === 'recommended' ? 'two-repo-fusion' : plan.type,
    }))
}

function implementationPrompt(
  idea: string,
  plan: CustomerComposition | undefined,
  report: FactoryManagerV10Report,
) {
  const repos = (plan?.repos || []) as RankedRepo[]
  const brief = report.customerBrief

  return `You are the implementation engineer for AI Product Factory. Build the exact customer-approved product as a production-ready, maintainable system.\n\nPRODUCT OUTCOME\n${idea}\n\nCUSTOMER BRIEF\n- Audience: ${brief.audience}\n- Priority: ${brief.priority}\n- Platform: ${brief.platform}\n- Privacy: ${brief.privacy}\n- Cost posture: ${brief.budget}\n- Success: ${brief.successOutcome}\n\nAPPROVED / RECOMMENDED PLAN\n- Plan: ${plan?.customerTitle || 'No plan selected'}\n- Best for: ${plan?.bestFor || 'No plan selected'}\n- Canonical implementation fit: ${plan?.estimatedFit ?? 0}%\n- Recommendation confidence: ${plan?.confidence ?? 0}%\n- Capability coverage: ${plan?.capabilityCoverage ?? 0}%\n- Domain relevance: ${plan?.domainRelevance ?? 0}%\n- Integration complexity: ${plan?.integrationComplexity || 'Unknown'}\n\nOPEN-SOURCE SOURCES\n${repos.length ? repos.map((repo, index) => `${index + 1}. ${repo.fullName} — ${repo.url}\n   Role: ${repo.capabilities.join(', ') || 'Validated reusable component'}\n   License: ${repo.license}\n   Product relevance: ${repo.productRelevance ?? 0}%\n   Recommendation score: ${repo.recommendationScore ?? 0}%`).join('\n') : '- No external repository is approved. Implement product-owned code only.'}\n\nSOURCE-USAGE RULES\n- Never merge source trees blindly. Use dependencies, services, adapters or clean-room reimplementation where appropriate.\n- Re-check current README/API documentation and pin exact versions/commits before implementation.\n- Verify license obligations and maintain THIRD_PARTY_NOTICES.md.\n- Reject or replace a source if executable validation proves it does not match the required capability.\n- Keep every third-party integration replaceable behind typed contracts.\n- Do not silently substitute a different repository after the user approves the plan.\n\nMISSING / PRODUCT-OWNED CAPABILITIES\n${plan?.missingCapabilities.length ? plan.missingCapabilities.map((item) => `- ${item}`).join('\n') : '- No major capability gap is currently identified; product workflow and differentiation still remain product-owned.'}\n\nIMPLEMENTATION FLOW\n1. Inspect the target repository and create an ADR for every external source.\n2. Define product-owned domain models and typed contracts first.\n3. Make each selected external component work independently before composition.\n4. Implement the smallest end-to-end customer workflow; do not stop at scaffolding.\n5. Add authentication, authorization, input validation, secrets handling, retries, timeouts, idempotency and failure isolation.\n6. Add unit, adapter-contract, integration and end-to-end tests for success and failure paths.\n7. Add Docker/dev setup, health checks, structured logs, observability and cost metering.\n8. Run lint, typecheck, tests, security/dependency checks and production build; fix failures before declaring completion.\n9. Produce setup documentation, architecture notes, API examples and THIRD_PARTY_NOTICES.md.\n\nRELEASE RULE\nDo not call the product verified because an AI score is high. VERIFIED requires pinned source truth, license review, clean build, passing tests, security checks and a realistic end-user outcome test.\n\nStart with a concise implementation plan and file map, then implement and validate the runnable vertical slice.`
}

export function createPriorityAwareFactoryManagerV10Report(input: FactoryManagerV10Input): FactoryManagerV10Report {
  const report = createFactoryManagerV10Report(input)
  const plans = reorderPlans(report, input)
  const recommended = plans[0]

  if (recommended) {
    const decision: FactoryManagerV10Report['managerVerdict']['decision'] = recommended.estimatedFit < 58
      ? 'RESEARCH_MORE'
      : recommended.estimatedFit >= 82 && recommended.confidence >= 78
        ? 'GO'
        : 'GO_WITH_GUARDS'

    report.managerVerdict = {
      ...report.managerVerdict,
      decision,
      estimatedFeasibility: recommended.estimatedFit,
      confidence: recommended.confidence,
      summary: `${recommended.customerTitle} is the strongest plan for the customer's “${desiredEffort(input.customerContext?.priority)}” priority at ${recommended.estimatedFit}% implementation fit. The score combines product relevance, capability coverage, maintenance, license safety and integration complexity.`,
      reasons: recommended.whyThisCombination,
    }
  }

  report.compositionSuggestions = plans
  report.idePrompt = implementationPrompt(text(input.idea) || report.idea, recommended, report)
  return report
}
