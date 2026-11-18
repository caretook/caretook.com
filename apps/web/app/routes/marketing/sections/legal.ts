import type { PageMeta } from "./types";

/**
 * The legal pages' content shape (privacy policy, terms, consumer health data
 * notice) and the pure helpers `LegalPage` renders with. Each page's copy is
 * in its own `content.ts`; the layout is `LegalPage.tsx`.
 *
 * Text is plain strings. An internal link is written `[text](/path)` or
 * `[text](#section-id)`; anything else in square brackets, such as
 * `[privacy email]`, is a placeholder and shows as written.
 */

/** A block of formal text: a paragraph, a bulleted list, or a subheading. */
export type LegalBlock = string | { list: string[] } | { subheading: string };

export type LegalSection = {
  /** The heading's anchor id: lowercase words joined by hyphens, unique on the page. */
  id: string;
  heading: string;
  /** The plain-language summary, shown first ("In plain words"). */
  summary: string;
  /** The formal text below the summary. */
  formal: LegalBlock[];
};

export type LegalPageContent = {
  meta: PageMeta;
  /** The page's only `h1`. */
  heading: string;
  /** ISO date (`YYYY-MM-DD`) of the last change to the text. */
  lastUpdated: string;
  /** True until legal review: the page shows the DRAFT banner. */
  draft: boolean;
  /** Paragraphs before the sections. */
  intro: string[];
  sections: LegalSection[];
};

/** Pages with at least this many sections get a table of contents. */
export const TOC_MIN_SECTIONS = 4;

export type InlinePart = string | { text: string; href: string };

const LINK = /\[([^\]]+)\]\(((?:\/|#)[^)\s]*)\)/g;

/** Splits text into plain runs and internal links (`[text](/path)` or `[text](#id)`). */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label = "", href = ""] = match;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ text: label, href });
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** "2026-11-18" → "November 18, 2026" (UTC, so prerender and the browser agree). */
export function formatLegalDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
