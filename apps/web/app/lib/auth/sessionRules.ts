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

/** How long any one network answer may hold up a screen (a session check, a settings read). */
export const NETWORK_ANSWER_MS = 3000;

/** A session the server confirmed this recently lets navigation go ahead without waiting. */
export const FRESH_MS = 15 * 60 * 1000;

/** A fresh session is rechecked in the background once its confirmation is older than this. */
export const RECHECK_MS = 60 * 1000;

/**
 * - `fresh`: confirmed within `FRESH_MS` (the edge included): navigation goes
 *   ahead at once, and a background recheck keeps it fresh.
 * - `stale`: confirmed longer ago: navigation waits for a check (under
 *   `NETWORK_ANSWER_MS`); the offline limit still applies to its answer.
 * - `none`: never confirmed on this device, or storage unavailable.
 * A clock that moved back counts as no time passed.
 */
export type SessionFreshness = "fresh" | "stale" | "none";

export const sessionFreshness = (lastConfirmed: number | null, now: number): SessionFreshness => {
  if (lastConfirmed === null || !Number.isFinite(lastConfirmed)) return "none";
  return Math.max(0, now - lastConfirmed) <= FRESH_MS ? "fresh" : "stale";
};

/** Whether a fresh session is due a background recheck: confirmed over `RECHECK_MS` ago (or never). */
export const shouldRecheck = (lastConfirmed: number | null, now: number): boolean =>
  lastConfirmed === null || !Number.isFinite(lastConfirmed) || now - lastConfirmed > RECHECK_MS;

/**
 * `promise`'s answer, or `onTimeout()`'s once `ms` pass without one. A late
 * answer (or failure) is ignored. A failure before then still rejects.
 */
export const withTimeout = <T, U>(promise: Promise<T>, ms: number, onTimeout: () => U): Promise<T | U> =>
  new Promise<T | U>((resolve, reject) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

/** One session request: the answer, and the retry-after header if the server sent one. */
export type SessionAsk<T> = () => Promise<SessionAnswer<T> & { retryAfter?: string | null }>;

/**
 * Ask the server for the session, once more after a 429 (waiting as long as
 * `retryDelay` says). A network failure (fetch's `TypeError`) is `unknown`.
 * The whole exchange, retry included, has `budgetMs` (`NETWORK_ANSWER_MS`):
 * no answer by then is `unknown`, or `rateLimited` after a first 429, and a
 * retry that couldn't finish within the budget isn't made.
 */
export const askSession = async <T>(
  ask: SessionAsk<T>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  budgetMs: number = NETWORK_ANSWER_MS,
  clock: () => number = Date.now,
): Promise<SessionOutcome<T>> => {
  const start = clock();
  let soFar: SessionOutcome<T> = { kind: "unknown" };
  const once = async () => {
    try {
      const answer = await ask();
      return { outcome: sessionOutcome(answer), retryAfter: answer.retryAfter };
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      return { outcome: { kind: "unknown" } as const, retryAfter: null };
    }
  };
  const exchange = async (): Promise<SessionOutcome<T>> => {
    const first = await once();
    soFar = first.outcome;
    if (first.outcome.kind !== "rateLimited") return first.outcome;
    const delay = retryDelay(first.retryAfter);
    if (clock() - start + delay >= budgetMs) return first.outcome;
    await wait(delay);
    return (await once()).outcome;
  };
  return withTimeout(exchange(), budgetMs, () => soFar);
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
