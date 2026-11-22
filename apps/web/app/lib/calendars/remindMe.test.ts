import { describe, expect, it } from "vitest";
import { canRemind, effectiveLeads, remindSummary } from "./remindMe";

const NOW = new Date("2026-11-18T18:00:00.000Z");
const base = { id: "e", timeZone: "America/Los_Angeles", kind: "event" };
const on = { remindersOn: true, reminderLeads: ["eveningBefore", 60] as const };

describe("canRemind", () => {
  it("is for upcoming events only", () => {
    expect(canRemind({ ...base, occurredAt: "2026-11-19T18:00:00.000Z" }, NOW)).toBe(true);
    expect(canRemind({ ...base, kind: "note", occurredAt: "2026-11-19T18:00:00.000Z" }, NOW)).toBe(false);
    expect(canRemind({ ...base, kind: "symptom", occurredAt: "2026-11-19T18:00:00.000Z" }, NOW)).toBe(false);
    expect(canRemind({ ...base, occurredAt: "2026-11-17T18:00:00.000Z" }, NOW)).toBe(false);
    expect(
      canRemind(
        { ...base, occurredAt: "2026-11-19T18:00:00.000Z", cancelledAt: "2026-11-18T00:00:00Z" },
        NOW,
      ),
    ).toBe(false);
    expect(canRemind({ ...base, occurredAt: "2026-11-19T18:00:00.000Z", rescheduledTo: "x" }, NOW)).toBe(
      false,
    );
  });
});

describe("remindSummary", () => {
  it("says what each choice sends", () => {
    expect(remindSummary({ mode: "default" }, on)).toBe("Email: The evening before, at 18:00 · 1 h before");
    expect(remindSummary({ mode: "mute" }, on)).toBe("No reminders for this one.");
    expect(remindSummary({ mode: "extra", leads: [30, 60] }, on)).toBe(
      "Email: The evening before, at 18:00 · 1 h before · 30 min before",
    );
    expect(remindSummary({ mode: "extra", leads: [] }, on)).toBe(
      "Email: The evening before, at 18:00 · 1 h before",
    );
  });

  it("says so when the member's reminders are off", () => {
    const off = { remindersOn: false, reminderLeads: ["eveningBefore"] as const };
    expect(remindSummary({ mode: "default" }, off)).toContain("reminder emails are off");
    expect(effectiveLeads({ mode: "extra", leads: [30] }, off)).toEqual([]);
  });
});
