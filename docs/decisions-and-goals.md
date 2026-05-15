# Decisions and goals

This document records **what we are building**, **why**, and **which choices were made** so anyone onboarding or extending the reviewer understands intent—not only mechanics.

---

## What we want to achieve

We want an **autonomous code reviewer** that runs in **GitHub** on pull requests (not a single-shot “diff-only bot”). It should:

1. **Understand the codebase** well enough to find **real issues**—bugs, security flaws, incorrect assumptions, breaking API behavior—not generic fluff.
2. **Explore** beyond the immediate patch when useful (read files, run read-only shell commands like search/`git`/`rg`-style workflows via duet’s tools).
3. **Remember context across sessions**: conventions for this repo, recurring pitfalls, past review conclusions—without stuffing everything into one enormous prompt each run.
4. Use **DeepSeek** as the primary reasoning model via the **official DeepSeek API** (`DEEPSEEK_API_KEY`); **OpenRouter** remains optional.

Success looks like: **high-signal PR comments** that cite evidence, improve over time as memory accrues, and behave like a senior reviewer who has seen the repo before.

---

## What we decided (and did not choose)

### Agent harness + memory: **duet-agent**

We chose **[duet-agent](https://github.com/dzhng/duet-agent)** (`@duetso/agent`) as the runtime because:

- It targets **jobs that outlive a single chat**: durable **`TurnState`**, native **observational memory** (PGlite + hybrid retrieval), and multi-turn agent runs with coding tools.
- That matches an **autonomous reviewer** who may take multiple steps and benefit from **recall** on later PRs.

We **did not** adopt Memori / MemPalace / SimpleMem as separate memory layers for the first version because duet-agent already embeds a production-shaped memory pipeline. Adding a second memory system would duplicate responsibility unless we later split “org-wide knowledge” from “duet session memory” with a clear boundary.

### Model routing: **DeepSeek API directly** (default) or OpenRouter

The harness uses **`@earendil-works/pi-ai`**, which treats **DeepSeek as a first-class provider**:

- Set **`DEEPSEEK_API_KEY`** — requests go to **`https://api.deepseek.com`** (no extra base URL needed).
- Default review model in this repo: **`deepseek:deepseek-v4-flash`** (override with **`REVIEW_MODEL`**).

**OpenRouter** remains supported for aggregation / failover: set **`OPENROUTER_API_KEY`** and a model id such as **`openrouter:deepseek/deepseek-v4-flash`** (exact ids depend on OpenRouter’s catalog).

### Observational memory step uses the same provider by default

duet-agent’s observational PGlite pipeline runs **structured extraction** after agent turns. Upstream defaults that step to **`gpt-5.4-mini`** (OpenAI credentials). For **DeepSeek-only** setups we set **`TurnRunnerConfig.memoryModel`** in **`run-review.ts`** to **`REVIEW_MODEL`** unless **`MEMORY_MODEL`** / **`DUET_MEMORY_MODEL`** is set, so CI does not need a separate OpenAI key. Override **`MEMORY_MODEL`** only when you deliberately want a different model for memory (and configure that provider’s credentials).

### CI integration: **GitHub Actions** + **reusable workflow**

- Trigger: `pull_request` (opened, synchronize, reopened) on the repo that **executes** the job (this repo directly, or an app repo via a caller workflow); optional **`issue_comment`** re-run via **`/duet-review`** in the caller (see README).
- The workflow here supports **`workflow_call`**. Other repos use **`examples/caller-workflow.yml`** with `secrets: inherit` (see README).
- **App repos**: second checkout clones `code-review-agent` into **`.review-tooling`** for `npm ci`; **`TurnRunner` `cwd`** is the **caller** workspace (`REVIEW_WORKING_DIRECTORY` / `GITHUB_WORKSPACE`) so diffs and tools see application code.
- **This repo**: no second checkout when `github.repository` equals the tooling repository; tooling root is **`.`**.
- **Persistence**: `.duet-ci/` is **cached per caller `github.repository` + `github.base_ref`**, so each app keeps its own memory lane.
- We **prepare** a markdown brief, **run** the harness, then **post or update** one PR comment (HTML marker for idempotency).

### Deliverable format

The agent is instructed to write **`.review-context/REVIEW.md`** with structured sections (summary, blocking issues, non-blocking, questions, suggested commands). The workflow publishes that file as the PR comment body.

---

## Explicit non-goals (for now)

- **Replacing** human review or mandatory security/compliance sign-off.
- **Automatically merging** or pushing fixes unless product owners later add a separate, guarded workflow.
- **Guaranteed** exhaustiveness: the agent is bounded by time, context, and tooling; static analyzers and tests remain complementary.

---

## How this repo maps to those goals

| Piece | Purpose |
|-------|---------|
| `src/run-review.ts` | Boots `TurnRunner` (`model` + aligned `memoryModel`), restores optional state, injects review prompt + CI brief, writes updated state |
| `scripts/prepare-review-context.sh` | Builds factual grounding (diff, refs, PR metadata) for each run |
| `.github/workflows/duet-code-review.yml` | `pull_request` + `workflow_call`: caches memory, runs reviewer, posts PR comment |
| `examples/caller-workflow.yml` | Copy into app repos to invoke the reusable workflow |
| `AGENTS.md` | Repo-local reviewer tone and priorities (loaded by duet-agent conventions) |

---

## Revision notes

- **2026-05-15**: Initial capture—autonomous reviewer with duet-agent, DeepSeek via OpenRouter, GitHub Actions + cached PGlite memory.
- **2026-05-15**: Documented **DeepSeek official API** (`DEEPSEEK_API_KEY`) as the default path; OpenRouter optional.
- **2026-05-15**: Added **`workflow_call`** reusable workflow + second-checkout tooling pattern for multi-repo use.
- **2026-05-15**: **`memoryModel`** follows **`REVIEW_MODEL`** by default so observational memory does not require OpenAI when using DeepSeek-only CI; optional **`MEMORY_MODEL`** documented.
- **2026-05-15**: Optional **`issue_comment`** path (caller gate **`/duet-review`**) to re-run review; reusable workflow resolves PR SHAs and rejects fork-head PRs for that trigger.
