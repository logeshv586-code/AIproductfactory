import { NextRequest, NextResponse } from "next/server";

const GITHUB_API_BASE = "https://api.github.com";

async function githubFetch(endpoint: string): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GitHub-Idea-Generator/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers, next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  return response.json();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const language = searchParams.get("language") || "";
    const minStars = searchParams.get("min_stars");
    const sort = searchParams.get("sort") || "stars";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query) {
      return NextResponse.json({ success: false, error: "Search query is required" }, { status: 400 });
    }

    const queryParts: string[] = [query];
    if (language) queryParts.push(`language:${language}`);
    if (minStars) queryParts.push(`stars:>=${minStars}`);

    const encodedQuery = encodeURIComponent(queryParts.join(" "));
    const data = await githubFetch(
      `/search/repositories?q=${encodedQuery}&sort=${sort}&order=desc&per_page=${limit}`
    );

    const repos = (data.items || []).map((repo: any) => ({
      id: repo.id,
      name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url,
      topics: repo.topics || [],
      owner: repo.owner.login,
      ownerAvatar: repo.owner.avatar_url,
      license: repo.license?.spdx_id,
      updated: repo.updated_at,
    }));

    return NextResponse.json({ success: true, total_count: data.total_count, count: repos.length, repos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
