import type { SyncDb } from "../sync";

import { createContext, redirect } from "react-router";
import { accountUrls } from "./accountUrls";
import { authClient } from "./auth-client";
import { forgetUserData } from "./forgetUserData";
import { expireKeptCopy } from "./keptCopy";
import { localCopyFate } from "./localCopyRules";
import { finishPendingSignOut, rememberSessionId, signOutPending } from "./pendingSignOut";
import { signInUrl } from "../core/redirect";
import { sessionEpoch } from "./sessionEpoch";
import { askSession, sessionFreshness, shouldRecheck, withoutAnswer } from "./sessionRules";
import { closeSync, countWaiting, openSync } from "../sync";

// The signed-in user and their local database, for /app clientLoaders.
//
// The /app layout's middleware calls `requireSession` once per navigation
// and puts the result in `sessionContext`; every /app loader, action and
// middleware below it reads it from there (`context.get(sessionContext)`)
// rather than checking again. Concurrent calls share one in-flight check.
//
// A session the server confirmed within 15 minutes (`sessionFreshness`) is
// fresh: navigation goes ahead with it at once, and a background recheck
// (once its confirmation is a minute old, `shouldRecheck`) keeps it fresh or
// ends it. The fresh path needs a session this page has already checked, so
// the first navigation of every page load, and the first after a sign-in
// (`sessionChanged` in `sessionEpoch.ts`), always waits for the server (at most
// `NETWORK_ANSWER_MS`, through `askSession`).

/**
 * `image` and `role` are optional: users cached before they were added have
 * none. `role` is the global role (admin, support, member), for the account
 * menu's Admin item only; the server checks it again on every staff request.
 */
export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  role?: string | null;
};

const SESSION_KEY = "caretook:session-user";

/** The session this page last checked, for the fresh path. */
let known: (Session & { epoch: number }) | null = null;

/** The last signed-in user, so the app still opens when the device is offline. */
const cachedUser = (): SessionUser | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
};

const cacheUser = (user: SessionUser) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // Storage unavailable: offline starts go to sign-in instead.
  }
};

const CONFIRMED_PREFIX = "caretook:session-confirmed:";

/** When the server last confirmed this user's session on this device (ms), or null. */
const lastConfirmed = (userId: string): number | null => {
  try {
    const raw = localStorage.getItem(CONFIRMED_PREFIX + userId);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
};

const confirmNow = (userId: string) => {
  try {
    localStorage.setItem(CONFIRMED_PREFIX + userId, String(Date.now()));
  } catch {
    // Storage unavailable: offline starts go to sign-in instead.
  }
};

/** Forget the cached user and when their session was last confirmed. */
const forgetSessionUser = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(CONFIRMED_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Nothing cached.
  }
  rememberSessionId(null);
};

/** The user's global role: an additional field the client's types don't know about. */
const roleOf = (user: object) => {
  const role = (user as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
};

/**
 * Wipe this device's copy: stop syncing, empty the local database (vacuumed,
 * so no freed page keeps a deleted row) and drop its search index, and forget
 * the cached user and the forget list (`forgetUserData`). Sign-out, and a
 * session the server says has ended with nothing waiting to upload, both go
 * through here. Changes not uploaded yet are lost.
 */
export const wipeDevice = async () => {
  known = null;
  await closeSync().catch((e: unknown) => console.error("Couldn't clear local data", e));
  forgetSessionUser();
  forgetUserData();
};

/**
 * Keep the local copy for its owner (B-290): close the database without
 * clearing it, keeping its owner and when it was kept, and forget everything
 * else cached (the user, settings, groups, searches) except their unsent
 * settings changes. Nothing shows until someone signs in: the owner's
 * sign-in reopens it and uploads, anyone else's wipes it first.
 */
const keepForOwner = async () => {
  known = null;
  await closeSync({ keep: true }).catch((e: unknown) => console.error("Couldn't close local data", e));
  forgetSessionUser();
  forgetUserData({ keepPending: true });
};

/**
 * The server says this device's session has ended (signed out elsewhere,
 * expired, revoked): with changes waiting to upload the copy is kept for its
 * owner, else wiped (`localCopyFate`). Resolves which.
 */
export const endSession = async (): Promise<"keep" | "wipe"> => {
  const waiting = await countWaiting().catch((e: unknown) => {
    console.error("Couldn't count the changes waiting to upload", e);
    return 0;
  });
  const fate = localCopyFate({ reason: "sessionEnded", waiting }) === "keep" ? "keep" : "wipe";
  await (fate === "keep" ? keepForOwner() : wipeDevice());
  return fate;
};

type Resolved = SessionUser | "signedOut" | "offlineTooLong" | "rateLimited" | "unverified";

/** One get-session request, with the retry-after header of a 429. */
const getSession = async () => {
  let retryAfter: string | null = null;
  const answer = await authClient.getSession({
    // Always the live session, never Better Auth's cookie cache, so a revoked
    // session is noticed at the next check (B-140 turns the cache on for /rpc).
    query: { disableCookieCache: true },
    fetchOptions: {
      onError: ({ response }) => {
        retryAfter = response.headers.get("X-Retry-After") ?? response.headers.get("Retry-After");
      },
    },
  });
  return { ...answer, retryAfter };
};

/**
 * Ask the server (once more after a 429, `askSession`). With no answer to go
 * on (offline, a rate limit, a server error), the last signed-in user carries
 * on with their local data, but only within 3 days of the last confirmed
 * check (`offlineAllowed`); past that, sign-in, with the local copy kept so
 * unsynced changes still upload after. With nobody cached, a rate limit
 * sends sign-in a "try again in a moment" (B-130), anything else plain
 * sign-in. The server still checks the session before accepting any upload,
 * and PowerSync before sending any data. When the server says there's no
 * session, the device's copy is wiped, or kept for its owner when changes
 * wait to upload (`endSession`). A sign-out still owed to the server
 * (`pendingSignOut.ts`) is finished first, and the answer is signed out
 * without asking, unless the cookie holds a newer session than the one
 * being signed out (a magic-link or invite sign-in, B-730): that one is asked
 * about as usual.
 */
const resolveUser = async (): Promise<Resolved> => {
  if (signOutPending()) {
    const finished = await finishPendingSignOut();
    if (finished === "pending" || finished === "signedOut") return "signedOut";
  }
  const answer = await askSession(getSession);
  if (answer.kind === "ok") {
    const { user, session } = answer.data;
    // Better Auth doesn't sign in an unconfirmed address; this guards the rest.
    if (!user.emailVerified) return "unverified";
    confirmNow(user.id);
    // Beside the confirmation: an offline sign-out names this session (B-730).
    rememberSessionId(session.id);
    return { id: user.id, name: user.name, email: user.email, image: user.image ?? null, role: roleOf(user) };
  }
  if (answer.kind === "signedOut") {
    if (cachedUser()) await endSession();
    return "signedOut";
  }
  const cached = cachedUser();
  return withoutAnswer(answer.kind, cached, cached && lastConfirmed(cached.id), Date.now());
};

let inflight: Promise<Session | Exclude<Resolved, SessionUser>> | null = null;

const check = () =>
  (inflight ??= (async () => {
    // Taken before asking, so a sign-in during the request isn't credited to it.
    const epoch = sessionEpoch();
    // A copy kept past its limit goes before anything else (B-290).
    await expireKeptCopy().catch((e: unknown) => console.error("Couldn't expire the kept copy", e));
    const user = await resolveUser();
    if (typeof user === "string") {
      known = null;
      return user;
    }
    cacheUser(user);
    const session = { user, db: await openSync(user.id) };
    known = { ...session, epoch };
    return session;
  })().finally(() => {
    inflight = null;
  }));

/**
 * A background recheck's answer, from wherever the user is now: signed out
 * (the device is wiped or kept already, by `resolveUser`) is a full navigation to
 * sign-in, unverified to verify-email, and someone else's session a reload.
 * A rate limit or no answer does nothing: the next navigation asks again.
 *
 * "Now" is where the navigation that asked (`going`) is headed while it's
 * still loading: the address bar changes only once its loaders are done, and
 * an answer that comes first would send sign-in back to the page the user was
 * leaving (B-869). Once the address has moved on, it's the address.
 */
const recheck = (userId: string, going: string) => {
  const from = window.location.href;
  const here = () => (window.location.href === from ? going : window.location.href);
  check().then(
    (session) => {
      if (session === "signedOut") window.location.assign(signInUrl(new Request(here())));
      else if (session === "unverified") window.location.assign(accountUrls.verifyEmail());
      else if (typeof session !== "string" && session.user.id !== userId) window.location.reload();
    },
    (e: unknown) => console.error("Couldn't recheck the session", e),
  );
};

/** The session at once when it's fresh (rechecking it in the background when due), else null. */
const freshSession = (request: Request): Session | null => {
  if (!known || known.epoch !== sessionEpoch() || cachedUser()?.id !== known.user.id) return null;
  const confirmed = lastConfirmed(known.user.id);
  const now = Date.now();
  if (sessionFreshness(confirmed, now) !== "fresh") return null;
  if (shouldRecheck(confirmed, now)) recheck(known.user.id, request.url);
  return { user: known.user, db: known.db };
};

/** The user and their open local database, or a redirect to sign-in. */
export const requireSession = async (request: Request): Promise<Session> => {
  const fresh = freshSession(request);
  if (fresh) return fresh;
  const session = await check();
  if (session === "unverified") throw redirect(accountUrls.verifyEmail());
  if (session === "offlineTooLong") throw redirect(signInUrl(request, { reason: "offline" }));
  if (session === "rateLimited") throw redirect(signInUrl(request, { reason: "rate-limited" }));
  if (session === "signedOut") throw redirect(signInUrl(request));
  return session;
};

/** What `requireSession` resolves to. */
export type Session = { user: SessionUser; db: SyncDb };

/** The session for everything under /app, set by the /app layout's middleware. */
export const sessionContext = createContext<Session>();
