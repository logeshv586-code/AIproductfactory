"""Canonical Factory API. Browser sessions own immutable plans and build jobs."""
from __future__ import annotations

import asyncio
import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import Field

from execution.contract_builder import execute_build, output_root
from factory_core.models import Brief, StrictModel
from factory_core.reasoning import create_plans, enforce_privacy
from factory_core.store import Conflict, NotFound, RunStore

router = APIRouter(prefix='/factory', tags=['Product Reasoning Core'])
_workers: set[asyncio.Task] = set()


def store() -> RunStore:
    return RunStore()


def owner(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'A Factory browser session is required')
    try:
        return store().owner(authorization[7:])
    except NotFound as exc:
        raise HTTPException(401, str(exc)) from exc


def provider(request: Request):
    override = getattr(request.app.state, 'factory_provider', None)
    if override:
        return override
    # runtime_entry replaces this resolver with request-bound model sessions.
    import main
    return main.get_provider()


def handle(exc: Exception):
    if isinstance(exc, NotFound):
        raise HTTPException(404, str(exc)) from exc
    if isinstance(exc, Conflict):
        raise HTTPException(409, str(exc)) from exc
    raise HTTPException(422, str(exc)[:3000]) from exc


def spawn(store_: RunStore, owner_: str, job_id: str, provider_, request: Request):
    task = asyncio.create_task(execute_build(store_, owner_, job_id, provider_, getattr(request.app.state, 'factory_runner', None)))
    _workers.add(task)
    task.add_done_callback(_workers.discard)


class ApprovalRequest(StrictModel):
    runId: str = Field(pattern=r'^run_[a-f0-9]{32}$')
    planId: str
    contractHash: str = Field(pattern=r'^[a-f0-9]{64}$')


class BuildRequest(StrictModel):
    runId: str = Field(pattern=r'^run_[a-f0-9]{32}$')
    approvalId: str = Field(pattern=r'^approval_[a-f0-9]{32}$')
    contractHash: str = Field(pattern=r'^[a-f0-9]{64}$')
    idempotencyKey: str = Field(min_length=1, max_length=128)


@router.post('/session')
def create_session():
    return {'token': store().session()}


@router.post('/plans')
async def plans(brief: Brief, request: Request, actor: str = Depends(owner)):
    try:
        engine = provider(request)
        contracts, report = await asyncio.wait_for(create_plans(brief, engine, store().history(actor, brief.platform)), timeout=540)
        return {'success': True, **store().save_plans(actor, contracts, report)}
    except (ValueError, TimeoutError) as exc:
        handle(exc)


@router.get('/runs/{run_id}')
def read_run(run_id: str, actor: str = Depends(owner)):
    try:
        return {'success': True, **store().run(actor, run_id)}
    except ValueError as exc:
        handle(exc)


@router.post('/approve')
def approve(body: ApprovalRequest, actor: str = Depends(owner)):
    try:
        return {'success': True, **store().approve(actor, body.runId, body.planId, body.contractHash)}
    except ValueError as exc:
        handle(exc)


@router.post('/builds', status_code=202)
async def build(body: BuildRequest, request: Request, actor: str = Depends(owner)):
    try:
        db = store()
        engine = provider(request)
        run = db.run(actor, body.runId)
        selected = next((p for p in run['plans'] if p['contractHash'] == body.contractHash), None)
        if not selected:
            raise Conflict('Saved plan not found')
        enforce_privacy(Brief.model_validate(selected['contract']['brief']), engine)
        job, created = db.enqueue(actor, body.runId, body.approvalId, body.contractHash, body.idempotencyKey)
        if created or job['status'] == 'queued':
            spawn(db, actor, job['buildId'], engine, request)
        return {'success': True, **job}
    except ValueError as exc:
        handle(exc)


@router.get('/builds/{job_id}')
def read_build(job_id: str, actor: str = Depends(owner)):
    try:
        job = store().job(actor, job_id)
        if job.get('delivery'):
            job['delivery']['downloadUrl'] = f'/api/factory/core/builds/{job_id}/artifact'
        return {'success': True, **job}
    except ValueError as exc:
        handle(exc)


@router.post('/builds/{job_id}/resume', status_code=202)
async def resume(job_id: str, request: Request, actor: str = Depends(owner)):
    try:
        db = store()
        engine = provider(request)
        enforce_privacy(db.contract(actor, job_id).brief, engine)
        job = db.resume(actor, job_id)
        spawn(db, actor, job_id, engine, request)
        return {'success': True, **job}
    except ValueError as exc:
        handle(exc)


@router.post('/builds/{job_id}/cancel')
def cancel(job_id: str, actor: str = Depends(owner)):
    try:
        return {'success': True, **store().cancel(actor, job_id)}
    except ValueError as exc:
        handle(exc)


@router.get('/builds/{job_id}/artifact')
def artifact(job_id: str, actor: str = Depends(owner)):
    try:
        job = store().job(actor, job_id)
        if job['status'] not in {'ready', 'blocked', 'failed'} or not job.get('delivery'):
            raise NotFound('No completed source package is available for this build')
        path = output_root() / (job['buildId'] + '.zip')
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != job['delivery'].get('artifactSha256'):
            raise Conflict('Artifact is missing or changed after verification')
        return FileResponse(path, filename=path.name, media_type='application/zip', headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})
    except ValueError as exc:
        handle(exc)
