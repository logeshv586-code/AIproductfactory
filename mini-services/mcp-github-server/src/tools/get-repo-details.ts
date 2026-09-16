import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHubRepo } from "../types.js";
import { githubFetch } from "../github/api.js";
import { calculateTrendScore, estimateGrowthRate } from "../analysis/trend-scorer.js";
import { categorizeRepo, extractInnovationSignals } from "../analysis/categorizer.js";

export function registerGetRepoDetails(server: McpServer): void {
  server.tool(
    "get_repo_details",
    "Get detailed information about a specific GitHub repository including README, stats, and analysis.",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      repo: z.string().describe("Repository name"),
    },
    async (params) => {
      try {
        const repo: GitHubRepo = await githubFetch(`/repos/${params.owner}/${params.repo}`);

        let readme = "";
        try {
          const readmeData = await githubFetch(`/repos/${params.owner}/${params.repo}/readme`);
          if (readmeData.content) {
            readme = Buffer.from(readmeData.content, "base64").toString("utf-8").slice(0, 3000);
          }
        } catch {
          readme = "README not available";
        }

        const analysis = {
          trendScore: calculateTrendScore(repo),
          growthRate: estimateGrowthRate(repo),
          category: categorizeRepo(repo),
          innovationSignals: extractInnovationSignals(repo),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                repo: {
                  name: repo.full_name,
                  description: repo.description,
                  stars: repo.stargazers_count,
                  forks: repo.forks_count,
                  open_issues: repo.open_issues_count,
                  watchers: repo.watchers_count,
                  language: repo.language,
                  topics: repo.topics,
                  license: repo.license?.name,
                  created: repo.created_at,
                  updated: repo.updated_at,
                  pushed: repo.pushed_at,
                  homepage: repo.homepage,
                  archived: repo.archived,
                  has_wiki: repo.has_wiki,
                  has_discussions: repo.has_discussions,
                  owner: repo.owner.login,
                  owner_url: repo.owner.html_url,
                  default_branch: repo.default_branch,
                },
                analysis,
                readme_preview: readme,
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
