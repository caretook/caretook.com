// How links open the New care group sheet: with this history state, closing
// it goes back to where it was opened; without (a typed URL, a reload), it
// goes to /app.

export const NEW_GROUP_LINK_STATE = { newGroupFromApp: true } as const;

export const openedFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "newGroupFromApp" in state;
