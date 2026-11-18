/** A same-site path to return to after sign-in; anything else falls back to /app. */
export const safeRedirect = (to: string | null | undefined, fallback = "/app") =>
  to?.startsWith("/") && !to.startsWith("//") && !to.startsWith("/\\") ? to : fallback;

export const signInUrl = (request: Request) => {
  const { pathname, search } = new URL(request.url);
  return `/sign-in?${new URLSearchParams({ redirectTo: pathname + search }).toString()}`;
};
