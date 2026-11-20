// The tile cache (timeline-ux, B-166): the last answer of each header
// tile's live query, held in memory for the session, so a tile mounted again
// (Back to the timeline) paints at once instead of popping in when its query
// answers. Keyed by user, group and a name the caller picks (not the SQL: a
// query whose params follow the clock is still the same tile). Memory only,
// never `localStorage` (it holds health data), and `closeSync` clears it
// with the rest of the device's state at sign-out.

/** Which tile's answer: the group it's for and the caller's name for the query. */
export type RememberKey = { groupId: string; name: string };

const store = new Map<string, unknown>();

const storeKey = (userId: string, { groupId, name }: RememberKey) => JSON.stringify([userId, groupId, name]);

/** Keep `value` as the last answer for this user's tile. */
export const remember = (userId: string, key: RememberKey, value: unknown) => {
  store.set(storeKey(userId, key), value);
};

/** The last answer remembered for this user's tile, if any this session. */
export const recall = <T>(userId: string, key: RememberKey): T | undefined =>
  store.get(storeKey(userId, key)) as T | undefined;

/** Forget every answer (sign-out, or another user's database opening). */
export const clearRemembered = () => {
  store.clear();
};
