import type { AppError } from "@caretook/data";
import type { Queued } from "@caretook/notifications";

import { getDb, isError, logError, userSchema } from "@caretook/data";
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
  if (isError(queued)) logError("auth: couldn't queue an email", queued, { notification: name });
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

/** Makes a sign-in code for an address and stores it hashed (auth.ts passes it in). */
export type CreateSignInCode = (email: string) => Promise<string>;

/**
 * "Email me a sign-in link" (B-96): one email with the magic link and a
 * 6-digit code. Better Auth's magic-link plugin calls this for any address
 * (it would create the account on first use; ours has `disableSignUp`). Only
 * an existing account gets a code and an email; the check runs after the
 * response. The code is the email-OTP plugin's own (`createSignInCode`, its
 * server-only `createVerificationOTP`), so `signIn.emailOtp` checks it.
 */
export const sendSignInEmail = (
  { email, url, token }: { email: string; url: string; token: string },
  createSignInCode: CreateSignInCode,
) => {
  inBackground(async () => {
    if (!(await accountExists(email))) return;
    const code = await createSignInCode(email).catch((error: unknown) => {
      logError("auth: couldn't create a sign-in code", error, { notification: "signInEmail" });
      return undefined;
    });
    if (!code) return;
    const next = callbackPathOf(url);
    logFailure("signInEmail")(
      await notify("signInEmail", {
        to: email,
        data: { token, code, ...(next ? { next } : {}) },
        idempotencyKey: keyFor("signInEmail", token),
      }),
    );
  });
  return Promise.resolve();
};

/**
 * The email-OTP plugin requires a sender, but nothing sends a code on its
 * own: its send endpoint is off (auth.ts), and sign-in codes go out with the
 * link in `sendSignInEmail`.
 */
export const sendVerificationOTP = () => Promise.resolve();

/**
 * An access code's sign-up (/join/:code) with an address that already has an
 * account: nothing is created, the page says "check your email" as it does
 * for a new address, and the account's owner gets this. Queued in the
 * background like the other auth emails, so the answer takes no longer.
 * Keyed on the address, the code and the day, so repeats send one email.
 */
export const sendAccessCodeExistingAccount = (email: string, code: string) => {
  const day = new Date().toISOString().slice(0, 10);
  inBackground(() =>
    notify("accessCodeExistingAccount", {
      to: email,
      data: {},
      idempotencyKey: keyFor("accessCodeExistingAccount", `${email}:${code}:${day}`),
    }).then(logFailure("accessCodeExistingAccount")),
  );
};
