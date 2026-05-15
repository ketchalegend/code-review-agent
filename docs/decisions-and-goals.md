# Decisions and goals

This document records **what we are building**, **why**, and **which choices were made** so anyone onboarding or extending the reviewer understands intent—not only mechanics.

---

## What we want to achieve

We want an **autonomous code reviewer** that runs in **GitHub** on pull requests (not a single-shot “diff-only bot”). It should:

1. **Understand the codebase** well enough to find **real issues**—bugs, security flaws, incorrect assumptions, breaking API behavior—not generic fluff.
2. **Explore** beyond the immediate patch when useful (read files, run read-only shell commands like search/`git`/`rg`-style workflows via duet’s tools).
3. **Remember context across sessions**: conventions for this repo, recurring pitfalls, past review conclusions—without stuffing everything into one enormous prompt each run.
4. Use **DeepSeek** as the primary reasoning model, exposed through **OpenRouter** (OpenAI-compatible routing).

Success looks like: **high-signal PR comments** that cite evidence, improve over time as memory accrues, and behave like a senior reviewer who has seen the repo before.

---

## What we decided (and did not choose)

### Agent harness + memory: **duet-agent**

We chose **[duet-agent](https://github.com/dzhng/duet-agent)** (`@duetso/agent`) as the runtime because:

- It targets **jobs that outlive a single chat**: durable **`TurnState`**, native **observational memory** (PGlite + hybrid retrieval), and multi-turn agent runs with coding tools.
- That matches an **autonomous reviewer** who may take multiple steps and benefit from **recall** on later PRs.

We **did not** adopt Memori / MemPalace / SimpleMem as separate memory layers for the first version because duet-agent already embeds a production-shaped memory pipeline. Adding a second memory system would duplicate responsibility unless we later split “org-wide knowledge” from “duet session memory” with a clear boundary.

### Model routing: **DeepSeek via OpenRouter**

- Default model string in code: `openrouter:deepseek/deepseek-chat` (override with **`REVIEW_MODEL`**).
- Credential path in CI: **`OPENROUTER_API_KEY`** as a GitHub Actions secret.

Other providers supported by duet-agent remain available if we change keys and model ids.

### CI integration: **GitHub Actions on pull requests**

- Trigger: `pull_request` (opened, synchronize, reopened).
- We **prepare** a markdown brief (diff + metadata) for the agent, **run** the harness, then **post or update** a single PR comment (anchored by an HTML comment marker).
- **Persistence**: `.duet-ci/` (PGlite `memory.db` + serialized `turn-state.json`) is **cached** in Actions keyed by repository and base ref so memory can compound across runs on the same integration branch line.

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
| `src/run-review.ts` | Boots `TurnRunner`, restores optional state, injects review prompt + CI brief, writes updated state |
| `scripts/prepare-review-context.sh` | Builds factual grounding (diff, refs, PR metadata) for each run |
| `.github/workflows/duet-code-review.yml` | Schedules runs, caches memory store, posts PR feedback |
| `AGENTS.md` | Repo-local reviewer tone and priorities (loaded by duet-agent conventions) |

---

## Revision notes

- **2026-05-15**: Initial capture—autonomous reviewer with duet-agent, DeepSeek via OpenRouter, GitHub Actions + cached PGlite memory.
