/**
 * MCP GitHub Server - Fetch top repos and generate product ideas
 *
 * This MCP server provides tools for:
 * 1. Fetching top GitHub repositories by language, topic, and stars
 * 2. Searching GitHub repositories with advanced filters
 * 3. Analyzing trending topics and technologies
 * 4. Generating innovative product ideas based on collected repos
 * 5. Getting detailed repository information
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 MCP GitHub Server started - Fetching repos and generating ideas!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
