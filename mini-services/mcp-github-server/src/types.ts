export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  license: { spdx_id: string; name: string } | null;
  owner: { login: string; avatar_url: string; html_url: string };
  archived: boolean;
  size: number;
  default_branch: string;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
}

export interface RepoAnalysis {
  repo: GitHubRepo;
  trendScore: number;
  growthRate: number;
  category: string;
  innovationSignals: string[];
}

export interface ProductIdea {
  id: string;
  title: string;
  tagline: string;
  description: string;
  targetAudience: string;
  keyFeatures: string[];
  techStack: string[];
  inspiredBy: string[];
  marketPotential: "high" | "medium" | "low";
  difficulty: "beginner" | "intermediate" | "advanced";
  monetization: string[];
  uniqueValue: string;
}

export interface TrendAnalysis {
  topLanguages: { language: string; count: number; avgStars: number }[];
  topTopics: { topic: string; count: number; growth: number }[];
  emergingTech: string[];
  hotCategories: string[];
  insights: string[];
}
