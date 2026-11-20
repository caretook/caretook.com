import type { PeriodSpan } from "@caretook/data/schema";
import type {
  PrepEntry,
  PrepMedication,
  PrepPeriod,
  VisitEvent,
  VisitPrepData,
  VisitWindow,
} from "./visitPrep";

import { resolveUnits } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { hasVisitPrep, visitPrepHeading, visitPrepSection, visitWindow } from "./visitPrep";

// Times are fixed in the recipient's zone, Los Angeles. Daylight saving
// ended on Sunday, Nov 1, 2026, inside most windows here.

const ZONE = "America/Los_Angeles";
const NOW = new Date("2026-11-19T18:00:00Z"); // Thu Nov 19, 10:00 AM in LA
const DR_LEE = "p-lee";
const DR_RAY = "p-ray";

const event = (v: Partial<VisitEvent> & { occurredAt: string }): VisitEvent => ({
  id: v.occurredAt,
  title: "Visit",
  timeZone: ZONE,
  providerIds: [DR_LEE],
  ...v,
});

describe("visitWindow", () => {
  it("starts at the last past visit with any of the providers", () => {
    const events = [
      event({ id: "old", occurredAt: "2026-09-01T17:00:00Z" }),
      event({ id: "last", occurredAt: "2026-10-12T17:00:00Z", title: "Checkup" }),
      event({ id: "other", occurredAt: "2026-11-01T17:00:00Z", providerIds: [DR_RAY] }),
      event({ id: "next", occurredAt: "2026-11-24T17:00:00Z" }),
    ];
    expect(visitWindow({ providerIds: [DR_LEE], events, now: NOW })).toEqual({
      from: "2026-10-12T17:00:00Z",
      to: NOW.toISOString(),
      lastVisit: { id: "last", title: "Checkup", occurredAt: "2026-10-12T17:00:00Z" },
    });
    expect(visitWindow({ providerIds: [DR_RAY, DR_LEE], events, now: NOW }).lastVisit?.id).toBe("other");
  });

  it("skips cancelled visits and ones still in progress", () => {
    const events = [
      event({ id: "kept", occurredAt: "2026-10-01T17:00:00Z" }),
      event({ id: "cancelled", occurredAt: "2026-11-10T17:00:00Z", cancelledAt: "2026-11-09T00:00:00Z" }),
      event({ id: "now", occurredAt: "2026-11-19T17:30:00Z", endsAt: "2026-11-19T18:30:00Z" }),
    ];
    expect(visitWindow({ providerIds: [DR_LEE], events, now: NOW }).lastVisit?.id).toBe("kept");
  });

  it("is the last 30 days when there's no past visit (or no provider)", () => {
    const thirty = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
    for (const providerIds of [[DR_RAY], []]) {
      const window = visitWindow({
        providerIds,
        events: [event({ occurredAt: "2026-10-12T17:00:00Z" })],
        now: NOW,
      });
      expect(window).toEqual({ from: thirty, to: NOW.toISOString(), lastVisit: null });
    }
  });

  it("counts an all-day visit as past only once its day is over", () => {
    const today = event({ id: "today", occurredAt: "2026-11-19T08:00:00Z", allDay: true });
    const yesterday = event({ id: "yesterday", occurredAt: "2026-11-18T08:00:00Z", allDay: true });
    expect(visitWindow({ providerIds: [DR_LEE], events: [today, yesterday], now: NOW }).lastVisit?.id).toBe(
      "yesterday",
    );
  });
});

// --- The section -------------------------------------------------------------

const WINDOW: VisitWindow = {
  from: "2026-10-20T17:00:00Z", // Oct 20 (before the DST change)
  to: NOW.toISOString(),
  lastVisit: { id: "last-visit", title: "Checkup", occurredAt: "2026-10-20T17:00:00Z" },
};
// The same length before: Sep 20 – Oct 20.

let n = 0;
const entry = (kind: string, occurredAt: string, v: Partial<PrepEntry> = {}): PrepEntry => ({
  id: `e${++n}`,
  kind,
  occurredAt,
  title: null,
  details: null,
  ...v,
});
const vital = (occurredAt: string, ...readings: object[]) =>
  entry("vital", occurredAt, { details: { readings } as PrepEntry["details"] });
const symptom = (occurredAt: string, name: string, severity: number | null = null) =>
  entry("symptom", occurredAt, { details: { name, severity } });

const LISINOPRIL: PrepMedication = {
  id: "m-lis",
  name: "Lisinopril",
  strength: "10 mg",
  dose: "1 tablet",
  status: "current",
  schedule: { type: "scheduled", slots: [{ passId: "pass-am" }] },
  deletedAt: null,
};
const OXY: PrepMedication = {
  id: "m-oxy",
  name: "Oxybutynin",
  strength: "5 mg",
  dose: "1 tablet",
  status: "discontinued",
  schedule: { type: "scheduled", slots: [{ time: "20:00" }] },
  deletedAt: null,
};
const PASSES = [{ id: "pass-am", name: "Morning", time: "08:00", sortOrder: 0 }];

const span = (
  id: string,
  type: string,
  startsAt: string,
  endsAt: string | null,
  placeProviderId: string | null = null,
): PeriodSpan<PrepPeriod> => ({
  period: {
    id,
    type,
    label: null,
    placeProviderId,
    startedAt: startsAt,
    createdAt: startsAt,
    deletedAt: null,
  },
  startsAt,
  endsAt,
});

const data = (v: Partial<VisitPrepData> = {}): VisitPrepData => ({
  entries: [],
  medications: [],
  passes: PASSES,
  periods: [],
  placeNames: new Map(),
  appointmentId: "appt",
  units: resolveUnits(null),
  timeZone: ZONE,
  now: NOW,
  ...v,
});

const texts = (lines: { text: string }[]) => lines.map((l) => l.text);

describe("visitPrepSection", () => {
  it("dates the heading, and says so on a rerun", () => {
    expect(visitPrepHeading(WINDOW, data(), false)).toBe("Since your last visit · Oct 20 – Nov 19");
    expect(visitPrepHeading(WINDOW, data(), true)).toBe(
      "Since your last visit · Oct 20 – Nov 19 (updated Nov 19)",
    );
    expect(visitPrepSection(data(), WINDOW, { rerun: true })[0]).toEqual({
      text: "Since your last visit · Oct 20 – Nov 19 (updated Nov 19)",
      style: "heading",
    });
  });

  it("says nothing was logged when every section is empty", () => {
    expect(visitPrepSection(data(), WINDOW)).toEqual([
      { text: "Since your last visit · Oct 20 – Nov 19", style: "heading" },
      { text: "Nothing was logged in this time." },
    ]);
  });

  it("leaves out empty sections, and puts each line under its subheading", () => {
    const lines = visitPrepSection(
      data({ entries: [symptom("2026-11-02T20:00:00Z", "Dizziness", 4)] }),
      WINDOW,
    );
    expect(lines).toEqual([
      { text: "Since your last visit · Oct 20 – Nov 19", style: "heading" },
      { text: "Symptoms", style: "subheading" },
      { text: "Dizziness: once, worst 4/10, new", style: "bullet" },
    ]);
  });

  it("counts missed doses in the window per medication, with skips and refusals, after the current list", () => {
    const window: VisitWindow = { from: "2026-11-15T17:00:00Z", to: NOW.toISOString(), lastVisit: null };
    const given = (day: string, status: "given" | "refused" = "given") => ({
      id: `${day}-${status}`,
      occurredAt: `${day}T16:02:00.000Z`,
      details: { medicationId: LISINOPRIL.id, status, scheduledFor: "08:00", passId: "pass-am" },
    });
    const lines = texts(
      visitPrepSection(
        data({
          medications: [LISINOPRIL, { ...OXY, stoppedOn: "2026-11-17" }],
          // Morning on Nov 16 given, Nov 17 refused, Nov 18 nothing; today's is still open.
          doses: [given("2026-11-16"), given("2026-11-17", "refused")],
        }),
        window,
      ),
    );
    expect(lines.slice(lines.indexOf("Missed doses") - 2)).toEqual([
      "Current medications",
      "Lisinopril 10 mg · 1 tablet · Morning",
      "Missed doses",
      // Most first, then by name; Oxybutynin's 20:00 on Nov 15 and 16, until it stopped.
      "Lisinopril 10 mg: 1 missed, 1 refused (of 3)",
      "Oxybutynin 5 mg: 2 missed (of 2)",
    ]);
  });

  it("leaves out missed doses when every dose was given, or without the doses", () => {
    const window: VisitWindow = { from: "2026-11-17T17:00:00Z", to: NOW.toISOString(), lastVisit: null };
    const doses = ["2026-11-18"].map((day) => ({
      id: day,
      occurredAt: `${day}T16:00:00.000Z`,
      details: { medicationId: LISINOPRIL.id, status: "given" as const, scheduledFor: "08:00" },
    }));
    expect(texts(visitPrepSection(data({ medications: [LISINOPRIL], doses }), window))).not.toContain(
      "Missed doses",
    );
    expect(texts(visitPrepSection(data({ medications: [LISINOPRIL] }), WINDOW))).not.toContain(
      "Missed doses",
    );
  });

  it("lists medication changes in the window and the current medications", () => {
    const lines = texts(
      visitPrepSection(
        data({
          medications: [OXY, LISINOPRIL],
          entries: [
            entry("medicationChange", "2026-11-03T18:00:00Z", {
              details: {
                medicationId: OXY.id,
                change: "stopped",
                stopStatus: "discontinued",
                stopReason: "sideEffects",
              },
            }),
            entry("medicationChange", "2026-10-25T18:00:00Z", {
              details: {
                medicationId: LISINOPRIL.id,
                change: "changed",
                fields: ["dose"],
                before: { dose: "1 tablet" },
                after: { dose: "2 tablets" },
              },
            }),
            // Before the window: not a change since the last visit.
            entry("medicationChange", "2026-10-01T18:00:00Z", {
              details: { medicationId: LISINOPRIL.id, change: "started" },
            }),
            entry("medicationChange", "2026-11-10T18:00:00Z", {
              details: {
                change: "passMoved",
                passId: "pass-am",
                passName: "Morning",
                beforeTime: "08:00",
                afterTime: "08:30",
                medicationIds: [LISINOPRIL.id],
              },
            }),
          ],
        }),
        WINDOW,
      ),
    );
    expect(lines).toEqual([
      "Since your last visit · Oct 20 – Nov 19",
      "Medication changes",
      "Lisinopril 10 mg: Changed dose 1 tablet → 2 tablets (Oct 25)",
      "Oxybutynin 5 mg: Discontinued: side effects (Nov 3)",
      "Morning moved 8:00 → 8:30 (Nov 10)",
      "Current medications",
      "Lisinopril 10 mg · 1 tablet · Morning",
    ]);
  });

  it("gives each vital's range, average and direction against the time before", () => {
    const entries = [
      // Before (Sep 20 – Oct 20).
      vital("2026-10-01T16:00:00Z", { type: "bloodPressure", systolic: 120, diastolic: 76 }),
      vital(
        "2026-10-10T16:00:00Z",
        { type: "bloodPressure", systolic: 124, diastolic: 80 },
        { type: "heartRate", value: 72 },
      ),
      vital("2026-10-11T16:00:00Z", { type: "temperature", value: 37 }),
      // The window; one reading on each side of the DST change.
      vital(
        "2026-10-31T16:00:00Z",
        { type: "bloodPressure", systolic: 132, diastolic: 84 },
        { type: "heartRate", value: 70 },
      ),
      vital(
        "2026-11-02T17:00:00Z",
        { type: "bloodPressure", systolic: 140, diastolic: 88 },
        { type: "heartRate", value: 76 },
      ),
      vital("2026-11-05T17:00:00Z", { type: "temperature", value: 37.1 }),
      vital("2026-11-06T17:00:00Z", { type: "spo2", value: 95 }, { type: "bowelMovement", bristol: 3 }),
      vital(
        "2026-11-07T17:00:00Z",
        { type: "bowelMovement", bristol: 5 },
        { type: "urineOutput", value: null },
      ),
    ];
    const lines = texts(visitPrepSection(data({ entries }), WINDOW));
    expect(lines).toEqual([
      "Since your last visit · Oct 20 – Nov 19",
      "Vitals",
      "Blood pressure: 2 readings, 132–140 / 84–88 mmHg, average 136/86, up from 122/78",
      "Heart rate: 2 readings, 70–76 bpm, average 73 bpm, about the same as before (72 bpm)",
      "Temperature: 1 reading, 98.8 °F, average 98.8 °F, about the same as before (98.6 °F)",
      "Oxygen (SpO₂): 1 reading, 95%, average 95%",
      "Bowel movement: 2 times, types 3–5",
      "Urine output: 1 reading",
    ]);
  });

  it("shows vitals in the user's units", () => {
    const entries = [
      vital("2026-11-05T17:00:00Z", { type: "weight", value: 60 }, { type: "temperature", value: 38.5 }),
    ];
    const metric = texts(
      visitPrepSection(
        data({ entries, units: resolveUnits({ units: { temperature: "c", weight: "kg" } }) }),
        WINDOW,
      ),
    );
    expect(metric).toContain("Temperature: 1 reading, 38.5 °C, average 38.5 °C");
    expect(metric).toContain("Weight: 1 reading, 60 kg, average 60 kg");
    const imperial = texts(visitPrepSection(data({ entries }), WINDOW));
    expect(imperial).toContain("Weight: 1 reading, 132.3 lb, average 132.3 lb");
  });

  it("counts symptoms, with the worst severity, and marks the new ones", () => {
    const entries = [
      symptom("2026-10-05T16:00:00Z", "Headache", 2), // before
      symptom("2026-10-28T16:00:00Z", "headache ", 3),
      symptom("2026-11-02T16:00:00Z", "Dizziness", 6),
      symptom("2026-11-04T16:00:00Z", "Headache", 5),
      symptom("2026-11-06T16:00:00Z", "Dizziness"),
      symptom("2026-11-08T16:00:00Z", "Dizziness", 4),
      symptom("2026-11-09T16:00:00Z", "Cough"),
    ];
    const lines = texts(visitPrepSection(data({ entries }), WINDOW));
    expect(lines.slice(1)).toEqual([
      "Symptoms",
      "Dizziness: 3 times, worst 6/10, new",
      "Headache: 2 times, worst 5/10",
      "Cough: once, new",
    ]);
  });

  it("lists events, leaving out cancelled ones, the last visit and the appointment itself", () => {
    const entries = [
      entry("event", WINDOW.from, { id: "last-visit", title: "Checkup" }),
      entry("event", "2026-10-30T22:00:00Z", { title: "Fell in the bathroom" }),
      entry("event", "2026-11-12T22:00:00Z", { title: "Eye exam", cancelledAt: "2026-11-11T00:00:00Z" }),
      entry("event", "2026-11-14T22:00:00Z", { title: null }),
      entry("event", "2026-11-18T22:00:00Z", { id: "appt", title: "Today's visit" }),
      entry("note", "2026-11-15T22:00:00Z", { title: "A note" }),
    ];
    expect(texts(visitPrepSection(data({ entries }), WINDOW)).slice(1)).toEqual([
      "Events",
      "Oct 30: Fell in the bathroom",
      "Nov 14: Event",
    ]);
  });

  it("lists stays that overlap the window, not time at home", () => {
    const periods = [
      span("home1", "home", "2026-08-01T07:00:00Z", "2026-10-02T07:00:00Z"),
      span("er", "emergency", "2026-10-02T07:00:00Z", "2026-10-03T07:00:00Z"), // before the window
      span("hosp", "hospital", "2026-10-03T07:00:00Z", "2026-10-25T07:00:00Z", "p-mercy"),
      span("rehab", "rehab", "2026-10-25T07:00:00Z", "2026-11-10T08:00:00Z"),
      span("home2", "home", "2026-11-10T08:00:00Z", null),
    ];
    const lines = texts(
      visitPrepSection(
        data({ periods, placeNames: new Map([["p-mercy", "Mercy General Hospital"]]) }),
        WINDOW,
      ),
    );
    expect(lines.slice(1)).toEqual([
      "Hospital and other stays",
      "Hospital · Mercy General Hospital: Oct 3 – Oct 25",
      "Rehab: Oct 25 – Nov 10",
    ]);
    const open = texts(
      visitPrepSection(data({ periods: [span("now", "rehab", "2026-11-15T08:00:00Z", null)] }), WINDOW),
    );
    expect(open.at(-1)).toBe("Rehab: Nov 15 – now");
  });

  it("orders its sections: medications, vitals, symptoms, events, stays", () => {
    const lines = visitPrepSection(
      data({
        medications: [LISINOPRIL],
        entries: [
          vital("2026-11-02T17:00:00Z", { type: "heartRate", value: 70 }),
          symptom("2026-11-02T17:00:00Z", "Cough"),
          entry("event", "2026-11-03T17:00:00Z", { title: "Fall" }),
        ],
        periods: [span("rehab", "rehab", "2026-11-01T08:00:00Z", null)],
      }),
      WINDOW,
    );
    expect(lines.filter((l) => l.style === "subheading").map((l) => l.text)).toEqual([
      "Current medications",
      "Vitals",
      "Symptoms",
      "Events",
      "Hospital and other stays",
    ]);
  });
});

describe("hasVisitPrep", () => {
  it("finds a prepared section's heading anywhere in the text", () => {
    expect(hasVisitPrep("Questions\nSince your last visit · Oct 20 – Nov 19\n• x")).toBe(true);
    expect(hasVisitPrep("Since your last visit we talked")).toBe(false);
    expect(hasVisitPrep("")).toBe(false);
  });
});
