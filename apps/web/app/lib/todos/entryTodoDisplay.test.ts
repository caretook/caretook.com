import { describe, expect, it } from "vitest";
import { entryLinkOptions, firstLine, linkedEntryName, openTodosMark } from "./entryTodoDisplay";

describe("the timeline's open-todo mark", () => {
  it("says 1 todo, 2 todos, and nothing at 0", () => {
    expect(openTodosMark(1)).toBe("1 todo");
    expect(openTodosMark(2)).toBe("2 todos");
    expect(openTodosMark(12)).toBe("12 todos");
    expect(openTodosMark(0)).toBeNull();
    expect(openTodosMark(undefined)).toBeNull();
  });
});

describe("a linked entry's name", () => {
  it("is its title, else its text's first line, else its kind", () => {
    expect(linkedEntryName({ kind: "event", title: "Cardiology follow-up" }, "Bring the log")).toBe(
      "Cardiology follow-up",
    );
    expect(
      linkedEntryName({ kind: "note", title: null }, "\n  Called the pharmacy  \nThey said Friday"),
    ).toBe("Called the pharmacy");
    expect(linkedEntryName({ kind: "note", title: "  " }, "")).toBe("Note");
    expect(linkedEntryName({ kind: "event", title: null }, null)).toBe("Event");
    expect(firstLine(undefined)).toBe("");
  });
});

describe("the Link an entry choices", () => {
  const LA = "America/Los_Angeles";
  // Wednesday 2027-06-09, 12:00 in Los Angeles.
  const now = new Date(Date.UTC(2027, 5, 9, 19, 0));
  const entries = [
    {
      id: "a",
      kind: "note",
      title: null,
      occurredAt: "2027-06-09T17:00:00.000Z",
      text: "Pharmacy called back",
    },
    { id: "b", kind: "event", title: "Eye exam", occurredAt: "2027-06-08T17:00:00.000Z", text: null },
    { id: "c", kind: "symptom", title: null, occurredAt: "2027-06-08T16:00:00.000Z", text: "pharmacy" },
    { id: "d", kind: "note", title: "Café visit", occurredAt: "2027-06-01T17:00:00.000Z", text: "Notes" },
  ];

  it("offers notes and events only, in the given order, with kind and day", () => {
    expect(entryLinkOptions(entries, "", now, { timeZone: LA, locale: "en-US" })).toEqual([
      { id: "a", label: "Pharmacy called back", description: "Note · Today" },
      { id: "b", label: "Eye exam", description: "Event · Yesterday" },
      { id: "d", label: "Café visit", description: "Note · Tuesday, Jun 1" },
    ]);
  });

  it("matches every typed word in the title or text, ignoring case and accents, and caps the list", () => {
    expect(entryLinkOptions(entries, "PHARMACY back", now, { timeZone: LA }).map((o) => o.id)).toEqual(["a"]);
    expect(entryLinkOptions(entries, "cafe", now, { timeZone: LA }).map((o) => o.id)).toEqual(["d"]);
    expect(entryLinkOptions(entries, "", now, { timeZone: LA }, 2).map((o) => o.id)).toEqual(["a", "b"]);
  });
});
