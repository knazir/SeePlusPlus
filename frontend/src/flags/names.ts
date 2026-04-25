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
  /** Shows the v2-cutover banner above the topbar. Defaults true so the
   *  banner shows without admin action at cutover; flip to false in the
   *  admin panel to retire it. */
  BANNER_V2_CUTOVER: 'banner-v2-cutover',
} as const;

export type FlagName = (typeof FLAGS)[keyof typeof FLAGS];
