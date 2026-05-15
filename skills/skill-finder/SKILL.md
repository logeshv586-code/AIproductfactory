---
name: skill-finder
description: "Skill Finder. Helps discover and install AI Product Factory Skills. Answers questions like 'what skill can X', 'find a skill'. Trigger phrases: find skill, search skill, discover skill."
author: AI Product Factory
metadata:
  openfactory:
    emoji: 🔍
    requires:
      bins: [factory-cli]
---

# Skill Finder

Helps users discover and install Skills on the AI Product Factory.

## Features

When the user asks:
- "What skill can help me with...?"
- "Find a skill that can do X"
- "Is there a skill for...?"
- "I need a skill to..."

This Skill helps search the registry and recommends relevant Skills.

## Usage

### 1. Search Skills

```bash
factory-cli search "<user need>"
```

### 2. Inspect Details

```bash
factory-cli inspect <skill-name>
```

### 3. Install Skill

```bash
factory-cli install <skill-name>
```

## Workflow

```
1. Understand user needs
2. Extract keywords
3. Search registry
4. List relevant Skills
5. Provide installation advice
```

## Example

**User**: "What skill can help me monitor cryptocurrency prices?"

**Search**: `factory-cli search "crypto price monitor"`

**Return**: List of relevant Skills

---

*Helping users find the Skills they need 🔍*
