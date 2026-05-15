#!/usr/bin/env bash
set -euo pipefail

# Writes .review-context/review-brief.md for the autonomous reviewer.
OUT_DIR="${OUT_DIR:-.review-context}"
mkdir -p "$OUT_DIR"

{
  echo "## GitHub event"
  echo "- Repository: ${GITHUB_REPOSITORY:-unknown}"
  echo "- Ref: ${GITHUB_REF:-unknown}"
  echo "- SHA: ${GITHUB_SHA:-unknown}"
  echo "- Actor: ${GITHUB_ACTOR:-unknown}"
  echo ""
  if [[ "${GITHUB_EVENT_NAME:-}" == "push" ]] && [[ -n "${BASE_SHA:-}" ]] && [[ -n "${HEAD_SHA:-}" ]]; then
    echo "## Push compare range"
    echo "- Base SHA: ${BASE_SHA}"
    echo "- Head SHA: ${HEAD_SHA}"
    echo ""
  fi
  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    echo "## Pull request"
    echo "- Base ref: ${GITHUB_BASE_REF}"
    echo "- Head ref: ${GITHUB_HEAD_REF:-unknown}"
    echo "- PR number: ${PR_NUMBER:-unknown}"
    echo ""
  fi
  echo "## Diff (truncated if huge)"
  echo '```diff'
  if git rev-parse HEAD^1 >/dev/null 2>&1; then
    git diff HEAD^1..HEAD --stat || true
    echo ""
    git diff HEAD^1..HEAD || true
  elif [[ -n "${BASE_SHA:-}" ]] && [[ -n "${HEAD_SHA:-}" ]]; then
    git fetch --depth=200 origin "${BASE_SHA}" "${HEAD_SHA}" 2>/dev/null || true
    git diff "${BASE_SHA}".."${HEAD_SHA}" --stat || true
    echo ""
    git diff "${BASE_SHA}".."${HEAD_SHA}" || true
  else
    git show --stat --patch HEAD || true
  fi
  echo '```'
  echo ""
  echo "## Changed files"
  if [[ -n "${BASE_SHA:-}" ]] && [[ -n "${HEAD_SHA:-}" ]]; then
    git diff --name-only "${BASE_SHA}".."${HEAD_SHA}" || true
  else
    git diff-tree --no-commit-id --name-only -r HEAD || true
  fi
} > "$OUT_DIR/review-brief.md"

echo "Wrote $OUT_DIR/review-brief.md"
