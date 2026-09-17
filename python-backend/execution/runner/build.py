"""Trusted image-side build script; never provided by the coding model."""
import compileall
import importlib.metadata
import json
import re
import subprocess
from pathlib import Path

root = Path('/work')
# Exact dependency availability is checked offline; never install packages on the host.
for line in (root / 'requirements.txt').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    match = re.fullmatch(r'([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)', line)
    if not match:
        raise ValueError('Dependencies must be pinned name==version lines')
    if importlib.metadata.version(match[1]) != match[2]:
        raise ValueError(f'Dependency unavailable at approved version: {match[1]}=={match[2]}')
if not compileall.compile_dir(str(root / 'app'), quiet=1):
    raise ValueError('Python compilation failed')
subprocess.run(['python', '-m', 'pytest', '-q', 'tests'], cwd=root, check=True, timeout=90)
if (root / 'web').exists():
    expected = json.loads(Path('/opt/runner/web/package.json').read_text())
    actual = json.loads((root / 'web/package.json').read_text())
    if any(actual.get(k) != expected.get(k) for k in ['dependencies', 'devDependencies']):
        raise ValueError('Web dependencies require a provisioned runner image matching the approved lockfile')
    if (root / 'web/package-lock.json').read_bytes() != Path('/opt/runner/web/package-lock.json').read_bytes():
        raise ValueError('Web dependency lock differs from the installed runner')
    (root / 'web/node_modules').symlink_to('/opt/runner/web/node_modules', target_is_directory=True)
    subprocess.run(['/opt/runner/web/node_modules/.bin/tsc', '--noEmit'], cwd=root / 'web', check=True, timeout=60)
    subprocess.run(['node', 'build.mjs'], cwd=root / 'web', check=True, timeout=60)
