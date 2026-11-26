import type { MetaDescriptor } from "react-router";

/**
 * SEO and share tags for marketing pages. Pure: the site URL comes from the
 * marketing layout's loader (`APP_URL` on the server, read at prerender).
 */
export const SITE_NAME = "Caretook";
export const DEFAULT_SITE_URL = "https://caretook.com";

/**
 * The default share image (1200×630) and the square logo, in `public/`. The
 * image is the lockup (home's hero): its source is `public/og-default.svg`,
 * rendered to the PNG by `node scripts/build/share-image.mjs`. Change the
 * words in the SVG, here and in home's content together, then render again.
 */
export const DEFAULT_OG_IMAGE = {
  path: "/og-default.png",
  width: 1200,
  height: 630,
  alt: "Caretook. Care, taken. The free care notebook for families, built by caregivers who've been there.",
};
export const LOGO_PATH = "/icons/icon-512.png";

/** `APP_URL` → an origin with no trailing slash; anything unusable falls back to caretook.com. */
export function resolveSiteUrl(value: string | undefined): string {
  if (!value) return DEFAULT_SITE_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** The marketing layout's loader data, found from any child's meta `matches`. */
export function siteUrlFrom(matches: readonly ({ loaderData?: unknown } | undefined)[]): string {
  for (const match of matches) {
    const data = match?.loaderData as { siteUrl?: unknown } | undefined;
    if (typeof data?.siteUrl === "string") return data.siteUrl;
  }
  return DEFAULT_SITE_URL;
}

export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl + "/").toString();
}

/** "Features" → "Features · Caretook"; a title that already names Caretook (home's "Caretook: Care, taken.") is kept. */
export function pageTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
}

export type MarketingMetaInput = {
  title: string;
  description: string;
  path: string;
  siteUrl: string;
  image?: { path: string; width: number; height: number; alt: string };
  /** JSON-LD objects, each emitted as its own `<script type="application/ld+json">`. */
  jsonLd?: object[];
};

export function marketingMeta({
  title,
  description,
  path,
  siteUrl,
  image = DEFAULT_OG_IMAGE,
  jsonLd = [],
}: MarketingMetaInput): MetaDescriptor[] {
  const fullTitle = pageTitle(title);
  const url = absoluteUrl(siteUrl, path);
  const imageUrl = absoluteUrl(siteUrl, image.path);
  return [
    { title: fullTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: imageUrl },
    { property: "og:image:width", content: String(image.width) },
    { property: "og:image:height", content: String(image.height) },
    { property: "og:image:alt", content: image.alt },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: image.alt },
    ...jsonLd.map((data) => ({ "script:ld+json": data })),
  ];
}

/** `Organization` structured data (home). */
export function organizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl(siteUrl, "/"),
    logo: absoluteUrl(siteUrl, LOGO_PATH),
  };
}

/**
 * `FAQPage` structured data (the FAQ): the same questions and answers the page
 * shows, in order. Paragraphs are joined with a blank line.
 */
export function faqPageJsonLd(items: readonly { question: string; answer: readonly string[] }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer.join("\n\n") },
    })),
  };
}
