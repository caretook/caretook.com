// What a session check's answer means, and how long a device may carry on
// offline without one (security review S-2). Pure; unit-tested.

/** A device offline this long since its last confirmed session check goes to sign-in. */
export const OFFLINE_LIMIT_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Whether the cached user may carry on offline: only within `OFFLINE_LIMIT_MS`
 * of the last session check the server confirmed (the edge included). No
 * record (never confirmed on this device, or storage unavailable) means no.
 * A clock that moved back counts as no time passed.
 */
export const offlineAllowed = (lastConfirmed: number | null, now: number): boolean =>
  lastConfirmed !== null && Number.isFinite(lastConfirmed) && now - lastConfirmed <= OFFLINE_LIMIT_MS;

/** `authClient.getSession()`'s answer, as far as these rules need it. */
export type SessionAnswer<T> = { data: T | null; error: { status?: number } | null };

/**
 * - `ok`: the server confirmed a session.
 * - `signedOut`: the server said there's none (no session, or 401/403): a
 *   definite answer, so the device's copy goes.
 * - `unknown`: no answer to go on (offline, a 429 rate limit, a server
 *   error): the cached user carries on, within the offline limit.
 */
export type SessionOutcome<T> = { kind: "ok"; data: T } | { kind: "signedOut" } | { kind: "unknown" };

export const sessionOutcome = <T>({ data, error }: SessionAnswer<T>): SessionOutcome<T> => {
  if (data) return { kind: "ok", data };
  if (!error) return { kind: "signedOut" };
  return error.status === 401 || error.status === 403 ? { kind: "signedOut" } : { kind: "unknown" };
};
