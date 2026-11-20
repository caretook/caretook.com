import type { QuickEntryContext, QuickEntryReading } from "./quickEntry";

import { describe, expect, test } from "vitest";
import { assistantActionZSchema } from "./assistantActions";
import { editDistance, parseQuickEntry, splitQuickEntry } from "./quickEntry";

// The quick-entry parser, table-driven (in the style of search.test.ts):
// each row is a line and what its parts should read as. The clock is fixed in
// the recipient's zone, America/Los_Angeles, like the seeds.

const MET = "11111111-1111-4111-8111-111111111111";
const LIS = "22222222-2222-4222-8222-222222222222";
const APAP = "33333333-3333-4333-8333-333333333333";
const METO = "44444444-4444-4444-8444-444444444444";
const LEE = "55555555-5555-4555-8555-555555555555";
const RIVER = "66666666-6666-4666-8666-666666666666";
const SAM = "77777777-7777-4777-8777-777777777777";
const JO = "88888888-8888-4888-8888-888888888888";

/** Thursday, Nov 19, 2026, 8:00 in Los Angeles (16:00 UTC). */
const NOW = new Date("2026-11-19T16:00:00Z");

const context = (over: Partial<QuickEntryContext> = {}): QuickEntryContext => ({
  now: NOW,
  timeZone: "America/Los_Angeles",
  units: { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" },
  medications: [
    { id: MET, name: "Metformin", strength: "500 mg", dose: "1 tablet" },
    { id: LIS, name: "Lisinopril", strength: "10 mg", dose: "1 tablet" },
    {
      id: APAP,
      name: "Acetaminophen",
      strength: "500 mg",
      dose: "2 tablets",
      directions: "Tylenol, for pain",
    },
    { id: METO, name: "Metoprolol", strength: "25 mg" },
  ],
  providers: [
    { id: LEE, name: "Dr. Sandra Lee", type: "clinician" },
    { id: RIVER, name: "Riverside Dialysis", type: "practice", address: "12 River Rd" },
  ],
  members: [
    { id: SAM, name: "Sam Rivera" },
    { id: JO, name: "Jo Ann Okafor" },
  ],
  ...over,
});

const parse = (line: string, over?: Partial<QuickEntryContext>) => parseQuickEntry(line, context(over)).parts;
const top = (line: string, over?: Partial<QuickEntryContext>) => parse(line, over)[0]!.readings[0]!;
const action = (r: QuickEntryReading) => r.actions[0]!;
/** When an action is dated (a task has a due day instead). */
const when = (r: QuickEntryReading) => {
  const a = action(r);
  return "occurredAt" in a ? a.occurredAt : undefined;
};
const blocking = (r: QuickEntryReading) => r.warnings.filter((w) => w.blocking).map((w) => w.message);
const warnings = (r: QuickEntryReading) => r.warnings.map((w) => w.message);
const at = (iso: string) => new Date(iso).toISOString();

describe("splitting", () => {
  test.each([
    [
      "bp 130/85 hr 72, gave metformin, pain 4 left knee",
      ["bp 130/85 hr 72", "gave metformin", "pain 4 left knee"],
    ],
    ["gave metformin; skipped lisinopril", ["gave metformin", "skipped lisinopril"]],
    ["dizzy and nauseous", ["dizzy", "nauseous"]],
    ["urine 1,000 ml", ["urine 1,000 ml"]],
    ["n: ate lunch, then napped and watched tv", ["n: ate lunch, then napped and watched tv"]],
    ["e: lunch with Ann, and a walk", ["e: lunch with Ann, and a walk"]],
    ["candy, sandwich", ["candy", "sandwich"]],
    ["todo: pick up milk and bread, bp 130/85", ["todo: pick up milk and bread", "bp 130/85"]],
    ["bp 130/85 and t: call the pharmacy then fax it", ["bp 130/85", "t: call the pharmacy then fax it"]],
    ["   ", []],
    [",,, ;", []],
  ])("%s", (line, parts) => {
    expect(splitQuickEntry(line)).toEqual(parts);
  });
});

describe("vitals", () => {
  test.each([
    ["bp 130/85", [{ type: "bloodPressure", systolic: 130, diastolic: 85 }]],
    ["blood pressure 128 over 82", [{ type: "bloodPressure", systolic: 128, diastolic: 82 }]],
    ["BP130/85", [{ type: "bloodPressure", systolic: 130, diastolic: 85 }]],
    ["b/p 130 / 85 mmHg", [{ type: "bloodPressure", systolic: 130, diastolic: 85 }]],
    ["130/85", [{ type: "bloodPressure", systolic: 130, diastolic: 85 }]],
    ["hr 72", [{ type: "heartRate", value: 72 }]],
    ["pulse 64", [{ type: "heartRate", value: 64 }]],
    ["heart rate: 80", [{ type: "heartRate", value: 80 }]],
    ["72 bpm", [{ type: "heartRate", value: 72 }]],
    ["o2 95", [{ type: "spo2", value: 95 }]],
    ["spo2 97%", [{ type: "spo2", value: 97 }]],
    ["sats 93", [{ type: "spo2", value: 93 }]],
    ["o2 sat 95", [{ type: "spo2", value: 95 }]],
    ["pulse ox 96", [{ type: "spo2", value: 96 }]],
    ["rr 16", [{ type: "respiratoryRate", value: 16 }]],
    ["resp 18", [{ type: "respiratoryRate", value: 18 }]],
    ["bm", [{ type: "bowelMovement", bristol: null }]],
    ["bm type 4", [{ type: "bowelMovement", bristol: 4 }]],
    ["bowel movement 5", [{ type: "bowelMovement", bristol: 5 }]],
    ["urine", [{ type: "urineOutput", value: null }]],
    ["urine 300ml", [{ type: "urineOutput", value: 300 }]],
    ["slept 7 hours", [{ type: "sleep", value: 7 }]],
    ["sleep 6.5h", [{ type: "sleep", value: 6.5 }]],
    ["sugar 120", [{ type: "bloodGlucose", value: 120 }]],
    ["bg 98", [{ type: "bloodGlucose", value: 98 }]],
    ["glucose 140 mg/dl", [{ type: "bloodGlucose", value: 140 }]],
  ])("%s", (line, readings) => {
    const r = top(line);
    expect(r.kind).toBe("vital");
    expect(action(r)).toMatchObject({ type: "logVital", readings });
    expect(blocking(r)).toEqual([]);
  });

  test("several readings in one line are one entry, as the form makes it", () => {
    const parts = parse("bp 130/85 hr 72 temp 99.1");
    expect(parts).toHaveLength(1);
    const a = action(parts[0]!.readings[0]!);
    expect(a.type === "logVital" && a.readings.map((r) => r.type)).toEqual([
      "bloodPressure",
      "heartRate",
      "temperature",
    ]);
  });

  test("vitals split by 'and' or a comma are merged into one sitting", () => {
    const parts = parse("bp 130/85 and hr 72, o2 96");
    expect(parts).toHaveLength(1);
    expect(parts[0]!.text).toBe("bp 130/85, hr 72, o2 96");
    const a = action(parts[0]!.readings[0]!);
    expect(a.type === "logVital" && a.readings).toHaveLength(3);
  });

  test("the same type twice in neighbouring parts stays two entries", () => {
    expect(parse("bp 130/85, bp 128/80")).toHaveLength(2);
  });

  test.each([
    ["temp 99.1", { temperature: "f" }, 37.2778],
    ["temp 37.2", { temperature: "c" }, 37.2],
    ["temp 37.2c", { temperature: "f" }, 37.2],
    ["temp 99.1°F", { temperature: "c" }, 37.2778],
    ["temp 99.1 f", { temperature: "c" }, 37.2778],
    ["wt 143", { weight: "lb" }, 64.864],
    ["weight 65 kg", { weight: "lb" }, 65],
    ["65kg", { weight: "lb" }, 65],
    ["weight 143 lbs", { weight: "kg" }, 64.864],
    ["sugar 6.1", { glucose: "mmol/L" }, 109.9],
    ["sugar 6.1 mmol", { glucose: "mg/dL" }, 109.9],
    ["urine 10 oz", { volume: "mL" }, 295.7],
    ["urine 10 fl oz", { volume: "mL" }, 295.7],
    ["urine 300", { volume: "fl oz" }, 8872.1],
  ] as const)("%s in %o reads as %d (canonical)", (line, units, canonical) => {
    const r = top(line, { units: { ...context().units, ...units } });
    const a = action(r);
    expect(a.type).toBe("logVital");
    const value = a.type === "logVital" ? (a.readings[0] as { value: number }).value : NaN;
    expect(value).toBeCloseTo(canonical, 0);
  });

  test.each([
    ["bp 1300/85", "Systolic (top): enter a whole number from 40 to 300 mmHg."],
    ["bp 90/120", "The bottom number must be lower than the top one."],
    ["hr 72.5", "Heart rate: enter a whole number from 20 to 300 bpm."],
    ["o2 120", "Oxygen (SpO₂): enter a whole number from 50 to 100 %."],
    ["temp 120", "Temperature: enter a number from 77 to 113 °F."],
    ["bm type 9", null],
  ])("%s is blocked: %s", (line, message) => {
    const r = top(line);
    if (message === null) {
      // Not a Bristol type: no number is read, so the BM has none (and "9" is left as its note).
      expect(action(r)).toMatchObject({
        type: "logVital",
        readings: [{ type: "bowelMovement", bristol: null }],
      });
      return;
    }
    expect(r.kind).toBe("vital");
    expect(blocking(r)).toEqual([message]);
  });

  test.each([
    ["bp 190/85", "Systolic (top): that's unusual. Double-check it before saving."],
    ["hr 140", "Heart rate: that's unusual. Double-check it before saving."],
    ["temp 103", "Temperature: that's unusual. Double-check it before saving."],
  ])("%s is unusual: it warns but saves", (line, message) => {
    const r = top(line);
    expect(warnings(r)).toEqual([message]);
    expect(blocking(r)).toEqual([]);
    expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
  });

  test("words beside the readings are the entry's note", () => {
    expect(action(top("bp 130/85 left arm sitting"))).toMatchObject({ note: "left arm sitting" });
    expect(action(top("bp 130/85 hr 72"))).toMatchObject({ note: null });
  });

  test("a bare pair that can't be a blood pressure isn't one", () => {
    expect(top("11/20").kind).toBe("note");
    expect(top("3/10").kind).toBe("note");
  });
});

describe("doses", () => {
  test.each([
    ["gave metformin", MET, "given", "1 tablet"],
    ["metformin given", MET, "given", "1 tablet"],
    ["took lisinopril", LIS, "given", "1 tablet"],
    ["skipped lisinopril", LIS, "skipped", "1 tablet"],
    ["held metoprolol", METO, "skipped", null],
    ["refused acetaminophen", APAP, "refused", "2 tablets"],
    ["wouldn't take lisinopril", LIS, "refused", "1 tablet"],
    ["did not take metformin", MET, "refused", "1 tablet"],
    ["gave 2 tablets acetaminophen", APAP, "given", "2 tablets"],
    ["gave acetaminophen 1 tab", APAP, "given", "1 tab"],
    ["gave half a tablet metoprolol", METO, "given", "half a tablet"],
    ["gave metformin 500mg", MET, "given", "500mg"],
    // Partial and misspelled names; a name in the medication's notes.
    ["gave metf", MET, "given", "1 tablet"],
    ["gave lisin", LIS, "given", "1 tablet"],
    ["gave metfromin", MET, "given", "1 tablet"],
    ["gave lisinoprel", LIS, "given", "1 tablet"],
    ["gave acetominophen", APAP, "given", "2 tablets"],
    ["gave tylenol", APAP, "given", "2 tablets"],
    ["GAVE MÉTFORMIN", MET, "given", "1 tablet"],
  ])("%s", (line, medicationId, status, amount) => {
    const r = top(line);
    expect(r.kind).toBe("dose");
    expect(action(r)).toMatchObject({ type: "logDose", medicationId, status, amount });
    expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
  });

  test("a partial name that fits two medications offers both, as alternatives", () => {
    const readings = parse("gave met")[0]!.readings.filter((r) => r.kind === "dose");
    expect(readings.map((r) => (action(r) as { medicationId: string }).medicationId)).toEqual([MET, METO]);
  });

  test("a medication's name alone is a dose given; with other words it's a note", () => {
    expect(top("metformin").kind).toBe("dose");
    expect(top("metformin refill needed soon").kind).toBe("note");
  });

  test("'and' carries the verb to the next medication", () => {
    const parts = parse("skipped metformin and lisinopril");
    expect(parts.map((p) => action(p.readings[0]!))).toMatchObject([
      { type: "logDose", medicationId: MET, status: "skipped" },
      { type: "logDose", medicationId: LIS, status: "skipped" },
    ]);
  });

  test("other words are the dose's note", () => {
    expect(action(top("gave her metformin with food"))).toMatchObject({ note: "with food" });
  });

  test("a verb with no medication the group has is a note", () => {
    expect(top("gave aspirin").kind).toBe("note");
    expect(top("gave meds", { medications: [] }).kind).toBe("note");
  });

  test("a symptom word in a medication's notes doesn't make a symptom a dose", () => {
    expect(parse("pain 4 left knee")[0]!.readings.some((r) => r.kind === "dose")).toBe(false);
  });
});

describe("passes", () => {
  const MORNING = "77777777-7777-4777-8777-777777777777";
  const EVENING = "88888888-8888-4888-8888-888888888888";
  const BEDTIME = "99999999-9999-4999-8999-999999999999";
  // 8:00 in Los Angeles: Morning is due.
  const passes = [
    { id: MORNING, name: "Morning", time: "08:00", due: true, open: 3 },
    { id: EVENING, name: "Evening", time: "20:00", open: 4 },
    { id: BEDTIME, name: "Late evening", time: "22:30", open: 1 },
  ];
  const withPasses = { passes };
  const passOf = (r: QuickEntryReading) => (action(r) as { passId?: string }).passId;

  test.each([
    ["gave evening meds", EVENING],
    ["gave morning meds", MORNING],
    ["Gave Evening Medications", EVENING],
    ["gave evening", EVENING],
    ["evening meds given", EVENING],
    ["evening meds", EVENING],
    ["gave her evening pills", EVENING],
    ["gave late evening meds", BEDTIME],
    ["d: evening", EVENING],
    // No name: the pass due now.
    ["gave meds", MORNING],
    ["gave all", MORNING],
    ["gave all meds", MORNING],
    ["meds given", MORNING],
    ["gave her meds", MORNING],
  ])("%s", (line, passId) => {
    const r = top(line, withPasses);
    expect(r.kind).toBe("dose");
    expect(action(r)).toEqual({ type: "givePass", passId, occurredAt: NOW.toISOString() });
    expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
    expect(blocking(r)).toEqual([]);
  });

  test("'gave meds' at 8 pm means the evening pass when it's due", () => {
    const evening = new Date("2026-11-20T04:00:00Z"); // 20:00 in Los Angeles
    const due = passes.map((p) => ({ ...p, due: p.id === EVENING }));
    expect(passOf(top("gave meds", { now: evening, passes: due }))).toBe(EVENING);
    expect(passOf(top("gave all", { now: evening, passes: due }))).toBe(EVENING);
  });

  test("with no pass due, 'gave meds' is the nearest pass, less sure, with the others as alternatives", () => {
    const afternoon = new Date("2026-11-19T22:00:00Z"); // 14:00
    const quiet = passes.map((p) => ({ ...p, due: false }));
    const readings = parse("gave meds", { now: afternoon, passes: quiet })[0]!.readings;
    expect(readings.filter((r) => r.kind === "dose").map(passOf)).toEqual([MORNING, EVENING, BEDTIME]);
    expect(readings[0]!.confidence).toBeLessThan(0.9);
  });

  test("due passes break ties; a time phrase picks the pass nearest it", () => {
    const both = passes.map((p) => ({ ...p, due: p.id !== BEDTIME }));
    expect(passOf(top("gave meds", { passes: both }))).toBe(MORNING);
    const r = top("gave meds at 8pm", { now: new Date("2026-11-20T05:00:00Z"), passes: both });
    expect(passOf(r)).toBe(EVENING);
    expect(when(r)).toBe(at("2026-11-20T04:00:00Z"));
  });

  test("a pass with nothing left to give can't be saved", () => {
    const done = passes.map((p) => (p.id === EVENING ? { ...p, open: 0 } : p));
    expect(blocking(top("gave evening meds", { passes: done }))).toEqual([
      "Nothing is left to give in Evening today.",
    ]);
    // "gave meds" passes over it to one that isn't done.
    const allDone = passes.map((p) => ({ ...p, due: p.id === EVENING, open: p.id === EVENING ? 0 : 2 }));
    expect(passOf(top("gave meds", { passes: allDone }))).not.toBe(EVENING);
  });

  test("a name and the pass are both offered; skipping a pass, or another word, isn't Given all", () => {
    expect(action(top("gave metformin", withPasses))).toMatchObject({ type: "logDose", medicationId: MET });
    expect(top("skipped evening meds", withPasses).kind).toBe("note");
    expect(top("refused morning meds", withPasses).kind).toBe("note");
    expect(top("gave evening meds with applesauce", withPasses).kind).toBe("note");
    expect(top("evening", withPasses).kind).toBe("note");
    expect(top("gave meds", { passes: [] }).kind).toBe("note");
  });

  test("'and' carries Given to the next pass, and a pass carries it to a medication", () => {
    const parts = parse("gave morning and evening meds, metformin", withPasses);
    expect(parts.map((p) => action(p.readings[0]!))).toMatchObject([
      { type: "givePass", passId: MORNING },
      { type: "givePass", passId: EVENING },
      { type: "logDose", medicationId: MET, status: "given" },
    ]);
  });

  test("a future time blocks it", () => {
    expect(blocking(top("gave evening meds in 2 hours", withPasses)).length).toBe(1);
  });
});

describe("symptoms", () => {
  test.each([
    ["pain 6 left knee", "Pain", 6, "left knee"],
    ["pain 4", "Pain", 4, null],
    ["nausea 3/10", "Nausea", 3, null],
    ["Pain 6/10 in lower back", "Pain", 6, "lower back"],
    ["pain level 7", "Pain", 7, null],
    ["headache 5 out of 10", "Headache", 5, null],
    ["6/10 pain in left knee", "Pain", 6, "left knee"],
    ["itchy skin 2", "Itchy skin", 2, null],
    ["c/o back pain 8", "Back pain", 8, null],
    ["dizzy", "Dizzy", null, null],
    ["feeling nauseous", "Nauseous", null, null],
    ["dizzy when standing", "Dizzy when standing", null, null],
  ])("%s", (line, name, severity, note) => {
    const r = top(line);
    expect(r.kind).toBe("symptom");
    expect(action(r)).toMatchObject({ type: "logSymptom", name, severity, note });
  });

  test("a symptom alone has a note as its alternative", () => {
    expect(parse("dizzy")[0]!.readings.map((r) => r.kind)).toEqual(["symptom", "note", "event"]);
  });

  test("a severity past 10 isn't one", () => {
    for (const r of parse("pain 12")[0]!.readings) {
      expect(r.actions[0]).not.toMatchObject({ severity: 12 });
      expect(assistantActionZSchema.safeParse(r.actions[0]).success).toBe(true);
    }
  });

  test("a long sentence with a symptom word is a note, with the symptom as an alternative", () => {
    const readings = parse("she said her knee was sore after the long walk to the shops")[0]!.readings;
    expect(readings[0]!.kind).toBe("note");
    expect(readings.map((r) => r.kind)).toContain("symptom");
  });
});

describe("events", () => {
  test("an appointment with a provider and a day", () => {
    const r = top("appt dr lee tue 2pm");
    expect(r.kind).toBe("event");
    expect(action(r)).toEqual({
      type: "addEvent",
      title: "Appointment with Dr. Sandra Lee",
      occurredAt: at("2026-11-24T22:00:00Z"), // next Tuesday, 14:00 PST
      allDay: false,
      place: null,
      providerIds: [LEE],
      timeZone: "America/Los_Angeles",
    });
  });

  test("a future time makes an upcoming event, with the place from a practice", () => {
    const r = top("dialysis tomorrow 9:30 at Riverside");
    expect(action(r)).toMatchObject({
      type: "addEvent",
      title: "Dialysis",
      occurredAt: at("2026-11-20T17:30:00Z"),
      place: "12 River Rd",
      providerIds: [RIVER],
    });
  });

  test("a place that isn't a provider is kept as typed", () => {
    expect(action(top("appointment tomorrow 3pm at the clinic on 5th"))).toMatchObject({
      place: "the clinic on 5th",
      providerIds: [],
    });
  });

  test("an appointment's other words name it", () => {
    expect(action(top("cardiology appt dec 3 at 10am with dr lee"))).toMatchObject({
      title: "Cardiology appointment",
      occurredAt: at("2026-12-03T18:00:00Z"),
      providerIds: [LEE],
    });
  });

  test("a day without a time is all day, at the start of the day", () => {
    expect(action(top("appt dr lee friday"))).toMatchObject({
      allDay: true,
      occurredAt: at("2026-11-20T08:00:00Z"),
    });
  });

  test("an appointment with no time is now, with a warning", () => {
    const r = top("appointment with dr lee");
    expect(action(r)).toMatchObject({ occurredAt: NOW.toISOString(), providerIds: [LEE] });
    expect(warnings(r)).toEqual(["No time given, so it's set to now. Edit it to choose when."]);
    expect(blocking(r)).toEqual([]);
  });

  test("something that happened is an event, with a note as the alternative", () => {
    const readings = parse("fell in bathroom last night")[0]!.readings;
    expect(readings.map((r) => r.kind)).toEqual(["event", "note"]);
    expect(action(readings[0]!)).toMatchObject({
      title: "Fell in bathroom",
      occurredAt: at("2026-11-19T06:00:00Z"), // 22:00 the evening before
    });
  });
});

describe("notes", () => {
  test.each(["had a good day", "Ann visited, brought soup", "asdf qwer", "???ok", "🙂 good"])(
    "%s is a note (with event as an alternative), keeping the text as typed",
    (line) => {
      const part = parse(line)[0]!;
      expect(part.readings[0]!.kind).toBe("note");
      expect(action(part.readings[0]!)).toMatchObject({ type: "addNote", text: part.text });
      expect(part.readings.map((r) => r.kind)).toContain("event");
    },
  );

  test("every part has a note reading, whatever it is", () => {
    for (const line of ["bp 130/85", "gave metformin", "pain 4", "appt tomorrow", "hello"])
      expect(parse(line)[0]!.readings.some((r) => r.kind === "note")).toBe(true);
  });

  test("a note dated ahead is a reminder, all day", () => {
    expect(action(top("call the pharmacy tomorrow", { providers: [] }))).toMatchObject({
      type: "addEvent", // a future time phrase leans to an event…
    });
    const note = parse("call the pharmacy tomorrow")[0]!.readings.find((r) => r.kind === "note")!;
    expect(action(note)).toMatchObject({ occurredAt: at("2026-11-20T08:00:00Z") });
  });

  test("a very long line is cut to the limits, never refused", () => {
    const long = "word ".repeat(3000);
    const r = top(long);
    expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
  });
});

describe("prefixes", () => {
  test.each([
    ["n: bp 130/85", "note"],
    ["N: gave metformin", "note"],
    ["e: dinner with Ann", "event"],
    ["s: tired", "symptom"],
    ["s: low energy", "symptom"],
    ["v: 130/85", "vital"],
    ["d: metformin", "dose"],
  ])("%s is a %s", (line, kind) => {
    expect(top(line).kind).toBe(kind);
  });

  test("a prefix that can't be read as its kind falls back to a note, saying so", () => {
    const r = top("v: hello");
    expect(r.kind).toBe("note");
    expect(warnings(r)).toEqual(["Couldn't read a vital in this, so it's a note."]);
  });

  test("the prefix isn't part of the text", () => {
    expect(action(top("n: bp 130/85"))).toMatchObject({ text: "bp 130/85" });
  });
});

describe("tasks", () => {
  type Task = { title: string; assigneeId: string | null; dueOn: string | null; dueTime: string | null };
  const task = (line: string, over?: Partial<QuickEntryContext>) => {
    const r = top(line, over);
    expect(r.kind).toBe("task");
    expect(r.label).toBe("Task");
    const a = action(r);
    if (a.type !== "addTask") throw new Error(`not a task: ${a.type}`);
    return {
      title: a.title,
      assigneeId: a.assigneeId ?? null,
      dueOn: a.dueOn ?? null,
      dueTime: a.dueTime ?? null,
    };
  };
  const plain = (title: string, more: Partial<Task> = {}): Task => ({
    title,
    assigneeId: null,
    dueOn: null,
    dueTime: null,
    ...more,
  });

  test.each<[string, Task]>([
    // Each prefix; the time phrase is the due day (read ahead), and the time when it says one.
    ["todo: call pharmacy friday", plain("Call pharmacy", { dueOn: "2026-11-20" })],
    ["TODO call pharmacy", plain("Call pharmacy")],
    ["task: fax the insurance form", plain("Fax the insurance form")],
    [
      "t: pick up the walker tomorrow at 3pm",
      plain("Pick up the walker", { dueOn: "2026-11-20", dueTime: "15:00" }),
    ],
    ["to-do: refill metformin", plain("Refill metformin")],
    ["todo: pick up milk and bread", plain("Pick up milk and bread")],
    // Due phrases: a day, a day and time, a time alone (the next one), relative, "by".
    ["todo: call the office by 5pm", plain("Call the office", { dueOn: "2026-11-19", dueTime: "17:00" })],
    ["todo: call the office at 7", plain("Call the office", { dueOn: "2026-11-19", dueTime: "19:00" })],
    ["todo: order supplies next tue", plain("Order supplies", { dueOn: "2026-11-24" })],
    ["todo: book a ride nov 30 9am", plain("Book a ride", { dueOn: "2026-11-30", dueTime: "09:00" })],
    ["todo: call back in 2 hours", plain("Call back", { dueOn: "2026-11-19", dueTime: "10:00" })],
    ["todo: water the plants thursday", plain("Water the plants", { dueOn: "2026-11-19" })],
    // Members by "for" or "@": first name, full name, folded case; the words leave the title.
    ["todo: call pharmacy friday for Sam", plain("Call pharmacy", { assigneeId: SAM, dueOn: "2026-11-20" })],
    ["todo: @sam call pharmacy", plain("Call pharmacy", { assigneeId: SAM })],
    ["todo: call pharmacy @Sam", plain("Call pharmacy", { assigneeId: SAM })],
    ["t: for Sam Rivera: pick up groceries", plain("Pick up groceries", { assigneeId: SAM })],
    ["t: buy stamps for jo ann okafor", plain("Buy stamps", { assigneeId: JO })],
    ["t: buy stamps for jo", plain("Buy stamps", { assigneeId: JO })],
    // Not a member: the name stays in the title (a typed-in assignee is set in the sheet).
    ["todo: call pharmacy for Aunt May", plain("Call pharmacy for Aunt May")],
    ["todo: ask @dana about the ramp", plain("Ask @dana about the ramp")],
    ["todo: buy a card for Sam's birthday", plain("Buy a card for Sam's birthday")],
    [
      "todo: pick up a prescription for mom for Sam",
      plain("Pick up a prescription for mom", { assigneeId: SAM }),
    ],
  ])("%s", (line, expected) => {
    expect(task(line)).toEqual(expected);
    expect(blocking(top(line))).toEqual([]);
    expect(assistantActionZSchema.safeParse(action(top(line))).success).toBe(true);
  });

  test("with no members known, a name stays in the title", () => {
    expect(task("todo: call pharmacy for Sam", { members: [] })).toEqual(plain("Call pharmacy for Sam"));
  });

  test("two members with the name: nobody is assigned, and the card says so", () => {
    const members = [
      { id: SAM, name: "Sam Rivera" },
      { id: JO, name: "Sam Okafor" },
    ];
    expect(task("todo: call pharmacy for Sam", { members })).toEqual(plain("Call pharmacy"));
    expect(warnings(top("todo: call pharmacy for Sam", { members }))).toEqual([
      "More than one member is called Sam, so nobody is assigned. Edit it to choose.",
    ]);
    // The full name settles it.
    expect(task("todo: call pharmacy for sam okafor", { members })).toEqual(
      plain("Call pharmacy", { assigneeId: JO }),
    );
  });

  test("a due day already past is allowed, and the card says it's overdue", () => {
    const r = top("todo: send the form yesterday");
    expect(task("todo: send the form yesterday")).toEqual(plain("Send the form", { dueOn: "2026-11-18" }));
    expect(warnings(r)).toEqual(["That's already past, so it's overdue."]);
    expect(blocking(r)).toEqual([]);
  });

  test("a task needs words besides its due day", () => {
    const r = top("todo: friday");
    expect(r.kind).toBe("task");
    expect(blocking(r)).toEqual(["Say what the task is."]);
  });

  test("the alternative is a note of the same words", () => {
    const readings = parse("todo: call pharmacy friday")[0]!.readings;
    expect(readings.map((r) => r.label)).toEqual(["Task", "Note"]);
    expect(action(readings[1]!)).toMatchObject({ type: "addNote", text: "call pharmacy friday" });
  });

  test("without a prefix there's no task", () => {
    expect(parse("call pharmacy friday")[0]!.readings.map((r) => r.kind)).not.toContain("task");
  });

  test("in another zone, the due day and time are the recipient's", () => {
    // 16:00 UTC is 11:00 in New York, so "at 5" is 17:00 there.
    expect(task("todo: call the office at 5", { timeZone: "America/New_York" })).toEqual(
      plain("Call the office", { dueOn: "2026-11-19", dueTime: "17:00" }),
    );
  });

  test("a task beside other parts in one line", () => {
    const parts = parse("bp 130/85, todo: call pharmacy friday for Sam, gave metformin");
    expect(parts.map((p) => p.readings[0]!.kind)).toEqual(["vital", "task", "dose"]);
    expect(action(parts[1]!.readings[0]!)).toMatchObject({
      type: "addTask",
      title: "Call pharmacy",
      assigneeId: SAM,
      dueOn: "2026-11-20",
    });
  });
});

describe("times", () => {
  test.each([
    ["bp 120/80", "2026-11-19T16:00:00Z"],
    ["bp 120/80 at 7am", "2026-11-19T15:00:00Z"],
    ["bp 120/80 at 7", "2026-11-19T15:00:00Z"],
    ["bp 120/80 at 7:30", "2026-11-19T15:30:00Z"],
    ["bp 120/80 at 6:30 am", "2026-11-19T14:30:00Z"],
    ["bp 120/80 30 min ago", "2026-11-19T15:30:00Z"],
    ["bp 120/80 an hour ago", "2026-11-19T15:00:00Z"],
    ["bp 120/80 half an hour ago", "2026-11-19T15:30:00Z"],
    ["bp 120/80 2hrs ago", "2026-11-19T14:00:00Z"],
    ["bp 120/80 yesterday 9pm", "2026-11-19T05:00:00Z"],
    ["yesterday at 9pm bp 120/80", "2026-11-19T05:00:00Z"],
    ["bp 120/80 last night", "2026-11-19T06:00:00Z"],
    ["bp 120/80 yesterday", "2026-11-18T16:00:00Z"],
    ["bp 120/80 at 11pm", "2026-11-19T07:00:00Z"], // the most recent 11 pm: last night
    ["bp 120/80 at noon", "2026-11-18T20:00:00Z"],
    ["bp 120/80 mon 8am", "2026-11-16T16:00:00Z"], // a weekday leans back for a vital
    ["bp 120/80 nov 2 8am", "2026-11-02T16:00:00Z"],
    ["gave metformin at 20:00", "2026-11-19T04:00:00Z"],
  ])("%s → %s", (line, iso) => {
    const r = top(line);
    expect(when(r)).toBe(at(iso));
    expect(blocking(r)).toEqual([]);
  });

  test.each([
    "bp 120/80 tomorrow",
    "gave metformin in 2 hours",
    "pain 5 next tuesday",
    "bp 120/80 this evening",
  ])("a future time on a past-only kind blocks it: %s", (line) => {
    const r = parse(line)[0]!.readings.find((x) => x.kind !== "note" && x.kind !== "event")!;
    expect(blocking(r)).toEqual(["Can't be in the future"]);
  });

  test("a few minutes ahead (a clock running fast) is allowed", () => {
    expect(blocking(top("bp 120/80 in 3 min"))).toEqual([]);
  });

  test("'sat' beside a number is oxygen, not Saturday", () => {
    expect(action(top("o2 sat 95"))).toMatchObject({ occurredAt: NOW.toISOString() });
  });

  test("across the fall DST change (Nov 1, 2026)", () => {
    const now = new Date("2026-11-02T18:00:00Z"); // Mon 10:00 PST
    expect(when(top("bp 120/80 yesterday 9pm", { now }))).toBe(at("2026-11-02T05:00:00Z"));
    expect(when(top("bp 120/80 yesterday 1am", { now }))).toBe(at("2026-11-01T08:00:00Z")); // the first 1 am (PDT)
    // Two days back at the same time of day, across the change: 10:00 PDT.
    expect(when(top("bp 120/80 2 days ago", { now }))).toBe(at("2026-10-31T17:00:00Z"));
  });

  test("across the spring DST change (Mar 8, 2026): a skipped time moves forward", () => {
    const now = new Date("2026-03-08T18:00:00Z"); // Sun 11:00 PDT
    expect(when(top("bp 120/80 at 2:30am", { now }))).toBe(at("2026-03-08T10:30:00Z"));
    expect(when(top("bp 120/80 yesterday 8am", { now }))).toBe(at("2026-03-07T16:00:00Z"));
  });

  test("in another zone, times are the recipient's", () => {
    const r = top("bp 120/80 at 7am", { timeZone: "America/New_York" });
    expect(when(r)).toBe(at("2026-11-19T12:00:00Z"));
  });
});

describe("whole lines", () => {
  test("a vital, a dose and a symptom are three parts, each with its best reading", () => {
    const parts = parse("bp 130/85 hr 72, gave metformin, pain 4 left knee");
    expect(parts.map((p) => p.readings[0]!.kind)).toEqual(["vital", "dose", "symptom"]);
    for (const p of parts)
      for (const r of p.readings)
        if (!blocking(r).length) expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
  });

  test("readings are sorted best first, each labelled", () => {
    const readings = parse("pain 4")[0]!.readings;
    expect(readings.map((r) => r.label)).toEqual(["Symptom", "Note", "Event"]);
    expect([...readings].sort((a, b) => b.confidence - a.confidence)).toEqual(readings);
  });

  test("nothing to read gives no parts", () => {
    expect(parse("")).toEqual([]);
    expect(parse("  , ; ")).toEqual([]);
  });
});

test("editDistance counts a swap as one edit", () => {
  expect(editDistance("metfromin", "metformin")).toBe(1);
  expect(editDistance("lisinoprel", "lisinopril")).toBe(1);
  expect(editDistance("abc", "abc")).toBe(0);
  expect(editDistance("", "abc")).toBe(3);
});
