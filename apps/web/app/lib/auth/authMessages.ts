// What the signed-out account pages say. Every message about an email
// address is the same whether or not it has an account (so a stranger can't
// use these pages to find out who uses Caretook). Pure; unit-tested.

export type AuthError = { status?: number; code?: string; message?: string } | null | undefined;

export const authMessages = {
  wrongPassword: "That email and password don't match an account.",
  signInSent: (email: string) =>
    `Check your email. If ${email} has a Caretook account, we've sent it a sign-in link and a 6-digit code. Tap the link, or type the code here. Both work for 5 minutes.`,
  wrongCode: "That code didn't work. Check it, or send a new one.",
  linkExpired: "That sign-in link has expired or was already used. Send yourself a new one.",
  resetSent: (email: string) =>
    `Check your email. If ${email} has a Caretook account, we've sent it a link to choose a new password. It works once, for an hour.`,
  resetExpired: "This link has expired or was already used. Ask for a new one.",
  passwordChanged:
    "Your password is changed, and you're signed out everywhere else. Sign in with the new one.",
  passwordsDiffer: "The two passwords don't match.",
  passwordTooShort: "Use at least 12 characters.",
  verifySent: (email: string) =>
    `If ${email} still needs confirming, we've sent it a new link. It works for an hour.`,
  verifyExpired: "This link has expired or was already used. Send yourself a new one.",
  tooManyTries: "Too many tries. Wait a minute, then try again.",
  sessionRateLimited: "Too many attempts. Try again in a moment.",
  offlineTooLong: "You've been offline for 3 days. Sign in to keep going.",
  offline: "Couldn't reach Caretook. Check your connection and try again.",
  failed: "Something went wrong. Try again.",
} as const;

/** The message for a failure that isn't about the account itself. */
export const requestFailure = (error: AuthError) => {
  if (!error) return null;
  if (error.status === 429) return authMessages.tooManyTries;
  if (!error.status) return authMessages.offline;
  return null;
};

/**
 * Catches a request that never reached the server: offline, Better Auth's
 * fetch rejects with a TypeError instead of answering. It becomes an answer
 * with no status, which `requestFailure` calls offline (B-314). Anything else
 * still throws. Use as `authClient.….catch(unreached)`.
 */
export const unreached = (e: unknown) => {
  if (!(e instanceof TypeError)) throw e;
  const error: { status: number; statusText: string; code?: string; message?: string } = {
    status: 0,
    statusText: "",
  };
  return { data: null, error };
};

/** Better Auth's answer to a password sign-in for an unverified account. */
export const isUnverified = (error: AuthError) => error?.code === "EMAIL_NOT_VERIFIED";

/** A reset or verification token that's expired, used or made up. */
export const isBadToken = (error: AuthError) =>
  ["INVALID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND"].includes(error?.code ?? "");

export const MIN_PASSWORD_LENGTH = 12;

/** Checks a new password before it's sent; null when it's fine. */
export const newPasswordProblem = (password: string, confirm: string) => {
  if (password.length < MIN_PASSWORD_LENGTH) return authMessages.passwordTooShort;
  if (password !== confirm) return authMessages.passwordsDiffer;
  return null;
};

/** Six digits, ignoring spaces a reader might copy from the email. */
export const normalizeCode = (value: string) => value.replace(/\s+/g, "");
export const isCodeShaped = (value: string) => /^\d{6}$/.test(normalizeCode(value));
