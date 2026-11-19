import { describe, expect, it } from "vitest";
import {
  DISMISSED_KEEP,
  msUntilEnd,
  parseDeviceAnnouncement,
  pickAnnouncement,
  withDismissed,
} from "./announcement";

// The banner's rule (admin slice 6): fetched over cached, nothing once ended
// or dismissed.

const now = Date.parse("2026-11-19T12:00:00Z");
const a = { id: "a1", text: "Maintenance tonight", tone: "info" as const, endsAt: null };
const b = { id: "b2", text: "Slow sync", tone: "warning" as const, endsAt: "2026-11-19T13:00:00.000Z" };

describe("pickAnnouncement", () => {
  it("shows the fetched one over the cached one", () => {
    expect(pickAnnouncement({ fetched: b, cached: a, dismissed: [], now })).toBe(b);
  });

  it("shows nothing when the server says there's none, even with one cached", () => {
    expect(pickAnnouncement({ fetched: null, cached: a, dismissed: [], now })).toBeNull();
  });

  it("shows the cached one while the server hasn't answered (offline, native)", () => {
    expect(pickAnnouncement({ fetched: undefined, cached: a, dismissed: [], now })).toBe(a);
    expect(pickAnnouncement({ fetched: undefined, cached: null, dismissed: [], now })).toBeNull();
  });

  it("shows nothing once it has ended, cached or fetched", () => {
    const later = Date.parse("2026-11-19T13:00:00Z");
    expect(pickAnnouncement({ fetched: undefined, cached: b, dismissed: [], now: later })).toBeNull();
    expect(pickAnnouncement({ fetched: b, cached: null, dismissed: [], now: later })).toBeNull();
    expect(pickAnnouncement({ fetched: b, cached: null, dismissed: [], now: later - 1 })).toBe(b);
  });

  it("shows nothing for a dismissed one, and a new one again", () => {
    expect(pickAnnouncement({ fetched: a, cached: null, dismissed: ["a1"], now })).toBeNull();
    expect(pickAnnouncement({ fetched: undefined, cached: a, dismissed: ["a1"], now })).toBeNull();
    expect(pickAnnouncement({ fetched: b, cached: a, dismissed: ["a1"], now })).toBe(b);
  });
});

describe("parseDeviceAnnouncement", () => {
  it("accepts an announcement and fills a missing end", () => {
    expect(parseDeviceAnnouncement(a)).toEqual(a);
    expect(parseDeviceAnnouncement({ id: "x", text: "t", tone: "warning" })).toEqual({
      id: "x",
      text: "t",
      tone: "warning",
      endsAt: null,
    });
  });

  it("refuses anything else", () => {
    for (const bad of [null, "a1", 3, [], { ...a, id: "" }, { ...a, tone: "loud" }, { ...a, endsAt: 5 }]) {
      expect(parseDeviceAnnouncement(bad)).toBeNull();
    }
  });
});

describe("withDismissed", () => {
  it("adds an id once, newest last, and keeps the newest few", () => {
    expect(withDismissed(["a", "b"], "a")).toEqual(["b", "a"]);
    const many = Array.from({ length: DISMISSED_KEEP }, (_, i) => `id${i}`);
    const next = withDismissed(many, "new");
    expect(next).toHaveLength(DISMISSED_KEEP);
    expect(next.at(-1)).toBe("new");
    expect(next).not.toContain("id0");
  });
});

describe("msUntilEnd", () => {
  it("counts down to the end, never below zero, and is null without one", () => {
    expect(msUntilEnd(b, now)).toBe(3_600_000);
    expect(msUntilEnd(b, now + 4_000_000)).toBe(0);
    expect(msUntilEnd(a, now)).toBeNull();
    expect(msUntilEnd(null, now)).toBeNull();
  });
});
