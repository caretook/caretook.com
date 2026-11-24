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
      summary: "Event for Pat",
      when: "Thu, Nov 19 · 9:00–10:00 AM PST",
      location: null,
      description:
        "Thu, Nov 19 · 9:00–10:00 AM PST\nOpen in Caretook: https://caretook.example/app/groups/g1/entries/e1",
    });
    expect(calendarText(item({ kind: "appointment" }), "generic").summary).toBe("Event for Pat");
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
      summary: "Event for Pat: Dialysis",
      when: "Thu, Nov 19 · 9:00–10:00 AM PST",
      location: "Riverside Clinic, 12 Elm St",
      description:
        "Thu, Nov 19 · 9:00–10:00 AM PST\nWith Dr. Rivera, Riverside Clinic\nOpen in Caretook: https://caretook.example/app/groups/g1/entries/e1",
    });
  });

  it("stays generic where there's nothing to add", () => {
    const bare = calendarText(item({ title: null, place: null, providers: [] }), "details");
    expect(bare.summary).toBe("Event for Pat");
    expect(bare.location).toBeNull();
    expect(bare.description).not.toContain("With");
  });
});

describe("calendarText, status and time", () => {
  it("marks a cancelled appointment", () => {
    expect(calendarText(item({ status: "cancelled" }), "generic").summary).toBe("Cancelled: Event for Pat");
    expect(calendarText(item({ status: "cancelled" }), "details").summary).toBe(
      "Cancelled: Event for Pat: Dialysis",
    );
  });

  it("reads times in the zone asked for (a member elsewhere)", () => {
    expect(calendarText(item(), "generic", "America/New_York").when).toBe("Thu, Nov 19 · 12:00–1:00 PM EST");
    expect(calendarText(item(), "generic", "Europe/London").when).toBe("Thu, Nov 19 · 5:00–6:00 PM GMT");
  });
});

describe("calendarWhen", () => {
  it("gives a todo only its start (its end is made up)", () => {
    expect(calendarWhen(item({ kind: "todo" }), LA)).toBe("Thu, Nov 19 · 9:00 AM PST");
  });

  it("names both days across midnight", () => {
    const late = item({ start: "2026-11-20T06:00:00.000Z", end: "2026-11-20T09:00:00.000Z" });
    expect(calendarWhen(late, LA)).toBe("Thu, Nov 19 10:00 PM – Fri, Nov 20 1:00 AM PST");
  });

  it("writes AM/PM once when both ends share it, and at each end when they don't", () => {
    const noon = item({ start: "2026-11-19T19:30:00.000Z", end: "2026-11-19T21:00:00.000Z" });
    expect(calendarWhen(noon, LA)).toBe("Thu, Nov 19 · 11:30 AM–1:00 PM PST");
    const midnight = item({ start: "2026-11-19T08:00:00.000Z", end: "2026-11-19T09:00:00.000Z" });
    expect(calendarWhen(midnight, LA)).toBe("Thu, Nov 19 · 12:00–1:00 AM PST");
    const midday = item({ start: "2026-11-19T20:00:00.000Z", end: "2026-11-19T20:30:00.000Z" });
    expect(calendarWhen(midday, LA)).toBe("Thu, Nov 19 · 12:00–12:30 PM PST");
  });

  it("names the zone for the instant shown: daylight time in July", () => {
    const july = item({ start: "2026-07-16T16:00:00.000Z", end: "2026-07-16T17:00:00.000Z" });
    expect(calendarWhen(july, LA)).toBe("Thu, Jul 16 · 9:00–10:00 AM PDT");
    expect(calendarWhen({ ...july, kind: "todo" }, LA)).toBe("Thu, Jul 16 · 9:00 AM PDT");
  });

  it("names both zones for a range across a clock change", () => {
    // Sun 1 Nov 2026, Los Angeles falls back at 2:00 (PDT → PST).
    const sameDay = item({ start: "2026-11-01T08:30:00.000Z", end: "2026-11-01T09:30:00.000Z" });
    expect(calendarWhen(sameDay, LA)).toBe("Sun, Nov 1 · 1:30 AM PDT–1:30 AM PST");
    const overnight = item({ start: "2026-11-01T06:00:00.000Z", end: "2026-11-01T11:00:00.000Z" });
    expect(calendarWhen(overnight, LA)).toBe("Sat, Oct 31 11:00 PM PDT – Sun, Nov 1 3:00 AM PST");
  });

  it("falls back to Intl's name for a zone with no US abbreviation", () => {
    expect(calendarWhen(item(), "Europe/Paris")).toBe("Thu, Nov 19 · 6:00–7:00 PM GMT+1");
    expect(calendarWhen(item(), "Asia/Tokyo")).toBe("Fri, Nov 20 · 2:00–3:00 AM GMT+9");
  });

  it("keeps the wording on a cancelled event, with its prefix on the summary only", () => {
    const text = calendarText(item({ status: "cancelled" }), "generic");
    expect(text.summary).toBe("Cancelled: Event for Pat");
    expect(text.when).toBe("Thu, Nov 19 · 9:00–10:00 AM PST");
    expect(text.description.split("\n")[0]).toBe("Thu, Nov 19 · 9:00–10:00 AM PST");
  });

  it("says All day for a day span, the same in any zone", () => {
    const day = item({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    expect(calendarWhen(day, LA)).toBe("Thu, Nov 19 · All day");
    expect(calendarWhen(day, "Asia/Tokyo")).toBe("Thu, Nov 19 · All day");
    expect(calendarWhen({ ...day, end: "2026-11-21" }, LA)).toBe("Thu, Nov 19 – Fri, Nov 20 · All day");
  });
});
