"""
File System Simulator — Virtualized repo creation.
"""

import os
from typing import Any, List

class FSSimulator:
    def __init__(self, workspace_id: str, persist_to_disk: bool = True):
        self.workspace_id = workspace_id
        self.virtual_fs = {} # path -> content
        self.persist_to_disk = persist_to_disk
        self.base_path = os.path.join(os.getcwd(), "output", workspace_id)
        
        if self.persist_to_disk:
            os.makedirs(self.base_path, exist_ok=True)
            print(f"[Simulator] Persistence enabled at {self.base_path}")

    def create_structure(self, folders: list[str]):
        """
        Create a directory structure from a list of paths.
        """
        for path in folders:
            full_path = os.path.join(self.base_path, path)
            if path.endswith("/"):
                os.makedirs(full_path, exist_ok=True)
                self.virtual_fs[path] = {"type": "directory"}
            else:
                # Ensure parent dir exists
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                self.virtual_fs[path] = {"type": "file", "content": ""}
        
        print(f"[Simulator] Structure initialized for {self.workspace_id}")

    def write_file(self, path: str, content: str):
        self.virtual_fs[path] = {"type": "file", "content": content}
        if self.persist_to_disk:
            full_path = os.path.join(self.base_path, path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[Simulator] Persisted {path} to disk")

    def list_files(self) -> List[str]:
        return list(self.virtual_fs.keys())

_simulators = {}

def get_simulator(workspace_id: str) -> FSSimulator:
    if workspace_id not in _simulators:
        _simulators[workspace_id] = FSSimulator(workspace_id)
    return _simulators[workspace_id]
