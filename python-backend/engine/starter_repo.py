"""
Starter Repo Generator — Generates a starter codebase blueprint
including README, folder structure, and docker-compose.yml.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider


async def generate_starter_repo(
    product: dict[str, Any],
    architecture: dict[str, Any],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Generate a complete starter repo blueprint for a product.

    Returns:
      - readme_content: Full README.md content
      - folder_structure: List of files/directories to create
      - docker_compose_yaml: docker-compose.yml content
      - env_example: .env.example content
    """
    if provider is None:
        provider = get_provider()

    product_name = product.get("name", "my-product")
    tech_stack = architecture.get("tech_stack", ["Python", "FastAPI", "Docker"])
    components = architecture.get("components", [])
    deployment = architecture.get("deployment", "docker-compose")

    # Generate README
    readme = await _generate_readme(product, architecture, provider)

    # Generate folder structure
    folder_structure = _generate_folder_structure(product_name, components, tech_stack)

    # Generate main.py
    main_py_content = _generate_main_py(product_name, components, tech_stack)

    # Generate .env.example
    env_example = _generate_env_example(product_name, components)

    return {
        "readme_content": readme,
        "folder_structure": folder_structure,
        "docker_compose_yaml": main_py_content, # Reusing the field name for compatibility
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

    readme = f"""# {name}

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
# Clone the repository
git clone https://github.com/your-org/{name.lower().replace(' ', '-')}.git
cd {name.lower().replace(' ', '-')}

# Copy environment variables
cp .env.example .env

# Start services
docker-compose up -d

# Access the application
# API: http://localhost:8000
# Dashboard: http://localhost:3000
```

### Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8000
```

## Deployment

This project uses **{deployment}** for deployment.

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## License

MIT License
"""
    return readme


def _generate_folder_structure(
    product_name: str,
    components: list[dict[str, Any]],
    tech_stack: list[str],
) -> list[str]:
    """Generate the folder structure for an MCP skill starter repo."""
    base = product_name.lower().replace(" ", "-")

    folders = [
        f"{base}/",
        f"{base}/SKILL.md",
        f"{base}/main.py",
        f"{base}/requirements.txt",
        f"{base}/.env.example",
    ]

    # Add component-specific files based on capabilities
    for comp in components:
        comp_name = comp.get("name", "").lower().replace(" ", "_")
        folders.extend([
            f"{base}/src/{comp_name}.py",
        ])

    return folders


def _generate_main_py(
    product_name: str,
    components: list[dict[str, Any]],
    tech_stack: list[str],
) -> str:
    """Generate main.py content for the MCP skill."""
    
    imports = "import os\nfrom typing import Any, Dict\n\n"
    
    main_func = f'def run_skill(input_data: Dict[str, Any]) -> Dict[str, Any]:\n    """Execute the {product_name} skill."""\n    print("Executing skill...")\n    return {{"status": "success", "message": "Skill executed"}}\n\n'
    
    entry_point = 'if __name__ == "__main__":\n    import sys\n    import json\n    \n    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}\n    result = run_skill(input_data)\n    print(json.dumps(result))\n'
    
    return imports + main_func + entry_point


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
