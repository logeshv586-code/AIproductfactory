"""
Repo Selector — LLM-driven intent extraction and intelligent repo ranking.
Replaces simple keyword matching with semantic understanding.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider


async def extract_intent(
    user_input: str,
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Extract structured intent from user's natural language input.

    Returns:
      - domain: The primary domain of the user's idea
      - required_capabilities: List of needed capability types
      - keywords: Search keywords for repo discovery
      - description: Expanded description of the intent
    """
    if provider is None:
        provider = get_provider()

    messages = [
        {
            "role": "system",
            "content": """You are an intent extraction engine for an AI product builder.
Given a user's natural language product idea, extract structured intent.

Return ONLY valid JSON:
{
  "domain": "<primary domain (e.g., 'AI Development Tools', 'Data Analytics', 'DevOps Automation')>",
  "required_capabilities": ["<capability1>", "<capability2>", ...],
  "keywords": ["<search_keyword1>", "<search_keyword2>", ...],
  "description": "<expanded 2-sentence description of what the user wants to build>"
}

Valid capability types: memory, agent, rag, ui, backend, automation""",
        },
        {
            "role": "user",
            "content": f"USER IDEA:\n{user_input}",
        },
    ]

    raw = await provider.chat(messages, temperature=0.3, max_tokens=400)
    data = provider.parse_json(raw)

    return {
        "domain": data.get("domain", "Technology"),
        "required_capabilities": data.get("required_capabilities", ["backend"]),
        "keywords": data.get("keywords", [user_input.split()[0] if user_input else "software"]),
        "description": data.get("description", user_input),
    }


async def rank_repos(
    repos: list[dict[str, Any]],
    intent: dict[str, Any],
    provider: Optional[LLMProvider] = None,
) -> list[dict[str, Any]]:
    """
    Rank repos by relevance to the extracted intent using LLM.

    Returns top repos with score, reason, and suggested role.
    """
    if provider is None:
        provider = get_provider()

    if not repos:
        return []

    repo_list = []
    for r in repos[:15]:  # Limit to top 15 for LLM context
        repo_list.append({
            "full_name": r.get("full_name", r.get("name", "")),
            "stars": r.get("stars", r.get("stargazers_count", 0)),
            "description": (r.get("description") or "")[:100],
            "language": r.get("language", ""),
            "topics": r.get("topics", []),
        })

    messages = [
        {
            "role": "system",
            "content": """You are a repo selection agent. Given a product intent and list of repos,
rank the top 7 most relevant repos. For each repo, provide:
- score: relevance score 0-1
- reason: one-line explanation of why it's relevant
- role: suggested role in the product (e.g., "Core AI Engine", "Data Storage", "API Layer")

Return ONLY valid JSON:
{
  "rankings": [
    {"full_name": "<owner/repo>", "score": <0-1>, "reason": "<why relevant>", "role": "<suggested role>"}
  ]
}""",
        },
        {
            "role": "user",
            "content": f"""INTENT:
Domain: {intent.get('domain', '')}
Required capabilities: {intent.get('required_capabilities', [])}
Description: {intent.get('description', '')}

REPOS:
{repo_list}""",
        },
    ]

    raw = await provider.chat(messages, temperature=0.3, max_tokens=800)
    data = provider.parse_json(raw)

    rankings = data.get("rankings", [])
    rank_map = {r["full_name"]: r for r in rankings if "full_name" in r}

    # Merge rankings into repos
    result = []
    for repo in repos:
        full_name = repo.get("full_name", repo.get("name", ""))
        if full_name in rank_map:
            rank = rank_map[full_name]
            result.append({
                **repo,
                "relevance_score": rank.get("score", 0.5),
                "selection_reasoning": rank.get("reason", ""),
                "suggested_role": rank.get("role", ""),
            })
        else:
            result.append({
                **repo,
                "relevance_score": 0.3,
                "selection_reasoning": "Not in top ranked repos",
                "suggested_role": "",
            })

    # Sort by relevance score
    result.sort(key=lambda r: r.get("relevance_score", 0), reverse=True)

    return result[:7]  # Return top 7


async def select_best_repos(
    user_input: str,
    repos: list[dict[str, Any]],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Full repo selection pipeline: extract intent → rank repos → select best.

    Returns:
      - intent: Extracted user intent
      - selected_repos: Top repos with scores and reasoning
    """
    if provider is None:
        provider = get_provider()

    # Step 1: Extract intent
    intent = await extract_intent(user_input, provider)
    print(f"[RepoSelector] Intent extracted: domain={intent['domain']}, "
          f"capabilities={intent['required_capabilities']}")

    # Step 2: Rank repos by intent
    ranked = await rank_repos(repos, intent, provider)
    print(f"[RepoSelector] Ranked {len(ranked)} repos")

    return {
        "intent": intent,
        "selected_repos": ranked,
    }
