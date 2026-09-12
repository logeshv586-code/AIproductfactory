import json

from intelligence.learning_store import LearningStore


def test_save_writes_valid_json_and_creates_backup(tmp_path):
    path = tmp_path / "learning.json"

    store = LearningStore(str(path))
    store._data["repository_quality"]["test/repo"] = {
        "quality_score": 0.9,
        "used_in": 1,
        "approved": 1,
        "failures": 0,
    }
    store.save()

    assert path.exists()

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["repository_quality"]["test/repo"]["quality_score"] == 0.9

    store._data["repository_quality"]["test/repo"]["quality_score"] = 1.0
    store.save()

    backup_path = path.with_name("learning.json.bak")

    assert backup_path.exists()

    with open(backup_path, "r", encoding="utf-8") as f:
        backup_data = json.load(f)

    assert (
        backup_data["repository_quality"]["test/repo"]["quality_score"]
        == 0.9
    )


def test_load_recovers_from_corrupted_primary_using_backup(tmp_path):
    path = tmp_path / "learning.json"
    backup_path = tmp_path / "learning.json.bak"

    backup_data = {
        "repository_quality": {
            "test/repo": {
                "quality_score": 0.95,
                "used_in": 5,
                "approved": 5,
                "failures": 0,
            }
        },
        "capability_mappings": {},
        "architecture_decisions": [],
        "user_approvals": [],
        "successful_integrations": [],
        "failed_strategies": [],
        "repo_notes": {},
        "product_memories": [],
        "tournaments": [],
    }

    with open(path, "w", encoding="utf-8") as f:
        f.write("{ invalid json")

    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(backup_data, f)

    store = LearningStore(str(path))

    assert (
        store._data["repository_quality"]["test/repo"]["quality_score"]
        == 0.95
    )


def test_load_uses_defaults_when_primary_and_backup_are_corrupted(tmp_path):
    path = tmp_path / "learning.json"
    backup_path = tmp_path / "learning.json.bak"

    with open(path, "w", encoding="utf-8") as f:
        f.write("{ invalid primary json")

    with open(backup_path, "w", encoding="utf-8") as f:
        f.write("{ invalid backup json")

    store = LearningStore(str(path))

    assert store._data["repository_quality"] == {}
    assert store._data["capability_mappings"] == {}
    assert store._data["architecture_decisions"] == []


def test_load_uses_defaults_when_no_file_exists(tmp_path):
    path = tmp_path / "learning.json"

    store = LearningStore(str(path))

    assert store._data["repository_quality"] == {}
    assert store._data["capability_mappings"] == {}
    assert store._data["architecture_decisions"] == []
    assert store._data["product_memories"] == []
    assert store._data["tournaments"] == []


def test_learned_state_survives_save_and_reload(tmp_path):
    path = tmp_path / "learning.json"

    store = LearningStore(str(path))

    store.record_repository_outcome(
        "test/repo",
        approved=True,
    )

    store.record_capability_mapping(
        "memory",
        "test/repo",
        success=True,
    )

    reloaded = LearningStore(str(path))

    assert reloaded.repo_hint("test/repo") == 0.05
    assert reloaded.best_repo_for("memory") == "test/repo"
