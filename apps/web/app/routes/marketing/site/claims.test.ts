import { describe, expect, it } from "vitest";

import { content as about } from "../about/content";
import { content as contact } from "../contact/content";
import { content as faq, faqItems } from "../faq/content";
import { content as features } from "../features/content";
import { homeContent } from "../home/content";
import { layoutContent } from "../layout/content";
import * as meta from "./meta";
import { MARKETING_PAGES } from "./pages";
import * as price from "./price";

// Claims discipline (plans/marketing-prd.md, _Messaging update_): the words the
// non-legal pages never say, and the price promise said once. The legal pages
// (privacy, terms, the health data notice) are out of this test on purpose.

/** Every string in a value, however deep (ids and hrefs too); functions are skipped. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

// Never name a competitor (plans/marketing-prd.md, _Messaging update_): show
// the difference instead. A short list of the care apps a family might know;
// any spacing or hyphen between a name's words still matches.
const COMPETITORS = [
  "Caring Village",
  "CaringBridge",
  "Lotsa Helping Hands",
  "ianacare",
  "CareZone",
  "Carely",
  "Medisafe",
];

const namePattern = (name: string) => new RegExp(`\\b${name.split(" ").join("[\\s-]*")}\\b`, "i");

const BANNED: [name: string, pattern: RegExp][] = [
  ["early access", /early[\s-]*access/i],
  ["HIPAA", /hipaa/i],
  ["free forever", /free[\s-]*forever/i],
  // "Secure" as a claim says nothing a family can check. "Security" as the
  // name of a topic (the FAQ's group heading) is allowed.
  ["a bare secure", /\b(in)?secure(ly|d)?\b/i],
  // Until downloading all your data exists (B-52).
  ["export anytime", /export (it |your data )?(anytime|any time|whenever)/i],
  ...COMPETITORS.map((name): [string, RegExp] => [`the competitor ${name}`, namePattern(name)]),
];

const SOURCES: [name: string, value: unknown][] = [
  ["home", homeContent],
  ["features", features],
  ["FAQ", faq],
  ["About", about],
  ["Contact", contact],
  ["the header and footer", layoutContent],
  ["the page links", MARKETING_PAGES.map((page) => page.label)],
  ["the meta module", { ...meta }],
  ["the price module", { ...price }],
];

describe("claims discipline", () => {
  it("finds the copy it checks", () => {
    for (const [, value] of SOURCES) expect(strings(value).length).toBeGreaterThan(0);
    expect(strings(homeContent)).toContain(homeContent.hero.lead);
    expect(strings(faq)).toContain(faqItems.at(-1)!.answer.at(-1));
    expect(strings({ ...meta })).toContain(meta.DEFAULT_OG_IMAGE.alt);
    expect(strings(contact)).toContain(contact.notes.at(-1)!.body);
    expect(strings(layoutContent)).toContain(layoutContent.header.waitlist);
    expect(strings(layoutContent)).toContain(layoutContent.footer.blurb);
  });

  for (const [source, value] of SOURCES) {
    it(`never says a banned phrase in ${source}`, () => {
      for (const text of strings(value)) {
        for (const [name, pattern] of BANNED) {
          expect(pattern.test(text), `${source} says ${name}: "${text}"`).toBe(false);
        }
      }
    });
  }

  it("catches each banned phrase, and lets the topic word through", () => {
    const caught = (text: string) => BANNED.some(([, pattern]) => pattern.test(text));
    for (const text of [
      "Free while in early access",
      "an early-access band",
      "HIPAA compliant",
      "Free forever",
      "Is our information secure?",
      "Stored securely",
      "Export anytime",
      ...COMPETITORS,
      "Unlike caring village, we print",
      "Better than CaringBridge.",
      "lotsa-helping-hands",
    ]) {
      expect(caught(text), text).toBe(true);
    }
    for (const text of [
      "Privacy and security",
      "privacy-and-security",
      "free, always",
      "caring for a village of helpers",
      "Carelyn's notes",
    ]) {
      expect(caught(text), text).toBe(false);
    }
  });
});

describe("the price promise", () => {
  it("is one sentence shared by home's price band and the FAQ's cost answer", () => {
    expect(homeContent.price.body).toBe(price.PRICE_PROMISE);
    const cost = faqItems.find((item) => item.question === "What does Caretook cost?");
    expect(cost?.answer).toEqual([price.PRICE_PROMISE]);
    // Written once: no page carries its own copy of it.
    for (const [source, value] of SOURCES.slice(0, 4)) {
      const copies = strings(value).filter((text) => text.includes("free, always"));
      expect(
        copies.every((text) => text === price.PRICE_PROMISE),
        source,
      ).toBe(true);
    }
  });

  it("ties free to the essentials and keeps early families' essentials free", () => {
    expect(price.PRICE_PROMISE).toMatch(/^The essentials \(.*medications.*\) are free, always\./);
    expect(price.PRICE_PROMISE).toMatch(/early families keep what they have, free\.$/);
  });

  it("heads the hero, the features page and the price band", () => {
    expect(price.PRICE_HEADLINE).toBe("Free for families");
    expect(homeContent.hero.eyebrow).toBe(price.PRICE_HEADLINE);
    expect(features.intro.eyebrow).toBe(price.PRICE_HEADLINE);
    expect(homeContent.price.heading).toBe(price.PRICE_HEADLINE);
    expect(features.cta.body).toMatch(/free for families/i);
  });
});
