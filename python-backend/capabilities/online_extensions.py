"""Optional connected extensions for offline-first products.

These extensions are never required for the core product to run. They are
enabled only when the user chooses connected mode and should degrade to the
listed offline fallback when connectivity is unavailable.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class OnlineExtension:
    id: str
    name: str
    purpose: str
    trigger_keywords: tuple[str, ...]
    connectors: tuple[str, ...]
    offline_fallback: str
    approval_required: bool = True

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


ONLINE_EXTENSIONS: tuple[OnlineExtension, ...] = (
    OnlineExtension(
        "web_research",
        "Live Web Research",
        "Fetch current public information for research and evidence.",
        ("web", "latest", "news", "research", "internet", "current"),
        ("browser MCP", "search provider", "HTTP research adapter"),
        "Use the local imported corpus / cached snapshots only.",
    ),
    OnlineExtension(
        "github_mcp",
        "GitHub MCP",
        "Read repositories, issues, pull requests and optionally write approved changes.",
        ("github", "repo", "pull request", "issue", "codebase"),
        ("GitHub MCP", "GitHub API adapter"),
        "Use local git repositories and previously imported repository metadata.",
    ),
    OnlineExtension(
        "saas_mcp",
        "SaaS MCP Router",
        "Connect the product to user-authorized SaaS tools such as Notion, CRM or ticketing systems.",
        ("notion", "crm", "ticket", "saas", "connector", "integration"),
        ("MCP router", "OAuth connector adapters"),
        "Use local files/SQLite/imported exports.",
    ),
    OnlineExtension(
        "mail_calendar",
        "Mail & Calendar Connectors",
        "Use authorized email/calendar accounts for scheduling, outreach or workflow actions.",
        ("email", "gmail", "calendar", "meeting", "schedule", "interview"),
        ("mail connector", "calendar connector", "MCP"),
        "Draft locally and export actions for manual execution.",
    ),
    OnlineExtension(
        "live_business_data",
        "Live Business Data",
        "Retrieve live prices, finance, travel, maps, inventory or other remote business data.",
        ("price", "stock", "finance", "travel", "maps", "inventory", "availability"),
        ("domain API adapters", "MCP connectors"),
        "Use the most recent local snapshot and clearly show its timestamp.",
    ),
    OnlineExtension(
        "remote_browser",
        "Remote Browser Automation",
        "Use Playwright/browser MCP against approved public web destinations.",
        ("browser", "website", "scrape", "automation", "portal"),
        ("browser MCP", "Playwright"),
        "Restrict automation to localhost/intranet or imported HTML snapshots.",
    ),
    OnlineExtension(
        "cloud_voice",
        "Cloud Voice Upgrade",
        "Optionally use real-time cloud STT/TTS/voice sessions when explicitly enabled.",
        ("voice", "speech", "call", "realtime"),
        ("voice API", "realtime agent connector"),
        "Use Whisper/whisper.cpp + local LLM + Piper/Kokoro.",
    ),
    OnlineExtension(
        "cloud_vision",
        "Cloud Vision Upgrade",
        "Optionally use hosted multimodal/VLM APIs for difficult image/video tasks.",
        ("vision", "image", "video", "multimodal", "ocr"),
        ("VLM API adapter",),
        "Use local VLM + OpenCV/FFmpeg + local OCR.",
    ),
)


def list_online_extensions() -> list[dict[str, object]]:
    return [item.to_dict() for item in ONLINE_EXTENSIONS]


def match_online_extensions(text: str, *, limit: int = 8) -> list[dict[str, object]]:
    lowered = (text or "").lower()
    scored: list[tuple[int, OnlineExtension]] = []
    for item in ONLINE_EXTENSIONS:
        score = sum(2 if " " in keyword else 1 for keyword in item.trigger_keywords if keyword in lowered)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda pair: (-pair[0], pair[1].name))
    return [item.to_dict() for _, item in scored[:limit]]
