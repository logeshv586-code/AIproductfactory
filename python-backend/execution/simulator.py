"""
File System Simulator — virtualized repo creation with safe disk persistence.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List


class FSSimulator:
    def __init__(self, workspace_id: str, persist_to_disk: bool = True):
        safe_workspace = "".join(ch for ch in workspace_id if ch.isalnum() or ch in {"-", "_"}).strip("._")
        if not safe_workspace:
            raise ValueError("workspace_id must contain at least one safe character")

        self.workspace_id = safe_workspace
        self.virtual_fs: dict[str, dict[str, object]] = {}
        self.persist_to_disk = persist_to_disk
        self.base_path = os.path.abspath(os.path.join(os.getcwd(), "output", safe_workspace))

        if self.persist_to_disk:
            os.makedirs(self.base_path, exist_ok=True)
            print(f"[Simulator] Persistence enabled at {self.base_path}")

    def _safe_path(self, path: str) -> tuple[str, str]:
        """Return normalized relative/full paths and reject traversal/absolute paths."""
        raw = str(path or "").replace("\\", "/").strip()
        if not raw:
            raise ValueError("file path is required")
        if raw.startswith("/") or (len(raw) > 1 and raw[1] == ":"):
            raise ValueError(f"absolute paths are not allowed: {path}")

        normalized = os.path.normpath(raw).replace("\\", "/")
        if normalized in {".", ".."} or normalized.startswith("../"):
            raise ValueError(f"path traversal is not allowed: {path}")

        full_path = os.path.abspath(os.path.join(self.base_path, normalized))
        try:
            if os.path.commonpath([self.base_path, full_path]) != self.base_path:
                raise ValueError(f"path escapes workspace: {path}")
        except ValueError as exc:
            raise ValueError(f"invalid workspace path: {path}") from exc
        return normalized, full_path

    def create_structure(self, folders: list[str]):
        """Create a directory/file skeleton from relative workspace paths."""
        file_names_without_suffix = {"Dockerfile", "Makefile", "Procfile", "LICENSE", "README"}
        for path in folders:
            normalized, full_path = self._safe_path(path)
            name = Path(normalized).name
            looks_like_dir = (
                str(path).endswith(("/", "\\"))
                or (Path(normalized).suffix == "" and name not in file_names_without_suffix)
            )
            if looks_like_dir:
                os.makedirs(full_path, exist_ok=True)
                self.virtual_fs[normalized.rstrip("/") + "/"] = {"type": "directory"}
            else:
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                if self.persist_to_disk and not os.path.exists(full_path):
                    Path(full_path).touch()
                self.virtual_fs[normalized] = {"type": "file", "content": ""}

        print(f"[Simulator] Structure initialized for {self.workspace_id}")

    def write_file(self, path: str, content: str):
        normalized, full_path = self._safe_path(path)
        text = content if isinstance(content, str) else str(content)
        self.virtual_fs[normalized] = {"type": "file", "content": text}
        if self.persist_to_disk:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
            print(f"[Simulator] Persisted {normalized} to disk")

    def read_file(self, path: str) -> str:
        normalized, full_path = self._safe_path(path)
        cached = self.virtual_fs.get(normalized)
        if cached and cached.get("type") == "file":
            return str(cached.get("content", ""))
        if self.persist_to_disk and os.path.isfile(full_path):
            return Path(full_path).read_text(encoding="utf-8")
        raise FileNotFoundError(normalized)

    def list_files(self) -> List[str]:
        if not self.persist_to_disk:
            return sorted(self.virtual_fs.keys())

        files: list[str] = []
        for root, _, names in os.walk(self.base_path):
            for name in names:
                full_path = os.path.join(root, name)
                files.append(os.path.relpath(full_path, self.base_path).replace("\\", "/"))
        return sorted(set(files) | {p for p, meta in self.virtual_fs.items() if meta.get("type") == "file"})


_simulators: dict[str, FSSimulator] = {}


def get_simulator(workspace_id: str) -> FSSimulator:
    if workspace_id not in _simulators:
        _simulators[workspace_id] = FSSimulator(workspace_id)
    return _simulators[workspace_id]
