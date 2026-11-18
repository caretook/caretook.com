import { describe, expect, it } from "vitest";

import { MARKETING_PAGES, PRERENDER_PATHS } from "./pages";
import { isDisallowed, robotsTxt, ROBOTS_DISALLOW, sitemapXml } from "./seo";

const PRIVATE = [
  "/app",
  "/app/groups/x/timeline",
  "/admin",
  "/invite/abc",
  "/join",
  "/join/CODE",
  "/api/auth/jwks",
  "/rpc/me.get",
  "/dev/mail",
  "/sign-in",
  "/sign-out",
];

describe("sitemapXml", () => {
  const xml = sitemapXml("https://caretook.com");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it("lists every marketing page as an absolute URL", () => {
    expect(locs).toEqual(MARKETING_PAGES.map((p) => `https://caretook.com${p.path}`));
  });

  it("lists none of the private paths", () => {
    for (const path of PRIVATE) expect(locs).not.toContain(`https://caretook.com${path}`);
  });

  it("is a sitemaps.org urlset", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });

  it("escapes XML in URLs", () => {
    expect(sitemapXml("https://caretook.com", ["/a?b=1&c=2"])).toContain(
      "<loc>https://caretook.com/a?b=1&amp;c=2</loc>",
    );
  });
});

describe("robotsTxt", () => {
  const txt = robotsTxt("https://caretook.com");
  const lines = txt.split("\n");

  it("allows the site and disallows the app and private paths", () => {
    expect(lines).toContain("User-agent: *");
    expect(lines).toContain("Allow: /");
    for (const path of ["/app", "/admin", "/invite", "/join", "/api", "/rpc", "/dev"]) {
      expect(lines).toContain(`Disallow: ${path}`);
    }
    expect(lines.filter((l) => l.startsWith("Disallow:"))).toHaveLength(ROBOTS_DISALLOW.length);
  });

  it("points at the sitemap", () => {
    expect(lines).toContain("Sitemap: https://caretook.com/sitemap.xml");
  });

  it("disallows the private paths and none of the public ones (prefix rules)", () => {
    for (const path of PRIVATE.filter((p) => !p.startsWith("/sign-"))) expect(isDisallowed(path)).toBe(true);
    for (const path of PRERENDER_PATHS) expect(isDisallowed(path)).toBe(false);
    // Brand assets sit outside the disallowed prefixes too (not /apple-touch-icon.png).
    for (const path of [
      "/favicon.svg",
      "/icons/apple-touch-icon.png",
      "/og-default.png",
      "/site.webmanifest",
    ]) {
      expect(isDisallowed(path)).toBe(false);
    }
  });
});

describe("PRERENDER_PATHS", () => {
  it("is every marketing page plus the sitemap and robots, once each", () => {
    expect(PRERENDER_PATHS).toEqual([...MARKETING_PAGES.map((p) => p.path), "/sitemap.xml", "/robots.txt"]);
    expect(new Set(PRERENDER_PATHS).size).toBe(PRERENDER_PATHS.length);
  });
});
