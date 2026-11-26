import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND } from "../../../components/brand/name";

import { content as about } from "../about/content";
import { content as contact } from "../contact/content";
import { content as faq } from "../faq/content";
import { content as features } from "../features/content";
import { homeContent } from "../home/content";
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

  it("gives home the tagline and every other page its own name", () => {
    expect(pageTitle(homeContent.meta.title)).toBe("Caretook: Care, taken.");
    expect(pageTitle(features.meta.title)).toBe("Features · Caretook");
    expect(pageTitle(faq.meta.title)).toBe("FAQ · Caretook");
    expect(pageTitle(about.meta.title)).toBe("About · Caretook");
    expect(pageTitle(contact.meta.title)).toBe("Contact · Caretook");
  });

  it("carries the descriptor in the descriptions of home, features, FAQ and About", () => {
    for (const page of [homeContent, features, faq, about]) {
      expect(page.meta.description).toMatch(/care notebook for families/i);
    }
  });
});

describe("the share image", () => {
  const { name, tagline } = BRAND;
  const { descriptor } = homeContent.hero.lockup;
  const publicFile = (path: string) =>
    readFileSync(fileURLToPath(new URL(`../../../../public${path}`, import.meta.url)));

  it("has the lockup as its alt text", () => {
    expect(DEFAULT_OG_IMAGE.alt).toBe(`${name}. ${tagline} ${descriptor}`);
  });

  it("is drawn from an SVG source that says the same words", () => {
    const svg = publicFile(DEFAULT_OG_IMAGE.path.replace(/\.png$/, ".svg")).toString("utf8");
    const words = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    // The descriptor is too long for one line: it's drawn as two, between the
    // tagline and the site's address.
    expect(words.slice(0, 2)).toEqual([name, tagline]);
    expect(words.slice(2, -1)).toHaveLength(2);
    expect(words.slice(2, -1).join(" ")).toBe(descriptor);
    expect(words.at(-1)).toBe("caretook.com");
    expect(svg).toContain(`viewBox="0 0 ${DEFAULT_OG_IMAGE.width} ${DEFAULT_OG_IMAGE.height}"`);
  });

  it("is a PNG of the size the tags give", () => {
    const png = publicFile(DEFAULT_OG_IMAGE.path);
    expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
    // The IHDR chunk: width then height, big-endian, from byte 16.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
      DEFAULT_OG_IMAGE.width,
      DEFAULT_OG_IMAGE.height,
    ]);
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
