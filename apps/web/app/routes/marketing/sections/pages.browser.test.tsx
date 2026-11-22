import { describe, expect, test } from "vitest";
import * as faq from "../faq/route";
import { openMarketing, scrollsSideways, SITE_URL } from "../marketingWorld";

// The inner pages (features, FAQ, About) on one device, moved down from
// marketing.spec.mjs: one h1 and no sideways scroll at both widths, images
// lazy but for at most one, and the FAQ's JSON-LD matching what it shows.
// Every screenshot's alt text and file are site/screenshots.test.ts's; that
// the built site serves each as SVG stays in the browser check.

const INNER = ["/features", "/faq", "/about"];

describe.each(INNER)("%s", (path) => {
  test.each([420, 1280])("at %i: one h1, no sideways scroll, images lazy but at most one", async (width) => {
    const { screen } = await openMarketing(path, { width });
    await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(scrollsSideways(), "no horizontal scroll").toBe(false);
    const eager = [...document.querySelectorAll("main img")].filter(
      (img) => (img as HTMLImageElement).loading !== "lazy",
    );
    expect(eager.length, "eager images").toBeLessThanOrEqual(1);
  });
});

test("the FAQ's JSON-LD matches its visible questions and answers", async () => {
  const { screen } = await openMarketing("/faq");
  await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
  const visible = [...document.querySelectorAll("[data-faq-item]")].map((item) => ({
    q: item.querySelector("h3")?.textContent?.trim(),
    a: [...item.querySelectorAll("p")].map((p) => p.textContent?.trim()).join("\n\n"),
  }));
  const tags = faq.meta({ matches: [{ loaderData: { siteUrl: SITE_URL } }] } as never) as Record<
    string,
    unknown
  >[];
  const ld = tags.flatMap((t) => ("script:ld+json" in t ? [t["script:ld+json"]] : [])) as {
    "@type": string;
    mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
  }[];
  const faqPage = ld.find((d) => d["@type"] === "FAQPage");
  expect(visible.length).toBeGreaterThan(0);
  expect(faqPage?.mainEntity?.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(visible);
});
