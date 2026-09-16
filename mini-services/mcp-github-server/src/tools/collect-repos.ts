import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHubRepo } from "../types.js";
import { githubFetch } from "../github/api.js";

export function registerCollectRepos(server: McpServer): void {
  server.tool(
    "collect_repos",
    "Collect and save GitHub repository data for later analysis. Builds a curated collection of repos.",
    {
      repos: z.array(z.object({
        owner: z.string().describe("Repository owner"),
        name: z.string().describe("Repository name"),
      })).describe("List of repos to collect"),
      tags: z.array(z.string()).optional().describe("Custom tags to apply to all collected repos"),
    },
    async (params) => {
      try {
        const collected: any[] = [];
        const errors: string[] = [];

        for (const repoRef of params.repos.slice(0, 20)) {
          try {
            const repo: GitHubRepo = await githubFetch(`/repos/${repoRef.owner}/${repoRef.name}`);
            collected.push({
              name: repo.full_name,
              description: repo.description,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              language: repo.language,
              topics: repo.topics,
              url: repo.html_url,
              tags: params.tags || [],
              collected_at: new Date().toISOString(),
            });
          } catch (err: any) {
            errors.push(`${repoRef.owner}/${repoRef.name}: ${err.message}`);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                collected: collected.length,
                errors: errors.length,
                repos: collected,
                error_details: errors.length > 0 ? errors : undefined,
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
