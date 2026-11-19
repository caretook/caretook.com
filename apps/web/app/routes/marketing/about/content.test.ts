import { describe, expect, it } from "vitest";

import { content } from "./content";

const nonEmpty = (s: string | undefined) => typeof s === "string" && s.trim().length > 0;

describe("about content", () => {
  it("has a title, a search-length description, and one h1", () => {
    expect(nonEmpty(content.meta.title)).toBe(true);
    expect(content.meta.description.length).toBeGreaterThanOrEqual(70);
    expect(content.meta.description.length).toBeLessThanOrEqual(200);
    expect(nonEmpty(content.intro.heading) && nonEmpty(content.intro.lead)).toBe(true);
  });

  it("says why Caretook exists and who's behind it", () => {
    const ids = content.sections.map((s) => s.id);
    expect(ids).toContain("why");
    expect(ids).toContain("who");
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of content.sections) {
      expect(nonEmpty(s.heading)).toBe(true);
      expect(s.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it("marks the team's own copy as a placeholder until it's written", () => {
    expect(content.sections.find((s) => s.id === "who")?.placeholder).toBe(true);
  });
});
