import { resolveSiteUrl } from "../site/meta";
import { sitemapXml } from "../site/seo";

// /sitemap.xml: every marketing page (prerendered to a static file at build).
export function loader() {
  return new Response(sitemapXml(resolveSiteUrl(process.env.APP_URL)), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
