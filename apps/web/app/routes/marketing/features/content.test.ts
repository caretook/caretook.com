import { describe, expect, it } from "vitest";

import { MARKETING_ICONS } from "../sections/icons";
import { MARKETING_LINKS } from "../site/pages";
import { content as faq } from "../faq/content";
import { homeContent } from "../home/content";
import { content } from "./content";

const nonEmpty = (s: string | undefined) => typeof s === "string" && s.trim().length > 0;

/** Every string in a value, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

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

  // The quick entry and easy mode blocks lead, right after the timeline (B-887, B-888).
  it("opens with the timeline, then quick entry, then easy mode", () => {
    expect(content.showcases.slice(0, 3).map((s) => s.id)).toEqual(["timeline", "quick-entry", "easy-mode"]);
    const easy = content.showcases.find((s) => s.id === "easy-mode");
    expect(easy?.paragraphs.length).toBeGreaterThan(0);
    expect(easy?.points?.length ?? 0).toBeGreaterThan(0);
    expect(MARKETING_ICONS).toHaveProperty(easy?.icon ?? "");
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

  // Everything built is a main block (plans/marketing-2-prd.md, US 3 and 4).
  it("has a block for every part of the app that exists today", () => {
    const ids = content.showcases.map((s) => s.id);
    for (const id of [
      "quick-entry",
      "vitals",
      "medications",
      "todos",
      "planner",
      "calendars",
      "providers",
      "care-periods",
      "profile",
      "printouts",
      "search",
      "assistants",
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it("names only the printouts that exist: the medication list, the weekly bedside sheet and the profile", () => {
    const printouts = content.showcases.find((s) => s.id === "printouts");
    expect(printouts?.points).toHaveLength(3);
    expect(printouts?.points?.join(" ")).toMatch(/medication list.*weekly bedside sheet.*profile sheet/i);
  });

  it("says where your own Claude or ChatGPT is set up", () => {
    const assistants = content.showcases.find((s) => s.id === "assistants");
    const text = [assistants?.heading, ...(assistants?.paragraphs ?? [])].join(" ");
    for (const word of ["Claude", "ChatGPT", "Group settings, under Assistants", "Settings, under Devices"]) {
      expect(text).toContain(word);
    }
  });

  // The app's word for a calendar item is "event" (docs/domain/appointments.md).
  it("says event or visit, never appointment, on features and home", () => {
    for (const text of [...strings(content), ...strings(homeContent)]) {
      expect(/appointment/i.test(text), text).toBe(false);
    }
  });

  it("lists nothing as coming: no band for it, and no built feature said to be on its way", () => {
    expect(content).not.toHaveProperty("coming");
    for (const [page, value] of [
      ["features", content],
      ["home", homeContent],
      ["FAQ", faq],
    ] as const) {
      for (const text of strings(value)) {
        // "as soon as you're back online" is the one "soon" that stays.
        expect(
          /coming[\s-]+soon|(?<!\bas )\bsoon\b|\bnot yet\b|\bon the way\b/i.test(text),
          `${page}: "${text}"`,
        ).toBe(false);
      }
    }
  });

  it("ends with both calls to action", () => {
    expect(content.cta.actions.map((a) => a.href)).toEqual([MARKETING_LINKS.waitlist, MARKETING_LINKS.join]);
  });
});
