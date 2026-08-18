import json
import subprocess
import sys

from engine.starter_repo import _generate_folder_structure, _generate_main_py


def test_generated_main_py_executes(tmp_path):
    code = _generate_main_py(
        "Smoke Product",
        [{"name": "orchestrator", "tech": "Python", "role": "workflow"}],
        ["Python"],
    )
    main_file = tmp_path / "main.py"
    main_file.write_text(code, encoding="utf-8")

    result = subprocess.run(
        [sys.executable, str(main_file), json.dumps({"hello": "world"})],
        capture_output=True,
        text=True,
        check=True,
        timeout=10,
    )
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["status"] == "success"


def test_folder_structure_contains_runnable_entrypoint():
    structure = _generate_folder_structure(
        "Smoke Product",
        [{"name": "orchestrator"}],
        ["Python"],
    )
    assert "smoke-product/main.py" in structure
    assert "smoke-product/requirements.txt" in structure
    assert "smoke-product/.env.example" in structure
