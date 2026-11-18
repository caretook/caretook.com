import type { Route } from "./+types/route";

import { Gallery } from "../sections/PageSections";
import { CtaBand, FeatureGrid, Hero, PromiseSection, Steps } from "../sections/Sections";
import { marketingMeta, organizationJsonLd, siteUrlFrom } from "../site/meta";
import { homeContent } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  const siteUrl = siteUrlFrom(matches);
  return marketingMeta({
    ...homeContent.meta,
    path: "/",
    siteUrl,
    jsonLd: [organizationJsonLd(siteUrl)],
  });
}

export default function Home() {
  return (
    <>
      <Hero content={homeContent.hero} />
      <FeatureGrid content={homeContent.helps} />
      <Gallery content={homeContent.gallery} />
      <Steps content={homeContent.steps} />
      <PromiseSection content={homeContent.promise} />
      <CtaBand content={homeContent.earlyAccess} />
      <CtaBand content={homeContent.waitlist} tone="accent" />
    </>
  );
}
