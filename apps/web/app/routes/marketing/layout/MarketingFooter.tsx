import { Link } from "react-router";

import { FullLogo } from "~/components/brand";
import { BAND_ALT, CONTAINER } from "../sections/look";
import { MARKETING_LINKS, MARKETING_PAGES } from "../site/pages";
import { layoutContent } from "./content";

const SITE_PAGES = MARKETING_PAGES.filter((p) => p.area === "site");
const LEGAL_PAGES = MARKETING_PAGES.filter((p) => p.area === "legal");

const words = layoutContent.footer;
const linkClass = "link link-hover text-base-content/80";

export function MarketingFooter() {
  return (
    <footer className={`border-t border-base-300 ${BAND_ALT}`}>
      <div className={`${CONTAINER} grid gap-8 py-10 sm:grid-cols-3`}>
        <div>
          <FullLogo />
          <p className="mt-3 text-base text-base-content/80">{words.blurb}</p>
        </div>
        <nav aria-label={words.siteNavLabel}>
          <h2 className="font-semibold">{words.siteHeading}</h2>
          <ul className="mt-2 space-y-1 text-base">
            {SITE_PAGES.map((page) => (
              <li key={page.id}>
                <Link to={page.path} className={linkClass}>
                  {page.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to={MARKETING_LINKS.signIn} className={linkClass}>
                {words.signIn}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={words.legalNavLabel}>
          <h2 className="font-semibold">{words.legalHeading}</h2>
          <ul className="mt-2 space-y-1 text-base">
            {LEGAL_PAGES.map((page) => (
              <li key={page.id}>
                <Link to={page.path} className={linkClass}>
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {/* The year is set at prerender, so a page built last year can differ on hydration. */}
      <p className={`${CONTAINER} pb-8 text-sm text-base-content/70`} suppressHydrationWarning>
        © {new Date().getFullYear()} {words.owner}
      </p>
    </footer>
  );
}
