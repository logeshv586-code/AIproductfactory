"""File System Simulator — virtualized repo creation with workspace confinement."""

from pathlib import Path
from typing import List
import os


class FSSimulator:
    def __init__(self, workspace_id: str, persist_to_disk: bool = True):
        self.workspace_id = workspace_id
        self.virtual_fs = {}  # path -> metadata/content
        self.persist_to_disk = persist_to_disk
        self.base_path = os.path.join(os.getcwd(), "output", workspace_id)
        self._base = Path(self.base_path).resolve()

        if self.persist_to_disk:
            self._base.mkdir(parents=True, exist_ok=True)
            print(f"[Simulator] Persistence enabled at {self.base_path}")

    def _resolve(self, path: str) -> Path:
        candidate = (self._base / path).resolve()
        if candidate != self._base and self._base not in candidate.parents:
            raise ValueError(f"Refusing path outside build workspace: {path}")
        return candidate

    def create_structure(self, folders: list[str]):
        """Create a directory structure from a list of relative workspace paths."""
        for path in folders:
            full_path = self._resolve(path)
            if path.endswith("/"):
                full_path.mkdir(parents=True, exist_ok=True)
                self.virtual_fs[path] = {"type": "directory"}
            else:
                full_path.parent.mkdir(parents=True, exist_ok=True)
                self.virtual_fs[path] = {"type": "file", "content": ""}
        print(f"[Simulator] Structure initialized for {self.workspace_id}")

    def write_file(self, path: str, content: str):
        if not isinstance(path, str) or not path.strip():
            raise ValueError("Generated file path must be a non-empty string")
        if not isinstance(content, str):
            content = str(content)
        full_path = self._resolve(path)
        self.virtual_fs[path] = {"type": "file", "content": content}
        if self.persist_to_disk:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            print(f"[Simulator] Persisted {path} to disk")

    def list_files(self) -> List[str]:
        return list(self.virtual_fs.keys())


_simulators = {}


def get_simulator(workspace_id: str) -> FSSimulator:
    if workspace_id not in _simulators:
        _simulators[workspace_id] = FSSimulator(workspace_id)
    return _simulators[workspace_id]
