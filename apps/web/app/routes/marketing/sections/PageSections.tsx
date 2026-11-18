import { screenshotSrc, screenshotSrcSet, SCREENSHOT_SIZE, type ScreenshotRef } from "../site/screenshots";
import { MarketingIcon } from "./icons";
import type { FaqGroup, GalleryContent, PageIntroContent, ProseContent, ShowcaseContent } from "./types";

/**
 * Section components for the inner pages (features, FAQ, about), beside the
 * home page's in `Sections.tsx`. Each renders one shape from `types.ts`.
 */

const CONTAINER = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/** A page's opening, with its only `h1`. */
export function PageIntro({ content }: { content: PageIntroContent }) {
  return (
    <section aria-labelledby="page-heading" className="bg-base-200">
      <div className={`${CONTAINER} py-14 sm:py-16`}>
        {content.eyebrow && (
          <p className="badge badge-soft badge-primary badge-lg mb-5 font-medium">{content.eyebrow}</p>
        )}
        <h1
          id="page-heading"
          className="max-w-3xl text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl"
        >
          {content.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-base-content/80 sm:text-xl">
          {content.lead}
        </p>
      </div>
    </section>
  );
}

/**
 * An app screenshot: the device's theme picks light or dark, and `srcset`
 * picks the width. Lazy unless `eager` (the first image on a page that shows
 * it above the fold).
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
  const sizes = "(min-width: 640px) 300px, 75vw";
  return (
    <figure className={`mx-auto w-full max-w-[300px] ${className}`}>
      <picture>
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={screenshotSrcSet(image.name, "dark")}
          sizes={sizes}
        />
        <img
          src={screenshotSrc(image.name, "light", SCREENSHOT_SIZE.width)}
          srcSet={screenshotSrcSet(image.name, "light")}
          sizes={sizes}
          width={SCREENSHOT_SIZE.width}
          height={SCREENSHOT_SIZE.height}
          alt={image.alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-auto w-full rounded-box border border-base-300 bg-base-100 shadow-lg"
        />
      </picture>
      {image.caption && (
        <figcaption className="mt-3 text-center text-base text-base-content/70">{image.caption}</figcaption>
      )}
    </figure>
  );
}

/** One feature at length: text and points beside its screenshot (alternating sides from `sm`). */
export function Showcase({
  content,
  flip = false,
  eager = false,
}: {
  content: ShowcaseContent;
  flip?: boolean;
  eager?: boolean;
}) {
  return (
    <section
      id={content.id}
      aria-labelledby={`${content.id}-heading`}
      className={`${CONTAINER} scroll-mt-20 py-14`}
    >
      <div className="grid items-center gap-10 sm:grid-cols-[minmax(0,1fr)_300px] sm:gap-14">
        <div className={flip ? "sm:order-2" : ""}>
          <span className="flex size-11 items-center justify-center rounded-box bg-primary/10 text-primary">
            <MarketingIcon name={content.icon} className="size-6" />
          </span>
          <h2 id={`${content.id}-heading`} className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            {content.heading}
          </h2>
          {content.paragraphs.map((p) => (
            <p key={p} className="mt-4 leading-relaxed text-base-content/80">
              {p}
            </p>
          ))}
          {content.points && (
            <ul className="mt-5 space-y-2">
              {content.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-primary" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {content.image && (
          <Screenshot image={content.image} eager={eager} className={flip ? "sm:order-1" : ""} />
        )}
      </div>
    </section>
  );
}

/** A row of screenshots (three across from `sm`, scrolling sideways on phones). */
export function Gallery({ content }: { content: GalleryContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={`${CONTAINER} py-14`}>
      <header className="max-w-2xl">
        <h2 id={`${content.id}-heading`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {content.heading}
        </h2>
        {content.intro && <p className="mt-3 text-base-content/80">{content.intro}</p>}
      </header>
      <ul className="mt-8 grid gap-10 sm:grid-cols-3 sm:gap-6">
        {content.shots.map((shot) => (
          <li key={shot.name}>
            <Screenshot image={shot} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A heading and paragraphs; placeholder copy is marked so it can't pass for final. */
export function Prose({ content }: { content: ProseContent }) {
  return (
    <section id={content.id} aria-labelledby={`${content.id}-heading`} className={`${CONTAINER} py-10`}>
      <div className="max-w-2xl">
        <h2 id={`${content.id}-heading`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
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
    <div className={`${CONTAINER} py-10`}>
      {groups.map((group) => (
        <section
          key={group.id}
          id={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="scroll-mt-20 py-6"
        >
          <h2 id={`${group.id}-heading`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {group.heading}
          </h2>
          <div className="mt-6 max-w-3xl divide-y divide-base-300">
            {group.items.map((item) => (
              <div key={item.question} className="py-5" data-faq-item>
                <h3 className="text-xl font-semibold">{item.question}</h3>
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
