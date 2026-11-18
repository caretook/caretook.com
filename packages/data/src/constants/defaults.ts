import type { AuthUser } from "../permissions/types";

export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

// The actor for internal work (auth callbacks, cron jobs, workers). It is
// not a row in the user table; the nil UUID only fills createdBy/updatedBy.
export const SYSTEM_USER: AuthUser = Object.freeze({
  id: "00000000-0000-0000-0000-000000000000",
  roleNames: Object.freeze(["system"] as const),
});
