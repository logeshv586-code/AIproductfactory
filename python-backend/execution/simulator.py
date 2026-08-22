"""
File System Simulator — Virtualized repo creation.
"""

from __future__ import annotations

import os
from typing import List


class FSSimulator:
    def __init__(self, workspace_id: str, persist_to_disk: bool = True):
        self.workspace_id = workspace_id
        self.virtual_fs = {}  # path -> content
        self.persist_to_disk = persist_to_disk
        self.base_path = os.path.abspath(os.path.join(os.getcwd(), "output", workspace_id))

        if self.persist_to_disk:
            os.makedirs(self.base_path, exist_ok=True)
            print(f"[Simulator] Persistence enabled at {self.base_path}")

    def _resolve(self, path: str) -> str:
        normalized = os.path.normpath(str(path or "").replace("\\", os.sep))
        if normalized in {"", ".", ".."} or os.path.isabs(normalized) or normalized.startswith(f"..{os.sep}"):
            raise ValueError(f"unsafe workspace path: {path}")
        full_path = os.path.abspath(os.path.join(self.base_path, normalized))
        try:
            common = os.path.commonpath([self.base_path, full_path])
        except ValueError as exc:
            raise ValueError(f"unsafe workspace path: {path}") from exc
        if common != self.base_path:
            raise ValueError(f"unsafe workspace path: {path}")
        return full_path

    def create_structure(self, folders: list[str]):
        """Create a directory/file structure rooted inside this workspace."""
        for path in folders:
            if not path:
                continue
            full_path = self._resolve(path)
            if str(path).endswith(("/", "\\")):
                os.makedirs(full_path, exist_ok=True)
                self.virtual_fs[path] = {"type": "directory"}
            else:
                parent = os.path.dirname(full_path)
                if parent:
                    os.makedirs(parent, exist_ok=True)
                self.virtual_fs[path] = {"type": "file", "content": ""}

        print(f"[Simulator] Structure initialized for {self.workspace_id}")

    def write_file(self, path: str, content: str):
        full_path = self._resolve(path)
        self.virtual_fs[path] = {"type": "file", "content": content}
        if self.persist_to_disk:
            parent = os.path.dirname(full_path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as file_handle:
                file_handle.write(content)
            print(f"[Simulator] Persisted {path} to disk")

    def list_files(self) -> List[str]:
        return list(self.virtual_fs.keys())


_simulators = {}


def get_simulator(workspace_id: str) -> FSSimulator:
    if workspace_id not in _simulators:
        _simulators[workspace_id] = FSSimulator(workspace_id)
    return _simulators[workspace_id]
