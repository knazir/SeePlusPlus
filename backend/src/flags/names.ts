// Canonical list of flags that backend code references. Any call to
// `isEnabled()` should use one of these constants — typos become compile
// errors, renames become find-replace in two files (here + the frontend
// mirror at frontend/src/flags/names.ts).
//
// Flags that exist only as "admin-created experiments" don't need to live
// here; put them here only when code reads them.
//
// Keep the values kebab-case and in sync with
// frontend/src/flags/names.ts.
export const FLAGS = {
    /** Gates the in-product tutor panel + breadcrumb + topbar button. */
    TUTOR_PANEL: "tutor-panel",
} as const;

export type FlagName = (typeof FLAGS)[keyof typeof FLAGS];
