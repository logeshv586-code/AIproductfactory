import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHubRepo } from "../types.js";
import { githubFetch } from "../github/api.js";
import { analyzeTrends } from "../analysis/trend-analyzer.js";

export function registerAnalyzeTrends(server: McpServer): void {
  server.tool(
    "analyze_trends",
    "Analyze trends across GitHub repositories. Returns language trends, hot topics, and emerging technologies.",
    {
      language: z.string().optional().describe("Focus language for trend analysis"),
      topic: z.string().optional().describe("Focus topic for trend analysis"),
      sample_size: z.number().min(10).max(100).optional().describe("Number of repos to analyze (default 50)"),
    },
    async (params) => {
      try {
        const sampleSize = params.sample_size || 50;
        const queryParts: string[] = ["stars:>500"];

        if (params.language) queryParts.push(`language:${params.language}`);
        if (params.topic) queryParts.push(`topic:${params.topic}`);

        const query = encodeURIComponent(queryParts.join(" "));
        const data = await githubFetch(
          `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${sampleSize}`
        );
        const repos: GitHubRepo[] = data.items || [];

        const trends = analyzeTrends(repos);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                analyzed_repos: repos.length,
                trends,
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
