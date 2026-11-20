import { BUILD_APP_ENV } from "~/lib/noindex";

import { resolveSiteUrl } from "../site/meta";
import { sitemapPaths, sitemapXml } from "../site/seo";

// /sitemap.xml: every marketing page (prerendered to a static file at build);
// staging's is empty.
export function loader() {
  return new Response(sitemapXml(resolveSiteUrl(process.env.APP_URL), sitemapPaths(BUILD_APP_ENV)), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
