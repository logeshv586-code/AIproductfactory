---
name: academic-data-search
description: >
  Search and analyze academic data using the AMiner Open Platform API. Use this skill when users need to query scholar information, paper details, institution data, journal content, or patent information.
  Trigger scenarios: AMiner mentions, academic data queries, searching for papers/scholars/institutions/journals/patents, academic QA, citation analysis, research institution analysis, scholar profiles, paper citation chains, journal submission analysis, etc.
  Supports 6 integrated workflows (Scholar Panorama, Paper Deep Dive, Institution Research Analysis, Journal Monitor, Academic QA, Patent Chain Analysis) and 28 independent APIs.
---

# Academic Data Search (AMiner Open Platform)

AMiner is a leading global academic data platform, providing comprehensive data on scholars, papers, institutions, journals, and patents.
This skill covers all 28 open APIs, organized into 6 practical workflows.

- **API Documentation**: https://open.aminer.cn/open/doc
- **Console (Generate Token)**: https://open.aminer.cn/open/board?tab=control

---

## Step 1: Obtain Token

All API calls require an `Authorization: <your_token>` header.

**How to obtain:**
1. Go to the [AMiner Console](https://open.aminer.cn/open/board?tab=control), log in, and generate an API Token.
2. For detailed instructions, refer to the [Open Platform Documentation](https://open.aminer.cn/open/doc).

> Tokens are generated after logging in to the console and remain valid for repeated use within their expiration period.

---

## Quick Start (Python Client)

All workflows can be driven via `scripts/aminer_client.py`:

```bash
# Scholar Panorama Analysis
python scripts/aminer_client.py --token <TOKEN> --action scholar_profile --name "Andrew Ng"

# Paper Deep Dive (including citation chain)
python scripts/aminer_client.py --token <TOKEN> --action paper_deep_dive --title "Attention is all you need"

# Institution Research Analysis
python scripts/aminer_client.py --token <TOKEN> --action org_analysis --org "MIT"

# Journal Paper Monitor (for specific year)
python scripts/aminer_client.py --token <TOKEN> --action venue_papers --venue "Nature" --year 2024

# Academic QA (Natural language query)
python scripts/aminer_client.py --token <TOKEN> --action paper_qa --query "latest progress in transformer architecture"

# Patent Search and Details
python scripts/aminer_client.py --token <TOKEN> --action patent_search --query "quantum computing"
```

---

## Stability and Fallback Strategy

The `scripts/aminer_client.py` client includes built-in retry and fallback strategies for network stability.

- **Timeout & Retries**: 30s timeout, max 3 retries with exponential backoff.
- **Retryable Status Codes**: 408, 429, 500, 502, 503, 504.
- **Workflow Fallbacks**: Automatically downgrades to alternative search APIs if primary search yields no results.

---

## 6 Major Workflows

### 1. Scholar Panorama Analysis
**Scenario**: Get a complete academic profile of a scholar, including bio, research directions, papers, patents, and projects.
**Command**:
```bash
python scripts/aminer_client.py --token <TOKEN> --action scholar_profile --name "Yann LeCun"
```

### 2. Paper Deep Dive
**Scenario**: Get full paper information and its citation relationship based on title or keywords.
**Command**:
```bash
python scripts/aminer_client.py --token <TOKEN> --action paper_deep_dive --title "BERT"
```

### 3. Institution Research Analysis
**Scenario**: Analyze the scholar scale, paper output, and patent count of an institution.
**Command**:
```bash
python scripts/aminer_client.py --token <TOKEN> --action org_analysis --org "MIT"
```

### 4. Journal Paper Monitor
**Scenario**: Track papers in a specific journal for a specific year.
**Command**:
```bash
python scripts/aminer_client.py --token <TOKEN> --action venue_papers --venue "NeurIPS" --year 2023
```

### 5. Academic QA Search
**Scenario**: Intelligent search for papers using natural language or structured keywords.
**Command**:
```bash
python scripts/aminer_client.py --token <TOKEN> --action paper_qa --query "deep learning methods for protein structure prediction"
```

### 6. Patent Chain Analysis
**Scenario**: Search for patents in specific technical fields or get the patent portfolio of a scholar/institution.
**Command**:
```bash
python scripts/aminer_client.py --token <TOKEN> --action patent_search --query "quantum computing chips"
```

---

## Reference Materials

- Full API Catalog: Read `references/api-catalog.md`
- Python Client Source: `scripts/aminer_client.py`
- Official Docs: https://open.aminer.cn/open/doc
