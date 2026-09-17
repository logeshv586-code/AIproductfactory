"""Versioned, validated contracts. Models propose; these invariants decide."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import PurePosixPath
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CONTROL_FILES = {"PRODUCT_CONTRACT.json", "SOURCE_MANIFEST.json", "THIRD_PARTY_NOTICES.md", "verification.json", "build-manifest.json", "web/build.mjs", "web/src/main.tsx", "web/index.html", "web/tsconfig.json"}
SYSTEM_CHECKS = {"runtimeReady", "evidenceBinding", "fixtureMode", "taskCoverage", "fileManifest", "browserRunner", "isolatedRunner", "isolatedExecution", "desktopInstallation", "executionComplete"}

ID = r"^[A-Za-z][A-Za-z0-9_-]{0,95}$"


def canonical(value: Any) -> str:
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def safe_path(value: str) -> str:
    p = PurePosixPath(value)
    if not value or "\\" in value or ":" in value or p.is_absolute() or any(x in {"..", ".", ""} for x in value.split("/")):
        raise ValueError("Expected a relative file path without traversal")
    if any(x in {".git", "node_modules", "__pycache__"} for x in p.parts) or p.name == ".env":
        raise ValueError("Generated credentials, caches and repository internals are forbidden")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Brief(StrictModel):
    idea: str = Field(min_length=8, max_length=12000)
    audience: str = Field(default="", max_length=1000)
    platform: Literal["web", "desktop", "automation"] = "web"
    priority: Literal["speed", "balanced", "scale"] = "balanced"
    privacy: Literal["cloud_allowed", "local_only"] = "cloud_allowed"
    constraints: list[str] = Field(default_factory=list, max_length=40)
    target_os: list[Literal["linux", "windows", "macos"]] = Field(default_factory=lambda: ["linux"])


class Evidence(StrictModel):
    id: str = Field(pattern=ID)
    url: str
    claim: str
    retrieved_at: str
    revision: str = ""
    content_hash: str = ""
    excerpt: str = Field(default="", max_length=16000)
    status: Literal["retrieved", "unavailable", "hypothesis"]
    source_type: Literal["repository", "documentation", "market", "paper", "user"]
    limitation: str = ""


class Source(StrictModel):
    name: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    url: str
    revision: str = Field(pattern=r"^[a-f0-9]{40}$")
    license: str = Field(min_length=1)
    mode: Literal["reference", "dependency", "adaptation"] = "reference"
    evidence_ids: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_source(self):
        if self.url != f"https://github.com/{self.name}":
            raise ValueError("Repository URL must match its locked identity")
        if self.license.lower() in {"unknown", "none", "noassertion"}:
            raise ValueError("Resolve license evidence before locking an external source")
        return self


class Requirement(StrictModel):
    id: str = Field(pattern=ID)
    title: str = Field(min_length=3)
    description: str = Field(min_length=8)
    priority: Literal["must", "should", "could"] = "must"
    criteria_ids: list[str] = Field(min_length=1)


class Assertion(StrictModel):
    pointer: str = Field(pattern=r"^(/.*)?$")
    operator: Literal["equals", "contains", "greater_than", "nonempty"] = "equals"
    expected: Any = None


class BrowserStep(StrictModel):
    action: Literal["visit", "fill", "click", "text", "visible"]
    target: str = Field(min_length=1, max_length=500)
    value: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def local_visit(self):
        if self.action == "visit" and (not self.target.startswith("/") or self.target.startswith("//")):
            raise ValueError("Browser acceptance must stay on the generated product")
        return self


class Check(StrictModel):
    id: str = Field(pattern=ID)
    requirement_id: str = Field(pattern=ID)
    description: str = Field(min_length=8)
    kind: Literal["http", "browser", "manual"]
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    path: str = "/"
    body: dict[str, Any] = Field(default_factory=dict)
    expected_status: int = Field(default=200, ge=100, le=599)
    assertions: list[Assertion] = Field(default_factory=list)
    steps: list[BrowserStep] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def meaningful(self):
        if not self.path.startswith("/") or self.path.startswith("//") or "\\" in self.path:
            raise ValueError("Acceptance HTTP paths must be local")
        if self.kind == "http" and (self.path in {"/health", "/api/product"} or not self.assertions):
            raise ValueError("Business acceptance requires an observable domain result, not health alone")
        if self.kind == "browser" and (not self.steps or not any(s.action in {"text", "visible"} for s in self.steps)):
            raise ValueError("Browser checks need observable assertions")
        return self


class Component(StrictModel):
    name: str = Field(min_length=2)
    purpose: str = Field(min_length=8)
    requirement_ids: list[str] = Field(min_length=1)
    states: list[str] = Field(min_length=1)
    interactions: list[str] = Field(min_length=1)
    origin: Literal["original", "adapted", "primitive"] = "original"


class Experience(StrictModel):
    direction: str = Field(min_length=8)
    tokens: dict[str, str]
    pages: list[str] = Field(min_length=1)
    components: list[Component] = Field(min_length=1)


class Task(StrictModel):
    id: str = Field(pattern=ID)
    title: str = Field(min_length=3)
    description: str = Field(min_length=8)
    requirement_ids: list[str]
    depends_on: list[str] = Field(default_factory=list)
    files: list[str] = Field(min_length=1, max_length=24)

    @field_validator("files")
    @classmethod
    def paths(cls, values):
        return [safe_path(v) for v in values]


class Budget(StrictModel):
    max_tasks: int = Field(default=64, ge=1, le=256)
    repair_rounds: int = Field(default=2, ge=0, le=4)
    wall_seconds: int = Field(default=1800, ge=30, le=7200)
    model_calls: int = Field(default=100, ge=1, le=300)


class Contract(StrictModel):
    schema_version: Literal["1.0"] = "1.0"
    policy_version: Literal["reasoning-core-1"] = "reasoning-core-1"
    run_id: str = Field(pattern=ID)
    plan_id: Literal["PLAN-A", "PLAN-B", "PLAN-C"]
    revision: int = Field(default=1, ge=1)
    name: str = Field(min_length=3)
    summary: str = Field(min_length=8)
    rationale: str = Field(min_length=8)
    brief: Brief
    requirements: list[Requirement] = Field(min_length=1, max_length=100)
    excluded_scope: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    experience: Experience
    architecture: dict[str, Any]
    file_manifest: list[str] = Field(min_length=1, max_length=256)
    tasks: list[Task] = Field(min_length=1, max_length=256)
    acceptance: list[Check] = Field(min_length=1, max_length=300)
    sources: list[Source] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    hypotheses: list[str] = Field(default_factory=list)
    research_limitations: list[str] = Field(default_factory=list)
    budget: Budget = Field(default_factory=Budget)
    generation_mode: Literal["model", "fixture"] = "model"
    model_provenance: dict[str, str] = Field(default_factory=dict)

    @field_validator("file_manifest")
    @classmethod
    def manifest_paths(cls, values):
        return [safe_path(v) for v in values]

    @model_validator(mode="after")
    def links_and_dag(self):
        def unique(values, label):
            if len(values) != len(set(values)):
                raise ValueError(f"Duplicate {label}")
            return set(values)
        reqs = unique([r.id for r in self.requirements], "requirement IDs")
        checks = unique([c.id for c in self.acceptance], "criterion IDs")
        if checks & SYSTEM_CHECKS:
            raise ValueError("Acceptance criteria cannot reuse controller check identities")
        tasks = unique([t.id for t in self.tasks], "task IDs")
        files = unique(self.file_manifest, "manifest paths")
        evidence = unique([e.id for e in self.evidence], "evidence IDs")
        unique([s.name for s in self.sources], "source identities")
        if len(self.tasks) > self.budget.max_tasks:
            raise ValueError("Plan exceeds task budget; revise scope explicitly")
        for r in self.requirements:
            if not set(r.criteria_ids) <= checks:
                raise ValueError(f"Unknown criteria for {r.id}")
            if any(c.requirement_id != r.id for c in self.acceptance if c.id in r.criteria_ids):
                raise ValueError(f"Criteria for {r.id} belong to a different requirement")
            if not any(r.id in t.requirement_ids for t in self.tasks):
                raise ValueError(f"Requirement {r.id} has no implementation task")
        for c in self.acceptance:
            if c.requirement_id not in reqs or c.id not in next(r.criteria_ids for r in self.requirements if r.id == c.requirement_id):
                raise ValueError(f"Unlinked criterion {c.id}")
        for c in self.experience.components:
            if not set(c.requirement_ids) <= reqs:
                raise ValueError("Component references an unknown requirement")
        for s in self.sources:
            if not set(s.evidence_ids) <= evidence:
                raise ValueError("Source is missing evidence")
            if not any(e.id in s.evidence_ids and e.status == "retrieved" and e.revision == s.revision for e in self.evidence):
                raise ValueError("Locked source has no retrieved revision evidence")
        completed: set[str] = set()
        for t in self.tasks:
            if set(t.files) & CONTROL_FILES:
                raise ValueError("Tasks cannot edit protected contract, evaluator or bootstrap files")
            if not set(t.files) <= files or not set(t.requirement_ids) <= reqs or not set(t.depends_on) <= tasks:
                raise ValueError(f"Invalid task links: {t.id}")
        while len(completed) < len(tasks):
            ready = {t.id for t in self.tasks if t.id not in completed and set(t.depends_on) <= completed}
            if not ready:
                raise ValueError("Task dependency cycle")
            completed.update(ready)
        return self

    @property
    def contract_hash(self) -> str:
        return digest(self)
