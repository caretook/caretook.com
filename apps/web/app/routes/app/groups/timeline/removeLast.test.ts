import { describe, expect, it } from "vitest";
import { lastEntryName, REMOVE_WINDOW_MS, removableEntry } from "./removeLast";

const now = new Date("2026-11-19T18:00:00.000Z");
const made = (msAgo: number) => ({ created_at: new Date(now.getTime() - msAgo).toISOString() });

describe("removableEntry", () => {
  it("is your latest entry for 30 minutes after you added it", () => {
    expect(removableEntry(made(0), now)).toEqual(made(0));
    expect(removableEntry(made(REMOVE_WINDOW_MS), now)).toEqual(made(REMOVE_WINDOW_MS));
    expect(removableEntry(made(-60_000), now)).toEqual(made(-60_000));
    // PowerSync's text, with microseconds.
    const synced = { created_at: "2026-11-19T17:45:00.123000Z" };
    expect(removableEntry(synced, now)).toBe(synced);
    expect(removableEntry({ created_at: "2026-11-19T17:29:00.000000Z" }, now)).toBeNull();
  });

  it("is nothing after that, or with no entry", () => {
    expect(removableEntry(made(REMOVE_WINDOW_MS + 1), now)).toBeNull();
    expect(removableEntry(null, now)).toBeNull();
  });
});

describe("lastEntryName", () => {
  it("says the kind and its name or title", () => {
    expect(lastEntryName({ kind: "symptom", title: null, details: '{"name":"Feeling","severity":3}' })).toBe(
      "Symptom: Feeling",
    );
    expect(lastEntryName({ kind: "note", title: "Lunch", details: null })).toBe("Note: Lunch");
    expect(lastEntryName({ kind: "vital", title: null, details: '{"readings":[]}' })).toBe("Vitals");
    expect(lastEntryName({ kind: "dose", title: null, details: "{bad" })).toBe("Dose");
    expect(lastEntryName({ kind: "future", title: null, details: null })).toBe("Entry");
  });
});
