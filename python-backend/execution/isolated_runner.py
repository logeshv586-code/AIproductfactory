"""Only the Docker boundary executes generated code. No host fallback."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from factory_core.models import Contract, canonical


def source_digest(workspace: Path) -> str:
    h = hashlib.sha256()
    for path in sorted(workspace.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symlinks are forbidden in generated products')
        if path.is_file():
            h.update(path.relative_to(workspace).as_posix().encode() + b'\0' + path.read_bytes() + b'\0')
    return h.hexdigest()


class IsolatedRunner:
    def __init__(self):
        self.image = os.environ.get('FACTORY_RUNNER_IMAGE', 'ai-product-factory-runner:1')

    def available(self) -> bool:
        if not shutil.which('docker'):
            return False
        try:
            return subprocess.run(['docker', 'image', 'inspect', self.image], capture_output=True, timeout=10).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False

    def verify(self, workspace: Path, contract: Contract) -> dict:
        code_hash = source_digest(workspace)
        result = {'passed': False, 'contractHash': contract.contract_hash, 'sourceDigest': code_hash, 'runnerVersion': 'isolated-1', 'checks': [], 'previewHtml': ''}
        if not self.available():
            result['checks'] = [{'name': 'isolatedRunner', 'passed': False, 'detail': 'Docker runner image unavailable. Source was generated but no generated code was executed. Provision FACTORY_RUNNER_IMAGE and resume.'}]
            return result
        tag = 'factory-' + uuid.uuid4().hex[:16]
        network, container = tag + '-net', tag + '-app'
        with tempfile.TemporaryDirectory(prefix='factory-acceptance-') as tmp:
            temp = Path(tmp)
            checks_file = temp / 'contract.json'
            checks_file.write_text(canonical(contract))
            checks_file.chmod(0o444)
            evidence = temp / 'evidence'
            evidence.mkdir(mode=0o777)
            evidence.chmod(0o777)
            def run(args, timeout=30):
                return subprocess.run(['docker', *args], capture_output=True, text=True, timeout=timeout)
            limits = ['--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=256', '--memory=1g', '--cpus=2', '--tmpfs', '/tmp:rw,nosuid,size=256m,mode=1777', '--tmpfs', '/work:rw,nosuid,size=512m,mode=1777']
            try:
                created = run(['network', 'create', '--internal', network])
                if created.returncode:
                    raise RuntimeError(created.stderr[-1000:])
                started = run(['run', '-d', '--name', container, '--network', network, '--network-alias', 'product', *limits, '-v', f'{workspace.resolve()}:/source:ro', self.image, 'sh', '-c', 'cp -R /source/. /work/ && python /opt/runner/build.py && exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000'])
                if started.returncode:
                    raise RuntimeError(started.stderr[-1000:])
                evaluated = run(['run', '--rm', '--network', network, *limits, '-v', f'{checks_file}:/checks/contract.json:ro', '-v', f'{evidence}:/evidence:rw', self.image, 'python', '/opt/runner/acceptance.py', 'http://product:8000', '/checks/contract.json'], timeout=240)
                if evaluated.returncode:
                    raise RuntimeError(evaluated.stderr[-2000:])
                result['checks'] = json.loads(evaluated.stdout)['checks']
                # Missing observations are failures, even if the evaluator aborted early.
                observed = {x['name'] for x in result['checks']}
                result['checks'].extend({'name': c.id, 'requirementId': c.requirement_id, 'passed': False, 'detail': 'Acceptance check did not execute'} for c in contract.acceptance if c.id not in observed)
                screenshot = evidence / 'preview.png'
                if screenshot.is_file():
                    data = base64.b64encode(screenshot.read_bytes()).decode()
                    result['previewHtml'] = f'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:"><img alt="Captured generated application" style="width:100%" src="data:image/png;base64,{data}">'
                if contract.brief.platform == 'desktop':
                    result['checks'].append({'name': 'desktopInstallation', 'passed': False, 'detail': 'Web/API behavior tested in Linux container; native launch and installer checks on ' + ', '.join(contract.brief.target_os) + ' remain required.'})
                if contract.generation_mode == 'fixture':
                    result['checks'].append({'name': 'fixtureMode', 'passed': False, 'detail': 'Deterministic fixture output cannot earn functional verification.'})
                result['passed'] = bool(result['checks']) and all(c['passed'] for c in result['checks'])
                if not result['passed']:
                    logs = run(['logs', '--tail', '60', container])
                    result['buildLog'] = (logs.stdout + logs.stderr)[-6000:]
            except (ValueError, OSError, subprocess.TimeoutExpired, RuntimeError) as exc:
                result['checks'].append({'name': 'isolatedExecution', 'passed': False, 'detail': str(exc)[:2000]})
            finally:
                run(['rm', '-f', container])
                run(['network', 'rm', network])
        return result
