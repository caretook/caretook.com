import { safeRedirect } from "./redirect";
import { searchString } from "./appUrls";

// The signed-out account pages: sign-in (and its three methods), password
// reset and email verification. Like `appUrls`, but for the pages outside
// /app. Pure; unit-tested in web:unit.

export const SIGN_IN_METHODS = ["password", "link", "code"] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/** `?with=` on /sign-in; anything unknown is the password form. */
export const parseSignInMethod = (value: string | null | undefined): SignInMethod =>
  (SIGN_IN_METHODS as readonly (string | null | undefined)[]).includes(value)
    ? (value as SignInMethod)
    : "password";

/** Only a path other than /app's default is carried, to keep links short. */
const nextParam = (to: string | null | undefined) => {
  const next = safeRedirect(to);
  return next === safeRedirect(null) ? undefined : next;
};

export const accountUrls = {
  signIn: (method: SignInMethod = "password", redirectTo?: string | null) =>
    `/sign-in${searchString({ with: method === "password" ? undefined : method, redirectTo: nextParam(redirectTo) })}`,
  /** Where an expired or used magic link lands (Better Auth adds `error=`). */
  magicLinkError: () => "/sign-in?with=link&expired=1",
  resetPassword: () => "/reset-password",
  /** An invite link's page (the token is base64url, so it needs no escaping). */
  invite: (token: string) => `/invite/${encodeURIComponent(token)}`,
  verifyEmail: (email?: string | null, next?: string | null) =>
    `/verify-email${searchString({ email: email?.trim() || undefined, next: nextParam(next) })}`,
};
