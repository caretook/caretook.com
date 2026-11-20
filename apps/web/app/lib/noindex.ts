/**
 * Staging is public but must never be indexed (hosting slice 1). `APP_ENV`
 * (`staging` | `production`; unset in dev, tests and check builds) is baked in
 * at build time (vite.config.ts's `envPrefix`), since each environment builds
 * separately and prerendered pages are files: what the build saw is what they say.
 *
 * Pure and client-safe: root.tsx (every page, both targets), the robots and
 * sitemap routes, and the security headers read it.
 */

/** This build's `APP_ENV`. */
export const BUILD_APP_ENV: string | undefined = import.meta.env.APP_ENV;

/** Does this environment ask search engines to stay away? Only staging. */
export const isNoindex = (appEnv: string | undefined) => appEnv?.trim() === "staging";

/** What every page's `<meta name="robots">` says on staging. */
export const ROBOTS_NOINDEX = "noindex, nofollow";

/** The `X-Robots-Tag` header every response carries on staging (app responses and host-served files). */
export const X_ROBOTS_TAG = "noindex";

/** The `<meta name="robots">` a page carries, or none (production and dev are indexable). */
export const robotsMeta = (appEnv: string | undefined): { name: "robots"; content: string } | undefined =>
  isNoindex(appEnv) ? { name: "robots", content: ROBOTS_NOINDEX } : undefined;
