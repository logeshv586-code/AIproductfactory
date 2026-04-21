# GitHub MCP Server & Idea Generator

A Model Context Protocol (MCP) server for GitHub that fetches top repositories and generates innovative product ideas using AI-powered analysis.

## Architecture

```
├── mini-services/mcp-github-server/    # Standalone MCP Server
│   └── src/index.ts                     # MCP tools implementation
├── src/app/
│   ├── page.tsx                         # Web Dashboard UI
│   ├── api/github/repos/route.ts        # Fetch trending repos API
│   ├── api/github/search/route.ts       # Search repos API
│   ├── api/github/trends/route.ts       # Trend analysis API
│   ├── api/github/ideas/route.ts        # Save/manage ideas API
│   └── api/github/generate/route.ts     # AI idea generation API
├── prisma/schema.prisma                 # Database schema
└── download/                            # Generated files
```

## MCP Server Tools

The MCP server provides 6 tools:

### 1. `fetch_top_repos`
Fetch top GitHub repositories with trend analysis.
- **Parameters**: `language`, `topic`, `since` (daily/weekly/monthly), `sort`, `limit`, `min_stars`
- **Returns**: Analyzed repos with trend scores, growth rates, categories, and innovation signals

### 2. `search_repos`
Search GitHub repositories with advanced filters.
- **Parameters**: `query`, `language`, `min_stars`, `max_stars`, `sort`, `limit`
- **Returns**: Matching repositories with metadata

### 3. `get_repo_details`
Get detailed information about a specific repository.
- **Parameters**: `owner`, `repo`
- **Returns**: Full repo details including README preview and analysis

### 4. `analyze_trends`
Analyze trends across GitHub repositories.
- **Parameters**: `language`, `topic`, `sample_size`
- **Returns**: Language trends, hot topics, emerging technologies, insights

### 5. `generate_ideas`
Generate innovative product ideas from top repos.
- **Parameters**: `language`, `topic`, `focus`, `sample_size`, `strategy`
- **Returns**: Product ideas with features, tech stack, market potential, monetization

### 6. `collect_repos`
Collect and save repository data for later analysis.
- **Parameters**: `repos` (array of {owner, name}), `tags`
- **Returns**: Collected repos with metadata

## Idea Generation Strategies

### Cross-Pollination
Combines concepts from 2 different repositories to create novel product ideas that bridge domains.

### Gap Analysis
Identifies underserved niches within a category by finding what's missing from existing solutions.

### Trend-Based
Leverages emerging technology trends and signals to create forward-looking product concepts.

### AI-Enhanced
Uses LLM (z-ai-web-dev-sdk) to generate creative, context-aware product ideas from repo data.

## Web Dashboard Features

- **Trending Repos**: Browse top GitHub repos with filters (language, topic, time range)
- **Product Ideas**: Generate and view AI-powered product ideas
- **Trend Analysis**: Visual charts for languages, categories, topics, and insights
- **Search**: Full-text search across GitHub repositories
- **Save & Manage**: Save ideas, rate them, track status

## Running the MCP Server

```bash
cd mini-services/mcp-github-server
bun install
bun run dev
```

### MCP Configuration

Add to your MCP client config (e.g., Claude Desktop):
```json
{
  "mcpServers": {
    "github-idea-generator": {
      "command": "bun",
      "args": ["run", "/path/to/mini-services/mcp-github-server/src/index.ts"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-optional"
      }
    }
  }
}
```

## Environment Variables

- `GITHUB_TOKEN` (optional): GitHub personal access token for higher rate limits
- `DATABASE_URL`: SQLite database path (default: file:./db/custom.db)

## Tech Stack

- **MCP Server**: @modelcontextprotocol/sdk, TypeScript, Bun
- **Web Dashboard**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Database**: Prisma ORM with SQLite
- **AI**: z-ai-web-dev-sdk for idea generation
- **Charts**: Recharts, Framer Motion animations
