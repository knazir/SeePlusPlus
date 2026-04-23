# Subagent patterns

Claude can parallelize work three ways. Pick the cheapest that fits.

## 1. Stay in-session (no subagent)

Default. Cheapest. Use for sequential work within one feature where each step informs the next.

## 2. Agent tool (in-session fanout)

Use when you have **independent, tightly-scoped subtasks** that don't need each other's output, and you want the results back *in this session*.

Canonical fits:

- Building a component + its test + its story together (three agents in parallel).
- Schema change on the backend → update the frontend's Zod validator → rerun integration tests (three agents, no overlap).
- "Search the codebase three different ways" — three `Explore` agents looking at different angles.

Rules:

- Send multiple Agent calls in **one message** when they're independent; otherwise they serialize.
- Don't delegate understanding. Tell the subagent *what to change*, not "based on your findings, figure it out."
- Be explicit about read-only vs. write. Read-only subagents protect your main context from tool-result bloat.

## 3. Worktree (out-of-session parallelism)

Use when tasks are **long-running, touch overlapping files, or you want them running while you do other things**. See `worktree-setup.md`.

Canonical fits:

- The three P1 spikes (FLIP / recognition / scrub) — each is its own world with its own test cycle.
- P4 viz sub-features (stack / heap / pointers) if they ever contend for the same files.
- P6 auth vs. workspaces vs. shares — three bounded backends.

Cost: each worktree is a full clone + per-directory `npm install` + its own dev stack. Only worth it for work that will take tens of minutes or touch files another agent is also touching.

## Decision matrix

| Situation | Pattern |
|---|---|
| Change one file | In-session |
| Sequential multi-file feature | In-session |
| N independent subtasks, one merge commit | Agent tool |
| Exploring "N ways to search for X" | Agent tool (N Explore agents) |
| Two features on disjoint surface but overlapping files | Worktree per feature |
| Spike with its own throwaway branch | Worktree |
| "I need to run tests while I keep coding" | Worktree |

## Anti-patterns

- **Spawning an Agent to do 30 seconds of in-session work.** The overhead of briefing + returning dominates; just do it.
- **Spawning a worktree for a 5-minute task.** Clone + install + compose-up > 5 min.
- **Letting two Agents touch the same file in parallel.** Merge conflicts you pay for later. Either serialize or split the file first.
