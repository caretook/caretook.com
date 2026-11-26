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

  // The founders' own words, approved on 2026-11-25: compared character for
  // character with plans/marketing-2-plan.md (slice 4). A failure here is a
  // question for the user, never a reason to edit either side.
  it("tells the founder story word for word", () => {
    const story = content.sections.find((s) => s.id === "who");
    expect(story?.heading).toBe("Why we built Caretook");
    expect(story?.paragraphs).toEqual([
      "We're Bo and Tedder, partners in Mars Hill, North Carolina, and we've both been family caregivers.",
      "In early 2025, Tedder's father was diagnosed with stage IV lung cancer and died within a few months. Bo's father lived with multiple sclerosis for decades. Bo and his mother cared for him nearly full time through his last two years, until he died in hospice in the fall of 2026.",
      "The illnesses were different, but the work was the same. We kept medical details straight, tracked medications, kept doctors and family on the same page, and made hard decisions without all the facts. The timeline, printable medication sheets and visit notes we pieced together turned out to be the most useful things we had. Bringing all of it to an AI assistant helped us make sense of everything and keep up with the constant choices.",
      "We came to it from different directions. Tedder brought clinical and disaster resilience training to the hard conversations and the crises. Bo brought twenty years of building software and the habit of turning a mess into a system. Between us, we could see how those rough tools could become something better, for families who don't have the time to build their own.",
      "We cared for each other through both losses. Caretook is the tool we wish we'd had the energy to build while we were in the middle of it, made for any family managing long-term care, so the next family doesn't have to start from scratch.",
    ]);
  });

  it("gives both founders' bios word for word, right under the story", () => {
    const at = content.sections.findIndex((s) => s.id === "who");
    expect(
      content.sections.slice(at + 1).map(({ id, heading, paragraphs }) => ({ id, heading, paragraphs })),
    ).toEqual([
      {
        id: "tedder",
        heading: "Tedder, MS, MSW, LCSW, LCASA",
        paragraphs: [
          "Co-founder. Master's degrees in social work and disaster resilience leadership from Tulane University.",
        ],
      },
      {
        id: "bo",
        heading: "Bo Davis",
        paragraphs: [
          "Co-founder. 20 years building software and leading technology teams, including as a startup CTO.",
        ],
      },
    ]);
  });

  it("has no placeholder copy left", () => {
    expect(content.sections.some((s) => "placeholder" in s && s.placeholder)).toBe(false);
  });

  it("names the co-founder Tedder, with no pronoun for Tedder", () => {
    const sentences = content.sections
      .filter((s) => ["who", "tedder", "bo"].includes(s.id))
      .flatMap((s) => [s.heading, ...s.paragraphs.flatMap((p) => p.split(/(?<=\.)\s+/))]);
    const third = /\b(he|him|his|she|her|hers|they|them|their|theirs)\b/i;
    const naming = sentences.filter((s) => s.includes("Tedder"));
    expect(naming.length).toBeGreaterThanOrEqual(4);
    // No sentence that names Tedder has a third-person pronoun at all.
    for (const s of naming) expect(third.test(s), s).toBe(false);
    // "He", "him" and "his" are Bo's father's and Bo's, in sentences without Tedder.
    expect(sentences.filter((s) => /\b(he|him|his|she|her|hers)\b/i.test(s))).toEqual([
      "Bo and his mother cared for him nearly full time through his last two years, until he died in hospice in the fall of 2026.",
    ]);
  });
});
