// What the server trusts about where a request came from (hosting slice 8):
// the native app's origins, and the client's address. Server only (it reads
// env); both /rpc (apps/web/app/routes/rpc.ts) and Better Auth (auth.ts) use
// these, so they trust the same origins and key on the same address. Env is
// read on each call, like the rest of config, so importing needs none.

import { getAuthConfig } from "./config";

type Env = Record<string, string | undefined>;

/** Capacitor's WebView origins (iOS, Android). Trusted only with `NATIVE_APP_ORIGINS=1`. */
export const NATIVE_APP_ORIGINS: readonly string[] = ["capacitor://localhost", "https://localhost"];

/**
 * The native app's origins when `NATIVE_APP_ORIGINS=1`, else none. Off by
 * default (dev, tests, checks, and every deploy until the app ships): with
 * credentials allowed, `https://localhost` is any local server's origin.
 */
export const nativeAppOrigins = (env: Env = process.env): string[] =>
  env.NATIVE_APP_ORIGINS?.trim() === "1" ? [...NATIVE_APP_ORIGINS] : [];

/**
 * Every origin allowed to call /rpc and /api/auth cross-origin, with
 * credentials: the native app's (when on) and `AUTH_TRUSTED_ORIGINS`.
 */
export const allowedOrigins = (env: Env = process.env): string[] => [
  ...nativeAppOrigins(env),
  ...getAuthConfig(env).trustedOrigins,
];

/**
 * The one header the host sets to the client's address (`CLIENT_IP_HEADER`,
 * lower-cased; `x-vercel-forwarded-for` on Vercel, which a client can't
 * spoof), or undefined when unset.
 */
export const clientIpHeader = (env: Env = process.env): string | undefined =>
  env.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined;

const firstEntry = (value: string | null | undefined) => value?.split(",")[0]?.trim() || null;

/**
 * The caller's address, for rate limits only (never stored). With
 * `CLIENT_IP_HEADER` set, that header's first entry and nothing else (null if
 * it's missing). Unset (dev, tests, checks): the first `x-forwarded-for`
 * entry, else `x-real-ip`; the browser checks give each page its own
 * `x-forwarded-for` (`cdp.mjs`).
 */
export const clientIpOf = (headers: Headers, env: Env = process.env): string | null => {
  const header = clientIpHeader(env);
  if (header) return firstEntry(headers.get(header));
  return firstEntry(headers.get("x-forwarded-for")) || headers.get("x-real-ip")?.trim() || null;
};
