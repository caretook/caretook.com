import type { Route } from "./+types/route";

import { PageIntro, Prose } from "../sections/PageSections";
import { CtaBand } from "../sections/Sections";
import { marketingMeta, siteUrlFrom } from "../site/meta";
import { pagePath } from "../site/pages";
import { content } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  return marketingMeta({ ...content.meta, path: pagePath("about"), siteUrl: siteUrlFrom(matches) });
}

export default function About() {
  return (
    <>
      <PageIntro content={content.intro} />
      {content.sections.map((section) => (
        <Prose key={section.id} content={section} />
      ))}
      <CtaBand content={content.cta} tone="accent" />
    </>
  );
}
