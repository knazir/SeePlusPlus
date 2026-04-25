// Canonical list of flags that frontend code references. Any call to
// `useFlag()` should use one of these constants — typos become compile
// errors.
//
// The mirror file at backend/src/flags/names.ts lists the flags the
// backend reads. The two files only need to share an entry when a flag
// is read on both sides; flags read by only one half (e.g. the cutover
// banner is client-only) live in just that half's file. Both files use
// kebab-case string values so the on-disk flag name is identical.
//
// Flags that exist only as "admin-created experiments" don't need to live
// here either; put them here only when code reads them.
export const FLAGS = {
  /** Gates the in-product tutor panel + breadcrumb + topbar button. */
  TUTOR_PANEL: 'tutor-panel',
  /** Shows the v2-cutover banner above the topbar. Defaults true so the
   *  banner shows without admin action at cutover; flip to false in the
   *  admin panel to retire it. */
  BANNER_V2_CUTOVER: 'banner-v2-cutover',
} as const;

export type FlagName = (typeof FLAGS)[keyof typeof FLAGS];
