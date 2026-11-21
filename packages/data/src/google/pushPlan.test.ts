import type { CalendarItem } from "../db/schema";

import { describe, expect, it } from "vitest";
import { STATUS_PROPERTY, UID_PROPERTY } from "./client";
import { eventHash, googleEventId, planPush, toGoogleEvent } from "./pushPlan";

// The Google push plan (appointments-2 slice 7), on the appointments area's
// week (Thu 19 Nov 2026, Los Angeles). Names and places are made up.

const LA = "America/Los_Angeles";
const item = (v: Partial<CalendarItem> = {}): CalendarItem => ({
  uid: "entry:e1",
  source: { type: "entry", id: "e1" },
  groupId: "g1",
  kind: "appointment",
  allDay: false,
  start: "2026-11-19T17:00:00.000Z",
  end: "2026-11-19T18:00:00.000Z",
  timeZone: LA,
  status: "confirmed",
  recipientName: "Pat",
  title: "Dialysis",
  place: "Riverside Clinic",
  providers: ["Dr. Rivera"],
  series: null,
  appUrl: "https://caretook.example/app/groups/g1/entries/e1",
  ...v,
});

describe("googleEventId", () => {
  it("is stable per item and in Google's base32hex alphabet", () => {
    expect(googleEventId("entry:e1")).toBe(googleEventId("entry:e1"));
    expect(googleEventId("entry:e1")).not.toBe(googleEventId("entry:e2"));
    expect(googleEventId("task:t1")).toMatch(/^[a-v0-9]{5,1024}$/);
  });
});

describe("toGoogleEvent", () => {
  it("is generic by default: no title, place or provider", () => {
    const event = toGoogleEvent(item(), "generic");
    expect(event).toEqual({
      id: googleEventId("entry:e1"),
      summary: "Appointment for Pat",
      description:
        "Thu 19 Nov · 9:00–10:00\nOpen in Caretook: https://caretook.example/app/groups/g1/entries/e1",
      location: null,
      start: { dateTime: "2026-11-19T17:00:00.000Z", timeZone: LA },
      end: { dateTime: "2026-11-19T18:00:00.000Z", timeZone: LA },
      transparency: "opaque",
      privateProperties: { [UID_PROPERTY]: "entry:e1", [STATUS_PROPERTY]: "confirmed" },
    });
    expect(JSON.stringify(event)).not.toMatch(/Dialysis|Riverside|Rivera/);
  });

  it("adds the details with consent", () => {
    const event = toGoogleEvent(item(), "details");
    expect(event.summary).toBe("Appointment for Pat: Dialysis");
    expect(event.location).toBe("Riverside Clinic");
    expect(event.description).toContain("With Dr. Rivera");
  });

  it("keeps a cancelled appointment, marked cancelled and free", () => {
    const event = toGoogleEvent(item({ status: "cancelled" }), "generic");
    expect(event.summary).toBe("Cancelled: Appointment for Pat");
    expect(event.transparency).toBe("transparent");
    expect(event.privateProperties[STATUS_PROPERTY]).toBe("cancelled");
  });

  it("makes all-day items date events", () => {
    const event = toGoogleEvent(item({ allDay: true, start: "2026-11-19", end: "2026-11-20" }), "generic");
    expect(event.start).toEqual({ date: "2026-11-19" });
    expect(event.end).toEqual({ date: "2026-11-20" });
  });
});

describe("planPush", () => {
  const first = item();
  const second = item({
    uid: "task:t1",
    kind: "task",
    title: "Pick up the walker",
    place: null,
    providers: [],
  });
  const pushedAs = (i: CalendarItem, level: "generic" | "details" = "generic") => ({
    itemUid: i.uid,
    googleEventId: googleEventId(i.uid),
    pushedHash: eventHash(toGoogleEvent(i, level)),
  });

  it("writes every item on a first push", () => {
    const plan = planPush({ items: [first, second], links: [], level: "generic" });
    expect(plan.upserts.map((u) => u.uid)).toEqual(["entry:e1", "task:t1"]);
    expect(plan).toMatchObject({ deletes: [], unchanged: 0 });
  });

  it("makes no call for an item whose event hasn't changed", () => {
    const plan = planPush({
      items: [first, second],
      links: [pushedAs(first), pushedAs(second)],
      level: "generic",
    });
    expect(plan).toEqual({ upserts: [], deletes: [], unchanged: 2 });
  });

  it("writes an item that moved, and only that one", () => {
    const moved = item({ start: "2026-11-19T18:00:00.000Z", end: "2026-11-19T19:00:00.000Z" });
    const plan = planPush({
      items: [moved, second],
      links: [pushedAs(first), pushedAs(second)],
      level: "generic",
    });
    expect(plan.upserts.map((u) => u.uid)).toEqual(["entry:e1"]);
    expect(plan.unchanged).toBe(1);
  });

  it("rewrites everything when the level changes (details off)", () => {
    const plan = planPush({
      items: [first],
      links: [pushedAs(first, "details")],
      level: "generic",
    });
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0]!.event.summary).toBe("Appointment for Pat");
  });

  it("deletes the events of items that are gone (deleted, done, out of the window)", () => {
    const plan = planPush({ items: [first], links: [pushedAs(first), pushedAs(second)], level: "generic" });
    expect(plan.deletes).toEqual([pushedAs(second)]);
  });

  it("keeps the id Google gave an event made there", () => {
    const link = { ...pushedAs(first), googleEventId: "made-in-google-1", pushedHash: "old" };
    const plan = planPush({ items: [first], links: [link], level: "generic" });
    expect(plan.upserts[0]!.event.id).toBe("made-in-google-1");
  });

  it("hashes the same event the same, whatever the key order", () => {
    const event = toGoogleEvent(first, "generic");
    const shuffled = Object.fromEntries(Object.entries(event).reverse()) as typeof event;
    expect(eventHash(shuffled)).toBe(eventHash(event));
  });
});
