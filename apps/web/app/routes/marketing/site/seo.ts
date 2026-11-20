import { isNoindex } from "../../../lib/marketing/noindex";
import { absoluteUrl } from "./meta";
import { MARKETING_PAGES } from "./pages";

/**
 * Paths crawlers stay out of: the app, staff pages, invites and access codes,
 * auth and the API, and dev tools. Robots rules match by prefix, so a public
 * page must never start with one of these (pages.ts's paths are tested).
 */
export const ROBOTS_DISALLOW = ["/app", "/admin", "/invite", "/join", "/api", "/rpc", "/dev"] as const;

export function isDisallowed(path: string): boolean {
  return ROBOTS_DISALLOW.some((prefix) => path.startsWith(prefix));
}

/**
 * robots.txt. On staging (`APP_ENV=staging`) it disallows everything and
 * names no sitemap; elsewhere the private prefixes only.
 */
export function robotsTxt(siteUrl: string, appEnv?: string): string {
  if (isNoindex(appEnv)) return ["User-agent: *", "Disallow: /", ""].join("\n");
  return [
    "User-agent: *",
    "Allow: /",
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${absoluteUrl(siteUrl, "/sitemap.xml")}`,
    "",
  ].join("\n");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The pages the sitemap lists: every marketing page, or none on staging. */
export const sitemapPaths = (appEnv?: string): readonly string[] =>
  isNoindex(appEnv) ? [] : MARKETING_PAGES.map((p) => p.path);

/** Every marketing page's URL (or the paths given). */
export function sitemapXml(siteUrl: string, paths: readonly string[] = MARKETING_PAGES.map((p) => p.path)) {
  const urls = paths.map((path) => `  <url><loc>${escapeXml(absoluteUrl(siteUrl, path))}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
