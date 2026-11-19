export type LinkBuilder = (path: string, params?: Record<string, string>) => string;

/**
 * Links in emails come from the configured APP_URL only, never from a
 * request's Host header (a forged Host would otherwise point a reset link
 * at an attacker). `path` must be an app path starting with "/".
 */
export const linkBuilder =
  (appUrl: string): LinkBuilder =>
  (path, params) => {
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new Error(`Email links take an app path starting with "/" (got "${path}")`);
    }
    const url = new URL(path, `${appUrl}/`);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    return url.toString();
  };
