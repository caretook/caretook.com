import { describe, expect, it } from "vitest";
import { attentionKey, needsAttention, todayStatus, todaySummary } from "./todayStatus";

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

describe("needsAttention", () => {
  const dose = (dueAt: string | null) => ({ kind: "medications" as const, dueAt, id: "pass:p" });
  const vitals = (latestAt: string) => ({ kind: "vitals" as const, latestAt });
  const tasks = (overdue: boolean) => ({ kind: "tasks" as const, overdue, id: "t" });

  it("nothing at all, and nothing that needs it: stale vitals, a task due today, an appointment later today", () => {
    expect(needsAttention([], NOW)).toBe(false);
    expect(
      needsAttention([vitals(plus(-3 * 24 * HOUR)), tasks(false), appointment(plus(5 * HOUR))], NOW),
    ).toBe(false);
  });
  it("a dose 2 h out does; 2 h 1 min out doesn't; due and overdue do; tomorrow's pass doesn't", () => {
    expect(needsAttention([dose(plus(2 * HOUR))], NOW)).toBe(true);
    expect(needsAttention([dose(plus(2 * HOUR + MIN))], NOW)).toBe(false);
    expect(needsAttention([dose(plus(0))], NOW)).toBe(true);
    expect(needsAttention([dose(plus(-3 * HOUR))], NOW)).toBe(true);
    expect(needsAttention([dose(null)], NOW)).toBe(false);
  });
  it("an overdue task does", () => {
    expect(needsAttention([tasks(true)], NOW)).toBe(true);
  });
  it("an appointment now, or in 90 min, or at 2 h does; at 2 h 1 min, past or all-day today doesn't", () => {
    expect(needsAttention([appointment(plus(-10 * MIN), { endsAt: plus(20 * MIN) })], NOW)).toBe(true);
    expect(needsAttention([appointment(plus(90 * MIN))], NOW)).toBe(true);
    expect(needsAttention([appointment(plus(2 * HOUR))], NOW)).toBe(true);
    expect(needsAttention([appointment(plus(2 * HOUR + MIN))], NOW)).toBe(false);
    expect(needsAttention([appointment(plus(-MIN))], NOW)).toBe(false);
    expect(needsAttention([appointment("2026-11-19T08:00:00.000Z", { allDay: true })], NOW)).toBe(false);
  });
  it("its key names each item that needs it, so a new one (or tomorrow's same pass) is a new key", () => {
    const rows = [dose(plus(-MIN)), tasks(true), appointment(plus(HOUR)), vitals(plus(-2 * 24 * HOUR))];
    expect(attentionKey(rows, NOW)).toBe(`dose:pass:p@${plus(-MIN)} task:t appointment:a`);
    expect(attentionKey([dose(plus(-MIN))], NOW)).not.toBe(
      attentionKey([dose(plus(24 * HOUR - MIN))], NOW.getTime() + 24 * HOUR),
    );
    expect(attentionKey([tasks(false), appointment(plus(5 * HOUR))], NOW)).toBe("");
  });
});

describe("todaySummary", () => {
  it("one part per row, in the card's order", () => {
    expect(
      todaySummary({
        vital: "BP 130/85 mmHg",
        appointments: 1,
        medications: { state: "due", count: 2, time: "8:00" },
        tasks: { overdue: 1, total: 2 },
      }),
    ).toBe("BP 130/85 mmHg · 1 appt · 2 meds due · 1 task overdue");
  });
  it("plurals, the next pass's time, today's tasks, and nothing for hidden rows", () => {
    expect(
      todaySummary({
        appointments: 3,
        medications: { state: "next", count: 4, time: "20:00" },
        tasks: { overdue: 0, total: 2 },
      }),
    ).toBe("3 appts · Meds 20:00 · 2 tasks today");
    expect(todaySummary({ medications: { state: "overdue", count: 1, time: "8:00" } })).toBe("1 med overdue");
    expect(todaySummary({ vital: null, appointments: 0, medications: null, tasks: null })).toBe("");
  });
});
