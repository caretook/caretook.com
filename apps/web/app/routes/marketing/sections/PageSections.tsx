import { Link } from "react-router";

import { screenshotSrc, SCREENSHOT_SIZE, type ScreenshotRef } from "../site/screenshots";
import { MarketingIcon } from "./icons";
import {
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
import type { FaqGroup, GalleryContent, PageIntroContent, ProseContent, ShowcaseContent } from "./types";

/**
 * Section components for the inner pages (features, FAQ, about), beside the
 * home page's in `Sections.tsx`. Each renders one shape from `types.ts`; width,
 * bands, cards and heading sizes come from `look.ts`.
 */

/** A page's opening, with its only `h1`. */
export function PageIntro({ content }: { content: PageIntroContent }) {
  return (
    <section aria-labelledby="page-heading" className={OPENING}>
      <div className={`${CONTAINER} ${SECTION}`}>
        {content.eyebrow && (
          <p className="badge badge-soft badge-primary badge-lg mb-5 font-medium">{content.eyebrow}</p>
        )}
        <h1 id="page-heading" className={`max-w-3xl ${H1}`}>
          {content.heading}
        </h1>
        <p className={`mt-5 max-w-2xl ${LEAD}`}>{content.lead}</p>
      </div>
    </section>
  );
}

/**
 * "On this page": a link to each block below. One row that scrolls sideways
 * on a phone, wrapping from `sm`. Hash `Link`s, not `<a href="#…">`, as on
 * the legal pages (marketing.md: a native hash jump confuses
 * `ScrollRestoration`).
 */
export function JumpLinks({ items }: { items: { id: string; heading: string }[] }) {
  return (
    <nav aria-labelledby="jump-heading" className={`${BAND_PAGE} border-b border-base-300`}>
      <div className={`${CONTAINER} py-6`}>
        <h2 id="jump-heading" className="text-sm font-semibold tracking-wide text-base-content/70 uppercase">
          On this page
        </h2>
        <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {items.map((item) => (
            <li key={item.id} className="shrink-0">
              <Link
                to={`#${item.id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-base-300 bg-base-100 px-4 whitespace-nowrap hover:border-primary hover:text-primary focus-visible:border-primary"
              >
                {item.heading}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/**
 * An app screenshot (an SVG placeholder for now; see `site/screenshots.ts`).
 * Lazy unless `eager` (the first image on a page that shows it above the fold).
 */
export function Screenshot({
  image,
  eager = false,
  className = "",
}: {
  image: ScreenshotRef;
  eager?: boolean;
  className?: string;
}) {
  return (
    <figure className={`mx-auto w-full max-w-[300px] ${className}`}>
      <img
        src={screenshotSrc(image.name)}
        width={SCREENSHOT_SIZE.width}
        height={SCREENSHOT_SIZE.height}
        alt={image.alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="h-auto w-full rounded-box border border-base-300 bg-base-100 shadow-lg"
      />
      {image.caption && (
        <figcaption className="mt-3 text-center text-base text-base-content/70">{image.caption}</figcaption>
      )}
    </figure>
  );
}

/**
 * One feature at length on its own band: text and points beside its
 * screenshot (alternating sides from `sm`). With no screenshot, its icon
 * stands large in the image's column instead (decorative, so hidden from
 * assistive tech; the phone keeps the small tile above the heading).
 */
export function Showcase({
  content,
  flip = false,
  eager = false,
  band = "page",
}: {
  content: ShowcaseContent;
  flip?: boolean;
  eager?: boolean;
  band?: "page" | "alt";
}) {
  const aside = flip ? "sm:order-1" : "";
  // The text always takes the flexible track and the aside the 300px one, on either side.
  const tracks = flip ? "sm:grid-cols-[300px_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1fr)_300px]";
  return (
    <section
      id={content.id}
      aria-labelledby={`${content.id}-heading`}
      className={`${band === "alt" ? BAND_ALT : BAND_PAGE} scroll-mt-16`}
    >
      <div className={`${CONTAINER} ${SECTION} grid items-center gap-10 sm:gap-14 ${tracks}`}>
        <div className={flip ? "sm:order-2" : ""}>
          <span className={`${ICON_TILE} ${content.image ? "" : "sm:hidden"}`}>
            <MarketingIcon name={content.icon} className="size-6" />
          </span>
          <h2 id={`${content.id}-heading`} className={`mt-4 ${H2}`}>
            {content.heading}
          </h2>
          {content.paragraphs.map((p) => (
            <p key={p} className={`mt-4 ${INTRO}`}>
              {p}
            </p>
          ))}
          {content.points && (
            <ul className="mt-6 space-y-3">
              {content.points.map((point) => (
                <li key={point} className="flex gap-3 text-lg">
                  <span aria-hidden="true" className="mt-3 size-2 shrink-0 rounded-full bg-primary" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {content.image ? (
          <Screenshot image={content.image} eager={eager} className={aside} />
        ) : (
          <div
            aria-hidden="true"
            data-showcase-icon
            className={`${CARD} hidden aspect-square w-full items-center justify-center text-primary sm:flex ${aside}`}
          >
            <span className="flex size-40 items-center justify-center rounded-full bg-primary/10">
              <MarketingIcon name={content.icon} className="size-20" />
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/** A row of screenshots (three across from `sm`, scrolling sideways on phones). */
export function Gallery({ content }: { content: GalleryContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={BAND_PAGE}>
      <div className={`${CONTAINER} ${SECTION}`}>
        <header className="max-w-2xl">
          <h2 id={`${content.id}-heading`} className={H2}>
            {content.heading}
          </h2>
          {content.intro && <p className={`mt-4 ${INTRO}`}>{content.intro}</p>}
        </header>
        <ul className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-6">
          {content.shots.map((shot) => (
            <li key={shot.name}>
              <Screenshot image={shot} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** A heading and paragraphs; placeholder copy is marked so it can't pass for final. */
export function Prose({ content }: { content: ProseContent }) {
  return (
    <section
      id={content.id}
      aria-labelledby={`${content.id}-heading`}
      className={`${CONTAINER} py-10 sm:py-12`}
    >
      <div className="max-w-2xl">
        <h2 id={`${content.id}-heading`} className={H2}>
          {content.heading}
          {content.placeholder && (
            <span className="badge badge-soft badge-warning ms-3 align-middle font-medium">
              To be written
            </span>
          )}
        </h2>
        {content.paragraphs.map((p) => (
          <p key={p} className="mt-4 leading-relaxed text-base-content/80">
            {p}
          </p>
        ))}
        {content.subsections?.map((sub) => (
          <div key={sub.heading} className="mt-8">
            <h3 className={H3}>{sub.heading}</h3>
            {sub.label && <p className="text-sm text-base-content/60">{sub.label}</p>}
            {sub.paragraphs.map((p) => (
              <p key={p} className="mt-2 leading-relaxed text-base-content/80">
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The FAQ: groups of questions (`h3`) with their answers, always visible, so
 * what the page shows and its `FAQPage` JSON-LD are the same text.
 */
export function FaqList({ groups }: { groups: FaqGroup[] }) {
  return (
    <div className={`${CONTAINER} py-10 sm:py-16`}>
      {groups.map((group) => (
        <section
          key={group.id}
          id={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="scroll-mt-20 py-6"
        >
          <h2 id={`${group.id}-heading`} className={H2}>
            {group.heading}
          </h2>
          <div className="mt-6 max-w-3xl divide-y divide-base-300">
            {group.items.map((item) => (
              <div key={item.question} className="py-5" data-faq-item>
                <h3 className={H3}>{item.question}</h3>
                {item.answer.map((p) => (
                  <p key={p} className="mt-2 leading-relaxed text-base-content/80">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
