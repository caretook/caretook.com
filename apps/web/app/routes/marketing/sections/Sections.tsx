import type { ButtonVariant } from "~/components/ui/plain";

import { FullLogo } from "~/components/brand";
import { Button } from "~/components/ui/plain";
import { MARKETING_LINKS } from "../site/pages";
import { MarketingIcon } from "./icons";
import {
  BAND_ACCENT,
  BAND_ALT,
  BAND_PAGE,
  CARD,
  CONTAINER,
  H1,
  H2,
  H3,
  ICON_TILE,
  INTRO,
  LEAD,
  OPENING,
  SECTION,
} from "./look";
import type {
  Cta,
  CtaBandContent,
  FeatureGridContent,
  HeroContent,
  PromiseContent,
  StepsContent,
} from "./types";

/**
 * The marketing site's section components: each renders one shape from
 * `types.ts`, so pages are a list of sections filled from their content module.
 */

/**
 * A call to action. `/join` belongs to another part of the site (access
 * codes), so it loads as a document; everything else navigates in place.
 */
export function CtaLink({
  cta,
  variant,
  className,
}: {
  cta: Cta;
  variant?: ButtonVariant;
  className?: string;
}) {
  const look = { variant, size: "lg", className } as const;
  return cta.href.startsWith(MARKETING_LINKS.join) ? (
    <Button {...look} href={cta.href}>
      {cta.label}
    </Button>
  ) : (
    <Button {...look} to={cta.href}>
      {cta.label}
    </Button>
  );
}

/** On the accent band, a call to action stands on the page's colour. */
export const CTA_ON_ACCENT = "bg-base-100 text-base-content";

/** Both hero buttons share one row from 360 px up: smaller on a phone, never wrapping their label. */
const HERO_CTA = "whitespace-nowrap max-sm:h-11 max-sm:min-h-0 max-sm:px-3 max-sm:text-sm";

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section aria-labelledby="hero-heading" className={OPENING}>
      <div className={`${CONTAINER} ${SECTION}`}>
        {content.eyebrow && (
          <p className="badge badge-soft badge-primary badge-lg mb-5 font-medium">{content.eyebrow}</p>
        )}
        {content.lockup ? (
          <>
            <h1 id="hero-heading" data-lockup>
              <FullLogo size="hero" />
            </h1>
            <p
              className="mt-6 max-w-2xl text-xl font-semibold text-balance sm:text-2xl"
              data-lockup-part="descriptor"
            >
              {content.lockup.descriptor}
            </p>
          </>
        ) : (
          <h1 id="hero-heading" className={`max-w-3xl ${H1}`}>
            {content.heading}
          </h1>
        )}
        <p className={`mt-5 max-w-2xl ${LEAD}`}>{content.lead}</p>
        <div className="mt-8 flex flex-nowrap gap-3">
          <CtaLink cta={content.primary} variant="primary" className={HERO_CTA} />
          {content.secondary && <CtaLink cta={content.secondary} variant="ghost" className={HERO_CTA} />}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ id, heading, intro }: { id: string; heading: string; intro?: string }) {
  return (
    <header className="max-w-2xl">
      <h2 id={`${id}-heading`} className={H2}>
        {heading}
      </h2>
      {intro && <p className={`mt-4 ${INTRO}`}>{intro}</p>}
    </header>
  );
}

export function FeatureGrid({ content }: { content: FeatureGridContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={BAND_ALT}>
      <div className={`${CONTAINER} ${SECTION}`}>
        <SectionHeading id={content.id} heading={content.heading} intro={content.intro} />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {content.items.map((item) => (
            <li key={item.title} className={CARD}>
              <div className="card-body gap-3 p-6 text-lg sm:p-8">
                <span className={ICON_TILE}>
                  <MarketingIcon name={item.icon} className="size-6" />
                </span>
                <h3 className={`mt-1 ${H3}`}>{item.title}</h3>
                <p className="leading-relaxed text-base-content/80">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Steps({ content }: { content: StepsContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={BAND_ALT}>
      <div className={`${CONTAINER} ${SECTION}`}>
        <SectionHeading id={content.id} heading={content.heading} intro={content.intro} />
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {content.items.map((step, i) => (
            <li key={step.title} className="flex gap-4 sm:flex-col">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-content"
              >
                {i + 1}
              </span>
              <div>
                <h3 className={H3}>{step.title}</h3>
                <p className="mt-2 leading-relaxed text-base-content/80">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PromiseSection({ content }: { content: PromiseContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={BAND_PAGE}>
      <div className={`${CONTAINER} ${SECTION}`}>
        <SectionHeading id={content.id} heading={content.heading} intro={content.lead} />
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {content.items.map((item) => (
            <li key={item.title} className="flex gap-4">
              <span className={`shrink-0 ${ICON_TILE}`}>
                <MarketingIcon name={item.icon} className="size-6" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 leading-relaxed text-base-content/80">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CtaBand({ content, tone = "plain" }: { content: CtaBandContent; tone?: "plain" | "accent" }) {
  const accent = tone === "accent";
  return (
    <section
      id={content.id}
      aria-labelledby={`${content.id}-heading`}
      className={`scroll-mt-20 ${accent ? BAND_ACCENT : BAND_ALT}`}
    >
      <div className={`${CONTAINER} ${SECTION}`}>
        <h2 id={`${content.id}-heading`} className={`max-w-3xl ${H2}`}>
          {content.heading}
        </h2>
        <p className={`mt-4 max-w-2xl text-lg leading-relaxed ${accent ? "" : "text-base-content/80"}`}>
          {content.body}
        </p>
        {content.note && (
          <p className={`mt-5 font-semibold ${accent ? "" : "text-primary"}`} data-note>
            {content.note}
          </p>
        )}
        {content.actions.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {content.actions.map((cta) => (
              <CtaLink
                key={cta.href}
                cta={cta}
                variant={accent ? undefined : "primary"}
                className={accent ? CTA_ON_ACCENT : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
