import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFetchTopRepos } from "./tools/fetch-top-repos.js";
import { registerSearchRepos } from "./tools/search-repos.js";
import { registerGetRepoDetails } from "./tools/get-repo-details.js";
import { registerAnalyzeTrends } from "./tools/analyze-trends.js";
import { registerGenerateIdeas } from "./tools/generate-ideas.js";
import { registerCollectRepos } from "./tools/collect-repos.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "github-idea-generator",
    version: "1.0.0",
    description: "MCP server for fetching top GitHub repos and generating innovative product ideas",
  });

  registerFetchTopRepos(server);
  registerSearchRepos(server);
  registerGetRepoDetails(server);
  registerAnalyzeTrends(server);
  registerGenerateIdeas(server);
  registerCollectRepos(server);

  return server;
}
