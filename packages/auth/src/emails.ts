import type { AppError } from "@caretook/data";
import type { Queued } from "@caretook/notifications";

import { getDb, isError, userSchema } from "@caretook/data";
import { inBackground, notify } from "@caretook/notifications";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

// Better Auth's email callbacks, sent through @caretook/notifications' outbox.
//
// Every callback queues its email in the background and returns at once:
// awaiting it would make a request for an existing account slower than one
// for an unknown address, which tells a stranger who has an account. The
// screens say the same thing either way (apps/web's sign-in and reset pages).
// Links are built by the templates from APP_URL, never from Better Auth's
// `url` (its origin comes from config too, but the templates own the paths).

/** The outbox keys on a hash, so a raw token is never part of a key. */
const keyFor = (name: string, secret: string) =>
  `${name}:${createHash("sha256").update(secret).digest("base64url")}`;

const logFailure = (name: string) => (queued: Queued | AppError) => {
  if (isError(queued)) console.error(`[auth] couldn't queue ${name}`, queued);
};

/** An app path other than the bare root (Better Auth's default callback). */
const appPath = (value: string | null | undefined) =>
  value && value !== "/" && /^\/(?!\/)/.test(value) ? value : undefined;

/** The `callbackURL` Better Auth put on its own link, if it's an app path. */
const callbackPathOf = (url: string) => {
  try {
    return appPath(new URL(url).searchParams.get("callbackURL"));
  } catch {
    return undefined;
  }
};

type AuthEmailUser = { email: string; name?: string | null };

export const sendVerificationEmail = ({
  user,
  url,
  token,
}: {
  user: AuthEmailUser;
  url: string;
  token: string;
}) => {
  const next = callbackPathOf(url);
  inBackground(() =>
    notify("verifyEmail", {
      to: user.email,
      data: { name: user.name ?? undefined, token, ...(next ? { next } : {}) },
      // The token is a JWT whose `iat` is in whole seconds, so two sends in
      // one second ("Send a new link" right after signing in) share it: key
      // each send on its own, or the outbox drops the second as a repeat.
      idempotencyKey: keyFor("verifyEmail", `${token}:${randomUUID()}`),
    }).then(logFailure("verifyEmail")),
  );
  return Promise.resolve();
};

export const sendResetPassword = ({ user, token }: { user: AuthEmailUser; token: string }) => {
  inBackground(() =>
    notify("resetPassword", {
      to: user.email,
      data: { name: user.name ?? undefined, token },
      idempotencyKey: keyFor("resetPassword", token),
    }).then(logFailure("resetPassword")),
  );
  return Promise.resolve();
};

const accountExists = async (email: string) => {
  const [row] = await getDb()
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(sql`lower(${userSchema.email})`, email.trim().toLowerCase()))
    .limit(1);
  return Boolean(row);
};

/**
 * Better Auth's magic-link plugin calls this for any address (it would
 * create the account on first use; ours has `disableSignUp`). Only an
 * existing account gets an email; the check runs after the response.
 */
export const sendMagicLink = ({ email, url, token }: { email: string; url: string; token: string }) => {
  inBackground(async () => {
    if (!(await accountExists(email))) return;
    const next = callbackPathOf(url);
    logFailure("magicLink")(
      await notify("magicLink", {
        to: email,
        data: { token, ...(next ? { next } : {}) },
        idempotencyKey: keyFor("magicLink", token),
      }),
    );
  });
  return Promise.resolve();
};

/**
 * The email-OTP plugin only calls this for existing accounts (it has
 * `disableSignUp`). Only sign-in codes are sent: the plugin's other uses
 * (reset, email change, verification by code) are turned off in auth.ts.
 */
export const sendVerificationOTP = ({ email, otp, type }: { email: string; otp: string; type: string }) => {
  if (type !== "sign-in") return Promise.resolve();
  inBackground(() =>
    notify("signInCode", {
      to: email,
      data: { code: otp },
      idempotencyKey: keyFor("signInCode", `${email}:${otp}:${Date.now()}`),
    }).then(logFailure("signInCode")),
  );
  return Promise.resolve();
};
