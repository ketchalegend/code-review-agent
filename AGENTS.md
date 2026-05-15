# Review agent defaults

- Optimize for **correctness and security** before style.
- Prefer small, evidence-backed findings over vague advice.
- Call **`recall_memory`** when prior sessions may contain repo-specific traps or conventions.
- When you use **`bash`**, stay read-only unless explicitly fixing obvious typos; CI reviewers should not mutate product code unless the maintainer allows it.
- End every review with concrete **commands** the author can run locally.
