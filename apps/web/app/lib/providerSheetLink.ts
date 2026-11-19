// How links open a provider sheet (`providers/new`, `providers/:providerId/edit`):
// with this history state, closing the sheet goes back to where it was opened
// (the directory or the provider page); without (a typed URL, a reload), it
// goes to the directory. Used by the directory, the provider page and the sheets
// themselves, so it lives here rather than in a route folder.

/** History state on a link that opens a provider sheet. */
export const PROVIDER_SHEET_STATE = { sheetOverProviders: true } as const;

/** Whether a provider sheet was opened by a link carrying `PROVIDER_SHEET_STATE`. */
export const openedOverProviders = (state: unknown) =>
  typeof state === "object" && state !== null && "sheetOverProviders" in state;
