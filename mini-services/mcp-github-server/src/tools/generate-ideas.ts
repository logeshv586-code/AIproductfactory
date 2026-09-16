import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHubRepo, RepoAnalysis } from "../types.js";
import { githubFetch } from "../github/api.js";
import { calculateTrendScore, estimateGrowthRate } from "../analysis/trend-scorer.js";
import { categorizeRepo, extractInnovationSignals } from "../analysis/categorizer.js";
import { analyzeTrends } from "../analysis/trend-analyzer.js";
import { generateProductIdeas } from "../ideas/generator.js";

export function registerGenerateIdeas(server: McpServer): void {
  server.tool(
    "generate_ideas",
    "Generate innovative product ideas by analyzing top GitHub repositories. Uses cross-pollination, gap analysis, and trend-based strategies.",
    {
      language: z.string().optional().describe("Focus language for repos (e.g., 'python', 'typescript')"),
      topic: z.string().optional().describe("Focus topic for repos (e.g., 'ai', 'devtools')"),
      focus: z.string().optional().describe("Specific area to focus idea generation on"),
      sample_size: z.number().min(5).max(50).optional().describe("Number of top repos to analyze (default 15)"),
      strategy: z.enum(["cross-pollination", "gap-analysis", "trend-based", "all"]).optional().describe("Idea generation strategy (default 'all')"),
    },
    async (params) => {
      try {
        const sampleSize = params.sample_size || 15;
        const queryParts: string[] = ["stars:>1000"];

        if (params.language) queryParts.push(`language:${params.language}`);
        if (params.topic) queryParts.push(`topic:${params.topic}`);

        const query = encodeURIComponent(queryParts.join(" "));
        const data = await githubFetch(
          `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${sampleSize}`
        );
        const repos: GitHubRepo[] = data.items || [];

        const analyzedRepos: RepoAnalysis[] = repos.map((repo) => ({
          repo,
          trendScore: calculateTrendScore(repo),
          growthRate: estimateGrowthRate(repo),
          category: categorizeRepo(repo),
          innovationSignals: extractInnovationSignals(repo),
        }));

        const ideas = generateProductIdeas(analyzedRepos, params.focus);
        const trends = analyzeTrends(repos);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                analyzed_repos: analyzedRepos.length,
                ideas_generated: ideas.length,
                strategies_used: params.strategy || "all",
                ideas: ideas.map((idea) => ({
                  id: idea.id,
                  title: idea.title,
                  tagline: idea.tagline,
                  description: idea.description,
                  targetAudience: idea.targetAudience,
                  keyFeatures: idea.keyFeatures,
                  techStack: idea.techStack,
                  inspiredBy: idea.inspiredBy,
                  marketPotential: idea.marketPotential,
                  difficulty: idea.difficulty,
                  monetization: idea.monetization,
                  uniqueValue: idea.uniqueValue,
                })),
                trendInsights: trends.insights,
                sourceRepos: analyzedRepos.slice(0, 5).map((a) => ({
                  name: a.repo.full_name,
                  stars: a.repo.stargazers_count,
                  category: a.category,
                  signals: a.innovationSignals,
                })),
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }) }],
          isError: true,
        };
      }
    }
  );
}
