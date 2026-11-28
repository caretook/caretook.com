import { describe, expect, it } from "vitest";

import { BRAND } from "../../../components/brand/name";
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

  it("leads with the lockup: a two-clause descriptor, and a lead", () => {
    expect(Object.keys(homeContent.hero.lockup)).toEqual(["descriptor"]);
    expect(homeContent.hero.lockup.descriptor).toContain(",");
    expect("heading" in homeContent.hero).toBe(false);
    expect(nonEmpty(homeContent.hero.lead)).toBe(true);
  });

  it("carries the tagline in its title, and keeps the founder clause out of the description", () => {
    expect(homeContent.meta.title).toBe(`${BRAND.name}: ${BRAND.tagline}`);
    // With the founder clause, the description would pass the search length
    // the first test holds it to.
    const [, founder = ""] = homeContent.hero.lockup.descriptor.split(", ");
    expect(nonEmpty(founder)).toBe(true);
    expect(homeContent.meta.description).not.toContain(founder.replace(/\.$/, ""));
  });

  it("says what it keeps track of in one sentence of at most 25 words", () => {
    const { lead } = homeContent.hero;
    expect(lead).toMatch(/^[A-Z][^.!?]*\.$/);
    expect(lead.split(/\s+/).length).toBeLessThanOrEqual(25);
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
