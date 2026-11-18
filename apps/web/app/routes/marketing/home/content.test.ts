import { describe, expect, it } from "vitest";

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

  it("has one h1 (the hero heading) and a lead", () => {
    expect(nonEmpty(homeContent.hero.heading)).toBe(true);
    expect(nonEmpty(homeContent.hero.lead)).toBe(true);
  });

  it("offers both calls to action: the waitlist and an access code", () => {
    expect(homeContent.hero.primary).toEqual({ label: "Join the waitlist", href: MARKETING_LINKS.waitlist });
    expect(homeContent.hero.secondary?.href).toBe(MARKETING_LINKS.join);
    // The waitlist link lands on the waitlist band.
    expect(MARKETING_LINKS.waitlist).toBe(`/#${homeContent.waitlist.id}`);
  });

  it("says it's free while in early access", () => {
    expect(homeContent.hero.eyebrow).toMatch(/free/i);
    expect(homeContent.earlyAccess.heading).toMatch(/free while in early access/i);
  });

  const sections = [
    homeContent.helps,
    homeContent.steps,
    homeContent.promise,
    homeContent.earlyAccess,
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

  it("keeps the privacy promise: no ads, not sold, no trackers, no AI training, deletion", () => {
    const text = homeContent.promise.items.map((i) => `${i.title} ${i.body}`).join(" ");
    for (const point of [/no ads/i, /sell/i, /trackers/i, /train/i, /delete/i]) expect(text).toMatch(point);
  });
});
