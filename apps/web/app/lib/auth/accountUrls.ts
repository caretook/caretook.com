import { safeRedirect } from "../core/redirect";
import { searchString } from "../core/urls";

// The signed-out account pages: sign-in (and its two methods), password
// reset and email verification. Like `appUrls`, but for the pages outside
// /app. Pure; unit-tested in web:unit.

/** A password, or one email with a sign-in link and a code (B-96). */
export const SIGN_IN_METHODS = ["password", "email"] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/** The separate link and code options before B-96; older emails still link to them. */
const EMAIL_ALIASES = ["link", "code"];

/** `?with=` on /sign-in; anything unknown is the password form. */
export const parseSignInMethod = (value: string | null | undefined): SignInMethod => {
  if (value && EMAIL_ALIASES.includes(value)) return "email";
  return (SIGN_IN_METHODS as readonly (string | null | undefined)[]).includes(value)
    ? (value as SignInMethod)
    : "password";
};

/** Only a path other than /app's default is carried, to keep links short. */
const nextParam = (to: string | null | undefined) => {
  const next = safeRedirect(to);
  return next === safeRedirect(null) ? undefined : next;
};

export const accountUrls = {
  signIn: (method: SignInMethod = "password", redirectTo?: string | null) =>
    `/sign-in${searchString({ with: method === "password" ? undefined : method, redirectTo: nextParam(redirectTo) })}`,
  /** Where an expired or used magic link lands (Better Auth adds `error=`). */
  magicLinkError: () => "/sign-in?with=email&expired=1",
  resetPassword: () => "/reset-password",
  /** An invite link's page (the token is base64url, so it needs no escaping). */
  invite: (token: string) => `/invite/${encodeURIComponent(token)}`,
  /** A staff access code's page (`/join/CARE-…`): an account and a new care group. */
  join: (code: string) => `/join/${encodeURIComponent(code)}`,
  verifyEmail: (email?: string | null, next?: string | null) =>
    `/verify-email${searchString({ email: email?.trim() || undefined, next: nextParam(next) })}`,
};
