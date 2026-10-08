"""Local Model & Embedding Registry.

Discovers local models and embeddings across Ollama and LM Studio,
inspects their capabilities, roles, context sizes, embedding dimensions,
checksums / identities, and licensing metadata, and supports role-based
resolution with deterministic fallbacks without public internet access.
"""

from __future__ import annotations

import hashlib
import ipaddress
import os
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable
from urllib.parse import urlparse, urlunparse

import httpx

from capabilities.offline_policy import factory_offline_only


# Supported canonical roles
SUPPORTED_ROLES = ("chat", "reasoning", "coding", "embedding", "reranker", "vision")

DEFAULT_BASE_URLS = {
    "ollama": os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
    "lmstudio": os.environ.get("LMSTUDIO_BASE_URL", "http://127.0.0.1:1234"),
}


def allow_remote_local_llm() -> bool:
    return os.environ.get("LOCAL_LLM_ALLOW_REMOTE_BASE_URLS", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def is_loopback_host(hostname: str) -> bool:
    if hostname.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        return False


def normalize_registry_endpoint(provider: str, value: str | None = None) -> str:
    """Normalize local model endpoint root (without /v1) for Ollama/LM Studio."""
    provider_name = provider.strip().lower()
    raw = (value or DEFAULT_BASE_URLS.get(provider_name, "http://127.0.0.1:11434")).strip().rstrip("/")
    if raw.endswith("/v1"):
        raw = raw[:-3]

    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Local model endpoint must be a valid http:// or https:// URL.")
    if parsed.username or parsed.password:
        raise ValueError("Credentials are not allowed inside local model endpoint URL.")
    if not allow_remote_local_llm() and not is_loopback_host(parsed.hostname):
        raise ValueError(
            "For safety, Ollama and LM Studio URLs must use localhost/loopback. "
            "Set LOCAL_LLM_ALLOW_REMOTE_BASE_URLS=1 only when intentionally connecting to a LAN server."
        )

    normalized = parsed._replace(path="", params="", query="", fragment="")
    return urlunparse(normalized).rstrip("/")


@dataclass
class LocalModelMetadata:
    id: str
    provider: str
    roles: list[str]
    endpoint: str
    offline: bool = True
    context_length: int | None = None
    embedding_dimension: int | None = None
    checksum: str | None = None
    license: str | None = None
    source: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "provider": self.provider,
            "roles": list(self.roles),
            "endpoint": self.endpoint,
            "offline": self.offline,
            "context_length": self.context_length,
            "embedding_dimension": self.embedding_dimension,
            "checksum": self.checksum,
            "license": self.license,
            "source": self.source,
            "details": self.details,
        }


def compute_model_checksum(model_id: str, provider: str, raw_digest: str | None = None) -> str:
    """Compute or return an immutable local identity checksum for a model."""
    if raw_digest and raw_digest.strip():
        val = raw_digest.strip()
        if val.startswith("sha256:"):
            return val
        return f"sha256:{val}"
    # Generate deterministic digest based on canonical model identifier & provider
    digest = hashlib.sha256(f"{provider}:{model_id}".encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def infer_roles(model_id: str, raw_details: dict[str, Any] | None = None) -> list[str]:
    """Identify roles: chat, reasoning, coding, embedding, reranker, vision."""
    name = model_id.lower()
    roles: set[str] = set()
    raw = raw_details or {}

    # 1. Embedding models
    if (
        "embed" in name
        or "bge" in name
        or "nomic" in name
        or "minilm" in name
        or "e5" in name
        or "gte" in name
        or raw.get("type") == "embedding"
        or raw.get("embedding") is True
    ):
        roles.add("embedding")

    # 2. Reranker models
    if "rerank" in name or "bge-reranker" in name or "colbert" in name:
        roles.add("reranker")

    # 3. Vision / Multimodal models
    if (
        "vision" in name
        or "llava" in name
        or "vl" in name
        or "bakllava" in name
        or "moondream" in name
        or "pixtral" in name
        or "llama-3.2-vision" in name
        or "qwen-vl" in name
        or "qwen2-vl" in name
        or "paligemma" in name
    ):
        roles.add("vision")

    # 4. Coding models
    if (
        "coder" in name
        or "code" in name
        or "deepseek-coder" in name
        or "devstral" in name
        or "codestral" in name
        or "starcoder" in name
    ):
        roles.add("coding")

    # 5. Reasoning models
    if (
        "r1" in name
        or "deepseek-r1" in name
        or "qwq" in name
        or "reason" in name
        or "gpt-oss" in name
        or "o1" in name
        or "o3" in name
        or "thinking" in name
    ):
        roles.add("reasoning")

    # If it's not strictly an embedding or reranker, it supports chat/conversation
    if not roles.intersection({"embedding", "reranker"}):
        roles.add("chat")
        if not roles.intersection({"coding", "reasoning"}):
            # General models can perform basic reasoning
            if any(fam in name for fam in ("qwen", "llama", "gemma", "mistral", "phi")):
                roles.add("reasoning")

    return sorted(roles, key=lambda r: SUPPORTED_ROLES.index(r) if r in SUPPORTED_ROLES else 99)


def detect_context_length(model_id: str, raw_details: dict[str, Any] | None = None) -> int:
    """Detect context window size in tokens from metadata or well-known model names."""
    details = raw_details or {}
    if details.get("context_length"):
        try:
            return int(details["context_length"])
        except (ValueError, TypeError):
            pass

    name = model_id.lower()
    # Check explicitly in name like '128k', '32k', '8k'
    m = re.search(r"(\d+)k", name)
    if m:
        return int(m.group(1)) * 1024

    if "qwen2.5" in name or "qwen3" in name:
        return 131072
    if "llama-3" in name or "llama3" in name:
        return 8192
    if "deepseek" in name:
        return 65536
    if "mistral" in name:
        return 32768
    if "gemma" in name:
        return 8192
    return 4096


def detect_embedding_dimension(model_id: str, raw_details: dict[str, Any] | None = None) -> int | None:
    """Detect embedding dimension for embedding models."""
    details = raw_details or {}
    if details.get("embedding_dimension"):
        try:
            return int(details["embedding_dimension"])
        except (ValueError, TypeError):
            pass

    name = model_id.lower()
    if "nomic-embed-text" in name:
        return 768
    if "bge-m3" in name:
        return 1024
    if "bge-large" in name:
        return 1024
    if "bge-small" in name or "minilm" in name:
        return 384
    if "bge-base" in name:
        return 768
    if "mxbai-embed-large" in name:
        return 1024
    if "all-minilm" in name:
        return 384
    if "embed" in name:
        return 768
    return None


def detect_license_and_source(model_id: str, raw_details: dict[str, Any] | None = None) -> tuple[str, str]:
    """Detect open-source license and source origin metadata."""
    details = raw_details or {}
    lic = details.get("license")
    src = details.get("source") or details.get("family") or "local"

    name = model_id.lower()
    if not lic:
        if "llama" in name:
            lic = "Llama 3 Community License"
            src = "Meta"
        elif "qwen" in name:
            lic = "Apache-2.0"
            src = "Alibaba Cloud / Qwen"
        elif "deepseek" in name:
            lic = "MIT"
            src = "DeepSeek"
        elif "mistral" in name or "codestral" in name or "devstral" in name:
            lic = "Apache-2.0"
            src = "Mistral AI"
        elif "gemma" in name:
            lic = "Gemma Terms of Use"
            src = "Google"
        elif "nomic" in name:
            lic = "Apache-2.0"
            src = "Nomic AI"
        elif "bge" in name:
            lic = "MIT"
            src = "BAAI"
        else:
            lic = "Open Model License / Custom"
            src = "Local Model Server"

    return lic, src


class LocalModelRegistry:
    """In-memory and discoverable registry of local models & embeddings."""

    def __init__(self):
        self._models: dict[str, LocalModelMetadata] = {}

    def clear(self) -> None:
        self._models.clear()

    def register(self, model: LocalModelMetadata) -> None:
        self._models[model.id] = model

    def get(self, model_id: str) -> LocalModelMetadata | None:
        return self._models.get(model_id)

    def list_all(self) -> list[LocalModelMetadata]:
        return list(self._models.values())

    def filter_by_role(self, role: str) -> list[LocalModelMetadata]:
        canonical_role = role.strip().lower()
        return [m for m in self._models.values() if canonical_role in m.roles]

    def resolve_role(self, role: str, fallback_to_local_deterministic: bool = True) -> LocalModelMetadata | dict[str, Any]:
        """Resolve a model for the given role, or deterministic fallback if missing."""
        canonical_role = role.strip().lower()
        candidates = self.filter_by_role(canonical_role)
        if candidates:
            # Pick highest context / most relevant candidate
            candidates.sort(key=lambda m: (m.context_length or 0), reverse=True)
            return candidates[0]

        if fallback_to_local_deterministic:
            return {
                "id": f"deterministic-fallback-{canonical_role}",
                "provider": "local",
                "roles": [canonical_role],
                "endpoint": "local://embedded",
                "offline": True,
                "is_fallback": True,
                "fallback_reason": f"No installed local model matched requested role '{canonical_role}'. Using deterministic local pipeline.",
                "context_length": 4096,
                "embedding_dimension": 384 if canonical_role == "embedding" else None,
                "checksum": compute_model_checksum(f"fallback-{canonical_role}", "local"),
                "license": "Built-in MIT",
                "source": "AI Product Factory Deterministic Engine",
            }

        raise KeyError(f"No local model available with role '{canonical_role}' and fallback is disabled.")

    async def discover_ollama(self, base_url: str = "http://127.0.0.1:11434") -> list[LocalModelMetadata]:
        endpoint = normalize_registry_endpoint("ollama", base_url)
        discovered: list[LocalModelMetadata] = []

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                # 1. Try native tags endpoint
                res = await client.get(f"{endpoint}/api/tags")
                if res.status_code == 200:
                    payload = res.json()
                    models_raw = payload.get("models", [])
                    for item in models_raw:
                        name = item.get("name", "") or item.get("model", "")
                        if not name:
                            continue
                        digest = item.get("digest", "")
                        details = item.get("details", {})
                        roles = infer_roles(name, details)
                        ctx = detect_context_length(name, details)
                        dim = detect_embedding_dimension(name, details)
                        lic, src = detect_license_and_source(name, details)
                        meta = LocalModelMetadata(
                            id=name,
                            provider="ollama",
                            roles=roles,
                            endpoint=f"{endpoint}/v1",
                            offline=True,
                            context_length=ctx,
                            embedding_dimension=dim,
                            checksum=compute_model_checksum(name, "ollama", digest),
                            license=lic,
                            source=src,
                            details=details,
                        )
                        self.register(meta)
                        discovered.append(meta)
                    return discovered
        except Exception:
            pass

        # 2. Try OpenAI-compatible /v1/models endpoint as fallback
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(f"{endpoint}/v1/models")
                res.raise_for_status()
                payload = res.json()
                data = payload.get("data", [])
                for item in data:
                    name = str(item.get("id", "")).strip()
                    if not name:
                        continue
                    roles = infer_roles(name)
                    ctx = detect_context_length(name)
                    dim = detect_embedding_dimension(name)
                    lic, src = detect_license_and_source(name)
                    meta = LocalModelMetadata(
                        id=name,
                        provider="ollama",
                        roles=roles,
                        endpoint=f"{endpoint}/v1",
                        offline=True,
                        context_length=ctx,
                        embedding_dimension=dim,
                        checksum=compute_model_checksum(name, "ollama"),
                        license=lic,
                        source=src,
                        details=item,
                    )
                    self.register(meta)
                    discovered.append(meta)
        except Exception as exc:
            # Re-raise or return empty depending on requirement
            pass

        return discovered

    async def discover_lmstudio(self, base_url: str = "http://127.0.0.1:1234") -> list[LocalModelMetadata]:
        endpoint = normalize_registry_endpoint("lmstudio", base_url)
        discovered: list[LocalModelMetadata] = []

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(f"{endpoint}/v1/models")
                res.raise_for_status()
                payload = res.json()
                data = payload.get("data", [])
                for item in data:
                    name = str(item.get("id", "")).strip()
                    if not name:
                        continue
                    roles = infer_roles(name, item)
                    ctx = detect_context_length(name, item)
                    dim = detect_embedding_dimension(name, item)
                    lic, src = detect_license_and_source(name, item)
                    meta = LocalModelMetadata(
                        id=name,
                        provider="lmstudio",
                        roles=roles,
                        endpoint=f"{endpoint}/v1",
                        offline=True,
                        context_length=ctx,
                        embedding_dimension=dim,
                        checksum=compute_model_checksum(name, "lmstudio"),
                        license=lic,
                        source=src,
                        details=item,
                    )
                    self.register(meta)
                    discovered.append(meta)
        except Exception:
            pass

        return discovered


# Global singleton registry instance
_GLOBAL_REGISTRY = LocalModelRegistry()


def get_local_registry() -> LocalModelRegistry:
    return _GLOBAL_REGISTRY
