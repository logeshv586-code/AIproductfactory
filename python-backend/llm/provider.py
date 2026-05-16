"""
LLM Provider — Abstract interface for LLM calls.
Supports OpenAI, Claude, and local fallback.
"""

import os
import json
import re
import asyncio
from abc import ABC, abstractmethod
from typing import Any, Optional


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def chat(self, messages: list[dict[str, str]], temperature: float = 0.5,
                   max_tokens: int = 1000) -> str:
        """Send a chat completion request and return the text response."""
        pass

    @abstractmethod
    async def get_embedding(self, text: str) -> list[float]:
        """Get embedding vector for a text string."""
        pass

    def parse_json(self, raw: str) -> Any:
        """Clean and parse JSON from LLM response."""
        cleaned = re.sub(r'```json\n?', '', raw)
        cleaned = re.sub(r'```\n?', '', cleaned).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {}


class OpenAIProvider(LLMProvider):
    """OpenAI GPT-4 / GPT-3.5 provider."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.model = model
        self.base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url if self.base_url else None,
            )
        return self._client

    async def chat(self, messages: list[dict[str, str]], temperature: float = 0.5,
                   max_tokens: int = 1000) -> str:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"[OpenAI] chat error: {e}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        try:
            response = await self.client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"[OpenAI] embedding error: {e}")
            # Return zero vector as fallback
            return [0.0] * 1536


class ClaudeProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = model
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=self.api_key)
        return self._client

    async def chat(self, messages: list[dict[str, str]], temperature: float = 0.5,
                   max_tokens: int = 1000) -> str:
        try:
            # Extract system message if present
            system_msg = ""
            user_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_msg = msg["content"]
                else:
                    user_messages.append(msg)

            kwargs = {
                "model": self.model,
                "messages": user_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if system_msg:
                kwargs["system"] = system_msg

            response = await self.client.messages.create(**kwargs)
            return response.content[0].text if response.content else ""
        except Exception as e:
            print(f"[Claude] chat error: {e}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        # Claude doesn't have embedding API, use OpenAI as fallback
        openai_provider = OpenAIProvider()
        return await openai_provider.get_embedding(text)


class GeminiProvider(LLMProvider):
    """Google Gemini provider."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = model
        self._client = None

    @property
    def client(self):
        if self._client is None:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(self.model)
        return self._client

    async def chat(self, messages: list[dict[str, str]], temperature: float = 0.5,
                   max_tokens: int = 1000) -> str:
        try:
            # Format messages for Gemini
            contents = []
            system_instruction = ""
            
            for msg in messages:
                if msg["role"] == "system":
                    system_instruction = msg["content"]
                else:
                    role = "model" if msg["role"] == "assistant" else "user"
                    contents.append({"role": role, "parts": [msg["content"]]})

            import google.generativeai as genai
            model = genai.GenerativeModel(
                model_name=self.model,
                system_instruction=system_instruction if system_instruction else None
            )
            
            response = await model.generate_content_async(
                contents,
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
            )
            return response.text
        except Exception as e:
            print(f"[Gemini] chat error: {e}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        try:
            import google.generativeai as genai
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document",
            )
            return result['embedding']
        except Exception as e:
            print(f"[Gemini] embedding error: {e}")
            return [0.0] * 768  # Gemini embeddings are often 768 dims


class NvidiaProvider(LLMProvider):
    """NVIDIA Hosted GLM-5.1 provider."""

    def __init__(self, api_key: Optional[str] = None, model: str = "z-ai/glm-5.1"):
        self.api_key = api_key or os.environ.get("NVIDIA_API_KEY", "")
        self.model = os.environ.get("NVIDIA_MODEL", model)
        self.base_url = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )
        return self._client

    async def chat(self, messages: list[dict[str, str]], temperature: float = 1.0,
                   max_tokens: int = 16384) -> str:
        try:
            # GLM-5.1 specific settings from apisample.py
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=1,
                extra_body={
                    "chat_template_kwargs": {
                        "enable_thinking": True,
                        "clear_thinking": False
                    }
                }
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"[Nvidia] chat error: {e}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        # NVIDIA hosted models might not all support embeddings, fallback to zero vector or OpenAI
        return [0.0] * 1536


class LocalProvider(LLMProvider):
    """Local / mock provider for development and testing."""

    async def chat(self, messages: list[dict[str, str]], temperature: float = 0.5,
                   max_tokens: int = 1000) -> str:
        # Return structured mock responses based on system prompt content
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        user = next((m["content"] for m in messages if m["role"] == "user"), "")

        if "probability scoring" in system.lower() or "feasibility" in system.lower():
            return json.dumps({
                "feasibility": 0.72,
                "novelty": 0.65,
                "demand": 0.78,
                "directives": ["Focus on API-first architecture", "Prefer repos with MIT license"],
                "rationale": "The idea has strong market demand with existing open-source components available for integration. Technical feasibility is good but requires careful architecture design."
            })
        elif "expand" in system.lower() and "product strategist" not in system.lower():
            return json.dumps({
                "market": "Growing market for AI-powered developer tools and automation platforms",
                "target_users": ["Software developers", "DevOps engineers", "Tech startups", "Enterprise IT teams"],
                "features": ["AI-powered code generation", "Real-time collaboration", "GitHub integration", "Automated testing", "Custom workflow builder"],
                "usp": "First platform to combine AI code generation with automated repo composition",
                "risks": ["Market competition from established players", "Technical complexity of multi-repo integration", "User adoption challenges"],
                "suggested_stack": ["Python", "FastAPI", "React", "PostgreSQL", "Redis"]
            })
        elif "planner" in system.lower() or "DAG" in system.lower():
            return json.dumps({
                "tasks": [
                    {"id": "arch", "name": "Design System Architecture", "depends_on": [], "agent": "system_designer", "inputs": {}, "priority": 10},
                    {"id": "compose", "name": "Compose Repos", "depends_on": ["arch"], "agent": "repo_composer", "inputs": {}, "priority": 8},
                    {"id": "gen1", "name": "Generate Core Module", "depends_on": ["compose"], "agent": "code_generator", "inputs": {}, "priority": 7},
                    {"id": "gen2", "name": "Generate API Layer", "depends_on": ["compose"], "agent": "code_generator", "inputs": {}, "priority": 6},
                    {"id": "test", "name": "Run Tests", "depends_on": ["gen1", "gen2"], "agent": "test_agent", "inputs": {}, "priority": 5}
                ]
            })
        elif "architect" in system.lower() or "architecture" in system.lower():
            return json.dumps({
                "components": [
                    {"name": "Core Engine", "role": "Main processing pipeline", "tech": "Python", "interface": "api"},
                    {"name": "API Gateway", "role": "Request routing and auth", "tech": "FastAPI", "interface": "rest"},
                    {"name": "Data Layer", "role": "Persistence and caching", "tech": "PostgreSQL", "interface": "lib"},
                    {"name": "AI Service", "role": "LLM integration and orchestration", "tech": "Python", "interface": "api"},
                    {"name": "Frontend Dashboard", "role": "User interface", "tech": "React", "interface": "ui"}
                ],
                "data_flows": [
                    {"from": "API Gateway", "to": "Core Engine", "data": "User requests and pipeline triggers"},
                    {"from": "Core Engine", "to": "AI Service", "data": "LLM prompts and context"},
                    {"from": "Core Engine", "to": "Data Layer", "data": "State persistence and retrieval"},
                    {"from": "Frontend Dashboard", "to": "API Gateway", "data": "User interactions"}
                ],
                "tech_stack": ["Python", "FastAPI", "React", "PostgreSQL", "Redis", "Docker"],
                "deployment": "docker-compose",
                "diagram_description": "Five-tier architecture: Frontend → API Gateway → Core Engine → AI Service + Data Layer, with Redis caching layer between Core and Data"
            })
        elif "repo selection" in system.lower() or "rank" in system.lower():
            return json.dumps({
                "rankings": [
                    {"full_name": "langchain-ai/langchain", "score": 0.92, "reason": "Core AI orchestration framework"},
                    {"full_name": "chroma-core/chroma", "score": 0.85, "reason": "Vector database for semantic search"},
                    {"full_name": "openai/openai-python", "score": 0.80, "reason": "LLM API integration"},
                    {"full_name": "fastapi/fastapi", "score": 0.78, "reason": "High-performance API framework"},
                    {"full_name": "prisma/prisma", "score": 0.70, "reason": "Database ORM and migrations"}
                ]
            })
        elif "integration" in system.lower() or "compose" in system.lower():
            return json.dumps({
                "steps": [
                    {"order": 1, "action": "Initialize project structure", "file": "pyproject.toml", "detail": "Create Python project with dependencies"},
                    {"order": 2, "action": "Set up FastAPI application", "file": "app/main.py", "detail": "Create API routes and middleware"},
                    {"order": 3, "action": "Configure database", "file": "app/database.py", "detail": "Set up PostgreSQL connection and models"},
                    {"order": 4, "action": "Implement AI service", "file": "app/ai_service.py", "detail": "LLM integration layer"},
                    {"order": 5, "action": "Create Docker configuration", "file": "docker-compose.yml", "detail": "Multi-container setup"}
                ],
                "repo_roles": {},
                "glue_code_needed": ["API adapter for repo integration", "Custom middleware for auth"],
                "config_files": ["pyproject.toml", "docker-compose.yml", ".env.example", "alembic.ini"]
            })
        elif "code generator" in system.lower() or "generate" in system.lower():
            return json.dumps({
                "filename": "core_engine.py",
                "language": "python",
                "code": '"""Core Engine — Main processing pipeline"""\n\nimport asyncio\nfrom typing import Any, Optional\n\n\nclass CoreEngine:\n    """Main processing engine for the AI product factory."""\n\n    def __init__(self, config: Optional[dict] = None):\n        self.config = config or {}\n        self.pipeline_steps = []\n        self.is_running = False\n\n    async def run_pipeline(self, input_data: dict[str, Any]) -> dict[str, Any]:\n        """Execute the full processing pipeline."""\n        self.is_running = True\n        results = {"status": "success", "steps_completed": 0}\n        for step in self.pipeline_steps:\n            try:\n                result = await step.execute(input_data)\n                results["steps_completed"] += 1\n            except Exception as e:\n                results["error"] = str(e)\n                break\n        self.is_running = False\n        return results\n\n    def add_step(self, step: Any) -> None:\n        """Add a processing step to the pipeline."""\n        self.pipeline_steps.append(step)\n',
                "description": "Core engine module with async pipeline execution"
            })
        elif "product" in system.lower() or "idea" in system.lower() or "combine" in system.lower() or "create" in user.lower() or "design a product" in system.lower():
            # Default product generation response for any strategy
            import re
            # Try to extract capability types from the user message
            caps_found = []
            for cap in ["memory", "agent", "rag", "ui", "backend", "automation"]:
                if cap in user.lower() or cap in system.lower():
                    caps_found.append(cap)
            if not caps_found:
                caps_found = ["backend", "agent"]

            return json.dumps({
                "name": f"AI-{''.join(c.title() for c in caps_found[:2])} Platform",
                "description": f"An innovative platform combining {caps_found[0]} and {caps_found[-1]} capabilities to create a powerful AI-powered solution for developers and teams",
                "system_flow": f"User Input → {caps_found[0].title()} Service → AI Processing → {caps_found[-1].title()} Engine → Output → Feedback Loop",
                "capabilities": caps_found,
                "target_users": ["Software developers", "DevOps engineers", "AI researchers"],
                "key_features": [f"Advanced {caps_found[0]} processing", f"Smart {caps_found[-1]} automation", "Real-time collaboration", "API-first design", "Custom workflow builder"],
                "repos_used": [],
                "gap_filled": caps_found[0] if "gap" in system.lower() else "",
                "trend_alignment": f"Aligned with {caps_found[0]} + {caps_found[-1]} trend",
                "composition_pattern": "pipeline_composition",
                "gaps_filled": caps_found,
            })
        else:
            return json.dumps({"result": "mock response", "name": "Default Product", "description": "A default product idea"})

    async def get_embedding(self, text: str) -> list[float]:
        # Return pseudo-random embedding based on text hash
        import hashlib
        h = hashlib.md5(text.encode()).hexdigest()
        vec = [(int(h[i:i+2], 16) / 255.0 - 0.5) * 2 for i in range(0, min(len(h), 1536 * 2), 2)]
        # Pad to 1536 dimensions
        while len(vec) < 1536:
            h = hashlib.md5((text + str(len(vec))).encode()).hexdigest()
            vec.extend([(int(h[i:i+2], 16) / 255.0 - 0.5) * 2 for i in range(0, min(len(h), (1536 - len(vec)) * 2), 2)])
        return vec[:1536]


class ResilientProvider(LLMProvider):
    """Wrap a remote provider with timeout and local fallback."""

    def __init__(self, primary: LLMProvider, fallback: Optional[LLMProvider] = None, timeout_seconds: float = 12.0):
        self.primary = primary
        self.fallback = fallback or LocalProvider()
        self.timeout_seconds = timeout_seconds

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
    ) -> str:
        try:
            text = await asyncio.wait_for(
                self.primary.chat(messages, temperature=temperature, max_tokens=max_tokens),
                timeout=self.timeout_seconds,
            )
            if text:
                return text
        except Exception as e:
            print(f"[ResilientProvider] primary chat fallback: {e}")

        return await self.fallback.chat(messages, temperature=temperature, max_tokens=max_tokens)

    async def get_embedding(self, text: str) -> list[float]:
        try:
            vector = await asyncio.wait_for(
                self.primary.get_embedding(text),
                timeout=self.timeout_seconds,
            )
            if vector and any(value != 0 for value in vector):
                return vector
        except Exception as e:
            print(f"[ResilientProvider] primary embedding fallback: {e}")

        return await self.fallback.get_embedding(text)


def get_provider(provider_name: Optional[str] = None) -> LLMProvider:
    """Factory function to get the configured LLM provider."""
    name = provider_name or os.environ.get("LLM_PROVIDER", "local")

    if name == "nvidia":
        if not os.environ.get("NVIDIA_API_KEY"):
            return LocalProvider()
        return ResilientProvider(NvidiaProvider())
    elif name == "openai":
        if not os.environ.get("OPENAI_API_KEY"):
            return LocalProvider()
        return ResilientProvider(OpenAIProvider())
    elif name == "claude":
        if not os.environ.get("ANTHROPIC_API_KEY"):
            return LocalProvider()
        return ResilientProvider(ClaudeProvider())
    elif name == "gemini":
        if not os.environ.get("GEMINI_API_KEY"):
            return LocalProvider()
        return ResilientProvider(GeminiProvider())
    else:
        return LocalProvider()
