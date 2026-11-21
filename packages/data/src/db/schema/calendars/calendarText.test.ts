import type { CalendarItem } from "./calendarItems";

import { describe, expect, it } from "vitest";
import { CALENDAR_ITEM_KINDS, calendarItems } from "./calendarItems";
import { calendarText, calendarWhen } from "./calendarText";

// calendarText (appointments-2): generic by default, details only at the
// `details` level, and never anything a CalendarItem doesn't carry. Times
// on the appointments area's week (Thu 19 Nov 2026), names made up.

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
  place: "Riverside Clinic, 12 Elm St",
  providers: ["Dr. Rivera", "Riverside Clinic"],
  series: null,
  appUrl: "https://caretook.example/app/groups/g1/entries/e1",
  ...v,
});

describe("calendarText, generic", () => {
  it("says what it is, for whom, when, and links back: nothing else", () => {
    expect(calendarText(item(), "generic")).toEqual({
      summary: "Appointment for Pat",
      when: "Thu 19 Nov · 9:00–10:00",
      location: null,
      description:
        "Thu 19 Nov · 9:00–10:00\nOpen in Caretook: https://caretook.example/app/groups/g1/entries/e1",
    });
    expect(calendarText(item({ kind: "appointment" }), "generic").summary).toBe("Appointment for Pat");
    expect(JSON.stringify(CALENDAR_ITEM_KINDS)).not.toMatch(/reminder/i);
    expect(calendarText(item({ kind: "todo" }), "generic").summary).toBe("Todo for Pat");
  });

  it("never holds the title, place or providers, for any kind or status", () => {
    for (const kind of CALENDAR_ITEM_KINDS)
      for (const status of ["confirmed", "cancelled"] as const)
        for (const allDay of [false, true]) {
          const subject = item({
            kind,
            status,
            allDay,
            ...(allDay && { start: "2026-11-19", end: "2026-11-20" }),
          });
          const text = JSON.stringify(calendarText(subject, "generic"));
          for (const secret of ["Dialysis", "Riverside", "Elm St", "Rivera"])
            expect(text).not.toContain(secret);
        }
  });
});

describe("calendarText, details", () => {
  it("never holds a note's text, even with details on", () => {
    // A whole row, body and details included, as the services would pass it.
    const row = {
      id: "e2",
      groupId: "g1",
      kind: "event" as const,
      occurredAt: "2026-11-19T17:00:00.000Z",
      timeZone: LA,
      endsAt: null,
      allDay: false,
      title: "Dialysis",
      body: "Bring the insurance card and ask about the fistula",
      details: { name: "fistula pain" },
      place: null,
      cancelledAt: null,
      deletedAt: null,
      createdAt: "2026-11-10T17:00:00.000Z",
      seriesId: null,
      seriesDay: null,
      seriesDetached: false,
    };
    const [projected] = calendarItems({
      entries: [row],
      todos: [],
      recipient: { displayName: "Pat", timeZone: LA },
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-12-01T00:00:00.000Z"),
      appUrl: "https://caretook.example",
    });
    const text = JSON.stringify([projected, calendarText(projected!, "details")]);
    expect(text).not.toMatch(/insurance|fistula/);
  });

  it("adds the title, place and providers' names", () => {
    expect(calendarText(item(), "details")).toEqual({
      summary: "Appointment for Pat: Dialysis",
      when: "Thu 19 Nov · 9:00–10:00",
      location: "Riverside Clinic, 12 Elm St",
      description:
        "Thu 19 Nov · 9:00–10:00\nWith Dr. Rivera, Riverside Clinic\nOpen in Caretook: https://caretook.example/app/groups/g1/entries/e1",
    });
  });

  it("stays generic where there's nothing to add", () => {
    const bare = calendarText(item({ title: null, place: null, providers: [] }), "details");
    expect(bare.summary).toBe("Appointment for Pat");
    expect(bare.location).toBeNull();
    expect(bare.description).not.toContain("With");
  });
});

describe("calendarText, status and time", () => {
  it("marks a cancelled appointment", () => {
    expect(calendarText(item({ status: "cancelled" }), "generic").summary).toBe(
      "Cancelled: Appointment for Pat",
    );
    expect(calendarText(item({ status: "cancelled" }), "details").summary).toBe(
      "Cancelled: Appointment for Pat: Dialysis",
    );
  });

  it("reads times in the zone asked for (a member elsewhere)", () => {
    expect(calendarText(item(), "generic", "America/New_York").when).toBe("Thu 19 Nov · 12:00–13:00");
    expect(calendarText(item(), "generic", "Europe/London").when).toBe("Thu 19 Nov · 17:00–18:00");
  });
});

describe("calendarWhen", () => {
  it("gives a todo only its start (its end is made up)", () => {
    expect(calendarWhen(item({ kind: "todo" }), LA)).toBe("Thu 19 Nov · 9:00");
  });

  it("names both days across midnight", () => {
    const late = item({ start: "2026-11-20T06:00:00.000Z", end: "2026-11-20T09:00:00.000Z" });
    expect(calendarWhen(late, LA)).toBe("Thu 19 Nov 22:00 – Fri 20 Nov 1:00");
  });

  it("says All day for a day span, the same in any zone", () => {
    const day = item({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    expect(calendarWhen(day, LA)).toBe("Thu 19 Nov · All day");
    expect(calendarWhen(day, "Asia/Tokyo")).toBe("Thu 19 Nov · All day");
    expect(calendarWhen({ ...day, end: "2026-11-21" }, LA)).toBe("Thu 19 Nov – Fri 20 Nov · All day");
  });
});
