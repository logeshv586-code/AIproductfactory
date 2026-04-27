// ============================================================
// Search Abstraction layer
// Supports: Tavily (default), Serper (placeholder)
// ============================================================

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface SearchOptions {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
}

export async function webSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("TAVILY_API_KEY is not set. Web search will return empty results.");
    return [];
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: options?.searchDepth || "basic",
        max_results: options?.maxResults || 5,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Tavily API error: ${error.detail || response.statusText}`);
    }

    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));
  } catch (error) {
    console.error("Web search failed:", error);
    return [];
  }
}
