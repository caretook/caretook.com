import { describe, expect, test } from "vitest";
import { BRAND } from "~/components/brand";
import * as faq from "../faq/route";
import { homeContent } from "../home/content";
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

// Home's hero is the lockup: the full logo (name, tagline tucked under it)
// is the page's only h1, then the descriptor, above the lead.
test.each([420, 1280])(
  "at %i home leads with the lockup, in order, with no sideways scroll",
  async (width) => {
    const { screen } = await openMarketing("/", { width });
    const { lockup, lead } = homeContent.hero;
    const h1 = screen.getByRole("heading", { level: 1 });
    await expect.element(h1).toBeVisible();
    await expect.element(h1).toHaveAccessibleName(`${BRAND.name} ${BRAND.tagline}`);
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    const hero = h1.element();
    const part = (name: string) => hero.querySelector(`[data-logo-part="${name}"]`);
    expect(part("name")?.textContent).toBe("Caretook");
    expect(part("tagline")?.textContent).toBe("Care, taken.");
    const descriptor = document.querySelector('[data-lockup-part="descriptor"]');
    expect(descriptor?.textContent).toBe(lockup.descriptor);
    await expect.element(screen.getByText(lockup.descriptor, { exact: true })).toBeVisible();
    const box = (el: Element | null | undefined) => el?.getBoundingClientRect();
    const [name, tagline] = [box(part("name")), box(part("tagline"))];
    // The tagline sits tucked under the name, not a line apart.
    expect(name && tagline && tagline.top - name.bottom).toBeLessThan(16);
    const tops = [name, tagline, box(descriptor)].map((r) => r?.top ?? NaN);
    const leadTop = screen.getByText(lead, { exact: true }).element().getBoundingClientRect().top;
    expect([...tops, leadTop]).toEqual([...tops, leadTop].sort((a, b) => a - b));
    expect(new Set(tops).size, "each part on its own line").toBe(tops.length);
    expect(scrollsSideways(), "no horizontal scroll").toBe(false);
  },
);

test("the inner pages keep their own heading as the h1, with no lockup", async () => {
  const { screen } = await openMarketing("/features");
  await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
  expect(document.querySelector("[data-lockup]")).toBeNull();
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
