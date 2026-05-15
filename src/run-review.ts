/**
 * Autonomous PR reviewer using @duetso/agent (PGlite observational memory).
 *
 * Env:
 * - OPENROUTER_API_KEY (DeepSeek via OpenRouter) or keys per https://github.com/dzhng/duet-agent
 * - REVIEW_MODEL (default: openrouter:deepseek/deepseek-chat)
 * - MEMORY_DB_PATH (default: .duet-ci/memory.db)
 * - TURN_STATE_PATH (optional JSON; restored if present)
 * - CONTEXT_PATH (default: .review-context/review-brief.md)
 * - REVIEW_OUTPUT_PATH (default: .review-context/REVIEW.md)
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  TurnRunner,
  type TurnRunnerConfig,
  type TurnState,
} from "@duetso/agent";

function loadOptionalJson(filePath: string): unknown | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function ensureDirs(...dirs: string[]) {
  for (const d of dirs) {
    mkdirSync(d, { recursive: true });
  }
}

async function main() {
  const cwd = process.cwd();
  const memoryDbPath =
    process.env.MEMORY_DB_PATH ?? path.join(cwd, ".duet-ci", "memory.db");
  const turnStatePath =
    process.env.TURN_STATE_PATH ?? path.join(cwd, ".duet-ci", "turn-state.json");
  const contextPath =
    process.env.CONTEXT_PATH ??
    path.join(cwd, ".review-context", "review-brief.md");
  const outputPath =
    process.env.REVIEW_OUTPUT_PATH ??
    path.join(cwd, ".review-context", "REVIEW.md");

  ensureDirs(path.dirname(memoryDbPath), path.dirname(contextPath));

  const model =
    process.env.REVIEW_MODEL ??
    process.env.DUET_REVIEW_MODEL ??
    "openrouter:deepseek/deepseek-chat";

  const contextBrief = existsSync(contextPath)
    ? readFileSync(contextPath, "utf8")
    : "(No review brief file; rely on repo + git commands.)";

  const savedState = loadOptionalJson(turnStatePath);

  const config: TurnRunnerConfig = {
    model,
    cwd,
    memoryDbPath,
  };

  const runner = new TurnRunner(config);

  runner.subscribe((event) => {
    if (event.type === "step") {
      console.error(`[duet] ${JSON.stringify(event.step)}`);
    }
    if (event.type === "state_machine") {
      console.error(`[relay] state: ${event.currentState}`);
    }
  });

  await runner.start(
    savedState
      ? {
          type: "start",
          mode: "agent",
          state: savedState as TurnState,
        }
      : { type: "start", mode: "agent" },
  );

  const message = [
    "You are an autonomous code reviewer with coding tools (read, bash, edit where permitted).",
    "Goal: produce a high-signal review of the **current PR/commit** with evidence-backed findings.",
    "",
    "## Constraints",
    "- Prefer **real defects**: correctness, security, concurrency, data loss, API breaks, perf cliffs.",
    "- Use **recall_memory** when prior observations about this repo might matter.",
    "- Ground claims in **file paths + short excerpts** or command output (do not invent line numbers).",
    "- If unsure, say what you would verify next.",
    "- Do **not** push commits or modify CI secrets.",
    "",
    "## Deliverable",
    `Write the final review to \`${outputPath}\` using Markdown with sections:`,
    "### Summary",
    "### Blocking issues",
    "### Non-blocking / improvements",
    "### Questions / assumptions",
    "### Suggested checks (commands)",
    "",
    "## Repo context (prepared by CI)",
    contextBrief,
  ].join("\n");

  const terminal = await runner.turn({
    type: "prompt",
    message,
    behavior: "follow_up",
  });

  try {
    writeFileSync(turnStatePath, JSON.stringify(terminal.state, null, 2), "utf8");
  } catch (err) {
    console.error(
      "[warn] Could not serialize TurnState; next run may start cold:",
      err,
    );
  }

  if (terminal.type === "complete" && terminal.error) {
    console.error(`Review runner error: ${terminal.error}`);
    process.exitCode = 1;
  }

  if (!existsSync(outputPath)) {
    console.error(
      `[warn] Expected ${outputPath} — agent did not write the deliverable file.`,
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
