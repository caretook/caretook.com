import { resolveSiteUrl } from "../site/meta";
import { robotsTxt } from "../site/seo";

// /robots.txt: marketing pages allowed, the app and private paths not
// (prerendered to a static file at build).
export function loader() {
  return new Response(robotsTxt(resolveSiteUrl(process.env.APP_URL)), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
