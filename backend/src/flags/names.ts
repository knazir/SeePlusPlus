// Canonical list of flags that backend code references. Any call to
// `isEnabled()` should use one of these constants — typos become compile
// errors.
//
// The mirror file at frontend/src/flags/names.ts lists the flags the
// frontend reads. The two files only need to share an entry when a flag
// is read on both sides; flags read by only one half (e.g. the cutover
// banner is client-only) live in just that half's file. Both files use
// kebab-case string values so the on-disk flag name is identical.
//
// Flags that exist only as "admin-created experiments" don't need to live
// here either; put them here only when code reads them.
export const FLAGS = {
    /** Gates the in-product tutor panel + breadcrumb + topbar button. */
    TUTOR_PANEL: "tutor-panel",
} as const;

export type FlagName = (typeof FLAGS)[keyof typeof FLAGS];
