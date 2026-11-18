import { Link } from "react-router";

import { MARKETING_LINKS, MARKETING_PAGES } from "../site/pages";
import { Wordmark } from "./Logo";

const SITE_PAGES = MARKETING_PAGES.filter((p) => p.area === "site");
const LEGAL_PAGES = MARKETING_PAGES.filter((p) => p.area === "legal");

const linkClass = "link link-hover text-base-content/80";

export function MarketingFooter() {
  return (
    <footer className="border-t border-base-300 bg-base-200">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <Wordmark />
          <p className="mt-3 text-base text-base-content/80">
            A shared place for a family to keep track of someone&apos;s care.
          </p>
        </div>
        <nav aria-label="Site">
          <h2 className="font-semibold">Caretook</h2>
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
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <h2 className="font-semibold">Legal</h2>
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
      <p
        className="mx-auto w-full max-w-5xl px-4 pb-8 text-sm text-base-content/70 sm:px-6"
        suppressHydrationWarning
      >
        © {new Date().getFullYear()} Caretook
      </p>
    </footer>
  );
}
