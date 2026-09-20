import asyncio
import copy
import json
import os
from pathlib import Path
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from factory_core.models import Assertion, Brief, Contract, digest
from factory_core.reasoning import create_plans, fixture_contract, enforce_privacy
from factory_core.store import Conflict, NotFound, RunStore
from execution.contract_builder import execute_build, implement, scaffold, write_files
from execution.isolated_runner import IsolatedRunner, source_digest
from execution.product_builder import _flatten_tasks
from llm.local_provider import LocalProvider


def plans(platform='web', mode='fixture', **kwargs):
    brief = Brief(idea='Build a working calculator that adds two numbers', platform=platform, **kwargs)
    run_id = 'run_' + uuid.uuid4().hex
    result = [fixture_contract(brief, run_id, p) for p in ['PLAN-A', 'PLAN-B', 'PLAN-C']]
    if mode == 'model':
        for c in result:
            c.generation_mode = 'model'
            c.acceptance[0].kind = 'http'
            c.acceptance[0].path = '/sum'
            c.acceptance[0].assertions = [Assertion(pointer='/result', expected=5)]
    return result


def saved(tmp_path, mode='fixture'):
    store = RunStore(tmp_path / 'state.db')
    actor = store.owner(store.session())
    cs = plans(mode=mode)
    store.save_plans(actor, cs, {'recommendedPlanId': 'PLAN-B'})
    approval = store.approve(actor, cs[1].run_id, cs[1].plan_id, cs[1].contract_hash)
    job, _ = store.enqueue(actor, approval['runId'], approval['approvalId'], approval['contractHash'], 'request-1')
    return store, actor, cs[1], approval, job


@pytest.mark.parametrize('case', ['unknown_check', 'cycle', 'escape', 'protected', 'health_only', 'reserved_check', 'borrowed_check'])
def test_contract_rejects_invalid_links_and_false_acceptance(case):
    d = plans()[0].model_dump()
    if case == 'unknown_check': d['requirements'][0]['criteria_ids'] = ['missing']
    if case == 'cycle': d['tasks'][0]['depends_on'] = ['TASK-1']
    if case == 'escape': d['tasks'][0]['files'].append('../escape.py')
    if case == 'protected': d['tasks'][0]['files'].append('verification.json')
    if case == 'health_only': d['acceptance'][0].update(kind='http', path='/health', assertions=[])
    if case == 'reserved_check':
        d['acceptance'][0]['id'] = 'evidenceBinding'
        d['requirements'][0]['criteria_ids'] = ['evidenceBinding']
    if case == 'borrowed_check':
        d['requirements'].append({**d['requirements'][0], 'id': 'REQ-2'})
        d['tasks'][0]['requirement_ids'].append('REQ-2')
    with pytest.raises(ValidationError): Contract.model_validate(d)


def test_hash_changes_when_criteria_change():
    c = plans()[0]
    before = c.contract_hash
    c.acceptance[0].description = 'An altered acceptance requirement'
    assert c.contract_hash != before
    assert digest({'b': 2, 'a': 1}) == digest({'a': 1, 'b': 2})


def test_exact_second_plan_and_ownership_survive_reload(tmp_path):
    db, actor, c, approval, job = saved(tmp_path)
    other = db.owner(db.session())
    with pytest.raises(NotFound): db.run(other, c.run_id)
    with pytest.raises(NotFound): db.job(other, job['buildId'])
    loaded = RunStore(tmp_path / 'state.db').contract(actor, job['buildId'])
    assert loaded.plan_id == 'PLAN-B'
    assert loaded.contract_hash == approval['contractHash']
    assert db.history(actor, 'web') == []


def test_forged_changed_and_superseded_approvals_rejected(tmp_path):
    db, actor, c, a, job = saved(tmp_path)
    with pytest.raises(Conflict): db.enqueue(actor, c.run_id, 'approval_fake', c.contract_hash, 'fake')
    with pytest.raises(Conflict): db.approve(actor, c.run_id, c.plan_id, '0' * 64)
    db.approve(actor, c.run_id, c.plan_id, c.contract_hash)
    with pytest.raises(Conflict): db.enqueue(actor, c.run_id, a['approvalId'], c.contract_hash, 'stale')


def test_idempotency_worker_exclusion_and_cancellation(tmp_path):
    db, actor, c, a, job = saved(tmp_path)
    same, created = db.enqueue(actor, c.run_id, a['approvalId'], c.contract_hash, 'request-1')
    assert not created and same['buildId'] == job['buildId']
    lease = db.claim(actor, job['buildId'])
    assert lease and db.claim(actor, job['buildId']) is None
    with pytest.raises(Conflict): db.update(actor, job['buildId'], lease, 'ready')
    with pytest.raises(Conflict): db.resume(actor, job['buildId'])
    db.cancel(actor, job['buildId'])
    with pytest.raises(Conflict): db.update(actor, job['buildId'], lease, 'verifying')


def test_expired_worker_resumes_but_old_lease_cannot_publish(tmp_path):
    db, actor, c, a, job = saved(tmp_path)
    old = db.claim(actor, job['buildId'])
    with db.db() as sql: sql.execute('UPDATE jobs SET lease_until=0 WHERE id=?', (job['buildId'],))
    assert db.job(actor, job['buildId'])['recoverable']
    db.resume(actor, job['buildId'])
    assert db.claim(actor, job['buildId']) != old
    with pytest.raises(Conflict): db.update(actor, job['buildId'], old)


def test_fixture_cannot_claim_research_or_local_model_intelligence():
    cs, report = asyncio.run(create_plans(Brief(idea='Create an offline inventory app', privacy='local_only'), LocalProvider(), []))
    assert len(cs) == 3 and report['mode'] == 'fixture'
    assert not any(c.sources for c in cs)
    assert all(c.acceptance[0].kind == 'manual' for c in cs)


def test_local_only_rejects_cloud_fallback():
    with pytest.raises(ValueError, match='Local-only'):
        enforce_privacy(Brief(idea='Private offline workflow', privacy='local_only'), object())


def test_more_than_eight_tasks_are_preserved():
    assert len(_flatten_tasks({'phases': [{'name': 'All work', 'tasks': [{'title': str(i)} for i in range(15)]}]})) == 15


class UnavailableRunner:
    def verify(self, workspace, contract):
        return {'passed': False, 'contractHash': contract.contract_hash, 'sourceDigest': source_digest(workspace), 'checks': [{'name': 'isolatedRunner', 'passed': False, 'detail': 'Runner unavailable'}]}


class PassingRunner:
    def verify(self, workspace, contract):
        return {'passed': True, 'contractHash': contract.contract_hash, 'sourceDigest': source_digest(workspace), 'checks': [{'name': 'runtimeReady', 'passed': True, 'detail': 'Unit-test fake runner'}, *[{'name': c.id, 'passed': True, 'detail': 'Unit-test fake runner'} for c in contract.acceptance]]}


class FilesProvider(LocalProvider):
    def __init__(self, files): self.files, self.calls = files, 0
    async def chat(self, *args, **kwargs):
        self.calls += 1
        return json.dumps({'files': self.files, 'summary': 'Implemented tested fixture'})


@pytest.mark.parametrize('runner', [UnavailableRunner(), PassingRunner()])
def test_fixture_delivers_unverified_zip_even_with_passing_runner(tmp_path, monkeypatch, runner):
    monkeypatch.setenv('FACTORY_OUTPUT_DIR', str(tmp_path / 'products'))
    db, actor, c, a, job = saved(tmp_path)
    asyncio.run(execute_build(db, actor, job['buildId'], LocalProvider(), runner))
    result = db.job(actor, job['buildId'])
    assert result['status'] == 'blocked', result
    assert not result['pipelineVerified']
    assert result['delivery']['artifactBytes'] > 0
    assert not db.history(actor, 'web')


def test_unapproved_writes_fail_before_any_file_is_written(tmp_path):
    c = plans()[0]
    provider = FilesProvider([{'path': 'app/main.py', 'content': 'valid = 1'}, {'path': 'verification.json', 'content': '{}'}])
    with pytest.raises(ValueError, match='protected'):
        asyncio.run(implement(provider, tmp_path, c, c.tasks[0]))
    assert not (tmp_path / 'app/main.py').exists()


def test_task_checkpoint_resume_and_exact_plan_build(tmp_path, monkeypatch):
    monkeypatch.setenv('FACTORY_OUTPUT_DIR', str(tmp_path / 'products'))
    db, actor, c, a, job = saved(tmp_path, mode='model')
    provider = FilesProvider([{'path': 'app/main.py', 'content': 'from fastapi import FastAPI\napp=FastAPI()\n'}])
    asyncio.run(execute_build(db, actor, job['buildId'], provider, UnavailableRunner()))
    assert provider.calls == 1
    db.resume(actor, job['buildId'])
    asyncio.run(execute_build(db, actor, job['buildId'], provider, PassingRunner()))
    assert provider.calls == 1, 'Completed tasks must survive resumption'
    assert db.job(actor, job['buildId'])['status'] == 'ready'
    assert db.contract(actor, job['buildId']).plan_id == 'PLAN-B'
    assert len(db.history(actor, 'web')) == 1


def test_runner_evidence_must_bind_to_current_code(tmp_path, monkeypatch):
    monkeypatch.setenv('FACTORY_OUTPUT_DIR', str(tmp_path / 'products'))
    class WrongRunner(PassingRunner):
        def verify(self, workspace, contract):
            result = super().verify(workspace, contract)
            result['sourceDigest'] = 'stale'
            return result
    db, actor, c, a, job = saved(tmp_path, mode='model')
    provider = FilesProvider([{'path': 'app/main.py', 'content': 'x = 1\n'}])
    asyncio.run(execute_build(db, actor, job['buildId'], provider, WrongRunner()))
    assert not db.job(actor, job['buildId']).get('pipelineVerified')


def test_api_approval_poll_download_integrity_and_cross_owner_denial(tmp_path, monkeypatch):
    monkeypatch.setenv('FACTORY_STATE_DIR', str(tmp_path / 'state'))
    monkeypatch.setenv('FACTORY_OUTPUT_DIR', str(tmp_path / 'products'))
    from main import app
    app.state.factory_provider = LocalProvider()
    app.state.factory_runner = UnavailableRunner()
    try:
        with TestClient(app) as client:
            assert client.post('/factory/plans', json={'idea': 'Make a calculator'}).status_code == 401
            headers = {'Authorization': 'Bearer ' + client.post('/factory/session').json()['token']}
            response = client.post('/factory/plans', headers=headers, json={'idea': 'Make a working calculator'})
            assert response.status_code == 200, response.text
            result = response.json()
            selected = result['plans'][1]
            approval = client.post('/factory/approve', headers=headers, json={'runId': result['runId'], 'planId': 'PLAN-B', 'contractHash': selected['contractHash']}).json()
            body = {k: approval[k] for k in ['runId', 'approvalId', 'contractHash']}
            body['idempotencyKey'] = 'build-one'
            created = client.post('/factory/builds', headers=headers, json=body)
            assert created.status_code == 202, created.text
            job_id = created.json()['buildId']
            for _ in range(100):
                job = client.get('/factory/builds/' + job_id, headers=headers).json()
                if job['status'] in {'ready', 'failed', 'blocked'}: break
                time.sleep(.02)
            assert job['status'] == 'blocked', job
            assert client.get('/factory/builds/' + job_id + '/artifact', headers=headers).content[:2] == b'PK'
            other = {'Authorization': 'Bearer ' + client.post('/factory/session').json()['token']}
            assert client.get('/factory/builds/' + job_id, headers=other).status_code == 404
            assert client.get('/factory/builds/' + job_id + '/artifact', headers=other).status_code == 404
            (tmp_path / 'products' / (job_id + '.zip')).write_bytes(b'tampered')
            assert client.get('/factory/builds/' + job_id + '/artifact', headers=headers).status_code == 409
            assert client.post('/execution/run_task', json={'task': {}, 'workspace_id': 'bypass'}).status_code == 409
    finally:
        del app.state.factory_provider
        del app.state.factory_runner


@pytest.mark.skipif(not IsolatedRunner().available() and os.environ.get('FACTORY_REQUIRE_RUNNER') != '1', reason='Requires the isolated Docker runner image')
def test_real_container_acceptance_rejects_echo_and_accepts_calculation(tmp_path):
    # The application container runs as UID 10001, unlike pytest's host user.
    tmp_path.chmod(0o755)
    c = plans(mode='model')[1]
    c.acceptance[0].method = 'POST'
    c.acceptance[0].body = {'a': 2, 'b': 3}
    from factory_core.models import Check
    c.requirements[0].criteria_ids.extend(['AC-2', 'AC-3'])
    c.acceptance.extend([
        Check.model_validate({'id': 'AC-2', 'requirement_id': 'REQ-1', 'kind': 'http', 'description': 'Invalid operands produce a useful error', 'method': 'POST', 'path': '/sum', 'body': {'a': 'invalid', 'b': 3}, 'expected_status': 400, 'assertions': [{'pointer': '/detail', 'expected': 'Two numbers required'}]}),
        Check.model_validate({'id': 'AC-3', 'requirement_id': 'REQ-1', 'kind': 'browser', 'description': 'Customer enters numbers and sees their calculated sum', 'steps': [{'action': 'fill', 'target': '#first', 'value': '2'}, {'action': 'fill', 'target': '#second', 'value': '3'}, {'action': 'click', 'target': 'button'}, {'action': 'text', 'target': '#result', 'value': '5'}]}),
    ])
    c = Contract.model_validate(c.model_dump())
    write_files(tmp_path, scaffold(c))
    runner = IsolatedRunner()
    assert runner.available(), 'CI requires the Docker runner; this gate must not silently skip'
    assert not runner.verify(tmp_path, c)['passed']
    source = (tmp_path / 'app/main.py').read_text() + '\nfrom fastapi import HTTPException\n@app.post("/sum")\ndef add(payload: dict):\n    if any(type(payload.get(k)) not in (float, int) for k in ("a", "b")):\n        raise HTTPException(400, "Two numbers required")\n    return {"result": payload["a"] + payload["b"]}\n'
    (tmp_path / 'app/main.py').write_text(source)
    (tmp_path / 'web/src/App.tsx').write_text('''import {useState} from 'react';
export default function App() {
  const [a,A]=useState(''), [b,B]=useState(''), [result,R]=useState('');
  async function calculate(){const response=await fetch('/sum',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:Number(a),b:Number(b)})});R(String((await response.json()).result));}
  return <main><label>First number<input id="first" value={a} onChange={e=>A(e.target.value)}/></label><label>Second number<input id="second" value={b} onChange={e=>B(e.target.value)}/></label><button onClick={calculate}>Calculate</button><output id="result">{result}</output></main>;
}''')
    result = runner.verify(tmp_path, c)
    assert result['passed'], result


def test_model_planning_validates_retries_and_owns_metadata(monkeypatch):
    from factory_core import reasoning
    from unittest.mock import AsyncMock
    monkeypatch.setattr(reasoning, 'analyze_intent', AsyncMock(return_value={}))
    monkeypatch.setattr(reasoning, 'analyze_product_thinking', AsyncMock(return_value={}))
    monkeypatch.setattr(reasoning, 'extract_requirements', AsyncMock(return_value={}))
    monkeypatch.setattr(reasoning, 'research', AsyncMock(return_value={'evidence': [], 'sources': [], 'limitations': ['No external source verified']}))

    class Model:
        provider_name = 'test-model'
        model = 'explicit-test-double'
        calls = 0
        async def chat(self, messages, **kwargs):
            self.calls += 1
            context = json.loads(messages[-1]['content'])
            c = fixture_contract(Brief.model_validate(context['brief']), context['run_id'], context['plan_id']).model_dump()
            c['brief']['platform'] = 'desktop'  # The server must restore the user's authoritative brief.
            c['model_provenance'] = {'provider': 'forged'}
            if self.calls == 1:
                c['tasks'][0]['depends_on'] = ['TASK-1']
            return json.dumps(c)
        def parse_json(self, raw): return json.loads(raw)

    model = Model()
    cs, report = asyncio.run(create_plans(Brief(idea='Build a working calculator', priority='scale'), model, []))
    assert model.calls == 4
    assert report['recommendedPlanId'] == 'PLAN-C'
    assert all(c.brief.platform == 'web' and c.generation_mode == 'model' for c in cs)
    assert all(c.model_provenance['provider'] == 'test-model' for c in cs)
    assert report['decisions'][0]['validationRounds'] == 2


def test_executor_completes_all_nine_tasks(tmp_path, monkeypatch):
    monkeypatch.setenv('FACTORY_OUTPUT_DIR', str(tmp_path / 'products'))
    cs = plans(mode='model')
    from factory_core.models import Task
    for c in cs:
        c.tasks = [Task(id=f'TASK-{i}', title=f'Implement part {i}', description='Write the approved domain implementation', requirement_ids=['REQ-1'], depends_on=[f'TASK-{i-1}'] if i > 1 else [], files=['app/main.py']) for i in range(1, 10)]
        Contract.model_validate(c.model_dump())
    db = RunStore(tmp_path / 'state.db')
    actor = db.owner(db.session())
    db.save_plans(actor, cs, {})
    a = db.approve(actor, cs[1].run_id, 'PLAN-B', cs[1].contract_hash)
    job, _ = db.enqueue(actor, a['runId'], a['approvalId'], a['contractHash'], 'nine')
    model = FilesProvider([{'path': 'app/main.py', 'content': 'x = 1\n'}])
    asyncio.run(execute_build(db, actor, job['buildId'], model, PassingRunner()))
    result = db.job(actor, job['buildId'])
    assert result['status'] == 'ready'
    assert model.calls == 9 and len(result['tasks']) == 9
    assert result['tasks']['TASK-9']['success']


def test_missing_runtime_observation_cannot_verify(tmp_path, monkeypatch):
    monkeypatch.setenv('FACTORY_OUTPUT_DIR', str(tmp_path / 'products'))
    class MissingRuntime(PassingRunner):
        def verify(self, workspace, contract):
            result = super().verify(workspace, contract)
            result['checks'] = [c for c in result['checks'] if c['name'] != 'runtimeReady']
            return result
    db, actor, c, a, job = saved(tmp_path, mode='model')
    asyncio.run(execute_build(db, actor, job['buildId'], FilesProvider([{'path': 'app/main.py', 'content': 'x = 1\n'}]), MissingRuntime()))
    assert not db.job(actor, job['buildId'])['pipelineVerified']


def test_run_store_respects_output_and_state_env(tmp_path, monkeypatch):
    # 1. Direct path override
    explicit_path = tmp_path / "custom" / "custom.sqlite3"
    store1 = RunStore(explicit_path)
    assert Path(store1.path).resolve() == explicit_path.resolve()

    # 2. FACTORY_STATE_DIR set
    state_dir = tmp_path / "custom_state"
    monkeypatch.setenv("FACTORY_STATE_DIR", str(state_dir))
    store2 = RunStore()
    assert Path(store2.path).resolve() == (state_dir / "runs.sqlite3").resolve()

    # 3. FACTORY_STATE_DIR unset, FACTORY_OUTPUT_DIR set
    monkeypatch.delenv("FACTORY_STATE_DIR", raising=False)
    output_dir = tmp_path / "custom_output"
    monkeypatch.setenv("FACTORY_OUTPUT_DIR", str(output_dir))
    store3 = RunStore()
    assert Path(store3.path).resolve() == (output_dir / "factory_state" / "runs.sqlite3").resolve()

    # 4. Both unset (falls back to output/factory_state/runs.sqlite3)
    monkeypatch.delenv("FACTORY_OUTPUT_DIR", raising=False)
    store4 = RunStore()
    assert Path(store4.path) == Path("output/factory_state/runs.sqlite3")

