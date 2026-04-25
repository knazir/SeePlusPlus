// Canonical list of flags that frontend code references. Any call to
// `useFlag()` should use one of these constants — typos become compile
// errors, renames become find-replace in two files (here + the backend
// mirror at backend/src/flags/names.ts).
//
// Flags that exist only as "admin-created experiments" don't need to live
// here; put them here only when code reads them.
//
// Keep the values kebab-case and in sync with backend/src/flags/names.ts.
export const FLAGS = {
  /** Gates the in-product tutor panel + breadcrumb + topbar button. */
  TUTOR_PANEL: 'tutor-panel',
  /** Selects ELK as the heap layout engine instead of dagre. */
  LAYOUT_ENGINE_ELK: 'layout-engine-elk',
} as const;

export type FlagName = (typeof FLAGS)[keyof typeof FLAGS];
