import os
from pathlib import Path
import tempfile
from execution.simulator import FSSimulator, _simulators


def test_fssimulator_respects_factory_output_dir():
  # Clear simulator cache to force instantiation
  _simulators.clear()

  with tempfile.TemporaryDirectory() as custom_dir:
    os.environ["FACTORY_OUTPUT_DIR"] = custom_dir
    try:
      sim = FSSimulator("ws_test_123")
      expected_path = str(Path(custom_dir).resolve() / "ws_test_123")
      assert sim.base_path == expected_path
    finally:
      del os.environ["FACTORY_OUTPUT_DIR"]
      _simulators.clear()


def test_fssimulator_fallback_when_env_not_set():
  _simulators.clear()
  os.environ.pop("FACTORY_OUTPUT_DIR", None)

  sim = FSSimulator("ws_test_456")
  expected_path = str(Path(os.getcwd()).resolve() / "output" / "ws_test_456")
  assert sim.base_path == expected_path
  _simulators.clear()