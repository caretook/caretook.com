import { describe, expect, it } from "vitest";
import { pastSections, upcomingSections } from "./upcomingDays";

const LA = "America/Los_Angeles";
// Wednesday, Nov 18, 2026, 10:00 AM in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00.000Z");

type Item = {
  id: string;
  occurredAt: string;
  timeZone: string;
  endsAt?: string | null;
  allDay?: boolean;
  cancelledAt?: string | null;
};
const at = (id: string, occurredAt: string, extra: Partial<Item> = {}): Item => ({
  id,
  occurredAt,
  timeZone: LA,
  ...extra,
});
const shape = (sections: { key: string; label: string; items: Item[] }[]) =>
  sections.map((s) => [s.label, s.items.map((i) => i.id)]);

describe("upcomingSections", () => {
  it("puts items in progress first, then days soonest first, all-day first in a day", () => {
    const items = [
      at("later-today", "2026-11-18T22:00:00.000Z"),
      at("tomorrow", "2026-11-19T17:30:00.000Z"),
      // All day Thursday (midnight in Los Angeles).
      at("tomorrow-all-day", "2026-11-19T08:00:00.000Z", { allDay: true }),
      at("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T18:15:00.000Z" }),
      at("saturday", "2026-11-21T19:00:00.000Z", { cancelledAt: "2026-11-17T00:00:00.000Z" }),
      at("past", "2026-11-18T17:00:00.000Z"),
    ];
    expect(shape(upcomingSections(items, NOW, LA, "en-US"))).toEqual([
      ["Now", ["visit"]],
      ["Today", ["later-today"]],
      ["Tomorrow", ["tomorrow-all-day", "tomorrow"]],
      ["Saturday, Nov 21", ["saturday"]],
    ]);
  });

  it("never puts a cancelled item under Now: it stays in its day until it ends", () => {
    const items = [
      at("later-today", "2026-11-18T22:00:00.000Z"),
      at("cancelled-visit", "2026-11-18T17:30:00.000Z", {
        endsAt: "2026-11-18T18:15:00.000Z",
        cancelledAt: "2026-11-17T00:00:00.000Z",
      }),
      at("visit", "2026-11-18T17:45:00.000Z", { endsAt: "2026-11-18T18:30:00.000Z" }),
    ];
    expect(shape(upcomingSections(items, NOW, LA, "en-US"))).toEqual([
      ["Now", ["visit"]],
      ["Today", ["cancelled-visit", "later-today"]],
    ]);
    const after = new Date("2026-11-18T18:20:00.000Z");
    expect(shape(upcomingSections(items, after, LA, "en-US"))).toEqual([
      ["Now", ["visit"]],
      ["Today", ["later-today"]],
    ]);
  });

  it("drops an item once its time passes, and one in progress once it ends", () => {
    const items = [
      at("soon", "2026-11-18T18:00:30.000Z"),
      at("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T18:01:00.000Z" }),
    ];
    expect(shape(upcomingSections(items, NOW, LA, "en-US"))).toEqual([
      ["Now", ["visit"]],
      ["Today", ["soon"]],
    ]);
    expect(upcomingSections(items, new Date("2026-11-18T18:01:00.000Z"), LA)).toEqual([]);
  });

  it("keeps an all-day item under Today until its day ends", () => {
    const allDay = at("all-day", "2026-11-18T08:00:00.000Z", { allDay: true });
    expect(shape(upcomingSections([allDay], NOW, LA, "en-US"))).toEqual([["Today", ["all-day"]]]);
    expect(upcomingSections([allDay], new Date("2026-11-19T08:00:00.000Z"), LA)).toEqual([]);
  });

  it("lists an all-day item under its own day when the viewer is elsewhere", () => {
    // All day Wednesday in Los Angeles starts at 9 PM Tuesday in Pago Pago:
    // it's still listed under Wednesday.
    const allDay = at("all-day", "2026-11-18T08:00:00.000Z", { allDay: true });
    const [section] = upcomingSections([allDay], NOW, "Pacific/Pago_Pago", "en-US");
    expect(section?.key).toBe("2026-11-18");
    expect(section?.label).toBe("Today");
  });
});

describe("pastSections", () => {
  it("lists past items newest first by day, leaving out what's still on", () => {
    const items = [
      at("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T18:15:00.000Z" }),
      at("today-all-day", "2026-11-18T08:00:00.000Z", { allDay: true }),
      at("this-morning", "2026-11-18T16:00:00.000Z"),
      at("yesterday", "2026-11-17T20:00:00.000Z", { cancelledAt: "2026-11-16T00:00:00.000Z" }),
      at("last-week", "2026-11-11T20:00:00.000Z"),
    ];
    expect(shape(pastSections(items, NOW, LA, "en-US"))).toEqual([
      ["Today", ["this-morning"]],
      ["Yesterday", ["yesterday"]],
      ["Wednesday, Nov 11", ["last-week"]],
    ]);
  });
});
