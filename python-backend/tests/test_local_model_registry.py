from __future__ import annotations

import pytest
from capabilities.local_model_registry import (
    LocalModelMetadata,
    LocalModelRegistry,
    compute_model_checksum,
    detect_context_length,
    detect_embedding_dimension,
    detect_license_and_source,
    get_local_registry,
    infer_roles,
    normalize_registry_endpoint,
)


def test_infer_roles_and_specializations():
    # Reasoning
    assert "reasoning" in infer_roles("deepseek-r1:14b")
    assert "reasoning" in infer_roles("qwq:32b")
    assert "reasoning" in infer_roles("gpt-oss:20b")

    # Coding
    assert "coding" in infer_roles("qwen2.5-coder:7b")
    assert "coding" in infer_roles("devstral:24b")

    # Embedding
    assert "embedding" in infer_roles("nomic-embed-text")
    assert "embedding" in infer_roles("bge-large-en-v1.5")
    # Embedding models shouldn't accidentally be labeled chat by default
    assert "chat" not in infer_roles("nomic-embed-text")

    # Reranker
    assert "reranker" in infer_roles("bge-reranker-large")

    # Vision
    assert "vision" in infer_roles("llava:13b")
    assert "vision" in infer_roles("qwen2-vl:7b")


def test_detect_context_and_embedding_dimensions():
    assert detect_context_length("qwen2.5-coder:7b") == 131072
    assert detect_context_length("llama-3.1:8b") == 8192
    assert detect_context_length("custom-model-64k") == 64 * 1024

    assert detect_embedding_dimension("nomic-embed-text") == 768
    assert detect_embedding_dimension("bge-m3") == 1024
    assert detect_embedding_dimension("all-minilm") == 384
    assert detect_embedding_dimension("qwen2.5-coder:7b") is None


def test_checksum_and_licensing():
    chk = compute_model_checksum("qwen2.5-coder:7b", "ollama")
    assert chk.startswith("sha256:")
    assert len(chk) > 10

    raw_digest = "sha256:abcdef1234567890"
    assert compute_model_checksum("custom", "ollama", raw_digest) == raw_digest

    lic, src = detect_license_and_source("qwen2.5-coder:7b")
    assert "Apache" in lic
    assert "Qwen" in src

    lic2, src2 = detect_license_and_source("deepseek-r1:14b")
    assert "MIT" in lic2
    assert "DeepSeek" in src2


def test_registry_registration_and_role_resolution():
    registry = LocalModelRegistry()
    coder = LocalModelMetadata(
        id="qwen-local-coder",
        provider="ollama",
        roles=["chat", "coding"],
        endpoint="http://127.0.0.1:11434/v1",
        offline=True,
        context_length=131072,
    )
    embedder = LocalModelMetadata(
        id="nomic-embed",
        provider="ollama",
        roles=["embedding"],
        endpoint="http://127.0.0.1:11434/v1",
        offline=True,
        embedding_dimension=768,
    )

    registry.register(coder)
    registry.register(embedder)

    # Resolution by role
    res_code = registry.resolve_role("coding")
    assert res_code.id == "qwen-local-coder"

    res_embed = registry.resolve_role("embedding")
    assert res_embed.id == "nomic-embed"

    # Missing role with deterministic fallback
    res_rerank = registry.resolve_role("reranker", fallback_to_local_deterministic=True)
    assert res_rerank["provider"] == "local"
    assert res_rerank["is_fallback"] is True
    assert "deterministic" in res_rerank["id"]

    # Missing role without fallback raises KeyError
    with pytest.raises(KeyError):
        registry.resolve_role("reranker", fallback_to_local_deterministic=False)


def test_endpoint_normalization_safety():
    assert normalize_registry_endpoint("ollama", "http://127.0.0.1:11434/v1") == "http://127.0.0.1:11434"
    assert normalize_registry_endpoint("lmstudio", "http://localhost:1234") == "http://localhost:1234"

    # Block public / remote URLs by default
    with pytest.raises(ValueError):
        normalize_registry_endpoint("ollama", "http://8.8.8.8:11434")
