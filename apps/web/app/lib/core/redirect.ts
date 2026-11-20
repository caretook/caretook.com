import { appUrls } from "../app-shell/appUrls";

/** A same-site path to return to after sign-in; anything else falls back to /app. */
export const safeRedirect = (to: string | null | undefined, fallback = appUrls.home()) =>
  to?.startsWith("/") && !to.startsWith("//") && !to.startsWith("/\\") ? to : fallback;

/** Why sign-in was asked for, when the sign-in page should say so. */
export type SignInReason = "offline" | "rate-limited";

export const signInUrl = (request: Request, { reason }: { reason?: SignInReason } = {}) => {
  const { pathname, search } = new URL(request.url);
  const params = new URLSearchParams({ redirectTo: pathname + search });
  if (reason) params.set("reason", reason);
  return `/sign-in?${params.toString()}`;
};
