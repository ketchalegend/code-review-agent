# Autonomous code review (duet-agent)

Runs **[duet-agent](https://github.com/dzhng/duet-agent)** (`TurnRunner` + PGlite observational memory) on pull requests. **DeepSeek’s official API is supported directly** (`DEEPSEEK_API_KEY`); OpenRouter remains optional.

**Intent and architecture choices** (what we decided and what we’re optimizing for) live in **[docs/decisions-and-goals.md](./docs/decisions-and-goals.md)**.

## Location

Project root: **`/Users/emmanuelketcha/duet-code-review-agent`**

## Quick local try

```bash
cd ~/duet-code-review-agent
npm install
# Official DeepSeek API (default model: deepseek-v4-flash)
export DEEPSEEK_API_KEY=sk-...
# Optional overrides:
# export REVIEW_MODEL=deepseek:deepseek-v4-pro
# export REVIEW_MODEL=openrouter:deepseek/deepseek-v4-flash  # needs OPENROUTER_API_KEY instead
# export MEMORY_MODEL=…   # optional; observational-memory step defaults to same model as REVIEW_MODEL

bash scripts/prepare-review-context.sh    # from a git repo with commits
npm run review
cat .review-context/REVIEW.md
```

## After you push (checklist)

1. **GitHub → Settings → Secrets and variables → Actions**
   - Add **`DEEPSEEK_API_KEY`** (from [DeepSeek platform](https://platform.deepseek.com/)) *or* **`OPENROUTER_API_KEY`** if you route models through OpenRouter.
2. **Variables (optional)** — **`REVIEW_MODEL`**, **`MEMORY_MODEL`**
   - **`REVIEW_MODEL`** — default **`deepseek:deepseek-v4-flash`** (workflow expression also defaults this when the variable is unset).
   - Other examples: **`deepseek:deepseek-v4-pro`**, or **`openrouter:…`** with OpenRouter’s model id string.
   - **`MEMORY_MODEL`** — observational-memory extraction inside duet-agent defaults to **`gpt-5.4-mini`** in upstream; this harness sets memory work to **match `REVIEW_MODEL`** unless you override here (useful if you intentionally want a cheap OpenAI mini for memory only—then supply the matching provider key).
3. **Actions enabled** on the repo (Settings → Actions → General).
4. Open or update a **pull request** — `pull_request` events drive the workflow (not every bare push to `main` unless you add a `push` trigger later).

### Re-run from a PR comment (optional)

In **caller** workflows, add `issue_comment: types: [created]` and gate the reusable job with a phrase check (see **`examples/caller-workflow.yml`**). Anyone who can comment (and isn’t a bot) can post **`/duet-review`** on the PR to run another review. GitHub only evaluates **`issue_comment`** workflows from the **default branch** copy of that YAML—merge the caller workflow before relying on comments. The reusable workflow refuses **fork-head** PRs for this path so secrets never run against untrusted code from `issue_comment` triggers.

### Runs when code lands on `main` (optional)

Add **`push: branches: [main]`** on the **caller** workflow (see **`examples/caller-workflow.yml`**). Each push runs Duet against **`before..after`** from the webhook and publishes the review as a **commit comment** on the new tip (`after`). That requires **`permissions: contents: write`** (already set in the reusable workflow and examples; mirror it in app repos if your workflow overrides permissions).

## Reusable workflow (recommended for other repos)

This repo’s workflow is **`workflow_call`-able**. Each app repo only needs a thin caller workflow.

1. Copy **`examples/caller-workflow.yml`** into your app repo as `.github/workflows/duet-code-review.yml` (or any name).
2. The template pins **`@v1`** on `uses:` (move the tag only when you intentionally ship breaking workflow changes).
3. On the **app repo**, add the same Actions **secrets** / **vars** (`DEEPSEEK_API_KEY`, optional `OPENROUTER_API_KEY`, optional `REVIEW_MODEL`, optional `MEMORY_MODEL`).
4. **`secrets: inherit`** passes caller secrets into the reusable workflow.

Behavior:

- When the workflow runs **inside this repo**, tooling is the checkout root (`.`) — no second clone.
- When it runs from **another repo**, Actions checks out `tooling_repository` @ `tooling_ref` into **`.review-tooling`**, runs `npm ci` there, but **`TurnRunner` uses the app repo root** (`REVIEW_WORKING_DIRECTORY` / `GITHUB_WORKSPACE`) so diffs and file reads target your application.

Optional **`workflow_call` inputs** (override from caller):

```yaml
jobs:
  duet-review:
    uses: ketchalegend/code-review-agent/.github/workflows/duet-code-review.yml@v1
    with:
      tooling_repository: ketchalegend/code-review-agent
      tooling_ref: main
    secrets: inherit
```

If the tooling repo is **private** and `GITHUB_TOKEN` from the caller cannot read it, fork or vendor the workflow (GitHub’s token rules vary); easiest fix is keeping **`code-review-agent` public**.

## GitHub Actions (single-repo / manual copy)

If you are **not** using `workflow_call`, you can still keep everything in one repo: clone this project and use `.github/workflows/duet-code-review.yml` as-is.

### Memory across runs

`.duet-ci/` holds PGlite **`memory.db`** plus **`turn-state.json`**. The workflow caches `.duet-ci` keyed by **`${{ github.repository }}`** and **`${{ github.base_ref }}`** so recall improves over time on the same default branch line.

### Embedding inside another repository

Prefer the **reusable workflow** section above. Older pattern (copying `scripts/` + `package.json` into the monorepo) still works but duplicates updates.

If you vendor files under `tools/code-review-agent/`:

- Point **`workflow_call`** `tooling_repository` / `tooling_ref` at your fork, **or** keep using the published workflow path and second-checkout behavior.

## Custom reviewer instructions

Edit **`AGENTS.md`** at the repo root (duet-agent loads it automatically for coding agents).
