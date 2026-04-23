# `.agents/` — See++ v2 agent conventions

Entry point for any Claude (or human) picking up work on the v2 branch. These docs codify *how* we work; `docs/v2/README.md` codifies *what* we're building.

## Start here

1. **Before your first commit on a feature**: read `worktree-setup.md`. Set up a sibling worktree + ports + DB name so parallel work doesn't collide.
2. **Before you fan out subagents**: skim `subagent-patterns.md`. It's a decision guide — worktree vs. Agent-tool vs. just-do-it.
3. **Before you move a PR out of draft**: `pr-ready-checklist.md`.

## Index

| File | Purpose |
|---|---|
| `worktree-setup.md` | Create a per-worktree clone with disjoint ports and its own DB |
| `subagent-patterns.md` | When to fan out via Agent tool vs. spawn a worktree vs. stay in-session |
| `pr-ready-checklist.md` | Draft → ready criteria |
| `session-log/` | Scratch space for per-session notes (not tracked as a feature) |

Other docs (golden-trace runbook, visual-regression playbook, scoped personas, etc.) are intentionally absent at P0. They're added when a concrete pain earns them — not speculatively.

## Source of truth

- v2 README + backlog: `docs/v2/README.md`
- Decision history: `docs/v2/adr/`

## House rules

- All v2 work lands on the `v2` branch via feature branches. Cutover to `master` is P7.
- Don't commit secrets. Worktree `.env.local` files are gitignored; confirm before adding anything env-adjacent.
- When you learn a pattern worth keeping, update the relevant doc here rather than a scratch note.
