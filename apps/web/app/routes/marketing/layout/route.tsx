import { Outlet } from "react-router";

import { resolveSiteUrl } from "../site/meta";
import { MarketingAnalytics } from "./MarketingAnalytics";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";

/**
 * The marketing frame (web build only): skip link, header, the page, footer.
 * Pages are prerendered at build. Nothing here imports from `routes/app/`,
 * `lib/sync/` or the editor, so no app chunk loads on a marketing page.
 */

// The canonical origin for meta tags, sitemap and robots: APP_URL, read on
// the server (at prerender), so client navigations reuse the same value.
export function loader() {
  return { siteUrl: resolveSiteUrl(process.env.APP_URL) };
}

export default function MarketingLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-base-100 text-lg">
      <a
        href="#main"
        className="sr-only z-50 rounded-field bg-base-100 px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <MarketingFooter />
      <MarketingAnalytics />
    </div>
  );
}
