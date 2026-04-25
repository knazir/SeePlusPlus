# frontend-legacy/

The original 2018 frontend. React 16 class components, CodeMirror 5,
Konva canvases for the visualization. Reference only.

Lives at `old.seepluspl.us` during the v2 cutover window so users with
bookmarked URLs have a fallback. Will be retired once v2 is settled;
the cutover banner in `frontend/` already points here.

## Don't

- Don't modify unless explicitly asked. New features go in `frontend/`.
- Don't backport bug fixes from `frontend/` here unless the bug is also
  reported on `old.seepluspl.us`. The legacy app is in maintenance,
  not active development.
- Don't update dependencies. The Dependabot PRs that target this
  directory can be closed without merging.
