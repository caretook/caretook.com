import type { CalendarItem } from "@caretook/data/schema";

import { describe, expect, it } from "vitest";
import { renderIcs } from "./renderIcs";

// The feed's rendering against golden files (renderIcs.golden/): generic and
// details, all-day, cancelled, and a series visit. Fictional people. The
// golden files are compared with LF line endings; the real output is CRLF.

const NOW = new Date("2026-11-18T18:00:00Z");
const APP_URL = "https://app.caretook.test";
const options = { calendarName: "Caretook: Pat", appUrl: APP_URL, now: NOW };

const item = (patch: Partial<CalendarItem> & Pick<CalendarItem, "uid">): CalendarItem => ({
  source: { type: "entry", id: patch.uid.split(":")[1]! },
  groupId: "g1",
  kind: "appointment",
  allDay: false,
  start: "2026-11-19T17:00:00.000Z",
  end: "2026-11-19T18:00:00.000Z",
  timeZone: "America/Los_Angeles",
  status: "confirmed",
  recipientName: "Pat",
  title: "Kidney check with Dr. Lee",
  place: "Mercy Clinic, 4 Elm St",
  providers: ["Dr. Lee"],
  series: null,
  appUrl: `${APP_URL}/app/groups/g1/entry/${patch.uid.split(":")[1]}`,
  ...patch,
});

const ITEMS: CalendarItem[] = [
  item({ uid: "entry:a1" }),
  item({
    uid: "entry:a2",
    status: "cancelled",
    title: "Physical therapy",
    place: null,
    providers: [],
    start: "2026-11-20T18:00:00.000Z",
    end: "2026-11-20T19:00:00.000Z",
  }),
  item({
    uid: "entry:a3",
    kind: "reminder",
    allDay: true,
    start: "2026-11-21",
    end: "2026-11-22",
    title: "Order refills",
    place: null,
    providers: [],
  }),
  item({
    uid: "task:t1",
    source: { type: "task", id: "t1" },
    kind: "task",
    start: "2026-11-23T16:30:00.000Z",
    end: "2026-11-23T17:00:00.000Z",
    title: "Pick up the walker",
    place: null,
    providers: [],
    appUrl: `${APP_URL}/app/groups/g1/tasks`,
  }),
  item({
    uid: "entry:s1",
    title: "Dialysis",
    place: "Dialysis center",
    providers: [],
    series: { id: "series1", day: "2026-11-24", detached: false },
    start: "2026-11-24T14:00:00.000Z",
    end: "2026-11-24T18:00:00.000Z",
  }),
  item({
    uid: "entry:s2",
    title: "Dialysis",
    place: "Dialysis center",
    providers: [],
    series: { id: "series1", day: "2026-11-26", detached: false },
    start: "2026-11-26T14:00:00.000Z",
    end: "2026-11-26T18:00:00.000Z",
  }),
];

const lf = (ics: string) => ics.replaceAll("\r\n", "\n");

describe("renderIcs", () => {
  it("renders the generic feed", async () => {
    const ics = renderIcs(ITEMS, "generic", options);
    await expect(lf(ics)).toMatchFileSnapshot("./renderIcs.golden/generic.ics");
  });

  it("renders the details feed", async () => {
    const ics = renderIcs(ITEMS, "details", options);
    await expect(lf(ics)).toMatchFileSnapshot("./renderIcs.golden/details.ics");
  });

  it("never lets a title, place or provider into the generic feed", () => {
    const ics = renderIcs(ITEMS, "generic", options);
    for (const secret of [
      "Kidney",
      "Dr. Lee",
      "Mercy",
      "Elm St",
      "Physical",
      "Order refills",
      "walker",
      "Dialysis",
    ])
      expect(ics).not.toContain(secret);
  });

  it("uses CRLF lines, UTC times for timed items and DATE values for all-day ones", () => {
    const ics = renderIcs(ITEMS, "generic", options);
    expect(ics).toContain("\r\n");
    expect(ics).toContain("DTSTART:20261119T170000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261121");
    expect(ics).toContain("DTEND;VALUE=DATE:20261122");
  });

  it("marks only the cancelled appointment cancelled, with stable UIDs at our domain", () => {
    const ics = lf(renderIcs(ITEMS, "generic", options));
    expect(ics.match(/STATUS:CANCELLED/g)).toHaveLength(1);
    expect(ics).toContain("UID:entry:a2@app.caretook.test");
    expect(ics).toContain("UID:task:t1@app.caretook.test");
    expect(renderIcs(ITEMS, "generic", options)).toContain("UID:entry:a1@app.caretook.test");
  });

  it("writes each series visit as its own event with no repeat rule", () => {
    const ics = renderIcs(ITEMS, "details", options);
    expect(ics.match(/UID:entry:s\d@/g)).toHaveLength(2);
    expect(ics).not.toContain("RRULE");
  });

  it("is a valid empty calendar with nothing in it", () => {
    const ics = renderIcs([], "generic", options);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
