import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from intelligence.learning_store import LearningStore


class LearningStorePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.tmp.name, "learning.json")

    def tearDown(self):
        self.tmp.cleanup()

    def test_first_run_uses_default_store(self):
        store = LearningStore(self.path)
        self.assertEqual(store.summary()["repositories_learned"], 0)
        self.assertEqual(store.product_memory_count(), 0)

    def test_save_and_reload_preserves_learning(self):
        store = LearningStore(self.path)
        store.record_capability_mapping("search", "owner/repo", success=True)

        reloaded = LearningStore(self.path)
        self.assertEqual(reloaded.best_repo_for("search"), "owner/repo")

    def test_second_save_preserves_previous_primary_as_backup(self):
        store = LearningStore(self.path)
        store.record_capability_mapping("search", "owner/first", success=True)
        first = store.to_dict()

        store.record_capability_mapping("search", "owner/second", success=True)

        with open(f"{self.path}.bak", "r", encoding="utf-8") as f:
            backup = json.load(f)
        self.assertEqual(backup, first)
        self.assertEqual(LearningStore(self.path).best_repo_for("search"), "owner/second")

    def test_corrupt_primary_recovers_from_valid_backup(self):
        store = LearningStore(self.path)
        store.record_capability_mapping("search", "owner/repo", success=True)
        # Create a second valid save so the first state becomes the backup.
        store.record_architecture_decision("layered", "web")

        with open(self.path, "w", encoding="utf-8") as f:
            f.write('{"capability_mappings":')

        recovered = LearningStore(self.path)
        self.assertEqual(recovered.best_repo_for("search"), "owner/repo")

    def test_corrupt_primary_and_backup_fall_back_to_defaults(self):
        with open(self.path, "w", encoding="utf-8") as f:
            f.write("not-json")
        with open(f"{self.path}.bak", "w", encoding="utf-8") as f:
            f.write("also-not-json")

        store = LearningStore(self.path)
        self.assertEqual(store.summary()["repositories_learned"], 0)
        self.assertEqual(store.summary()["mappings_learned"], 0)

    def test_save_replaces_primary_with_valid_json(self):
        store = LearningStore(self.path)
        store.record_failed_strategy("s1", "test failure")

        with open(self.path, "r", encoding="utf-8") as f:
            persisted = json.load(f)
        self.assertEqual(persisted["failed_strategies"][0]["strategy_id"], "s1")
        leftovers = [name for name in os.listdir(self.tmp.name) if name.startswith(".learning-")]
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
