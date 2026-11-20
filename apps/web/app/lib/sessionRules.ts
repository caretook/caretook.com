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
 * - `rateLimited`: a 429. The server didn't say whether there's a session.
 * - `unknown`: no answer to go on (offline, a server error): the cached user
 *   carries on, within the offline limit.
 */
export type SessionOutcome<T> =
  { kind: "ok"; data: T } | { kind: "signedOut" } | { kind: "rateLimited" } | { kind: "unknown" };

export const sessionOutcome = <T>({ data, error }: SessionAnswer<T>): SessionOutcome<T> => {
  if (data) return { kind: "ok", data };
  if (!error) return { kind: "signedOut" };
  if (error.status === 429) return { kind: "rateLimited" };
  return error.status === 401 || error.status === 403 ? { kind: "signedOut" } : { kind: "unknown" };
};

/** The longest a session check waits before asking again after a 429. */
export const RETRY_CAP_MS = 2000;

/**
 * How long to wait after a 429, from its retry-after header (seconds; Better
 * Auth sends `X-Retry-After`): capped at `RETRY_CAP_MS`, a second without one.
 */
export const retryDelay = (header: string | null | undefined): number => {
  const seconds = header == null || header.trim() === "" ? NaN : Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return 1000;
  return Math.min(seconds * 1000, RETRY_CAP_MS);
};

/** One session request: the answer, and the retry-after header if the server sent one. */
export type SessionAsk<T> = () => Promise<SessionAnswer<T> & { retryAfter?: string | null }>;

/**
 * Ask the server for the session, once more after a 429 (waiting as long as
 * `retryDelay` says). A network failure (fetch's `TypeError`) is `unknown`.
 */
export const askSession = async <T>(
  ask: SessionAsk<T>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<SessionOutcome<T>> => {
  const once = async () => {
    try {
      const answer = await ask();
      return { outcome: sessionOutcome(answer), retryAfter: answer.retryAfter };
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      return { outcome: { kind: "unknown" } as const, retryAfter: null };
    }
  };
  const first = await once();
  if (first.outcome.kind !== "rateLimited") return first.outcome;
  await wait(retryDelay(first.retryAfter));
  return (await once()).outcome;
};

/**
 * With no session from the server (rate-limited or unknown): the cached user
 * carries on within the offline limit, else `offlineTooLong`. With nobody
 * cached, a rate limit is `rateLimited` (sign-in says to try again in a
 * moment, never a silent bounce) and anything else is `signedOut`.
 */
export const withoutAnswer = <U>(
  kind: "rateLimited" | "unknown",
  cached: U | null,
  lastConfirmed: number | null,
  now: number,
): U | "offlineTooLong" | "rateLimited" | "signedOut" => {
  if (cached) return offlineAllowed(lastConfirmed, now) ? cached : "offlineTooLong";
  return kind === "rateLimited" ? "rateLimited" : "signedOut";
};
