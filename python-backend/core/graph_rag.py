"""
Graph RAG — Intelligent context expansion using Vector + Graph.
"""

from typing import Any, List, Optional
from memory.vector_memory import get_vector_memory
from memory.graph_memory import get_graph_memory
from llm.provider import LLMProvider, get_provider

class GraphRAG:
    def __init__(self, provider: Optional[LLMProvider] = None):
        self.provider = provider or get_provider()
        self.vector_db = get_vector_memory()
        self.graph_db = get_graph_memory()

    async def query(self, question: str) -> dict[str, Any]:
        """
        Perform a Graph RAG query.
        1. Semantic Search (Vector)
        2. Relationship Expansion (Graph)
        3. Contextual Synthesis (LLM)
        """
        # Step 1: Semantic Search for initial nodes
        hits = await self.vector_db.search(question, limit=3)
        
        expanded_context = []
        for hit in hits:
            node_id = hit.get("id")
            if node_id:
                # Step 2: Expand via graph (1-hop neighbors)
                neighbors = self.graph_db.get_neighbors(node_id)
                expanded_context.append({
                    "primary": hit,
                    "related": neighbors
                })

        # Step 3: Synthesize Answer
        messages = [
            {
                "role": "system",
                "content": """You are an AI Product Strategist. Use the provided context 
(which includes primary research/repo hits and their related graph entities) 
to answer the user's question with deep architectural insight."""
            },
            {
                "role": "user",
                "content": f"QUESTION: {question}\n\nCONTEXT:\n{expanded_context}"
            }
        ]

        answer = await self.provider.chat(messages, temperature=0.3)
        
        return {
            "answer": answer,
            "context_size": len(expanded_context),
            "sources": hits
        }

_rag = None

def get_graph_rag() -> GraphRAG:
    global _rag
    if _rag is None:
        _rag = GraphRAG()
    return _rag
