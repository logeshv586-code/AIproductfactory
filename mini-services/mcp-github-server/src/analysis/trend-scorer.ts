import type { GitHubRepo } from "../types.js";

export function calculateTrendScore(repo: GitHubRepo): number {
  const now = new Date();
  const createdAt = new Date(repo.created_at);
  const pushedAt = new Date(repo.pushed_at);
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const daysSincePush = (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);

  const starsPerDay = Math.min(repo.stargazers_count / Math.max(ageInDays, 1), 1000);
  const recencyFactor = Math.max(0, 1 - daysSincePush / 365);
  const forkRatio = repo.forks_count / Math.max(repo.stargazers_count, 1);
  const issueActivity = repo.open_issues_count / Math.max(repo.stargazers_count, 1);

  const score = (
    starsPerDay * 30 +
    recencyFactor * 40 +
    forkRatio * 15 +
    (1 - Math.min(issueActivity, 1)) * 15
  );

  return Math.round(score * 100) / 100;
}

export function estimateGrowthRate(repo: GitHubRepo): number {
  const now = new Date();
  const createdAt = new Date(repo.created_at);
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays < 30) return 95;
  if (ageInDays < 90) return 80;
  if (ageInDays < 180) return 60;
  if (ageInDays < 365) return 40;

  const pushedAt = new Date(repo.pushed_at);
  const daysSincePush = (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePush < 7) return 70;
  if (daysSincePush < 30) return 50;
  if (daysSincePush < 90) return 30;
  return 15;
}
