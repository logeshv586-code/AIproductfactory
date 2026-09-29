"""Durable single-host run store with ownership, idempotency and worker leases.

SQLite WAL supports multiple local API workers. Move the same transaction
boundaries to PostgreSQL before distributing workers across machines.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from factory_core.models import Contract, canonical, digest

TERMINAL = {"ready", "blocked", "failed", "cancelled"}
TRANSITIONS = {
    "queued": {"building", "cancelled"},
    "building": {"verifying", "blocked", "failed", "cancelled"},
    "verifying": {"repairing", "ready", "blocked", "failed", "cancelled"},
    "repairing": {"verifying", "blocked", "failed", "cancelled"},
    "blocked": {"queued", "cancelled"},
    "failed": {"queued", "cancelled"},
    "ready": set(), "cancelled": set(),
}


class Conflict(ValueError):
    pass


class NotFound(ValueError):
    pass


class RunStore:
    def __init__(self, path: str | Path | None = None):
        if path:
            self.path = str(path)
        elif os.environ.get("FACTORY_STATE_DIR"):
            self.path = str(Path(os.environ["FACTORY_STATE_DIR"]) / "runs.sqlite3")
        else:
            output_root = Path(os.environ.get("FACTORY_OUTPUT_DIR", "output"))
            self.path = str(output_root / "factory_state" / "runs.sqlite3")
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.db() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS owners (token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, created REAL NOT NULL, approval TEXT);
                CREATE TABLE IF NOT EXISTS contracts (hash TEXT PRIMARY KEY, run_id TEXT NOT NULL, plan_id TEXT NOT NULL, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, owner TEXT NOT NULL, run_id TEXT NOT NULL, contract_hash TEXT NOT NULL, created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, run_id TEXT NOT NULL, approval_id TEXT NOT NULL, contract_hash TEXT NOT NULL, idem TEXT NOT NULL, state TEXT NOT NULL, lease TEXT, lease_until REAL, payload TEXT NOT NULL, updated REAL NOT NULL, UNIQUE(owner,idem));
                CREATE TABLE IF NOT EXISTS outcomes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, job_id TEXT NOT NULL, kind TEXT NOT NULL, contract_hash TEXT NOT NULL, payload TEXT NOT NULL, created REAL NOT NULL, UNIQUE(job_id,kind));
            ''')

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=15, isolation_level=None)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("BEGIN IMMEDIATE")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def session(self) -> str:
        token = secrets.token_urlsafe(32)
        with self.db() as db:
            db.execute("INSERT INTO owners VALUES (?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), uuid.uuid4().hex, time.time() + 30 * 86400))
        return token

    def owner(self, token: str) -> str:
        with self.db() as db:
            row = db.execute("SELECT owner FROM owners WHERE token_hash=? AND expires>?", (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
        if not row:
            raise NotFound("Factory session is missing or expired")
        return row["owner"]

    def save_plans(self, owner: str, contracts: list[Contract], report: dict) -> dict:
        if {c.plan_id for c in contracts} != {"PLAN-A", "PLAN-B", "PLAN-C"} or len(contracts) != 3:
            raise ValueError("Exactly three plans are required")
        run_id = contracts[0].run_id
        if any(c.run_id != run_id for c in contracts):
            raise ValueError("Plan run identity mismatch")
        payload = {"runId": run_id, "plans": [{"contract": c.model_dump(), "contractHash": c.contract_hash} for c in contracts], **report}
        with self.db() as db:
            db.execute("INSERT INTO runs VALUES (?,?,?,?,NULL)", (run_id, owner, canonical(payload), time.time()))
            db.executemany("INSERT INTO contracts VALUES (?,?,?,?)", [(c.contract_hash, run_id, c.plan_id, canonical(c)) for c in contracts])
        return payload

    def run(self, owner: str, run_id: str) -> dict:
        with self.db() as db:
            row = db.execute("SELECT payload,approval FROM runs WHERE id=? AND owner=?", (run_id, owner)).fetchone()
        if not row:
            raise NotFound("Run not found")
        return {**json.loads(row["payload"]), "approvalId": row["approval"]}

    def approve(self, owner: str, run_id: str, plan_id: str, contract_hash: str) -> dict:
        with self.db() as db:
            row = db.execute("SELECT c.payload FROM contracts c JOIN runs r ON r.id=c.run_id WHERE r.id=? AND r.owner=? AND c.plan_id=? AND c.hash=?", (run_id, owner, plan_id, contract_hash)).fetchone()
            if not row:
                raise Conflict("Plan or contract revision no longer matches the saved run")
            contract = Contract.model_validate_json(row["payload"])
            if contract.contract_hash != contract_hash:
                raise Conflict("Saved contract hash mismatch")
            approval_id = "approval_" + uuid.uuid4().hex
            db.execute("INSERT INTO approvals VALUES (?,?,?,?,?)", (approval_id, owner, run_id, contract_hash, time.time()))
            db.execute("UPDATE runs SET approval=? WHERE id=? AND owner=?", (approval_id, run_id, owner))
            # Preference is not an engineering success.
            db.execute("INSERT INTO outcomes VALUES (?,?,?,?,?,?,?)", (uuid.uuid4().hex, owner, approval_id, "plan_approved", contract_hash, canonical({"planId": plan_id}), time.time()))
        return {"approvalId": approval_id, "runId": run_id, "planId": plan_id, "contractHash": contract_hash}

    def enqueue(self, owner: str, run_id: str, approval_id: str, contract_hash: str, key: str) -> tuple[dict, bool]:
        if not key or len(key) > 128:
            raise ValueError("An idempotency key of at most 128 characters is required")
        with self.db() as db:
            approval = db.execute("SELECT a.id FROM approvals a JOIN runs r ON r.id=a.run_id WHERE a.id=? AND a.owner=? AND a.run_id=? AND a.contract_hash=? AND r.approval=a.id", (approval_id, owner, run_id, contract_hash)).fetchone()
            if not approval:
                raise Conflict("A current server-owned approval for this exact contract is required")
            old = db.execute("SELECT * FROM jobs WHERE owner=? AND idem=?", (owner, key)).fetchone()
            if old:
                if (old["run_id"], old["approval_id"], old["contract_hash"]) != (run_id, approval_id, contract_hash):
                    raise Conflict("Idempotency key already belongs to a different build")
                return self._job(old), False
            job_id = "build_" + uuid.uuid4().hex
            payload = {"tasks": {}, "events": [], "modelCalls": 0, "elapsedSeconds": 0, "repairAttempts": 0}
            db.execute("INSERT INTO jobs VALUES (?,?,?,?,?,?,'queued',NULL,0,?,?)", (job_id, owner, run_id, approval_id, contract_hash, key, canonical(payload), time.time()))
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return self._job(row), True

    @staticmethod
    def _job(row) -> dict:
        return {**json.loads(row["payload"]), "buildId": row["id"], "runId": row["run_id"], "approvalId": row["approval_id"], "contractHash": row["contract_hash"], "status": row["state"], "updatedAt": row["updated"], "recoverable": row["state"] in {"building", "verifying", "repairing"} and (row["lease_until"] or 0) < time.time()}

    def job(self, owner: str, job_id: str) -> dict:
        with self.db() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()
        if not row:
            raise NotFound("Build not found")
        return self._job(row)

    def contract(self, owner: str, job_id: str) -> Contract:
        with self.db() as db:
            row = db.execute("SELECT c.payload,j.contract_hash FROM jobs j JOIN contracts c ON c.hash=j.contract_hash WHERE j.id=? AND j.owner=?", (job_id, owner)).fetchone()
        if not row:
            raise NotFound("Build not found")
        result = Contract.model_validate_json(row["payload"])
        if result.contract_hash != row["contract_hash"]:
            raise Conflict("Saved contract was modified")
        return result

    def claim(self, owner: str, job_id: str) -> str | None:
        with self.db() as db:
            lease = secrets.token_hex(16)
            changed = db.execute("UPDATE jobs SET lease=?,lease_until=?,state='building',updated=? WHERE id=? AND owner=? AND state='queued'", (lease, time.time() + 60, time.time(), job_id, owner)).rowcount
        return lease if changed else None

    def update(self, owner: str, job_id: str, lease: str, state: str | None = None, **values) -> dict:
        with self.db() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=? AND owner=? AND lease=?", (job_id, owner, lease)).fetchone()
            if not row or row["state"] == "cancelled" or (row["lease_until"] or 0) < time.time():
                raise Conflict("Worker lease expired or build cancelled")
            target = state or row["state"]
            if target != row["state"] and target not in TRANSITIONS[row["state"]]:
                raise Conflict(f"Illegal build transition: {row['state']} → {target}")
            payload = {**json.loads(row["payload"]), **values}
            if target != row["state"]:
                payload["events"] = [*payload.get("events", []), {"state": target, "at": time.time()}]
            db.execute("UPDATE jobs SET payload=?,state=?,lease_until=?,updated=? WHERE id=?", (canonical(payload), target, time.time() + 60, time.time(), job_id))
        return self.job(owner, job_id)

    def cancel(self, owner: str, job_id: str) -> dict:
        with self.db() as db:
            row = db.execute("SELECT state FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()
            if not row:
                raise NotFound("Build not found")
            if row["state"] != "cancelled" and "cancelled" not in TRANSITIONS[row["state"]]:
                raise Conflict("A ready build cannot be cancelled")
            db.execute("UPDATE jobs SET state='cancelled',lease=NULL,lease_until=0,updated=? WHERE id=?", (time.time(), job_id))
        return self.job(owner, job_id)

    def resume(self, owner: str, job_id: str) -> dict:
        with self.db() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()
            if not row:
                raise NotFound("Build not found")
            if row["state"] not in {"blocked", "failed", "building", "verifying", "repairing"} or (row["lease_until"] or 0) >= time.time() and row["state"] not in TERMINAL:
                raise Conflict("Build is already active or cannot be resumed")
            db.execute("UPDATE jobs SET state='queued',lease=NULL,lease_until=0,updated=? WHERE id=?", (time.time(), job_id))
        return self.job(owner, job_id)

    def outcome(self, owner: str, job_id: str, kind: str, payload: dict) -> None:
        if kind not in {"build_passed", "acceptance_passed", "build_failed"}:
            raise ValueError("Unsupported runner outcome")
        with self.db() as db:
            row = db.execute("SELECT contract_hash,state FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()
            if not row or row["state"] == "cancelled":
                return
            db.execute("INSERT OR REPLACE INTO outcomes VALUES (?,?,?,?,?,?,?)", (uuid.uuid4().hex, owner, job_id, kind, row["contract_hash"], canonical(payload), time.time()))

    def history(self, owner: str, platform: str) -> list[dict]:
        with self.db() as db:
            rows = db.execute("SELECT o.kind,o.payload,o.created,c.payload AS contract FROM outcomes o JOIN contracts c ON c.hash=o.contract_hash WHERE o.owner=? AND o.kind='acceptance_passed' AND o.created>? ORDER BY o.created DESC LIMIT 30", (owner, time.time() - 90 * 86400)).fetchall()
        return [{"outcome": r["kind"], "result": json.loads(r["payload"]), "name": json.loads(r["contract"])["name"], "platform": platform} for r in rows if json.loads(r["contract"])["brief"]["platform"] == platform][:5]
