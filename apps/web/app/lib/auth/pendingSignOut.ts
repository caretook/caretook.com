import { authClient } from "./auth-client";
import { NETWORK_ANSWER_MS, sessionOutcome, withTimeout } from "./sessionRules";

// A sign-out the server hasn't heard about yet (sync-safety slice 4, B-290).
// Sign out wipes the device first and then tells the server; offline that
// second step fails, so a marker is left and the app finishes it the next
// time it reaches the server, before any session check (`requireSession`,
// and the sign-in page's loader and action): until then the session cookie
// could still open the app. Light: the sign-in page imports it.
//
// The marker names the session being signed out (B-730): each confirmed
// session check records its id (`rememberSessionId`), and an offline sign-out
// writes it into the marker. A sign-in made meanwhile through a magic link or
// an invite (which never pass the sign-in page's guard) replaces the cookie's
// session, and finishing must not end that newer one.

const PENDING_KEY = "caretook:sign-out-pending";
const SESSION_ID_KEY = "caretook:session-id";

/** Record the id of the session a check just confirmed; `null` forgets it (with the cached user). */
export const rememberSessionId = (id: string | null) => {
  try {
    if (id === null) localStorage.removeItem(SESSION_ID_KEY);
    else localStorage.setItem(SESSION_ID_KEY, id);
  } catch {
    // Storage unavailable: a later pending sign-out names no session.
  }
};

/** The id of the session last confirmed on this device, or null. Read it before the wipe forgets it. */
export const confirmedSessionId = (): string | null => {
  try {
    return localStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
};

/** Whether a sign-out is still owed to the server. */
export const signOutPending = (): boolean => {
  try {
    return localStorage.getItem(PENDING_KEY) !== null;
  } catch {
    return false;
  }
};

/** The session the pending sign-out is for, or null (none on record, or a marker without one). */
const pendingSessionId = (): string | null => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    const session = (parsed as { session?: unknown } | null)?.session;
    return typeof session === "string" && session !== "" ? session : null;
  } catch {
    return null;
  }
};

/** Leave the marker (for `sessionId`, when known); `false` removes it. */
const setPending = (pending: false | { sessionId: string | null }) => {
  try {
    if (pending)
      localStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), session: pending.sessionId }));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage unavailable: nothing to finish later.
  }
};

/**
 * Ask the server to end this device's session. True once the server has
 * answered with anything but a server error (a 4xx means there's no session
 * left to end); false offline or on a 5xx.
 */
const tellServer = async (): Promise<boolean> => {
  try {
    const { error } = await authClient.signOut();
    return !error || (typeof error.status === "number" && error.status >= 400 && error.status < 500);
  } catch {
    // fetch's TypeError: no connection.
    return false;
  }
};

/**
 * Sign-out's server half: tell the server, or leave the marker to finish it
 * later, naming `sessionId` (`confirmedSessionId()`, read before the wipe).
 */
export const signOutOnServer = async (sessionId: string | null): Promise<void> => {
  setPending((await tellServer()) ? false : { sessionId });
};

/** Whose session the cookie holds now: `{ id }` (`null` for none), or `unknown` with no answer. */
const cookieSession = async (): Promise<{ id: string | null } | "unknown"> => {
  const answer = await withTimeout(
    authClient.getSession({ query: { disableCookieCache: true } }).catch(() => null),
    NETWORK_ANSWER_MS,
    () => null,
  );
  if (!answer) return "unknown";
  const outcome = sessionOutcome(answer);
  if (outcome.kind === "ok") return { id: outcome.data.session.id };
  return outcome.kind === "signedOut" ? { id: null } : "unknown";
};

/**
 * What finishing a pending sign-out came to:
 * - `none`: nothing was pending.
 * - `pending`: still owed (the server couldn't be reached): the caller treats
 *   the device as signed out without asking who is signed in.
 * - `signedOut`: the session is ended (or the cookie holds none): signed out.
 * - `kept`: the cookie holds a newer session than the one being signed out
 *   (a magic-link or invite sign-in, B-730): it stays, and the caller asks
 *   the server as usual.
 */
export type PendingSignOut = "none" | "pending" | "signedOut" | "kept";

/**
 * Finish a pending sign-out, if there is one. With the session it's for on
 * record, first asks whose session the cookie holds: the same one is signed
 * out, another is kept, none needs nothing more. A marker naming no session
 * signs out whatever the cookie holds. The marker is cleared once that's
 * settled, never offline.
 */
export const finishPendingSignOut = async (): Promise<PendingSignOut> => {
  if (!signOutPending()) return "none";
  const sessionId = pendingSessionId();
  if (sessionId !== null) {
    const holding = await cookieSession();
    if (holding === "unknown") return "pending";
    if (holding.id !== sessionId) {
      setPending(false);
      return holding.id === null ? "signedOut" : "kept";
    }
  }
  if (!(await tellServer())) return "pending";
  setPending(false);
  return "signedOut";
};
