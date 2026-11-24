import { localCopyFate } from "./localCopyRules";

// A local copy kept for its owner after the server ended their session with
// changes still waiting to upload (sync-safety slice 4, B-290). The copy
// stays closed behind sign-in: the same person's next sign-in reopens it and
// uploads (`open` in lib/sync/client.ts clears the mark), anyone else's wipes
// it first, and past `KEPT_COPY_LIMIT_MS` the next app start wipes it
// (`expireKeptCopy`, from the /app session check and the sign-in page).

const KEPT_KEY = "caretook:sync-kept";

/** Whether a kept copy is on the device, and since when (ms; NaN if unreadable). */
export const readKept = (): number | null => {
  try {
    const raw = localStorage.getItem(KEPT_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
};

/** Mark the local copy as kept now; `null` removes the mark. */
export const writeKept = (at: number | null) => {
  try {
    if (at === null) localStorage.removeItem(KEPT_KEY);
    else localStorage.setItem(KEPT_KEY, String(at));
  } catch {
    // Without storage no copy is ever kept (the session's end wipes it).
  }
};

/**
 * Wipe a kept copy that has waited past its limit (the whole device, as
 * sign-out does). Resolves whether it wiped. Nothing kept: nothing to do.
 */
export const expireKeptCopy = async (now: number = Date.now()): Promise<boolean> => {
  const keptAt = readKept();
  if (keptAt === null) return false;
  if (localCopyFate({ reason: "keptCopy", waiting: 0, keptAt, now }) === "keep") return false;
  // Loaded only when needed: the sign-in page calls this.
  const { wipeDevice } = await import("./session");
  await wipeDevice();
  writeKept(null);
  return true;
};
