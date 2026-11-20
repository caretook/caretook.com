// The care group a user last opened on this device, so `/app` can go back
// to it. Per device and per user, in localStorage (every access may throw:
// private mode, storage disabled). Sign-out forgets them all.

const PREFIX = "caretook:lastGroup:";

const storageKey = (userId: string) => `${PREFIX}${userId}`;

/** Remember `groupId` as `userId`'s last group on this device (a group route loaded). */
export const rememberGroup = (userId: string, groupId: string) => {
  try {
    localStorage.setItem(storageKey(userId), groupId);
  } catch {
    // Storage unavailable: `/app` falls back to the only group, or the list.
  }
};

/** The group `userId` last opened on this device, if any. */
export const rememberedGroup = (userId: string): string | null => {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
};

/** Forget every remembered group on this device (sign-out). */
export const forgetGroups = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing remembered.
  }
};

/**
 * Where `/app` goes: the remembered group while you're still in it, else
 * your only group, else nowhere (null: show the list, or "no groups yet").
 */
export const resolveHomeGroup = ({
  groups,
  remembered,
}: {
  groups: readonly { id: string }[];
  remembered: string | null;
}): string | null => {
  if (remembered && groups.some((g) => g.id === remembered)) return remembered;
  if (groups.length === 1 && groups[0]) return groups[0].id;
  return null;
};
