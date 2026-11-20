import { Link } from "react-router";

import { formatLegalDate, inlineParts, TOC_MIN_SECTIONS } from "./legal";
import type { LegalBlock, LegalPageContent } from "./legal";

/**
 * One legal page (privacy policy, terms, consumer health data notice): the
 * DRAFT banner, the "last updated" date, a table of contents for long pages,
 * and each section's plain-language summary above its formal text, with an
 * anchor link on every heading.
 *
 * In-page links are React Router `Link`s, not plain `<a href="#…">`: a native
 * hash jump adds a history entry with no state, which `ScrollRestoration`
 * keys as "default" and then scrolls back to that key's stale saved position.
 */

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <Link key={i} to={part.href} className="link">
            {part.text}
          </Link>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <p>
        <Inline text={block} />
      </p>
    );
  }
  if ("list" in block) {
    return (
      <ul className="list-disc space-y-1 pl-6">
        {block.list.map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return <h3 className="pt-2 text-lg font-semibold text-base-content">{block.subheading}</h3>;
}

export function LegalPage({ content }: { content: LegalPageContent }) {
  const toc = content.sections.length >= TOC_MIN_SECTIONS;
  return (
    <article aria-labelledby="page-heading" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {content.draft && (
        <div role="note" data-draft className="alert alert-warning mb-8 items-start text-base">
          <p>
            <strong>DRAFT, not yet reviewed.</strong> This text is a draft for legal review. It isn&apos;t
            final and may change before Caretook opens to the public.
          </p>
        </div>
      )}
      <h1 id="page-heading" className="text-4xl font-bold tracking-tight text-balance">
        {content.heading}
      </h1>
      <p className="mt-3 text-base text-base-content/70" data-last-updated>
        Last updated <time dateTime={content.lastUpdated}>{formatLegalDate(content.lastUpdated)}</time>
      </p>
      <div className="mt-6 space-y-4 leading-relaxed">
        {content.intro.map((p) => (
          <p key={p}>
            <Inline text={p} />
          </p>
        ))}
      </div>

      {toc && (
        <nav aria-labelledby="toc-heading" className="mt-10 rounded-box bg-base-200 p-5 sm:p-6">
          <h2 id="toc-heading" className="font-semibold">
            On this page
          </h2>
          <ol className="mt-3 list-decimal space-y-1 pl-6 text-base">
            {content.sections.map((s) => (
              <li key={s.id}>
                <Link to={`#${s.id}`} className="link link-hover">
                  {s.heading}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {content.sections.map((s) => (
        <section key={s.id} aria-labelledby={s.id} className="mt-12">
          <h2 id={s.id} className="scroll-mt-20 text-2xl font-semibold tracking-tight">
            {s.heading}
            <Link
              to={`#${s.id}`}
              className="ml-2 rounded-field font-normal text-base-content/50 no-underline hover:text-primary focus-visible:text-primary"
              aria-label={`Link to this section: ${s.heading}`}
              data-anchor
            >
              #
            </Link>
          </h2>
          <div className="mt-4 rounded-box border-l-4 border-primary bg-primary/5 p-4 sm:p-5">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">In plain words</p>
            <p className="mt-1 leading-relaxed">
              <Inline text={s.summary} />
            </p>
          </div>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-base-content/85">
            {s.formal.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
