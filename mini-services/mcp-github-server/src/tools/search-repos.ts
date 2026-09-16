import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHubRepo } from "../types.js";
import { githubFetch } from "../github/api.js";

export function registerSearchRepos(server: McpServer): void {
  server.tool(
    "search_repos",
    "Search GitHub repositories with advanced filters. Supports complex query syntax.",
    {
      query: z.string().describe("Search query (supports GitHub search syntax)"),
      language: z.string().optional().describe("Filter by programming language"),
      min_stars: z.number().optional().describe("Minimum star count"),
      max_stars: z.number().optional().describe("Maximum star count"),
      sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional().describe("Sort field"),
      limit: z.number().min(1).max(100).optional().describe("Number of results (1-100, default 20)"),
    },
    async (params) => {
      try {
        const limit = params.limit || 20;
        const queryParts: string[] = [params.query];
        if (params.language) queryParts.push(`language:${params.language}`);
        if (params.min_stars) queryParts.push(`stars:>=${params.min_stars}`);
        if (params.max_stars) queryParts.push(`stars:<=${params.max_stars}`);

        const query = encodeURIComponent(queryParts.join(" "));
        const sortParam = params.sort || "stars";

        const data = await githubFetch(
          `/search/repositories?q=${query}&sort=${sortParam}&order=desc&per_page=${limit}`
        );
        const repos: GitHubRepo[] = data.items || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                total_count: data.total_count,
                count: repos.length,
                repos: repos.map((r) => ({
                  name: r.full_name,
                  description: r.description,
                  stars: r.stargazers_count,
                  forks: r.forks_count,
                  language: r.language,
                  url: r.html_url,
                  topics: r.topics,
                  license: r.license?.spdx_id,
                  updated: r.updated_at,
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
