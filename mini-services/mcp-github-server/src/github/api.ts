const GITHUB_API_BASE = "https://api.github.com";

export async function githubFetch(endpoint: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "MCP-GitHub-Server/1.0",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers });

  if (!response.ok) {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const resetTime = response.headers.get("X-RateLimit-Reset");
    if (remaining === "0") {
      throw new Error(
        `GitHub API rate limit exceeded. Resets at: ${new Date(parseInt(resetTime || "0") * 1000).toISOString()}`
      );
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
