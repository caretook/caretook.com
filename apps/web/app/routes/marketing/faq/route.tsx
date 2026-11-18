import type { Route } from "./+types/route";

import { FaqList, PageIntro } from "../sections/PageSections";
import { faqPageJsonLd, marketingMeta, siteUrlFrom } from "../site/meta";
import { pagePath } from "../site/pages";
import { content, faqItems } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  return marketingMeta({
    ...content.meta,
    path: pagePath("faq"),
    siteUrl: siteUrlFrom(matches),
    jsonLd: [faqPageJsonLd(faqItems)],
  });
}

export default function Faq() {
  return (
    <>
      <PageIntro content={content.intro} />
      <FaqList groups={content.groups} />
    </>
  );
}
