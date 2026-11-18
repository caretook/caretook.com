import { describe, expect, it } from "vitest";

import {
  DEFAULT_OG_IMAGE,
  DEFAULT_SITE_URL,
  marketingMeta,
  organizationJsonLd,
  pageTitle,
  resolveSiteUrl,
  siteUrlFrom,
} from "./meta";

type Tag = Record<string, unknown>;
const find = (tags: Tag[], key: string, value: string) => tags.find((t) => t[key] === value);
const content = (tags: Tag[], key: string, value: string) => find(tags, key, value)?.content;

describe("resolveSiteUrl", () => {
  it("uses APP_URL's origin, without a trailing slash or path", () => {
    expect(resolveSiteUrl("https://staging.caretook.com/")).toBe("https://staging.caretook.com");
    expect(resolveSiteUrl("http://localhost:6273/app")).toBe("http://localhost:6273");
  });

  it("falls back to caretook.com when unset or unusable", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("not a url")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("javascript:alert(1)")).toBe(DEFAULT_SITE_URL);
  });
});

describe("siteUrlFrom", () => {
  it("finds the marketing layout's loader data among the matches", () => {
    const matches = [{ loaderData: undefined }, { loaderData: { siteUrl: "https://x.test" } }, undefined];
    expect(siteUrlFrom(matches)).toBe("https://x.test");
  });

  it("falls back when no match carries it", () => {
    expect(siteUrlFrom([{ loaderData: null }])).toBe(DEFAULT_SITE_URL);
  });
});

describe("pageTitle", () => {
  it("adds the site name unless the title has it", () => {
    expect(pageTitle("Features")).toBe("Features · Caretook");
    expect(pageTitle("Caretook: keep track")).toBe("Caretook: keep track");
  });
});

describe("marketingMeta", () => {
  const tags = marketingMeta({
    title: "Features",
    description: "What Caretook does.",
    path: "/features",
    siteUrl: "https://caretook.com",
  }) as Tag[];

  it("sets the title, description and canonical URL", () => {
    expect(find(tags, "title", "Features · Caretook")).toBeTruthy();
    expect(content(tags, "name", "description")).toBe("What Caretook does.");
    expect(tags.filter((t) => t.rel === "canonical")).toEqual([
      { tagName: "link", rel: "canonical", href: "https://caretook.com/features" },
    ]);
  });

  it("sets Open Graph tags, with the default share image as an absolute URL", () => {
    expect(content(tags, "property", "og:type")).toBe("website");
    expect(content(tags, "property", "og:site_name")).toBe("Caretook");
    expect(content(tags, "property", "og:title")).toBe("Features · Caretook");
    expect(content(tags, "property", "og:description")).toBe("What Caretook does.");
    expect(content(tags, "property", "og:url")).toBe("https://caretook.com/features");
    expect(content(tags, "property", "og:image")).toBe("https://caretook.com/og-default.png");
    expect(content(tags, "property", "og:image:width")).toBe("1200");
    expect(content(tags, "property", "og:image:height")).toBe("630");
    expect(content(tags, "property", "og:image:alt")).toBe(DEFAULT_OG_IMAGE.alt);
  });

  it("sets a large-image Twitter card", () => {
    expect(content(tags, "name", "twitter:card")).toBe("summary_large_image");
    expect(content(tags, "name", "twitter:title")).toBe("Features · Caretook");
    expect(content(tags, "name", "twitter:description")).toBe("What Caretook does.");
    expect(content(tags, "name", "twitter:image")).toBe("https://caretook.com/og-default.png");
  });

  it("uses a page's own image, and emits JSON-LD", () => {
    const own = marketingMeta({
      title: "Home",
      description: "d",
      path: "/",
      siteUrl: "http://localhost:6273",
      image: { path: "/shots/timeline.webp", width: 840, height: 1800, alt: "The timeline" },
      jsonLd: [organizationJsonLd("http://localhost:6273")],
    }) as Tag[];
    expect(own.find((t) => t.rel === "canonical")?.href).toBe("http://localhost:6273/");
    expect(content(own, "property", "og:image")).toBe("http://localhost:6273/shots/timeline.webp");
    expect(content(own, "property", "og:image:alt")).toBe("The timeline");
    expect(own.filter((t) => "script:ld+json" in t)).toEqual([
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Caretook",
          url: "http://localhost:6273/",
          logo: "http://localhost:6273/icons/icon-512.png",
        },
      },
    ]);
  });

  it("emits each tag once", () => {
    const keys = tags.map((t) => JSON.stringify([t.title, t.name, t.property, t.rel]));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
