"""Air-gapped runtime policy.

FACTORY_OFFLINE_ONLY=1 blocks public-network calls made through Product
Intelligence. Loopback/local model servers stay available.
"""

from __future__ import annotations

import ipaddress
import os
from urllib.parse import urlparse


_TRUE = {"1", "true", "yes", "on"}
_LOCAL_SCHEMES = {"", "file"}


class OfflineNetworkBlocked(RuntimeError):
    """Raised when code tries to leave the local machine in offline-only mode."""


def factory_offline_only() -> bool:
    return os.environ.get("FACTORY_OFFLINE_ONLY", "").strip().lower() in _TRUE


def _is_loopback(hostname: str | None) -> bool:
    if not hostname:
        return False
    value = hostname.strip().lower()
    if value == "localhost":
        return True
    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        return False


def network_allowed(url: str) -> bool:
    """Return True when the URL is legal under the current runtime policy."""
    if not factory_offline_only():
        return True

    parsed = urlparse(url)
    if parsed.scheme.lower() in _LOCAL_SCHEMES:
        return True
    return parsed.scheme.lower() in {"http", "https"} and _is_loopback(parsed.hostname)


def require_network_allowed(url: str) -> None:
    if not network_allowed(url):
        raise OfflineNetworkBlocked(
            f"External network disabled by FACTORY_OFFLINE_ONLY=1: {url}"
        )


def offline_status() -> dict[str, object]:
    return {
        "offline_only": factory_offline_only(),
        "external_network": "blocked" if factory_offline_only() else "allowed",
        "loopback_services": "allowed",
        "recommended_llm": "Ollama or LM Studio",
    }
