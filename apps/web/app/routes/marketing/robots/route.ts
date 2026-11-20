import { BUILD_APP_ENV } from "~/lib/noindex";

import { resolveSiteUrl } from "../site/meta";
import { robotsTxt } from "../site/seo";

// /robots.txt: marketing pages allowed, the app and private paths not
// (prerendered to a static file at build). Staging's disallows everything.
export function loader() {
  return new Response(robotsTxt(resolveSiteUrl(process.env.APP_URL), BUILD_APP_ENV), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
