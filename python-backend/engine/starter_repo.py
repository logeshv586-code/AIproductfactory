"""
Starter Repo Generator — generates a small runnable starter codebase blueprint
including README, source entrypoint, dependency manifest, Docker assets, and env.
"""

from typing import Any, Optional

from llm.provider import LLMProvider, get_provider


async def generate_starter_repo(
    product: dict[str, Any],
    architecture: dict[str, Any],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """Generate an explicit starter-repository file contract."""
    if provider is None:
        provider = get_provider()

    product_name = product.get("name", "my-product")
    tech_stack = architecture.get("tech_stack", ["Python", "FastAPI", "Docker"])
    components = architecture.get("components", [])

    readme = await _generate_readme(product, architecture, provider)
    folder_structure = _generate_folder_structure(product_name, components, tech_stack)
    main_py_content = _generate_main_py(product_name, components, tech_stack)
    env_example = _generate_env_example(product_name, components)
    docker_compose_yaml = _generate_docker_compose(product_name)
    dockerfile_content = _generate_dockerfile()
    requirements_content = _generate_requirements(tech_stack)

    return {
        "root_dir": product_name.lower().replace(" ", "-"),
        "readme_content": readme,
        "folder_structure": folder_structure,
        "main_py_content": main_py_content,
        "docker_compose_yaml": docker_compose_yaml,
        "dockerfile_content": dockerfile_content,
        "requirements_content": requirements_content,
        "env_example": env_example,
    }


async def _generate_readme(
    product: dict[str, Any],
    architecture: dict[str, Any],
    provider: LLMProvider,
) -> str:
    """Generate a comprehensive README.md for the product."""
    name = product.get("name", "My Product")
    description = product.get("description", "")
    features = product.get("key_features", [])
    tech_stack = architecture.get("tech_stack", [])
    components = architecture.get("components", [])
    data_flows = architecture.get("data_flows", [])
    deployment = architecture.get("deployment", "docker-compose")

    return f"""# {name}

{description}

## Features

{chr(10).join(f'- **{f}**' for f in features)}

## Architecture

### Components

{chr(10).join(f'- **{c.get("name", "")}** ({c.get("tech", "")}): {c.get("role", "")}' for c in components)}

### Data Flows

{chr(10).join(f'- {d.get("from", "")} → {d.get("to", "")}: {d.get("data", "")}' for d in data_flows)}

## Tech Stack

{chr(10).join(f'- {tech}' for tech in tech_stack)}

## Getting Started

```bash
cp .env.example .env
python main.py '{{"hello":"world"}}'
```

Or with Docker:

```bash
docker compose up --build
```

## Deployment

Architecture target: **{deployment}**.

## License

MIT License
"""


def _generate_folder_structure(
    product_name: str,
    components: list[dict[str, Any]],
    tech_stack: list[str],
) -> list[str]:
    """Generate the folder structure for the legacy starter path."""
    base = product_name.lower().replace(" ", "-")
    folders = [
        f"{base}/",
        f"{base}/README.md",
        f"{base}/main.py",
        f"{base}/requirements.txt",
        f"{base}/Dockerfile",
        f"{base}/docker-compose.yml",
        f"{base}/.env.example",
    ]

    for comp in components:
        comp_name = comp.get("name", "").lower().replace(" ", "_")
        if comp_name:
            folders.append(f"{base}/src/{comp_name}.py")

    return folders


def _generate_main_py(
    product_name: str,
    components: list[dict[str, Any]],
    tech_stack: list[str],
) -> str:
    """Generate an executable Python entrypoint."""
    imports = "from typing import Any, Dict\n\n"
    main_func = (
        f'def run_skill(input_data: Dict[str, Any]) -> Dict[str, Any]:\n'
        f'    """Execute the {product_name} starter."""\n'
        '    return {"status": "success", "message": "Skill executed", "input": input_data}\n\n'
    )
    entry_point = (
        'if __name__ == "__main__":\n'
        '    import json\n'
        '    import sys\n\n'
        '    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}\n'
        '    result = run_skill(input_data)\n'
        '    print(json.dumps(result))\n'
    )
    return imports + main_func + entry_point


def _generate_docker_compose(product_name: str) -> str:
    service = product_name.lower().replace(" ", "-") or "app"
    return f"""services:
  {service}:
    build: .
    command: python main.py
    env_file:
      - .env
    environment:
      APP_PORT: ${{APP_PORT:-8000}}
"""


def _generate_dockerfile() -> str:
    return """FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
"""


def _generate_requirements(tech_stack: list[str]) -> str:
    lowered = {str(item).lower() for item in tech_stack}
    requirements: list[str] = []
    if any("fastapi" in item for item in lowered):
        requirements.extend(["fastapi>=0.115,<1", "uvicorn>=0.30,<1"])
    return "\n".join(requirements) + ("\n" if requirements else "")


def _generate_env_example(
    product_name: str,
    components: list[dict[str, Any]],
) -> str:
    """Generate .env.example content."""
    return f"""# {product_name} Environment Variables

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/{product_name.lower().replace(' ', '-')}

# Redis
REDIS_URL=redis://localhost:6379

# LLM Provider (openai | claude | local)
LLM_PROVIDER=local
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# GitHub API
GITHUB_TOKEN=your-github-token

# Application
APP_ENV=development
APP_PORT=8000
APP_SECRET=your-secret-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
"""
