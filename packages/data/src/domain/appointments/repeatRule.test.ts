import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "../../db/schema/timeline/timelineEntry";
import { appointmentSeriesCreateZSchema } from "../../db/schema/appointments/appointmentSeries";
import { parseRule, repeatText, ruleText, seriesVisitId } from "./repeatRule";

const GROUP = "00000000-0000-4000-8000-000000000001";
const SERIES = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("repeatText", () => {
  const text = (rule: string, over: Partial<Parameters<typeof repeatText>[0]> = {}) =>
    repeatText({ rule, startTime: "06:00", startsOn: "2026-11-18", ...over });

  it("words each pattern", () => {
    expect(text("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20270131")).toBe(
      "Every Mon, Wed, Fri at 6:00 · until 31 Jan",
    );
    expect(text("FREQ=WEEKLY;INTERVAL=4;BYDAY=TU", { startTime: "09:30" })).toBe(
      "Every 4 weeks on Tue at 9:30",
    );
    expect(text("FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU", { startTime: null, allDay: true })).toBe(
      "Monthly on the 2nd Tuesday",
    );
    expect(text("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR", { startTime: "18:00" })).toBe(
      "Monthly on the last Friday at 18:00",
    );
    expect(text("FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=22", { allDay: true })).toBe(
      "Every 3 months on the 22nd",
    );
    expect(text("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1", { allDay: true })).toBe("Monthly on the last day");
    expect(text("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1", { startTime: "09:00" })).toBe(
      "Every 2 months on the last day at 9:00",
    );
    expect(text("FREQ=DAILY;INTERVAL=3;COUNT=12", { allDay: true })).toBe("Every 3 days · 12 visits");
    expect(text("FREQ=DAILY;INTERVAL=1", { startTime: "07:05" })).toBe("Every day at 7:05");
  });

  it("names the year of an end more than a year away, and counts reminders as times", () => {
    expect(text("FREQ=DAILY;INTERVAL=1;UNTIL=20280105", { allDay: true })).toBe(
      "Every day · until 5 Jan 2028",
    );
    expect(text("FREQ=WEEKLY;INTERVAL=1;BYDAY=SU;COUNT=1", { allDay: true, kind: "note" })).toBe(
      "Every Sun · 1 time",
    );
  });

  it("says only 'Repeats' for a rule it can't read", () => {
    expect(text("FREQ=YEARLY")).toBe("Repeats");
  });
});

describe("parseRule and ruleText", () => {
  it("round-trips each shape, days in week order", () => {
    for (const rule of [
      "FREQ=DAILY;INTERVAL=2",
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=12",
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31",
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1",
      "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1;COUNT=6",
      "FREQ=MONTHLY;INTERVAL=2;BYDAY=-1SU;UNTIL=20271231",
    ]) {
      const parsed = parseRule(rule);
      expect(parsed.ok && ruleText(parsed.rule)).toBe(rule);
    }
    expect(parseRule("FREQ=MONTHLY;BYMONTHDAY=-1")).toMatchObject({ rule: { monthly: { by: "lastDay" } } });
    const unordered = parseRule("FREQ=WEEKLY;BYDAY=FR,MO");
    expect(unordered.ok && ruleText(unordered.rule)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR");
  });

  it("refuses what Caretook doesn't write, with a reason", () => {
    const problem = (rule: string) => {
      const parsed = parseRule(rule);
      return parsed.ok ? null : parsed.problem;
    };
    expect(problem("FREQ=WEEKLY;INTERVAL=1")).toBe("Choose at least one day");
    expect(problem("FREQ=MONTHLY;INTERVAL=1")).toBe("Choose a date or a weekday in the month");
    expect(problem("FREQ=MONTHLY;BYMONTHDAY=3;BYDAY=1MO")).toBe("Choose a date or a weekday in the month");
    expect(problem("FREQ=MONTHLY;BYDAY=6MO")).toBe("Choose a date or a weekday in the month");
    for (const day of ["-2", "-31", "-01", "0", "32"])
      expect(problem(`FREQ=MONTHLY;BYMONTHDAY=${day}`)).toBe("Choose a date from 1 to 31");
    expect(problem("FREQ=WEEKLY;BYDAY=MO;BYMONTHDAY=-1")).toBe("This repeat isn't supported");
    expect(problem("FREQ=DAILY;COUNT=3;UNTIL=20270101")).toBe(
      "End on a date or after a number of visits, not both",
    );
    expect(problem("FREQ=DAILY;INTERVAL=0")).toBe("Repeat every 1 to 99");
    expect(problem("FREQ=DAILY;UNTIL=20270231")).toBe("Enter a valid end date");
    expect(problem("FREQ=YEARLY")).toBe("Choose daily, weekly or monthly");
    expect(problem("FREQ=DAILY;BYHOUR=9")).toBe("This repeat isn't supported");
    expect(problem("FREQ=DAILY;BYDAY=MO")).toBe("This repeat isn't supported");
  });
});

describe("seriesVisitId", () => {
  it("is stable, and differs by series and by day", () => {
    const id = seriesVisitId(SERIES, "2026-11-18");
    expect(id).toBe(seriesVisitId(SERIES.toUpperCase(), "2026-11-18"));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).not.toBe(seriesVisitId(SERIES, "2026-11-19"));
    expect(id).not.toBe(seriesVisitId(GROUP, "2026-11-18"));
    // Frozen: a device and the server derive the same id, so it may never change.
    expect(id).toBe("47ecab49-82f7-520b-b79e-e0b0a2392e9b");
  });
});

describe("the series create schema", () => {
  const valid = {
    groupId: GROUP,
    kind: "event" as const,
    rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
    startsOn: "2026-11-18",
    startTime: "06:00",
    timeZone: "America/Los_Angeles",
    title: "Dialysis",
    durationMinutes: 240,
  };
  const issues = (over: Record<string, unknown>) => {
    const res = appointmentSeriesCreateZSchema.safeParse({ ...valid, ...over });
    return res.success ? [] : res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  };

  it("accepts an appointment series, and refuses a note series (a reminder is a todo)", () => {
    expect(issues({})).toEqual([]);
    expect(
      issues({
        kind: "note",
        title: null,
        durationMinutes: null,
        startTime: null,
        allDay: true,
        rule: "FREQ=MONTHLY;BYDAY=2TU",
      }),
    ).toEqual(["kind: A series makes events"]);
  });

  it("refuses a weekly rule without days, a monthly one without a date or weekday, and COUNT with UNTIL", () => {
    expect(issues({ rule: "FREQ=WEEKLY;INTERVAL=1" })).toEqual(["rule: Choose at least one day"]);
    expect(issues({ rule: "FREQ=MONTHLY;INTERVAL=1" })).toEqual([
      "rule: Choose a date or a weekday in the month",
    ]);
    expect(issues({ rule: "FREQ=DAILY;COUNT=2;UNTIL=20270101" })).toEqual([
      "rule: End on a date or after a number of visits, not both",
    ]);
    expect(issues({ rule: "FREQ=DAILY;UNTIL=20261117" })).toEqual([
      "rule: The end date is before the first day",
    ]);
  });

  it("refuses kinds other than appointments, and mixed timing", () => {
    expect(issues({ kind: "vital" })).toEqual(["kind: A series makes events"]);
    expect(issues({ startTime: null })).toEqual(["startTime: Choose a time, or all day"]);
    expect(issues({ allDay: true })).toEqual([
      "startTime: An all-day item has no time",
      "durationMinutes: An all-day item has no end time",
    ]);
    expect(issues({ title: "" })).toEqual(["title: Enter a title"]);
    expect(issues({ providerIds: [SERIES, SERIES] })).toEqual(["providerIds: A provider is listed twice"]);
  });
});

describe("an entry's series fields", () => {
  const base = { occurredAt: "2026-11-18T17:00:00.000Z", timeZone: "America/Los_Angeles", details: null };

  it("are for notes and events only", () => {
    const visit = { seriesId: SERIES, seriesDay: "2026-11-18" };
    expect(
      timelineEntryContentZSchema.safeParse({ ...base, kind: "event", title: "PT", ...visit }).success,
    ).toBe(true);
    expect(
      timelineEntryContentZSchema.safeParse({ ...base, kind: "note", ...visit, seriesDetached: true })
        .success,
    ).toBe(true);
    const symptom = timelineEntryContentZSchema.safeParse({
      ...base,
      kind: "symptom",
      details: { name: "Pain" },
      ...visit,
    });
    expect(symptom.success ? [] : symptom.error.issues.map((i) => i.message)).toEqual([
      "Only notes and events repeat",
      "Only notes and events repeat",
    ]);
  });

  it("need both the series and its day", () => {
    const res = timelineEntryContentZSchema.safeParse({
      ...base,
      kind: "event",
      title: "PT",
      seriesId: SERIES,
    });
    expect(res.success ? [] : res.error.issues.map((i) => i.message)).toEqual([
      "A series visit needs its series and its day",
    ]);
  });
});
