"""
Repo Analyzer — Extracts signals from GitHub repos.
Identifies AI components, API surfaces, complexity levels, and capability hints.
"""

from typing import Any


# Capability detection keywords mapped to categories
CAPABILITY_KEYWORDS: dict[str, list[str]] = {
    "memory": ["vector", "embedding", "storage", "database", "cache", "rag", "retrieval", "semantic", "search"],
    "agent": ["agent", "workflow", "orchestrat", "autonomous", "planning", "decision", "multi-agent", "crew"],
    "rag": ["retrieval", "augmented", "generation", "document", "chunk", "index", "knowledge-base", "embed"],
    "ui": ["ui", "frontend", "react", "vue", "dashboard", "component", "visualization", "chart", "interface"],
    "backend": ["api", "server", "backend", "microservice", "rest", "graphql", "fastapi", "express", "database"],
    "automation": ["automat", "cron", "scheduler", "pipeline", "ci/cd", "deploy", "workflow", "bot", "trigger"],
}


def analyze_repo(repo: dict[str, Any]) -> dict[str, Any]:
    """
    Analyze a single repo to extract signals.

    Returns a dict with:
      - name, description, stars, language
      - signals: { hasAI, hasAPI, complexity, capabilities, entryPoints }
    """
    description = (repo.get("description") or "").lower()
    topics = [t.lower() for t in (repo.get("topics") or [])]
    name = repo.get("name", "").lower()
    stars = repo.get("stars", repo.get("stargazers_count", 0))

    # Detect AI-related signals
    ai_keywords = ["ai", "ml", "machine-learning", "deep-learning", "llm", "gpt", "neural",
                   "transformer", "model", "nlp", "computer-vision", "openai", "claude", "anthropic"]
    has_ai = any(kw in description or kw in name or kw in " ".join(topics) for kw in ai_keywords)

    # Detect API presence
    api_keywords = ["api", "rest", "graphql", "endpoint", "http", "server", "sdk"]
    has_api = any(kw in description or kw in name for kw in api_keywords)

    # Determine complexity
    if stars > 10000:
        complexity = "high"
    elif stars > 1000:
        complexity = "medium"
    else:
        complexity = "low"

    # Map capabilities
    detected_capabilities = []
    all_text = f"{description} {name} {' '.join(topics)}"
    for cap_type, keywords in CAPABILITY_KEYWORDS.items():
        if any(kw in all_text for kw in keywords):
            detected_capabilities.append(cap_type)

    if not detected_capabilities:
        detected_capabilities = ["general"]

    # Infer entry points
    language = repo.get("language", "").lower()
    entry_points = _infer_entry_points(language, description)

    return {
        "name": repo.get("name", repo.get("full_name", "")),
        "full_name": repo.get("full_name", repo.get("name", "")),
        "description": repo.get("description", ""),
        "stars": stars,
        "language": repo.get("language"),
        "topics": topics,
        "signals": {
            "hasAI": has_ai,
            "hasAPI": has_api,
            "complexity": complexity,
            "capabilities": detected_capabilities,
            "entryPoints": entry_points,
        },
    }


def analyze_repos(repos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Analyze a list of repos and return their signal profiles."""
    return [analyze_repo(repo) for repo in repos]


def _infer_entry_points(language: str, description: str) -> list[str]:
    """Infer likely entry points based on language and description."""
    entry_map = {
        "python": ["main.py", "app.py", "setup.py", "pyproject.toml"],
        "typescript": ["src/index.ts", "src/main.ts", "package.json"],
        "javascript": ["src/index.js", "index.js", "package.json"],
        "go": ["main.go", "cmd/main.go"],
        "rust": ["src/main.rs", "Cargo.toml"],
        "java": ["src/main/java/Main.java", "pom.xml", "build.gradle"],
    }
    desc_lower = description.lower()

    # Check for framework-specific patterns
    if "fastapi" in desc_lower:
        return ["app/main.py", "app/api.py"]
    elif "flask" in desc_lower:
        return ["app.py", "wsgi.py"]
    elif "django" in desc_lower:
        return ["manage.py", "wsgi.py"]
    elif "next.js" in desc_lower or "nextjs" in desc_lower:
        return ["app/page.tsx", "app/layout.tsx"]
    elif "react" in desc_lower:
        return ["src/App.tsx", "src/index.tsx"]

    return entry_map.get(language, ["README.md"])
