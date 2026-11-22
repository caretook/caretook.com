import { appUrls } from "../app-shell/appUrls";

const probeOrigin = "https://caretook.invalid";

/** Control characters (browsers drop tab, CR and LF from URLs, so `/\t/evil.com` is `//evil.com`) or a backslash. */
const hasUnsafeCharacter = (to: string) => {
  for (let i = 0; i < to.length; i++) {
    const code = to.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
};

/** A same-site path to return to after sign-in; anything else falls back to /app. */
export const safeRedirect = (to: string | null | undefined, fallback = appUrls.home()) => {
  if (!to?.startsWith("/") || to.startsWith("//") || hasUnsafeCharacter(to)) return fallback;
  try {
    return new URL(to, probeOrigin).origin === probeOrigin ? to : fallback;
  } catch {
    return fallback;
  }
};

/** Why sign-in was asked for, when the sign-in page should say so. */
export type SignInReason = "offline" | "rate-limited";

export const signInUrl = (request: Request, { reason }: { reason?: SignInReason } = {}) => {
  const { pathname, search } = new URL(request.url);
  const params = new URLSearchParams({ redirectTo: pathname + search });
  if (reason) params.set("reason", reason);
  return `/sign-in?${params.toString()}`;
};
