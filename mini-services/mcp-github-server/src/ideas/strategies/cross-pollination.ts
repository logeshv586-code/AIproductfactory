import type { RepoAnalysis, ProductIdea } from "../../types.js";
import {
  toTitleCase,
  determineTargetAudience,
  generateKeyFeatures,
  determineTechStack,
  assessMarketPotential,
  assessDifficulty,
  suggestMonetization,
} from "../helpers.js";

export function crossPollinate(repoA: RepoAnalysis, repoB: RepoAnalysis, focus?: string): ProductIdea | null {
  const nameA = repoA.repo.name.replace(/[-_]/g, " ");
  const nameB = repoB.repo.name.replace(/[-_]/g, " ");
  const catA = repoA.category;
  const catB = repoB.category;

  if (focus && !`${catA} ${catB} ${nameA} ${nameB}`.toLowerCase().includes(focus.toLowerCase())) {
    return null;
  }

  const templates = [
    {
      title: `${toTitleCase(nameA)} meets ${toTitleCase(nameB)}`,
      tagline: `Bridging ${catA} and ${catB} — the best of both worlds in one platform`,
      description: `What if you could combine the power of ${repoA.repo.description || nameA} with the elegance of ${repoB.repo.description || nameB}? This product creates a unified experience that leverages the strengths of both approaches, eliminating the need to choose between them. Users get a seamless workflow that was previously impossible.`,
    },
    {
      title: `${toTitleCase(nameB)}-Powered ${toTitleCase(nameA)}`,
      tagline: `Supercharging ${catA} with ${catB} innovation`,
      description: `By integrating the core concepts from ${nameB} into the ${nameA} ecosystem, we create a next-generation tool that addresses the limitations of both original projects. This approach brings fresh capabilities to an established audience while introducing novel workflows.`,
    },
    {
      title: `${toTitleCase(nameA)} for ${catB} Developers`,
      tagline: `Purpose-built ${catA} tooling for the ${catB} community`,
      description: `The ${catB} community has long needed a solution like ${nameA}, but adapted specifically for their workflows. This product takes the proven patterns from ${nameA} and reimagines them for ${catB} use cases, creating a specialized tool that feels native to both worlds.`,
    },
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];

  return {
    id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: template.title,
    tagline: template.tagline,
    description: template.description,
    targetAudience: determineTargetAudience(catA, catB),
    keyFeatures: generateKeyFeatures(repoA, repoB),
    techStack: determineTechStack(repoA, repoB),
    inspiredBy: [repoA.repo.full_name, repoB.repo.full_name],
    marketPotential: assessMarketPotential(repoA, repoB),
    difficulty: assessDifficulty(repoA, repoB),
    monetization: suggestMonetization(catA, catB),
    uniqueValue: `Unique combination of ${catA} and ${catB} — no existing solution covers both`,
  };
}
