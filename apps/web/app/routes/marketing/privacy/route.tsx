import type { Route } from "./+types/route";

import { LegalPage } from "../sections/LegalPage";
import { marketingMeta, siteUrlFrom } from "../site/meta";
import { pagePath } from "../site/pages";
import { content } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  return marketingMeta({ ...content.meta, path: pagePath("privacy"), siteUrl: siteUrlFrom(matches) });
}

export default function Page() {
  return <LegalPage content={content} />;
}
