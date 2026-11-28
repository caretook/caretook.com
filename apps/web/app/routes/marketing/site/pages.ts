/**
 * The marketing site's pages (web build only): the one list the header,
 * footer, sitemap and prerender config read. Pure, with no imports, because
 * `react-router.config.ts` imports it too.
 *
 * A new marketing page appends an entry here and its route in `routes.ts`'s
 * web-only list.
 */
export type MarketingArea = "site" | "legal";

export type MarketingPage = {
  id: string;
  path: string;
  /** The link text in the header and footer. */
  label: string;
  area: MarketingArea;
  /** Shown in the header's nav (and the phone menu). */
  header?: boolean;
};

export const MARKETING_PAGES = [
  { id: "home", path: "/", label: "Home", area: "site" },
  { id: "features", path: "/features", label: "Features", area: "site", header: true },
  { id: "faq", path: "/faq", label: "FAQ", area: "site", header: true },
  { id: "about", path: "/about", label: "About", area: "site", header: true },
  { id: "contact", path: "/contact", label: "Contact", area: "site" },
  { id: "privacy", path: "/privacy", label: "Privacy policy", area: "legal" },
  { id: "terms", path: "/terms", label: "Terms", area: "legal" },
  {
    id: "health-data-privacy",
    path: "/health-data-privacy",
    label: "Consumer health data notice",
    area: "legal",
  },
  { id: "accessibility", path: "/accessibility", label: "Accessibility", area: "site" },
] as const satisfies readonly MarketingPage[];

export type MarketingPageId = (typeof MARKETING_PAGES)[number]["id"];

/** Resource routes the web build also prerenders. */
export const MARKETING_RESOURCES = ["/sitemap.xml", "/robots.txt"] as const;

/** Every path the web build prerenders to static files. */
export const PRERENDER_PATHS: string[] = [...MARKETING_PAGES.map((p) => p.path), ...MARKETING_RESOURCES];

/** Where the site's calls to action go, outside the marketing pages. */
export const MARKETING_LINKS = {
  signIn: "/sign-in",
  /** Access codes (`/join/:code`, from `invites`). */
  join: "/join",
  /** The waitlist band on home. */
  waitlist: "/#waitlist",
} as const;

export function pagePath(id: MarketingPageId): string {
  return MARKETING_PAGES.find((p) => p.id === id)!.path;
}
