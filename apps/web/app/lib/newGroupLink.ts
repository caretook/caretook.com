// How links open the New care group sheet (`/app/groups/new`): with this
// history state, closing it goes back to where it was opened; without (a typed
// URL, a reload), it goes to /app. Used by the group menu, /app home, /join/:code
// and the sheet itself, so it lives here rather than in the sheet's route folder.

/** History state on a link that opens the New care group sheet. */
export const NEW_GROUP_LINK_STATE = { newGroupFromApp: true } as const;

/** Whether the New care group sheet was opened by a link carrying `NEW_GROUP_LINK_STATE`. */
export const openedNewGroupFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "newGroupFromApp" in state;
