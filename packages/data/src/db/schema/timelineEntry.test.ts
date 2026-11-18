import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "./timelineEntry";

const base = { occurredAt: "2026-11-17T12:00:00.000Z", timeZone: "America/Los_Angeles" };
const paths = (input: unknown) => {
  const parsed = timelineEntryContentZSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.path.join("."));
};

describe("note content", () => {
  it("needs no body or title: its text is its live document", () => {
    expect(paths({ ...base, kind: "note" })).toEqual([]);
    expect(paths({ ...base, kind: "note", body: null, title: null })).toEqual([]);
    expect(paths({ ...base, kind: "note", title: "Morning" })).toEqual([]);
  });

  it("rejects a body, even an empty one", () => {
    expect(paths({ ...base, kind: "note", body: "Ate lunch" })).toEqual(["body"]);
    expect(paths({ ...base, kind: "note", body: "" })).toEqual(["body"]);
  });
});

describe("event content", () => {
  it("still needs a title", () => {
    expect(paths({ ...base, kind: "event", title: "Physical therapy" })).toEqual([]);
    expect(paths({ ...base, kind: "event", title: " " })).toEqual(["title"]);
  });
});
