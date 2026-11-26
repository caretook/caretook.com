import type { Route } from "./+types/route";

import { PageIntro, Showcase } from "../sections/PageSections";
import { CtaBand } from "../sections/Sections";
import { marketingMeta, siteUrlFrom } from "../site/meta";
import { pagePath } from "../site/pages";
import { content } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  return marketingMeta({ ...content.meta, path: pagePath("features"), siteUrl: siteUrlFrom(matches) });
}

export default function Features() {
  return (
    <>
      <PageIntro content={content.intro} />
      {content.showcases.map((showcase, i) => (
        // The first screenshot is above the fold on wide screens: load it at once.
        <Showcase key={showcase.id} content={showcase} flip={i % 2 === 1} eager={i === 0} />
      ))}
      <CtaBand content={content.cta} tone="accent" />
    </>
  );
}
