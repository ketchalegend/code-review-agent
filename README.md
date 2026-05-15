# Autonomous code review (duet-agent)

Runs **[duet-agent](https://github.com/dzhng/duet-agent)** (`TurnRunner` + PGlite observational memory) on pull requests, optionally routed through **[DeepSeek via OpenRouter](https://openrouter.ai)**.

**Intent and architecture choices** (what we decided and what we’re optimizing for) live in **[docs/decisions-and-goals.md](./docs/decisions-and-goals.md)**.

## Location

Project root: **`/Users/emmanuelketcha/duet-code-review-agent`**

## Quick local try

```bash
cd ~/duet-code-review-agent
npm install
export OPENROUTER_API_KEY=sk-or-...
export REVIEW_MODEL=openrouter:deepseek/deepseek-chat   # optional
bash scripts/prepare-review-context.sh    # from a git repo with commits
npm run review
cat .review-context/REVIEW.md
```

## GitHub Actions

1. Push this repository (or copy `.github/workflows`, `scripts/`, `src/`, `package.json`, etc. into your app repo root).
2. Add repo secret **`OPENROUTER_API_KEY`** (or configure another provider supported by duet-agent).
3. Optional: set repo variable **`REVIEW_MODEL`** (defaults to `openrouter:deepseek/deepseek-chat` in `src/run-review.ts`).
4. Open a PR — the workflow prepares `.review-context/review-brief.md`, runs the agent, then posts or updates one PR comment.

### Memory across runs

`.duet-ci/` holds PGlite **`memory.db`** plus **`turn-state.json`**. The workflow caches `.duet-ci` keyed by **`${{ github.repository }}`** and **`${{ github.base_ref }}`** so recall improves over time on the same default branch line.

### Embedding inside another repository

If this folder lives under `tools/duet-code-review-agent/` in a monorepo:

- Set workflow `defaults.run.working-directory` as needed, or prefix paths.
- Point `CONTEXT_PATH` / `REVIEW_OUTPUT_PATH` / `MEMORY_DB_PATH` / `TURN_STATE_PATH` at `${{ github.workspace }}/...` as already shown.
- Ensure `scripts/prepare-review-context.sh` runs from the **application** root so `git diff` covers real product changes.

## Custom reviewer instructions

Edit **`AGENTS.md`** at the repo root (duet-agent loads it automatically for coding agents).
