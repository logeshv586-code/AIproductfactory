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

    # Generate docker-compose
    docker_compose = _generate_docker_compose(product_name, components, tech_stack, deployment)

    # Generate .env.example
    env_example = _generate_env_example(product_name, components)

    return {
        "readme_content": readme,
        "folder_structure": folder_structure,
        "docker_compose_yaml": docker_compose,
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
    """Generate the folder structure for the starter repo."""
    base = product_name.lower().replace(" ", "-")

    folders = [
        f"{base}/",
        f"{base}/README.md",
        f"{base}/.env.example",
        f"{base}/.gitignore",
        f"{base}/docker-compose.yml",
        f"{base}/Dockerfile",
        f"{base}/pyproject.toml",
        f"{base}/requirements.txt",
        f"{base}/app/",
        f"{base}/app/__init__.py",
        f"{base}/app/main.py",
        f"{base}/app/config.py",
        f"{base}/app/database.py",
        f"{base}/app/api/",
        f"{base}/app/api/__init__.py",
        f"{base}/app/api/routes.py",
        f"{base}/app/api/middleware.py",
        f"{base}/app/services/",
        f"{base}/app/services/__init__.py",
        f"{base}/app/services/pipeline.py",
        f"{base}/app/services/ai_service.py",
        f"{base}/app/models/",
        f"{base}/app/models/__init__.py",
        f"{base}/app/models/schemas.py",
        f"{base}/app/core/",
        f"{base}/app/core/__init__.py",
        f"{base}/app/core/engine.py",
        f"{base}/app/core/utils.py",
        f"{base}/tests/",
        f"{base}/tests/__init__.py",
        f"{base}/tests/test_api.py",
        f"{base}/tests/test_services.py",
        f"{base}/scripts/",
        f"{base}/scripts/setup.sh",
    ]

    # Add component-specific files
    for comp in components:
        comp_name = comp.get("name", "").lower().replace(" ", "_")
        comp_tech = comp.get("tech", "").lower()

        if comp_tech in ("react", "next.js", "typescript", "javascript"):
            folders.extend([
                f"{base}/frontend/",
                f"{base}/frontend/package.json",
                f"{base}/frontend/src/",
                f"{base}/frontend/src/App.tsx",
                f"{base}/frontend/src/components/",
            ])
        elif comp_tech in ("python", "fastapi"):
            folders.extend([
                f"{base}/app/services/{comp_name}.py",
            ])

    return folders


def _generate_docker_compose(
    product_name: str,
    components: list[dict[str, Any]],
    tech_stack: list[str],
    deployment: str,
) -> str:
    """Generate docker-compose.yml content."""
    name = product_name.lower().replace(" ", "-")

    has_postgres = any("postgres" in t.lower() or "sql" in t.lower() for t in tech_stack)
    has_redis = any("redis" in t.lower() for t in tech_stack)
    has_frontend = any(t in ("React", "Next.js", "TypeScript", "JavaScript") for t in tech_stack)

    compose = f"""version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/{name}
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./app:/app
    depends_on:
      - db
    restart: unless-stopped
"""

    if has_postgres:
        compose += f"""
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: {name}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
"""

    if has_redis:
        compose += """
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
"""

    if has_frontend:
        compose += """
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./frontend/src:/app/src
    depends_on:
      - api
    restart: unless-stopped
"""

    compose += "\nvolumes:\n"
    if has_postgres:
        compose += "  postgres_data:\n"
    if has_redis:
        compose += "  redis_data:\n"

    return compose


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
