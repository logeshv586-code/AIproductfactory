"""
Skill Engine — Registry and Router for AI capabilities.
"""

import os
import json
from typing import Any, Optional

class SkillEngine:
    def __init__(self, skills_dir: str):
        self.skills_dir = skills_dir
        self.skills = {}
        self._load_skills()

    def _load_skills(self):
        """Load all skills from the skills directory."""
        if not os.path.exists(self.skills_dir):
            return

        for skill_name in os.listdir(self.skills_dir):
            skill_path = os.path.join(self.skills_dir, skill_name, "skill.md")
            if not os.path.exists(skill_path):
                skill_path = os.path.join(self.skills_dir, skill_name, "SKILL.md")
            
            if os.path.exists(skill_path):
                # Simple parsing for now - we could use a proper markdown parser
                with open(skill_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Extract description from frontmatter if possible
                    self.skills[skill_name] = {
                        "name": skill_name,
                        "path": os.path.join(self.skills_dir, skill_name),
                        "content": content
                    }

    def get_skill(self, name: str) -> Optional[dict[str, Any]]:
        return self.skills.get(name)

    def list_skills(self) -> list[str]:
        return list(self.skills.keys())

    def find_best_skill(self, task_description: str) -> Optional[str]:
        """Simple heuristic to find the best skill for a task."""
        # In v2.1 this would use an LLM-based router
        for name, skill in self.skills.items():
            if name.lower() in task_description.lower():
                return name
        return None

# Singleton instance
_engine = None

def get_skill_engine() -> SkillEngine:
    global _engine
    if _engine is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        _engine = SkillEngine(os.path.join(base_dir, "skills"))
    return _engine
