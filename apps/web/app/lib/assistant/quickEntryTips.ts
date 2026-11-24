// Quick entry's tips panel: shown on a user's first few real focuses of the
// box, until they close it for good. Per device and user, in localStorage
// (every access may throw: private mode, storage disabled; then the panel
// never shows), and forgotten at sign-out (`forgetUserData`).

const PREFIX = "caretook:quickEntryTips:";
const keyOf = (userId: string) => `${PREFIX}${userId}`;

/** How many real focuses show the panel. */
export const TIPS_FOCUSES = 3;

type Tips = { seen: number; dismissed: boolean };

const parse = (raw: string | null): Tips => {
  if (!raw) return { seen: 0, dismissed: false };
  try {
    const value = JSON.parse(raw) as Partial<Tips> | null;
    const seen = typeof value?.seen === "number" && value.seen >= 0 ? value.seen : 0;
    return { seen, dismissed: value?.dismissed === true };
  } catch {
    return { seen: 0, dismissed: false };
  }
};

/**
 * A real focus of the box: whether the panel shows for it. It counts the
 * focus (up to `TIPS_FOCUSES`) and says no once they're used up, once it was
 * closed, or when storage can't be read or written.
 */
export const takeTipsFocus = (userId: string): boolean => {
  try {
    const tips = parse(localStorage.getItem(keyOf(userId)));
    if (tips.dismissed || tips.seen >= TIPS_FOCUSES) return false;
    localStorage.setItem(keyOf(userId), JSON.stringify({ ...tips, seen: tips.seen + 1 }));
    return true;
  } catch {
    return false;
  }
};

/** The panel's X: never show it again to `userId` on this device. */
export const dismissTips = (userId: string) => {
  try {
    const tips = parse(localStorage.getItem(keyOf(userId)));
    localStorage.setItem(keyOf(userId), JSON.stringify({ ...tips, dismissed: true }));
  } catch {
    // Storage unavailable: the panel never shows anyway.
  }
};

/** Forget every user's tips state on this device (sign-out). */
export const forgetQuickEntryTips = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
};
