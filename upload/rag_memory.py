"""
RAG Memory — Idea store · Repo knowledge · Build history · Debug memory · Prob. weights
"""
from __future__ import annotations
import json
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any


@dataclass
class MemoryEntry:
    kind: str          # "idea" | "repo" | "build" | "debug" | "prob_weight"
    key: str
    content: Any
    ts: float = field(default_factory=time.time)
    tags: list[str] = field(default_factory=list)


class RAGMemory:
    """
    Simple file-backed vector-like store.
    In production swap _search() for a real embedding/vector DB (pgvector, Chroma …).
    """

    def __init__(self, path: str = ".rag_memory.json"):
        self._path = Path(path)
        self._store: list[MemoryEntry] = []
        self._load()

    # ── persistence ─────────────────────────────────────────────────────────
    def _load(self):
        if self._path.exists():
            raw = json.loads(self._path.read_text())
            self._store = [MemoryEntry(**r) for r in raw]

    def _save(self):
        self._path.write_text(json.dumps([asdict(e) for e in self._store], indent=2))

    # ── write ────────────────────────────────────────────────────────────────
    def store(self, kind: str, key: str, content: Any, tags: list[str] | None = None):
        # Upsert by key
        self._store = [e for e in self._store if e.key != key]
        self._store.append(MemoryEntry(kind=kind, key=key, content=content, tags=tags or []))
        self._save()

    # ── read ─────────────────────────────────────────────────────────────────
    def get(self, key: str) -> MemoryEntry | None:
        return next((e for e in self._store if e.key == key), None)

    def search(self, query: str, kind: str | None = None, top_k: int = 5) -> list[MemoryEntry]:
        """Keyword overlap search (replace with embedding search in production)."""
        q_tokens = set(query.lower().split())
        scored = []
        for e in self._store:
            if kind and e.kind != kind:
                continue
            text = json.dumps(e.content).lower()
            overlap = sum(1 for t in q_tokens if t in text)
            if overlap:
                scored.append((overlap, e))
        scored.sort(key=lambda x: -x[0])
        return [e for _, e in scored[:top_k]]

    # ── specialised helpers ──────────────────────────────────────────────────
    def store_idea(self, idea_id: str, data: dict):
        self.store("idea", f"idea:{idea_id}", data, tags=["idea"])

    def store_repo(self, repo_full_name: str, data: dict):
        self.store("repo", f"repo:{repo_full_name}", data, tags=["repo"])

    def store_build(self, build_id: str, data: dict):
        self.store("build", f"build:{build_id}", data, tags=["build"])

    def store_debug(self, debug_id: str, data: dict):
        self.store("debug", f"debug:{debug_id}", data, tags=["debug"])

    def store_prob_weights(self, weights: dict):
        self.store("prob_weight", "prob_weights:global", weights, tags=["prob"])

    def get_prob_weights(self) -> dict:
        entry = self.get("prob_weights:global")
        return entry.content if entry else {}

    def recall_context(self, query: str, top_k: int = 5) -> list[dict]:
        hits = self.search(query, top_k=top_k)
        return [{"kind": h.kind, "key": h.key, "content": h.content} for h in hits]

    def summary(self) -> dict:
        from collections import Counter
        counts = Counter(e.kind for e in self._store)
        return {"total_entries": len(self._store), "by_kind": dict(counts)}
