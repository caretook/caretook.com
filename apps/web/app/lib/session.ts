import type { SyncDb } from "./sync";

import { createContext, redirect } from "react-router";
import { accountUrls } from "./accountUrls";
import { authClient } from "./auth-client";
import { forgetGroups } from "./lastGroup";
import { forgetSettings } from "./me";
import { forgetRecentSearches } from "./recentSearches";
import { signInUrl } from "./redirect";
import { askSession, withoutAnswer } from "./sessionRules";
import { closeSync, openSync } from "./sync";

// The signed-in user and their local database, for /app clientLoaders.
//
// The /app layout's middleware calls `requireSession` once per navigation
// and puts the result in `sessionContext`; every /app loader, action and
// middleware below it reads it from there (`context.get(sessionContext)`)
// rather than checking again. Concurrent calls share one in-flight check.

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
};

/** The user's global role: an additional field the client's types don't know about. */
const roleOf = (user: object) => {
  const role = (user as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
};

/**
 * Wipe this device's copy: stop syncing, empty the local database (vacuumed,
 * so no freed page keeps a deleted row) and drop its search index, and forget the cached user, settings (pending changes too),
 * last group and recent searches. Sign-out, and a session the server says
 * has ended, both go through here. Changes not uploaded yet are lost.
 */
export const wipeDevice = async () => {
  await closeSync().catch((e: unknown) => console.error("Couldn't clear local data", e));
  forgetSessionUser();
  forgetSettings();
  forgetGroups();
  forgetRecentSearches();
};

type Resolved = SessionUser | "signedOut" | "offlineTooLong" | "rateLimited" | "unverified";

/** One get-session request, with the retry-after header of a 429. */
const getSession = async () => {
  let retryAfter: string | null = null;
  const answer = await authClient.getSession({
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
 * session, the device's copy is wiped.
 */
const resolveUser = async (): Promise<Resolved> => {
  const answer = await askSession(getSession);
  if (answer.kind === "ok") {
    const { user } = answer.data;
    // Better Auth doesn't sign in an unconfirmed address; this guards the rest.
    if (!user.emailVerified) return "unverified";
    confirmNow(user.id);
    return { id: user.id, name: user.name, email: user.email, image: user.image ?? null, role: roleOf(user) };
  }
  if (answer.kind === "signedOut") {
    if (cachedUser()) await wipeDevice();
    return "signedOut";
  }
  const cached = cachedUser();
  return withoutAnswer(answer.kind, cached, cached && lastConfirmed(cached.id), Date.now());
};

let inflight: Promise<Session | Exclude<Resolved, SessionUser>> | null = null;

const check = () =>
  (inflight ??= (async () => {
    const user = await resolveUser();
    if (typeof user === "string") return user;
    cacheUser(user);
    return { user, db: await openSync(user.id) };
  })().finally(() => {
    inflight = null;
  }));

/** The user and their open local database, or a redirect to sign-in. */
export const requireSession = async (request: Request): Promise<Session> => {
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
