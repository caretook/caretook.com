// How links open a sheet over the profile (`profile/basics`, a condition's
// sheet, …): with this history state, closing the sheet goes back to where
// it was opened (the profile, or a medication's page for a condition it's
// for); without (a typed URL, a reload), it goes to the profile. Used by the
// profile's sheets and by the medication page, so it lives here rather than
// in a route folder (like PROVIDER_SHEET_STATE).

/** History state on a link that opens a profile sheet (so closing it can go back). */
export const PROFILE_SHEET_STATE = { profileSheet: true } as const;

/** Whether a sheet was opened by one of this app's links. */
export const openedFromProfile = (state: unknown) =>
  typeof state === "object" && state !== null && "profileSheet" in state;
