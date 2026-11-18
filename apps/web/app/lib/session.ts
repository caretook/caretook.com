import type { SyncDb } from "./sync";

import { createContext, redirect } from "react-router";
import { authClient } from "./auth-client";
import { signInUrl } from "./redirect";
import { openSync } from "./sync";

// The signed-in user and their local database, for /app clientLoaders.
//
// The /app layout's middleware calls `requireSession` once per navigation
// and puts the result in `sessionContext`; every /app loader, action and
// middleware below it reads it from there (`context.get(sessionContext)`)
// rather than checking again. Concurrent calls share one in-flight check.

/** `image` is optional: users cached before it was added have none. */
export type SessionUser = { id: string; name: string | null; email: string; image?: string | null };

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

/** Forget the cached user (sign-out). */
export const forgetSessionUser = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing cached.
  }
};

/**
 * Offline (no response at all), the last signed-in user carries on with
 * their local data. The server still checks the session before accepting
 * any upload, and PowerSync before sending any data.
 */
const resolveUser = async (): Promise<SessionUser | null> => {
  try {
    const { data, error } = await authClient.getSession();
    if (data)
      return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image ?? null,
      };
    // An error without a status means the request never reached the server.
    return error && !error.status ? cachedUser() : null;
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    return cachedUser();
  }
};

let inflight: Promise<Session | null> | null = null;

const check = () =>
  (inflight ??= (async () => {
    const user = await resolveUser();
    if (!user) return null;
    cacheUser(user);
    return { user, db: await openSync(user.id) };
  })().finally(() => {
    inflight = null;
  }));

/** The user and their open local database, or a redirect to sign-in. */
export const requireSession = async (request: Request): Promise<Session> => {
  const session = await check();
  if (!session) throw redirect(signInUrl(request));
  return session;
};

/** What `requireSession` resolves to. */
export type Session = { user: SessionUser; db: SyncDb };

/** The session for everything under /app, set by the /app layout's middleware. */
export const sessionContext = createContext<Session>();
