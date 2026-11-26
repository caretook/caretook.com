import { describe, expect, it } from "vitest";

import type { ProseContent } from "../sections/types";
import { content } from "./content";

const subsOf = (s: ProseContent) => s.subsections ?? [];

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
      expect(s.paragraphs.length + subsOf(s).length).toBeGreaterThan(0);
    }
  });

  it("puts the bios under Who we are and the thanks after them", () => {
    const ids = content.sections.map((s) => s.id);
    expect(ids.slice(ids.indexOf("who"))).toEqual(["who", "who-we-are", "thanks"]);
    for (const id of ["who-we-are", "thanks"]) {
      const s = content.sections.find((s) => s.id === id);
      expect(s && subsOf(s).length).toBeGreaterThan(0);
    }
  });

  it("has no placeholder copy left", () => {
    expect(content.sections.some((s) => "placeholder" in s && s.placeholder)).toBe(false);
  });

  it("uses no pronoun in a sentence that names Tedder", () => {
    const sentences = content.sections
      .flatMap((s) => [
        s.heading,
        ...s.paragraphs,
        ...subsOf(s).flatMap((sub) => [sub.heading, ...sub.paragraphs]),
      ])
      .flatMap((p) => p.split(/(?<=\.)\s+/));
    const third = /\b(he|him|his|she|her|hers|they|them|their|theirs)\b/i;
    for (const s of sentences.filter((s) => s.includes("Tedder"))) expect(third.test(s), s).toBe(false);
  });
});
