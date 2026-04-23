# PR ready-for-review checklist

Draft → ready transition. Every box below must be ticked.

## Code

- [ ] Branch is up-to-date with `v2` (rebased if needed; merge commits discouraged on feature branches).
- [ ] No `TODO` / `FIXME` / `XXX` without an issue link or a `TODO-FOLLOWUP` marker that's resolved in a follow-up PR.
- [ ] No commented-out code.
- [ ] No leftover `console.log`, `dbg!`, `print(...)` past the scope of the change.
- [ ] No `.only` / `.skip` in tests.

## Tests

- [ ] Any new logic in `backend/` has a test (unit or integration) or a written justification for why not.
- [ ] If you touched `backend/src/parse_vg_trace.ts`: golden-trace integration tests still pass end-to-end (once goldens exist; added at P2).
- [ ] If you touched visualization (P3+): visual-regression baselines either unchanged or updated + eyeballed.
- [ ] `npm test` passes locally in every directory whose package.json has a test script.

## Contracts

- [ ] If you changed `POST /api/run` response shape or added a new endpoint: frontend's Zod validator updated in the same PR (or next PR linked).
- [ ] If you touched `SPP-Valgrind`: goldens regenerated (P2+); diff reviewed (semantic changes flagged, cosmetic changes accepted).

## Docs

- [ ] If you added a new top-level directory or changed a major convention: relevant `CLAUDE.md` updated.
- [ ] If you made a load-bearing design decision: ADR file under `docs/v2/adr/` (format: `NNNN-title.md`).
- [ ] Phase retro stub under `docs/v2/retros/P<n>.md` updated if this PR closes a phase.

## CI

- [ ] All CI checks green on the draft. (Not "hopefully green after one more push.")
- [ ] If any visual / E2E test is flaky-quarantined as part of this PR, the quarantine is linked to a ticket.

## Review

- [ ] PR description: *why* (link to plan / issue / design-spec), *what* (bullet list of user-visible changes), *how to test* (commands + expected output or screenshots).
- [ ] Screenshots for any pixel-visible change.
- [ ] Request review.

## Merge

Once approved:

- [ ] **Squash merge** into `v2`. Preserve a single PR-title commit, not the individual feature commits.
- [ ] Delete the remote branch after merge (GitHub auto-prompts).
- [ ] If this PR closes a phase, tag: `git tag v2-P<n>-done` and push.
