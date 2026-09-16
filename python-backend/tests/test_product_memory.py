from intelligence.product_memory import ProductMemory


class StubStore:
    def __init__(self, memories):
        self._memories = memories

    def product_memories(self):
        return self._memories


def test_legacy_memory_without_product_dna_is_not_a_false_match():
    store = StubStore(
        [
            {
                "run_id": "legacy-run",
                "idea": "An unrelated legacy product",
            }
        ]
    )

    result = ProductMemory(store).search("Build a fintech wallet")

    assert result["has_memory"] is True
    assert result["total_memory"] == 1
    assert result["matches"] == []
