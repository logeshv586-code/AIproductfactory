"""File System Simulator — virtualized repo creation with workspace confinement."""

import os
import re
import tempfile
from pathlib import Path
from typing import List


MAX_SIMULATOR_FILE_BYTES = 400_000

_SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9_-]{20,}",
    r"sk-ant-[A-Za-z0-9_-]{10,}",
    r"sk-proj-[A-Za-z0-9_-]{10,}",
    r"ghp_[A-Za-z0-9]{20,}",
    r"github_pat_[A-Za-z0-9_]{20,}",
    r"xox[baprs]-[A-Za-z0-9-]{10,}",
    r"tvly-[A-Za-z0-9_-]{10,}",
    r"AKIA[0-9A-Z]{16}",
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
]


def _looks_like_secret(content: str) -> bool:
    return any(re.search(pattern, content) for pattern in _SECRET_PATTERNS)


class FSSimulator:
    def __init__(self, workspace_id: str, persist_to_disk: bool = True):
        self.workspace_id = workspace_id
        self.virtual_fs = {}  # path -> metadata/content
        self.persist_to_disk = persist_to_disk

        # Read FACTORY_OUTPUT_DIR from environment if configured; fallback to local output folder
        factory_output_dir = os.environ.get("FACTORY_OUTPUT_DIR")
        if factory_output_dir and factory_output_dir.strip():
            output_root = Path(factory_output_dir).resolve()
        else:
            output_root = Path(os.getcwd()) / "output"

        self.base_path = str(output_root / workspace_id)
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
        encoded = content.encode("utf-8")
        if len(encoded) > MAX_SIMULATOR_FILE_BYTES:
            raise ValueError(f"Generated file exceeds {MAX_SIMULATOR_FILE_BYTES} byte cap: {path}")
        if _looks_like_secret(content):
            raise ValueError(f"Refusing to persist file with embedded credential pattern: {path}")
        full_path = self._resolve(path)
        self.virtual_fs[path] = {"type": "file", "content": content}
        if self.persist_to_disk:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp_name = tempfile.mkstemp(dir=str(full_path.parent), prefix=".factory-tmp-")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as handle:
                    handle.write(content)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(tmp_name, full_path)
            except BaseException:
                try:
                    os.unlink(tmp_name)
                except OSError:
                    pass
                raise
            print(f"[Simulator] Persisted {path} to disk")

    def list_files(self) -> List[str]:
        return list(self.virtual_fs.keys())


_simulators = {}


def get_simulator(workspace_id: str) -> FSSimulator:
    if workspace_id not in _simulators:
        _simulators[workspace_id] = FSSimulator(workspace_id)
    return _simulators[workspace_id]