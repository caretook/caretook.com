import type { Route } from "./+types/route";

import { ComingSoon } from "../sections/Sections";
import { marketingMeta, siteUrlFrom } from "../site/meta";
import { pagePath } from "../site/pages";
import { content } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  return marketingMeta({ ...content.meta, path: pagePath("privacy"), siteUrl: siteUrlFrom(matches) });
}

export default function Page() {
  return <ComingSoon content={content} />;
}
