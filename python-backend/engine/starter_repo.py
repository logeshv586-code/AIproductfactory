"""
Starter Repo Generator — Generates a starter codebase blueprint including
README, folder structure, a Python entrypoint, Docker Compose and env config.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider


async def generate_starter_repo(
    product: dict[str, Any],
    architecture: dict[str, Any],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """Generate a complete starter repo blueprint with explicit content fields."""
    if provider is None:
        provider = get_provider()

    product_name = product.get("name", "my-product")
    tech_stack = architecture.get("tech_stack", ["Python", "FastAPI", "Docker"])
    components = architecture.get("components", [])

    readme = await _generate_readme(product, architecture, provider)
    folder_structure = _generate_folder_structure(product_name, components, tech_stack)
    main_py_content = _generate_main_py(product_name, components, tech_stack)
    compose_yaml = _generate_docker_compose(product_name)
    env_example = _generate_env_example(product_name, components)

    return {
        "readme_content": readme,
        "folder_structure": folder_structure,
        "main_py_content": main_py_content,
        # Deprecated compatibility alias. The legacy engine still reads this
        # key when writing main.py; new code must use main_py_content.
        "docker_compose_yaml": main_py_content,
        "compose_yaml": compose_yaml,
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

### Prerequisites

- Docker and Docker Compose
- Python 3.11+
- Node.js 20+ (if frontend included)

### Quick Start

```bash
git clone https://github.com/your-org/{name.lower().replace(' ', '-')}.git
cd {name.lower().replace(' ', '-')}
cp .env.example .env
docker compose up -d
```

### Development

```bash
pip install -r requirements.txt
python main.py
```

## Deployment

This project uses **{deployment}** for deployment.

## License

MIT License
"""


def _generate_folder_structure(
    product_name: str,
    components: list[dict[str, Any]],
    tech_stack: list[str],
) -> list[str]:
    """Generate the folder structure for a starter repository."""
    base = product_name.lower().replace(" ", "-")
    folders = [
        f"{base}/",
        f"{base}/README.md",
        f"{base}/main.py",
        f"{base}/requirements.txt",
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
    """Generate executable Python content for main.py."""
    imports = "import json\nimport sys\nfrom typing import Any, Dict\n\n"
    main_func = (
        f'def run_skill(input_data: Dict[str, Any]) -> Dict[str, Any]:\n'
        f'    """Execute the {product_name} starter application."""\n'
        '    return {"status": "success", "message": "Starter application executed", "input": input_data}\n\n'
    )
    entry_point = (
        'if __name__ == "__main__":\n'
        '    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}\n'
        '    print(json.dumps(run_skill(input_data)))\n'
    )
    return imports + main_func + entry_point


def _generate_docker_compose(product_name: str) -> str:
    """Generate Docker Compose YAML under the explicit compose_yaml field."""
    service = product_name.lower().replace(" ", "-").replace("_", "-") or "app"
    return f"""services:
  {service}:
    image: python:3.12-slim
    working_dir: /app
    volumes:
      - ./:/app
    command: ["python", "main.py"]
    env_file:
      - .env
"""


def _generate_env_example(
    product_name: str,
    components: list[dict[str, Any]],
) -> str:
    """Generate .env.example content without real secrets."""
    db_name = product_name.lower().replace(" ", "-")
    return f"""# {product_name} Environment Variables

DATABASE_URL=postgresql://user:password@localhost:5432/{db_name}
REDIS_URL=redis://localhost:6379
LLM_PROVIDER=local
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GITHUB_TOKEN=
APP_ENV=development
APP_PORT=8000
APP_SECRET=change-me
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
"""
