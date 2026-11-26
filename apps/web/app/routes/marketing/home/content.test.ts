import { describe, expect, it } from "vitest";

import { BRAND } from "~/components/brand";
import { MARKETING_ICONS } from "../sections/icons";
import { MARKETING_LINKS } from "../site/pages";
import { homeContent } from "./content";

// The home content module's shape: what the page needs to render well, so a
// copy edit can't drop a heading, an icon or a call to action unnoticed.
const nonEmpty = (s: string | undefined) => typeof s === "string" && s.trim().length > 0;

describe("homeContent", () => {
  it("has a title and a search-length description", () => {
    expect(nonEmpty(homeContent.meta.title)).toBe(true);
    expect(homeContent.meta.description.length).toBeGreaterThanOrEqual(70);
    expect(homeContent.meta.description.length).toBeLessThanOrEqual(200);
  });

  it("leads with the lockup: the descriptor with the founder clause, and a lead", () => {
    expect(homeContent.hero.lockup).toEqual({
      descriptor: "A care notebook for families, made by caregivers who've been there.",
    });
    expect("heading" in homeContent.hero).toBe(false);
    expect(nonEmpty(homeContent.hero.lead)).toBe(true);
  });

  it("carries the tagline in its title and the descriptor's first clause in its description", () => {
    expect(homeContent.meta.title).toBe(`${BRAND.name}: ${BRAND.tagline}`);
    // The founder clause stays out of the description: with it, the description
    // would pass the search length the first test holds it to.
    const [first = ""] = homeContent.hero.lockup.descriptor.split(",");
    expect(first).toBe("A care notebook for families");
    // The description says "The free care notebook…": the clause past its article.
    expect(homeContent.meta.description).toContain(first.replace(/^A /, ""));
  });

  it("offers both calls to action: the waitlist and an access code", () => {
    expect(homeContent.hero.primary.href).toBe(MARKETING_LINKS.waitlist);
    expect(homeContent.hero.secondary?.href).toBe(MARKETING_LINKS.join);
    // The waitlist link lands on the waitlist band.
    expect(MARKETING_LINKS.waitlist).toBe(`/#${homeContent.waitlist.id}`);
  });

  const sections = [
    homeContent.helps,
    homeContent.steps,
    homeContent.promise,
    homeContent.price,
    homeContent.waitlist,
  ];

  it("gives every section a unique id and a heading", () => {
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(s.id).toMatch(/^[a-z][a-z-]*$/);
      expect(nonEmpty(s.heading)).toBe(true);
    }
  });

  it("gives every item a title, a body and a known icon", () => {
    for (const items of [homeContent.helps.items, homeContent.promise.items]) {
      expect(items.length).toBeGreaterThanOrEqual(3);
      for (const item of items) {
        expect(nonEmpty(item.title)).toBe(true);
        expect(nonEmpty(item.body)).toBe(true);
        expect(MARKETING_ICONS).toHaveProperty(item.icon);
      }
    }
    expect(homeContent.steps.items).toHaveLength(3);
    for (const step of homeContent.steps.items) {
      expect(nonEmpty(step.title) && nonEmpty(step.body)).toBe(true);
    }
  });

  it("picks four or five things it helps with, medications among them, and nothing as coming", () => {
    const { items } = homeContent.helps;
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items.map((i) => i.icon)).toContain("medications");
    expect(homeContent.hero.lead).toMatch(/medications/);
    expect(homeContent.hero.lead).not.toMatch(/\bsoon\b/i);
  });

  it("keeps the privacy promise: no ads, not sold, no trackers, no AI training, deletion", () => {
    const text = homeContent.promise.items.map((i) => `${i.title} ${i.body}`).join(" ");
    for (const point of [/no ads/i, /sell/i, /trackers/i, /train/i, /delete/i]) expect(text).toMatch(point);
  });

  it("labels every waitlist field and thanks the visitor", () => {
    const { email, firstName, caringFor, heardFrom, submit, sending, thanks } = homeContent.waitlist.form;
    for (const field of [email, firstName, caringFor, heardFrom]) expect(nonEmpty(field.label)).toBe(true);
    expect(nonEmpty(caringFor.none) && nonEmpty(submit) && nonEmpty(sending)).toBe(true);
    expect(nonEmpty(thanks.heading) && nonEmpty(thanks.body)).toBe(true);
    expect(homeContent.waitlist.actions.map((a) => a.href)).toContain(MARKETING_LINKS.join);
  });
});
