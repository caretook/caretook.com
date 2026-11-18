import { Link } from "react-router";

import { MARKETING_LINKS } from "../site/pages";
import { MarketingIcon } from "./icons";
import type {
  ComingSoonContent,
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

const CONTAINER = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/**
 * A call to action. `/join` belongs to another part of the site (access
 * codes), so it loads as a document; everything else navigates in place.
 */
export function CtaLink({ cta, className }: { cta: Cta; className: string }) {
  return (
    <Link to={cta.href} className={className} reloadDocument={cta.href.startsWith(MARKETING_LINKS.join)}>
      {cta.label}
    </Link>
  );
}

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section aria-labelledby="hero-heading" className="bg-base-200">
      <div className={`${CONTAINER} py-14 sm:py-20`}>
        {content.eyebrow && (
          <p className="badge badge-soft badge-primary badge-lg mb-5 font-medium">{content.eyebrow}</p>
        )}
        <h1
          id="hero-heading"
          className="max-w-3xl text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl"
        >
          {content.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-base-content/80 sm:text-xl">
          {content.lead}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <CtaLink cta={content.primary} className="btn btn-primary btn-lg" />
          {content.secondary && <CtaLink cta={content.secondary} className="btn btn-ghost btn-lg" />}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ id, heading, intro }: { id: string; heading: string; intro?: string }) {
  return (
    <header className="max-w-2xl">
      <h2 id={`${id}-heading`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {heading}
      </h2>
      {intro && <p className="mt-3 text-base-content/80">{intro}</p>}
    </header>
  );
}

export function FeatureGrid({ content }: { content: FeatureGridContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={`${CONTAINER} py-14`}>
      <SectionHeading id={content.id} heading={content.heading} intro={content.intro} />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {content.items.map((item) => (
          <li key={item.title} className="card bg-base-200">
            <div className="card-body gap-3 text-lg">
              <span className="flex size-11 items-center justify-center rounded-box bg-primary/10 text-primary">
                <MarketingIcon name={item.icon} className="size-6" />
              </span>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="leading-relaxed text-base-content/80">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Steps({ content }: { content: StepsContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className="bg-base-200">
      <div className={`${CONTAINER} py-14`}>
        <SectionHeading id={content.id} heading={content.heading} intro={content.intro} />
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {content.items.map((step, i) => (
            <li key={step.title} className="flex gap-4 sm:flex-col">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-content"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="mt-1 leading-relaxed text-base-content/80">{step.body}</p>
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
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={`${CONTAINER} py-14`}>
      <SectionHeading id={content.id} heading={content.heading} intro={content.lead} />
      <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <MarketingIcon name={item.icon} className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="leading-relaxed text-base-content/80">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CtaBand({ content, tone = "plain" }: { content: CtaBandContent; tone?: "plain" | "accent" }) {
  const accent = tone === "accent";
  return (
    <section
      id={content.id}
      aria-labelledby={`${content.id}-heading`}
      className={`scroll-mt-20 ${accent ? "bg-primary text-primary-content" : "bg-base-200"}`}
    >
      <div className={`${CONTAINER} py-14`}>
        <h2 id={`${content.id}-heading`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {content.heading}
        </h2>
        <p className={`mt-3 max-w-2xl leading-relaxed ${accent ? "" : "text-base-content/80"}`}>
          {content.body}
        </p>
        {content.note && (
          <p className={`mt-5 font-semibold ${accent ? "" : "text-primary"}`} data-note>
            {content.note}
          </p>
        )}
        {content.actions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {content.actions.map((cta) => (
              <CtaLink
                key={cta.href}
                cta={cta}
                className={accent ? "btn btn-lg bg-base-100 text-base-content" : "btn btn-primary btn-lg"}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** A placeholder page: one `h1`, a line of copy, and the way back. */
export function ComingSoon({ content }: { content: ComingSoonContent }) {
  return (
    <section aria-labelledby="page-heading" className={`${CONTAINER} py-14 sm:py-20`}>
      <h1 id="page-heading" className="text-4xl font-bold tracking-tight">
        {content.heading}
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-base-content/80">{content.lead}</p>
      <p className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="btn btn-ghost">
          Back to home
        </Link>
        <Link to={MARKETING_LINKS.waitlist} className="btn btn-primary">
          Join the waitlist
        </Link>
      </p>
    </section>
  );
}
