import { describe, expect, it } from "vitest";

import { content } from "./content";

const nonEmpty = (s: string | undefined) => typeof s === "string" && s.trim().length > 0;

describe("the contact page's content", () => {
  it("has a title, a search-length description, one heading and a lead", () => {
    expect(nonEmpty(content.meta.title)).toBe(true);
    expect(content.meta.description.length).toBeGreaterThanOrEqual(70);
    expect(content.meta.description.length).toBeLessThanOrEqual(200);
    expect(nonEmpty(content.heading) && nonEmpty(content.lead)).toBe(true);
  });

  it("labels every field and says thanks", () => {
    const { name, email, topic, message, submit, sending, thanks } = content.form;
    for (const field of [name, email, topic, message]) expect(nonEmpty(field.label)).toBe(true);
    expect(nonEmpty(topic.none) && nonEmpty(submit) && nonEmpty(sending)).toBe(true);
    expect(nonEmpty(thanks.heading) && nonEmpty(thanks.body)).toBe(true);
  });

  it("tells people how to reach us about privacy", () => {
    expect(content.notes.some((n) => /privacy/i.test(n.heading))).toBe(true);
  });
});
