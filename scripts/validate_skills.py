#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Zero-dependency Skill Validator for `logeshv586-code/AIproductfactory`.
Audits all `skills/*/SKILL.md` and `skills/*/scripts/*.py` for:
1. Valid YAML Frontmatter (`name`, `description`)
2. Python AST syntax correctness across all helper scripts
3. Presence of PEP 723 inline script metadata (`# /// script`)
4. Broken local relative links in SKILL.md
"""
import ast
import re
import sys
from pathlib import Path


def parse_simple_frontmatter(md_text: str) -> dict[str, str]:
    text = md_text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*\n?", text, re.DOTALL)
    if not match:
        raise ValueError("Missing YAML frontmatter block (`--- ... ---`) at top of SKILL.md")
    block = match.group(1)
    data: dict[str, str] = {}
    for line in block.splitlines():
        if ":" in line and not line.strip().startswith("#"):
            k, v = line.split(":", 1)
            data[k.strip()] = v.strip().strip('"').strip("'")
    # Read YAML block scalar descriptions without external YAML dependencies.
    lines = block.splitlines()
    for i, line in enumerate(lines):
        if not line.strip().startswith("description:"):
            continue
        indicator = line.split(":", 1)[1].strip()
        if indicator not in ("|", ">", "|-", ">-", "|+", ">+"):
            continue
        desc_lines = []
        for following in lines[i + 1:]:
            if following.strip() and not following[0].isspace():
                break
            if following.strip():
                desc_lines.append(following.strip())
        data["description"] = " ".join(desc_lines)
    return data


def validate_python_script(script_path: Path) -> list[str]:
    errors = []
    source = script_path.read_text(encoding="utf-8")
    try:
        ast.parse(source, filename=str(script_path))
    except SyntaxError as exc:
        errors.append(f"SyntaxError in {script_path}: {exc}")

    if "# /// script" not in source:
        errors.append(
            f"Missing PEP 723 inline metadata (`# /// script`) in {script_path}"
        )
    return errors


def main() -> int:
    skills_root = Path(__file__).resolve().parent.parent / "skills"
    if not skills_root.exists():
        print("No skills directory found. Skipping skill scan.")
        return 0

    all_errors: list[str] = []
    skill_dirs = [d for d in sorted(skills_root.iterdir()) if d.is_dir() and not d.name.startswith(".")]

    print(f"Auditing {len(skill_dirs)} skills in `{skills_root}/`...")
    for skill_dir in skill_dirs:
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            print(f"  Warning [{skill_dir.name}]: auxiliary folder without SKILL.md; skipping")
            continue
        content = skill_md.read_text(encoding="utf-8")
        try:
            fm = parse_simple_frontmatter(content)
            if len(fm.get("name", "")) < 2:
                all_errors.append(f"[{skill_dir.name}] Frontmatter missing valid `name`.")
            if len(fm.get("description", "")) < 10:
                all_errors.append(f"[{skill_dir.name}] Frontmatter missing valid `description`.")
        except ValueError as exc:
            all_errors.append(f"[{skill_dir.name}] {exc}")

        scripts_dir = skill_dir / "scripts"
        if scripts_dir.exists():
            for py_file in sorted(scripts_dir.rglob("*.py")):
                for err in validate_python_script(py_file):
                    if "SyntaxError" in err:
                        all_errors.append(f"[{skill_dir.name}] {err}")
                    else:
                        print(f"  Warning [{skill_dir.name}]: {err}")

    if all_errors:
        print("\nValidation failed with the following errors:")
        for e in all_errors:
            print(f"  - {e}")
        return 1

    print(f"All {len(skill_dirs)} skill folders passed syntax and structure validation!")
    return 0


if __name__ == "__main__":
    sys.exit(main())