import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHubRepo, RepoAnalysis } from "../types.js";
import { githubFetch } from "../github/api.js";
import { calculateTrendScore, estimateGrowthRate } from "../analysis/trend-scorer.js";
import { categorizeRepo, extractInnovationSignals } from "../analysis/categorizer.js";

export function registerFetchTopRepos(server: McpServer): void {
  server.tool(
    "fetch_top_repos",
    "Fetch top GitHub repositories by language, topic, or time range. Returns analyzed repos with trend scores.",
    {
      language: z.string().optional().describe("Programming language filter (e.g., 'typescript', 'python', 'rust')"),
      topic: z.string().optional().describe("Topic filter (e.g., 'machine-learning', 'web-framework', 'cli')"),
      since: z.enum(["daily", "weekly", "monthly"]).optional().describe("Time range for trending repos"),
      sort: z.enum(["stars", "forks", "updated"]).optional().describe("Sort criteria"),
      limit: z.number().min(1).max(100).optional().describe("Number of repos to fetch (1-100, default 25)"),
      min_stars: z.number().optional().describe("Minimum star count filter"),
    },
    async (params) => {
      try {
        const limit = params.limit || 25;
        const since = params.since || "weekly";

        let repos: GitHubRepo[] = [];

        if (params.language || params.topic) {
          const queryParts: string[] = [];
          if (params.language) queryParts.push(`language:${params.language}`);
          if (params.topic) queryParts.push(`topic:${params.topic}`);
          if (params.min_stars) queryParts.push(`stars:>=${params.min_stars}`);

          const now = new Date();
          let sinceDate: Date;
          if (since === "daily") {
            sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          } else if (since === "weekly") {
            sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          } else {
            sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          }
          queryParts.push(`pushed:>=${sinceDate.toISOString().split("T")[0]}`);
          queryParts.push(`stars:>100`);

          const query = encodeURIComponent(queryParts.join(" "));
          const sortParam = params.sort === "forks" ? "forks" : params.sort === "updated" ? "updated" : "stars";

          const data = await githubFetch(
            `/search/repositories?q=${query}&sort=${sortParam}&order=desc&per_page=${limit}`
          );
          repos = data.items || [];
        } else {
          const sinceDate = since === "daily"
            ? new Date(Date.now() - 24 * 60 * 60 * 1000)
            : since === "weekly"
            ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          const query = encodeURIComponent(
            `stars:>1000 pushed:>=${sinceDate.toISOString().split("T")[0]}`
          );
          const data = await githubFetch(
            `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${limit}`
          );
          repos = data.items || [];
        }

        const analyzed: RepoAnalysis[] = repos.map((repo: GitHubRepo) => ({
          repo,
          trendScore: calculateTrendScore(repo),
          growthRate: estimateGrowthRate(repo),
          category: categorizeRepo(repo),
          innovationSignals: extractInnovationSignals(repo),
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                count: analyzed.length,
                repos: analyzed.map((a) => ({
                  name: a.repo.full_name,
                  description: a.repo.description,
                  stars: a.repo.stargazers_count,
                  forks: a.repo.forks_count,
                  language: a.repo.language,
                  url: a.repo.html_url,
                  topics: a.repo.topics,
                  trendScore: a.trendScore,
                  growthRate: a.growthRate,
                  category: a.category,
                  innovationSignals: a.innovationSignals,
                  lastPushed: a.repo.pushed_at,
                })),
                filters: { language: params.language, topic: params.topic, since, sort: params.sort },
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
