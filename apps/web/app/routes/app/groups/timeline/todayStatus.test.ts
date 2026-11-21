import { describe, expect, it } from "vitest";
import { attentionCounts, todayStatus, todaySummary } from "./todayStatus";

const LA = "America/Los_Angeles";
const MIN = 60_000;
const HOUR = 60 * MIN;
// 10:00 in Los Angeles on 2026-11-19 (18:00Z).
const NOW = new Date("2026-11-19T18:00:00.000Z");
const plus = (ms: number, from = NOW) => new Date(from.getTime() + ms).toISOString();

const appointment = (occurredAt: string, extra: { allDay?: boolean; endsAt?: string | null } = {}) => ({
  kind: "appointment" as const,
  entry: { id: "a", occurredAt, timeZone: LA, ...extra },
});

describe("todayStatus", () => {
  describe("medications", () => {
    const dose = (dueAt: string | null) => ({ kind: "medications" as const, dueAt });
    it("neutral before its time, and for tomorrow's pass", () => {
      expect(todayStatus(dose(plus(MIN)), NOW, LA)).toBe("neutral");
      expect(todayStatus(dose(null), NOW, LA)).toBe("neutral");
    });
    it("warning from the moment it's due until it's overdue", () => {
      expect(todayStatus(dose(plus(0)), NOW, LA)).toBe("warning");
      expect(todayStatus(dose(plus(-59 * MIN)), NOW, LA)).toBe("warning");
    });
    it("error once overdue (60 minutes past), and a minute into it", () => {
      expect(todayStatus(dose(plus(-60 * MIN)), NOW, LA)).toBe("error");
      expect(todayStatus(dose(plus(-61 * MIN)), NOW, LA)).toBe("error");
    });
  });

  describe("tasks", () => {
    it("error when overdue, neutral when due today", () => {
      expect(todayStatus({ kind: "tasks", overdue: true }, NOW, LA)).toBe("error");
      expect(todayStatus({ kind: "tasks", overdue: false }, NOW, LA)).toBe("neutral");
    });
  });

  describe("vitals", () => {
    it("neutral up to exactly a day old, warning past it", () => {
      expect(todayStatus({ kind: "vitals", latestAt: plus(-HOUR) }, NOW, LA)).toBe("neutral");
      expect(todayStatus({ kind: "vitals", latestAt: plus(-24 * HOUR) }, NOW, LA)).toBe("neutral");
      expect(todayStatus({ kind: "vitals", latestAt: plus(-24 * HOUR - MIN) }, NOW, LA)).toBe("warning");
    });
  });

  describe("appointments", () => {
    // 23:00 in Los Angeles: within 2 hours is tomorrow there.
    const LATE = new Date("2026-11-20T07:00:00.000Z");
    it("info at 2 h, neutral at 2 h 1 min (on another day)", () => {
      expect(todayStatus(appointment(plus(2 * HOUR, LATE)), LATE, LA)).toBe("info");
      expect(todayStatus(appointment(plus(2 * HOUR + MIN, LATE)), LATE, LA)).toBe("neutral");
    });
    it("info later today, however far off; neutral tomorrow", () => {
      expect(todayStatus(appointment(plus(13 * HOUR)), NOW, LA)).toBe("info"); // 23:00
      expect(todayStatus(appointment(plus(14 * HOUR + MIN)), NOW, LA)).toBe("neutral"); // 00:01 tomorrow
    });
    it("info while in progress, and for an all-day item today; neutral for an all-day item tomorrow", () => {
      expect(todayStatus(appointment(plus(-10 * MIN), { endsAt: plus(20 * MIN) }), NOW, LA)).toBe("info");
      expect(todayStatus(appointment("2026-11-19T08:00:00.000Z", { allDay: true }), NOW, LA)).toBe("info");
      expect(todayStatus(appointment("2026-11-20T08:00:00.000Z", { allDay: true }), NOW, LA)).toBe("neutral");
    });
    it("neutral once past", () => {
      expect(todayStatus(appointment(plus(-MIN)), NOW, LA)).toBe("neutral");
    });
  });
});

describe("attentionCounts", () => {
  const slot = (state: "upcoming" | "due" | "overdue" | "given" | "skipped", at: string) => ({ state, at });
  const task = (dueOn: string, dueTime: string | null = null, doneAt: string | null = null) => ({
    dueOn,
    dueTime,
    doneAt,
  });
  const counts = (over: Partial<Parameters<typeof attentionCounts>[0]> = {}, now: Date = NOW) =>
    attentionCounts({ doses: [], tasks: [], appointment: null, now, timeZone: LA, ...over });

  it("nothing at all", () => {
    expect(counts()).toEqual({
      doses: { overdue: 0, soon: 0 },
      tasks: { overdue: 0, soon: 0 },
      appointments: { soon: 0 },
    });
  });
  it("doses: overdue is red; due, or upcoming within the hour, is soon; later or answered, neither", () => {
    const doses = [
      slot("overdue", plus(-2 * HOUR)),
      slot("due", plus(-5 * MIN)),
      slot("upcoming", plus(HOUR)),
      slot("upcoming", plus(HOUR + MIN)),
      slot("given", plus(-3 * HOUR)),
      slot("skipped", plus(10 * MIN)),
    ];
    expect(counts({ doses }).doses).toEqual({ overdue: 1, soon: 2 });
  });
  it("tasks: overdue (an earlier day, or past its time) is red; due within the hour is soon", () => {
    const tasks = [
      task("2026-11-17"),
      task("2026-11-19", "09:30"),
      task("2026-11-19", "11:00"),
      task("2026-11-19", "11:01"),
      task("2026-11-20", "10:30"),
      task("2026-11-18", null, plus(-HOUR)),
    ];
    expect(counts({ tasks }).tasks).toEqual({ overdue: 2, soon: 1 });
  });
  it("a task without a time is due at 19:00 in the recipient's zone: soon from 18:00 until the day ends", () => {
    const tasks = [task("2026-11-19")];
    expect(counts({ tasks }).tasks.soon).toBe(0); // 10:00
    expect(counts({ tasks }, new Date("2026-11-20T01:59:00.000Z")).tasks.soon).toBe(0); // 17:59
    expect(counts({ tasks }, new Date("2026-11-20T02:00:00.000Z")).tasks.soon).toBe(1); // 18:00
    expect(counts({ tasks }, new Date("2026-11-20T07:30:00.000Z")).tasks).toEqual({ overdue: 0, soon: 1 }); // 23:30
  });
  it("the next appointment: in progress or within the hour is soon; later, past or all-day isn't", () => {
    const soon = (a: ReturnType<typeof appointment>) => counts({ appointment: a.entry }).appointments.soon;
    expect(soon(appointment(plus(-10 * MIN), { endsAt: plus(20 * MIN) }))).toBe(1);
    expect(soon(appointment(plus(HOUR)))).toBe(1);
    expect(soon(appointment(plus(HOUR + MIN)))).toBe(0);
    expect(soon(appointment(plus(-MIN)))).toBe(0);
    expect(soon(appointment("2026-11-19T08:00:00.000Z", { allDay: true }))).toBe(0);
  });
});

describe("todaySummary", () => {
  const none = { doses: { overdue: 0, soon: 0 }, tasks: { overdue: 0, soon: 0 }, appointments: { soon: 0 } };

  it("overdue and due soon lead, summed across kinds; the rest follows without what they counted", () => {
    expect(
      todaySummary({
        counts: { doses: { overdue: 2, soon: 1 }, tasks: { overdue: 1, soon: 1 }, appointments: { soon: 1 } },
        vital: "BP 130/85 mmHg",
        appointments: 2,
        medications: "20:00",
        tasks: 3,
      }),
    ).toEqual({ overdue: "3 overdue", soon: "3 due soon", rest: "BP 130/85 mmHg · 1 appt · 1 task today" });
  });
  it("nothing overdue or soon: the rest alone, with plurals and the next pass's time", () => {
    expect(todaySummary({ counts: none, appointments: 3, medications: "20:00", tasks: 2 })).toEqual({
      overdue: null,
      soon: null,
      rest: "3 appts · Meds 20:00 · 2 tasks today",
    });
    expect(todaySummary({ counts: none })).toEqual({ overdue: null, soon: null, rest: "" });
  });
});
