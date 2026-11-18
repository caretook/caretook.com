import { describe, expect, it } from "vitest";

import { MARKETING_ICONS } from "../sections/icons";
import { MARKETING_LINKS } from "../site/pages";
import { content } from "./content";

const nonEmpty = (s: string | undefined) => typeof s === "string" && s.trim().length > 0;

describe("features content", () => {
  it("has a title and a search-length description", () => {
    expect(nonEmpty(content.meta.title)).toBe(true);
    expect(content.meta.description.length).toBeGreaterThanOrEqual(70);
    expect(content.meta.description.length).toBeLessThanOrEqual(200);
  });

  it("has one h1 (the intro heading) and a lead", () => {
    expect(nonEmpty(content.intro.heading) && nonEmpty(content.intro.lead)).toBe(true);
  });

  it("covers the timeline, notes written together, sharing and roles, and offline", () => {
    const ids = content.showcases.map((s) => s.id);
    for (const id of ["timeline", "notes-together", "sharing", "offline"]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every section a heading, text and a known icon", () => {
    for (const s of content.showcases) {
      expect(s.id).toMatch(/^[a-z][a-z-]*$/);
      expect(nonEmpty(s.heading)).toBe(true);
      expect(s.paragraphs.length).toBeGreaterThan(0);
      for (const p of [...s.paragraphs, ...(s.points ?? [])]) expect(nonEmpty(p)).toBe(true);
      expect(MARKETING_ICONS).toHaveProperty(s.icon);
    }
  });

  it("says what's coming: medications and providers", () => {
    const text = content.coming.items.map((i) => i.title).join(" ");
    expect(text).toMatch(/medications/i);
    expect(text).toMatch(/providers/i);
    for (const item of content.coming.items) expect(MARKETING_ICONS).toHaveProperty(item.icon);
  });

  it("ends with both calls to action", () => {
    expect(content.cta.actions.map((a) => a.href)).toEqual([MARKETING_LINKS.waitlist, MARKETING_LINKS.join]);
  });
});
