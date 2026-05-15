"""
File System Simulator — Virtualized repo creation.
"""

import os
from typing import Any, List

class FSSimulator:
    def __init__(self, workspace_id: str):
        self.workspace_id = workspace_id
        self.virtual_fs = {} # path -> content

    def create_structure(self, structure: dict[str, Any]):
        """
        Create a directory structure from a blueprint.
        """
        for folder in structure.get("folders", []):
            path = folder.get("path")
            self.virtual_fs[path] = {"type": "directory", "purpose": folder.get("purpose")}
        
        print(f"[Simulator] Virtual structure initialized for {self.workspace_id}")

    def write_file(self, path: str, content: str):
        self.virtual_fs[path] = {"type": "file", "content": content}

    def list_files(self) -> List[str]:
        return list(self.virtual_fs.keys())

_simulators = {}

def get_simulator(workspace_id: str) -> FSSimulator:
    if workspace_id not in _simulators:
        _simulators[workspace_id] = FSSimulator(workspace_id)
    return _simulators[workspace_id]
