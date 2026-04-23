# ADR 0004 — Editor: CodeMirror 6 now; revisit at multi-file

**Date:** 2026-04-23
**Status:** Accepted.

## Context

The frontend shell (v2 backlog #4) needs an in-browser code editor. Candidates considered: **CodeMirror 6**, **Monaco Editor** (VS Code's editor).

Relevant facts:

- See++'s UX is "write a small program, click Run, scrub the visualization." It's a visualizer that happens to have an editor, not an IDE.
- No language-service features (IntelliSense, go-to-definition, hover types) are load-bearing. We have no C++ language server and no plan to run one — trace-based learning is the whole point.
- Our design aesthetic is token-driven (`--color-*`, `--font-mono` in a `@theme` block). The theme must track those tokens so design review remains authoritative.
- Future v2 direction includes multi-file workspaces (backlog #17+), not at v1 launch.
- The bundle cost pressure matters: See++ is a landing-page-style app for students. Cold page load needs to feel snappy.

## Options

### CodeMirror 6 (chosen)

- ~60 KB gzipped for `codemirror` + `@codemirror/lang-cpp` on top of base deps.
- Custom theme drives off CSS variables directly — our existing design tokens work verbatim via `var(--color-…)` in `EditorView.theme({...})`.
- Modular; pay-for-what-you-use. No bundled language-service runtime.
- Syntax highlighting via Lezer; adequate for educational code display.
- Multi-file handling at app layer — one `EditorState` per file, swap on tab change. Requires explicit app-owned "which file is mounted" bookkeeping.

### Monaco

- ~500 KB gzipped incremental cost (core + worker), 3–5× the CM6 footprint.
- **Native multi-file model system** — one `monaco.editor.ITextModel` per file, shared undo scopes, cross-file find, built-in tabs-friendly affordances. Genuine win at N files.
- Theming is token-by-token (~100 categories) and resists being driven by CSS variables — wants concrete colors. Design-token parity = a maintained mapping file.
- Needs Vite worker config, plays poorly with React's `<StrictMode>` double-mount.
- Brings full-file VS Code UX (minimap, command palette, multi-cursor, bracket colorization, hover tooltips). Familiar to VS-Code-using students.

## Decision

**CodeMirror 6 at v1.** The bundle cost differential is large, the language-service features Monaco shines at are orthogonal to our product, and our CSS-variable theming works cleanly only with CM6.

Revisit Monaco when **multi-file workspaces land (backlog #17)**. At that point Monaco's model system starts to pay for its cost: tabs, shared undo, cross-file find. At v1 with one file, it doesn't.

## Swap cost estimate (for when we revisit)

A later swap is a one-afternoon job, fully reversible:

- `EditorPane.tsx` and its deps: rewrite against `@monaco-editor/react`.
- Theme mapping file: `--color-*` → Monaco token categories (~1 hour for design-mock parity).
- Vite worker plugin + loader config: ~30 min.
- `StrictMode` disposal guard or skip StrictMode: ~10 min.
- `<React.lazy>` wrap for bundle split: ~15 min.
- Test adjustment: mock `@monaco-editor/react` in tests (jsdom doesn't render it cleanly): ~15 min.

**Nothing else changes.** `store`, `api/client`, `TopBar`, `VizPane`, `ConsolePane`, layout, design tokens, keybindings all remain. The shell is already editor-agnostic — nothing outside `EditorPane` imports from it.

## Related

`frontend/src/components/EditorPane.tsx` carries a one-line comment pointing at this ADR so the decision is discoverable from the code.
