import { describe, expect, it } from "vitest";

import { faqPageJsonLd } from "../site/meta";
import { content, faqItems } from "./content";

const nonEmpty = (s: string | undefined) => typeof s === "string" && s.trim().length > 0;

describe("FAQ content", () => {
  it("has a title, a search-length description, and one h1", () => {
    expect(nonEmpty(content.meta.title)).toBe(true);
    expect(content.meta.description.length).toBeGreaterThanOrEqual(70);
    expect(content.meta.description.length).toBeLessThanOrEqual(200);
    expect(nonEmpty(content.intro.heading) && nonEmpty(content.intro.lead)).toBe(true);
  });

  it("gives every group an id and heading, and every item a question and an answer", () => {
    const ids = content.groups.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of content.groups) {
      expect(group.id).toMatch(/^[a-z][a-z-]*$/);
      expect(nonEmpty(group.heading)).toBe(true);
      expect(group.items.length).toBeGreaterThan(0);
    }
    for (const item of faqItems) {
      expect(item.question).toMatch(/\?$/);
      expect(item.answer.length).toBeGreaterThan(0);
      for (const p of item.answer) expect(nonEmpty(p)).toBe(true);
    }
    const questions = faqItems.map((i) => i.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("builds FAQPage JSON-LD with exactly the visible questions and answers, in order", () => {
    const ld = faqPageJsonLd(faqItems);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((q) => q.name)).toEqual(faqItems.map((i) => i.question));
    const first = faqItems[0]!;
    expect(ld.mainEntity[0]).toEqual({
      "@type": "Question",
      name: first.question,
      acceptedAnswer: { "@type": "Answer", text: first.answer.join("\n\n") },
    });
  });
});
