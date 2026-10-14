#!/usr/bin/env bash
# Review each open PR against the established app CI and research checks.
# Usage: gh auth login && bash scripts/review_and_merge_prs.sh
set -euo pipefail
REPO="logeshv586-code/AIproductfactory"
command -v gh >/dev/null || { echo "GitHub CLI (gh) is required"; exit 1; }
command -v jq >/dev/null || { echo "jq is required"; exit 1; }

required=(
  "Next.js lint, typecheck and build"
  "Contract, ownership and recovery regressions"
  "Real isolated API and React acceptance"
  "Hydrated Studio, approval and ZIP ownership"
  "Validate uploaded research scripts"
)

gh pr list --repo "$REPO" --state open --limit 200 \
  --json number,title,mergeable,isDraft | jq -c '.[]' | while IFS= read -r pr; do
  number=$(jq -r '.number' <<<"$pr")
  title=$(jq -r '.title' <<<"$pr")
  mergeable=$(jq -r '.mergeable' <<<"$pr")
  draft=$(jq -r '.isDraft' <<<"$pr")
  echo "Inspecting PR #$number: $title"
  if [[ "$draft" == true || "$mergeable" != MERGEABLE ]]; then
    echo "  Skipping: draft, conflict, or mergeability unknown"
    continue
  fi

  checks=$(gh pr checks "$number" --repo "$REPO" --json name,state 2>/dev/null || printf '[]')
  green=true
  for check_name in "${required[@]}"; do
    if ! jq -e --arg name "$check_name" \
      'any(.[]; .name == $name and .state == "SUCCESS")' <<<"$checks" >/dev/null; then
      green=false
      echo "  Missing or failing check: $check_name"
    fi
  done
  if [[ "$green" != true ]]; then
    echo "  Skipping: not fully tested"
    continue
  fi
  approval=$(gh pr view "$number" --repo "$REPO" --json reviewDecision --jq '.reviewDecision')
  if [[ "$approval" != APPROVED ]]; then
    echo "  Skipping: independent human approval needed"
    continue
  fi
  head=$(gh pr view "$number" --repo "$REPO" --json headRefOid --jq '.headRefOid')
  gh pr merge "$number" --repo "$REPO" --squash --match-head-commit "$head" --delete-branch
done
