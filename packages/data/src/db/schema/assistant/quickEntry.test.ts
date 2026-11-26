import type { QuickEntryContext, QuickEntryReading } from "./quickEntry";

import { describe, expect, test } from "vitest";
import { assistantActionZSchema } from "./assistantActions";
import { editDistance, parseQuickEntry, splitQuickEntry } from "./quickEntry";
import { findTime } from "./quickEntryTime";
import { QUICK_ENTRY_VOCABULARY } from "./quickEntryVocabulary";

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
const ALV = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALV_ADDRESS = "1200 Westside Ave, Springfield";

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
    { id: ALV, name: "Dr. Elena Alvarez", type: "clinician", address: ALV_ADDRESS },
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
/** When an action is dated (a todo has a due day instead). */
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
    // A repeat's weekdays are one part (B-254); what follows them splits as ever.
    ["every mon, wed and fri walk the dog", ["every mon, wed and fri walk the dog"]],
    ["walk the dog every Tue & Thu, gave metformin", ["walk the dog every Tue & Thu", "gave metformin"]],
    ["bins out every monday and gave metformin", ["bins out every monday", "gave metformin"]],
    ["every other week on mon + fri mow", ["every other week on mon + fri mow"]],
    ["saw dr lee on mon, wed was fine", ["saw dr lee on mon", "wed was fine"]],
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

  describe("a dose that wasn't given (B-300)", () => {
    const doses = (line: string) => parse(line)[0]!.readings.filter((r) => r.kind === "dose");

    test.each([
      "did not give metoprolol",
      "didn't give metoprolol",
      "didn’t give metoprolol",
      "didnt give metoprolol",
      "metoprolol not given",
      "metoprolol wasn't given",
      "metoprolol was not given",
      "couldn't give metoprolol",
      "wouldn't give metoprolol",
      "cannot give metoprolol",
      "never gave metoprolol",
      "forgot to give metoprolol",
      "unable to give metoprolol",
      "no metoprolol given",
      "d: didn't give metoprolol",
    ])("%s is skipped, with the note second", (line) => {
      const { readings } = parse(line)[0]!;
      expect(readings[0]!.kind).toBe("dose");
      expect(action(readings[0]!)).toMatchObject({
        type: "logDose",
        medicationId: METO,
        status: "skipped",
        note: null,
      });
      expect(readings[1]!.kind).toBe("note");
    });

    test("a negated dose is less sure than a plain one and surer than the note", () => {
      const { readings } = parse("didn't give metoprolol")[0]!;
      expect(readings[0]!.confidence).toBeLessThan(top("gave metoprolol").confidence);
      expect(readings[0]!.confidence).toBeGreaterThan(readings.find((r) => r.kind === "note")!.confidence);
    });

    test("a long name doesn't push the negating word out of reach", () => {
      const medications = [{ id: METO, name: "Vitamin D3 Gummy Chew" }];
      expect(action(top("no vitamin d3 gummy chew given", { medications }))).toMatchObject({
        status: "skipped",
      });
    });

    test("'and not' reads the next medication as skipped", () => {
      expect(parse("gave tylenol and not metoprolol").map((p) => action(p.readings[0]!))).toMatchObject([
        { type: "logDose", medicationId: APAP, status: "given" },
        { type: "logDose", medicationId: METO, status: "skipped", note: null },
      ]);
    });

    test("a carried negation needs a given before it and only a name after it", () => {
      expect(top("no metoprolol").kind).toBe("note");
      expect(parse("skipped metformin and not metoprolol")[1]!.readings[0]!.kind).toBe("note");
      expect(parse("gave metformin, no lisinopril side effects")[1]!.readings[0]!.kind).toBe("note");
    });

    test.each([
      ["gave metformin without food", "without food"],
      ["gave metformin with no problems", "with no problems"],
      ["gave tylenol not long ago", "not long ago"],
    ])("%s stays given", (line, note) => {
      expect(action(top(line))).toMatchObject({ type: "logDose", status: "given", note });
    });

    test.each([
      ["no pain after metformin given", MET, "no pain after"],
      ["no problems when given metformin", MET, "no problems when"],
      ["no pain gave tylenol", APAP, "no pain"],
      ["no chest pain gave tylenol", APAP, "no chest pain"],
    ])("%s negates the symptom, not the dose", (line, medicationId, note) => {
      expect(action(top(line))).toMatchObject({ type: "logDose", medicationId, status: "given", note });
    });

    test.each([
      "no pain meds given metoprolol",
      "no pain medicine given metoprolol",
      "no pain relief given metoprolol",
      "no painkillers given metoprolol",
      "no pain metoprolol given",
      "no evening metoprolol given",
      "no more metoprolol given",
    ])("%s is still skipped: the no is about the medication", (line) => {
      expect(action(top(line))).toMatchObject({ type: "logDose", medicationId: METO, status: "skipped" });
    });

    test("a negated skip or refusal stays a note even after a symptom", () => {
      expect(top("no pain skipped metformin").kind).toBe("note");
      expect(top("no pain refused metformin").kind).toBe("note");
    });

    test("a medication named like a symptom can still be negated", () => {
      const medications = [{ id: METO, name: "Nausea Relief" }];
      expect(action(top("no nausea relief given", { medications }))).toMatchObject({ status: "skipped" });
      expect(action(top("no nausea given", { medications }))).toMatchObject({ status: "skipped" });
    });

    test.each(["wouldn't take metoprolol", "wouldn’t take metoprolol", "did not swallow metoprolol"])(
      "%s stays refused",
      (line) => {
        expect(action(top(line))).toMatchObject({ type: "logDose", medicationId: METO, status: "refused" });
      },
    );

    test.each([
      ["gave metoprolol", "given"],
      ["skipped metoprolol", "skipped"],
      ["refused metoprolol", "refused"],
    ])("%s is unchanged", (line, status) => {
      expect(action(top(line))).toMatchObject({ type: "logDose", medicationId: METO, status });
    });

    test.each(["didn't skip metoprolol", "didn't refuse metoprolol"])("%s is a note, no dose", (line) => {
      expect(top(line).kind).toBe("note");
      expect(doses(line)).toEqual([]);
    });
  });

  describe("a typed count is the amount (B-301)", () => {
    const TYL = "99999999-9999-4999-8999-999999999999";
    const named = [{ id: TYL, name: "Tylenol", strength: "500 mg", dose: "2 tablets" }];
    const fixtures = [
      ["named Tylenol", named, TYL],
      ["Tylenol only in its directions", undefined, APAP],
    ] as const;
    const over = (medications: typeof named | undefined) => (medications ? { medications } : {});
    const symptoms = (line: string, medications?: typeof named) =>
      parse(line, over(medications))[0]!.readings.filter((r) => r.kind === "symptom");

    describe.each(fixtures)("%s", (_, medications, medicationId) => {
      test.each([
        ["gave 3 tylenol", "3 tablets"],
        ["gave 1 tylenol", "1 tablet"],
        ["gave half a tylenol", "half a tablet"],
        ["gave 1/2 tylenol", "1/2 tablet"],
        ["gave ½ tylenol", "½ tablet"],
        ["gave two tylenol", "two tablets"],
        ["tylenol x2", "2 tablets"],
        ["tylenol 2", "2 tablets"],
        ["3 tylenol", "3 tablets"],
        ["tylenol 20", "20 tablets"],
      ])("%s records %s", (line, amount) => {
        const r = top(line, over(medications));
        expect(r.kind).toBe("dose");
        expect(action(r)).toMatchObject({ type: "logDose", medicationId, amount, note: null });
      });

      test("tylenol 2 at 8 is a dose at 8:00, never a symptom named Tylenol", () => {
        const r = top("tylenol 2 at 8", over(medications));
        expect(r.kind).toBe("dose");
        expect(action(r)).toMatchObject({ medicationId, amount: "2 tablets", note: null });
        expect(when(r)).toBe(at("2026-11-19T16:00:00Z"));
        expect(symptoms("tylenol 2 at 8", medications)).toEqual([]);
      });

      test("gave tylenol 25 keeps the usual dose", () => {
        const r = top("gave tylenol 25", over(medications));
        expect(r.kind).toBe("dose");
        expect(action(r)).toMatchObject({ medicationId, amount: "2 tablets" });
      });

      test("tylenol 500 at the strength asks for the amount (B-662)", () => {
        const r = top("tylenol 500", over(medications));
        expect(r.kind).toBe("dose");
        expect(r.asksAmount).toBe(true);
        expect(action(r)).toMatchObject({ medicationId, amount: null });
      });

      test("didn't give 2 tylenol is skipped with the amount", () => {
        expect(action(top("didn't give 2 tylenol", over(medications)))).toMatchObject({
          medicationId,
          status: "skipped",
          amount: "2 tablets",
          note: null,
        });
      });

      test("a negated skip with a count stays a note, with no dose", () => {
        const { readings } = parse("didn't skip 2 tylenol", over(medications))[0]!;
        expect(readings[0]!.kind).toBe("note");
        expect(readings.some((r) => r.kind === "dose")).toBe(false);
      });
    });

    test.each([
      ["a measure", "500 mg"],
      ["no usual dose", null],
    ])("with %s, the count alone", (_, dose) => {
      const medications = [{ id: TYL, name: "Tylenol", strength: "500 mg", dose }];
      expect(action(top("gave 3 tylenol", { medications }))).toMatchObject({ amount: "3", note: null });
    });

    test("a strength after the name isn't a count; before it, a number is", () => {
      expect(action(top("lisinopril 10"))).toMatchObject({
        medicationId: LIS,
        amount: "1 tablet",
        note: null,
      });
      const medications = [{ id: TYL, name: "Warfarin", strength: "2 mg", dose: "1 tablet" }];
      expect(action(top("gave 2 warfarin", { medications }))).toMatchObject({ amount: "2 tablets" });
      expect(action(top("warfarin 2", { medications }))).toMatchObject({ amount: "1 tablet" });
    });

    describe("a number in the medication's name isn't a count", () => {
      const OMEGA = [{ id: TYL, name: "Omega 3", dose: "1 capsule" }];
      const HTP = [{ id: TYL, name: "5 HTP", dose: "1 capsule" }];

      test.each([
        ["gave omega 3", OMEGA, "1 capsule"],
        ["omega 3", OMEGA, "1 capsule"],
        ["gave 2 omega 3", OMEGA, "2 capsules"],
        ["2 omega 3", OMEGA, "2 capsules"],
        ["omega 3 x2", OMEGA, "2 capsules"],
        ["omega 3 2", OMEGA, "2 capsules"],
        ["gave 5 htp", HTP, "1 capsule"],
        ["gave 2 5 htp", HTP, "2 capsules"],
      ])("%s records the right amount", (line, medications, amount) => {
        const r = top(line, { medications });
        expect(r.kind).toBe("dose");
        expect(action(r)).toMatchObject({ type: "logDose", medicationId: TYL, amount, note: null });
      });

      test("a number before a name that ends in it is still a count", () => {
        expect(action(top("gave 3 omega", { medications: OMEGA }))).toMatchObject({ amount: "3 capsules" });
      });

      test("its strength and a time still read beside a number in the name", () => {
        const medications = [{ ...OMEGA[0]!, strength: "1000 mg" }];
        expect(action(top("omega 3 1000", { medications }))).toMatchObject({
          amount: "1 capsule",
          note: null,
        });
        const r = top("omega 3 at 8", { medications });
        expect(action(r)).toMatchObject({ amount: "1 capsule", note: null });
        expect(when(r)).toBe(at("2026-11-19T16:00:00Z"));
      });

      test("a number of times after the name stays in the note", () => {
        expect(action(top("gave omega 3 times", { medications: OMEGA }))).toMatchObject({
          amount: "1 capsule",
          note: "3 times",
        });
      });
    });

    test("a carried negation over a directions-only match stays a note", () => {
      const part = parse("gave metformin and not 2 tylenol")[1]!;
      expect(part.readings[0]!.kind).toBe("note");
      expect(part.readings.some((r) => r.kind === "dose" || r.kind === "symptom")).toBe(false);
    });

    test.each([
      ["gave 2 tablets acetaminophen", "2 tablets"],
      ["gave half a tablet metoprolol", "half a tablet"],
      ["gave tylenol", "2 tablets"],
    ])("%s is unchanged", (line, amount) => {
      expect(action(top(line))).toMatchObject({ type: "logDose", amount });
    });

    test.each([
      ["pain 4", "Pain", 4],
      ["nausea 3/10", "Nausea", 3],
      ["food 2", "Food", 2],
    ])("%s is still a symptom beside directions that mention it", (line, name, severity) => {
      const medications = [
        { id: APAP, name: "Acetaminophen", dose: "2 tablets", directions: "Tylenol, for pain with food" },
      ];
      const r = top(line, { medications });
      expect(r.kind).toBe("symptom");
      expect(action(r)).toMatchObject({ name, severity });
    });

    test("what a medication is for isn't its name: arthritis 3 is a symptom", () => {
      const medications = [
        { id: APAP, name: "Acetaminophen", dose: "2 tablets", directions: "Tylenol, for arthritis flares" },
      ];
      expect(action(top("arthritis 3", { medications }))).toMatchObject({ name: "Arthritis", severity: 3 });
      expect(action(top("tylenol 3", { medications }))).toMatchObject({ amount: "3 tablets" });
    });

    test("a short partial name without a verb isn't a dose: arm 3 is a symptom", () => {
      const medications = [{ id: TYL, name: "Armour Thyroid", dose: "1 tablet" }];
      expect(top("arm 3", { medications }).kind).toBe("symptom");
    });

    test("a number of times isn't a count", () => {
      expect(action(top("gave tylenol 2 times"))).toMatchObject({ amount: "2 tablets", note: "2 times" });
      expect(action(top("gave lisinopril 2 times"))).toMatchObject({ amount: "1 tablet", note: "2 times" });
    });

    test("a vital's number beside a medication isn't its count", () => {
      const r = parse("rr 16 metformin given")[0]!.readings.find((x) => x.kind === "dose")!;
      expect(action(r)).toMatchObject({ medicationId: MET, amount: "1 tablet" });
    });
  });

  describe("a fraction beside a medication is its amount (B-301, B-302)", () => {
    const medications = [{ id: APAP, name: "Tylenol", dose: "1 tablet" }];
    const day = (r: QuickEntryReading) =>
      new Date(when(r)!).toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
        month: "numeric",
        day: "numeric",
      });

    test.each([
      ["gave 3/8 tylenol", "3/8 tablet"],
      ["gave 1/6 tylenol", "1/6 tablet"],
      ["gave 5/6 tylenol", "5/6 tablet"],
      ["gave 2/5 tylenol", "2/5 tablet"],
      ["gave 1/2 tylenol", "1/2 tablet"],
      ["gave 1/8 tylenol", "1/8 tablet"],
      ["gave 3/8 of a tylenol", "3/8 tablet"],
      ["3/8 tylenol", "3/8 tablet"],
    ])("%s records %s, dated now", (line, amount) => {
      const r = top(line, { medications });
      expect(action(r)).toMatchObject({ type: "logDose", amount, note: null });
      expect(when(r)).toBe(NOW.toISOString());
    });

    test.each([
      ["on 3/8 gave tylenol", "3/8"],
      ["gave tylenol on 3/8", "3/8"],
      ["on 3/8 tylenol", "3/8"],
      ["11/25 gave tylenol", "11/25"],
    ])("%s stays dated %s, with the usual dose", (line, date) => {
      const r = top(line, { medications });
      expect(action(r)).toMatchObject({ type: "logDose", amount: "1 tablet" });
      expect(day(r)).toBe(date);
    });

    test.each(["gave 4/3 tylenol", "gave 3/7 tylenol", "gave 3/9 tylenol"])(
      "%s isn't a dose-like fraction, so it stays a date",
      (line) => {
        expect(day(top(line, { medications }))).toBe(line.split(" ")[1]);
      },
    );

    test("a real date later in the line still dates the dose", () => {
      const r = top("gave 3/8 tylenol on 11/12", { medications });
      expect(action(r)).toMatchObject({ amount: "3/8 tablet" });
      expect(day(r)).toBe("11/12");
    });

    describe("typed after the medication (B-591)", () => {
      const usual = [{ id: APAP, name: "Tylenol", dose: "2 tablets" }];

      test.each([
        ["gave tylenol 3/8", "3/8 tablet"],
        ["gave tylenol 1/2", "1/2 tablet"],
        ["tylenol 3/8", "3/8 tablet"],
        ["tylenol 3/8 given", "3/8 tablet"],
        ["d: tylenol 3/8", "3/8 tablet"],
        ["gave tylenol 3/8 tablet", "3/8 tablet"],
      ])("%s records %s, dated now", (line, amount) => {
        const r = top(line, { medications: usual });
        expect(action(r)).toMatchObject({ type: "logDose", amount, note: null });
        expect(when(r)).toBe(NOW.toISOString());
      });

      test("a number in the name stays in the name", () => {
        const r = top("gave omega 3 1/2", {
          medications: [{ id: APAP, name: "Omega 3", dose: "2 capsules" }],
        });
        expect(action(r)).toMatchObject({ amount: "1/2 capsule", note: null });
        expect(when(r)).toBe(NOW.toISOString());
      });

      test.each([
        ["gave tylenol on 3/8", "2 tablets"],
        ["gave 2 tylenol 3/8", "2 tablets"],
        ["gave half a tylenol 3/8", "half a tablet"],
        ["skipped tylenol 3/8", "2 tablets"],
        ["didn't give tylenol 3/8", "2 tablets"],
        ["refused tylenol 3/8", "2 tablets"],
      ])("%s keeps March 8 and records %s", (line, amount) => {
        const r = top(line, { medications: usual });
        expect(action(r)).toMatchObject({ type: "logDose", amount });
        expect(day(r)).toBe("3/8");
      });

      test("a dose not given carried from the last part keeps the date", () => {
        const r = parse("skipped metformin, tylenol 3/8", {
          medications: [...usual, { id: MET, name: "Metformin" }],
        })[1]!.readings[0]!;
        expect(action(r)).toMatchObject({ status: "skipped", amount: "2 tablets" });
        expect(day(r)).toBe("3/8");
      });

      test.each(["refill tylenol 3/8", "appt tylenol 3/8"])(
        "%s has no dose verb, so 3/8 stays a date",
        (line) => {
          expect(JSON.stringify(action(top(line, { medications: usual })))).toContain("-03-08");
        },
      );

      test("a part carried from a given dose reads the fraction only when it is just the name", () => {
        const meds = [...usual, { id: MET, name: "Metformin" }];
        expect(
          action(parse("gave metformin, tylenol 3/8", { medications: meds })[1]!.readings[0]!),
        ).toMatchObject({
          amount: "3/8 tablet",
        });
        const refill = parse("gave metformin, refill tylenol 3/8", { medications: meds })[1]!.readings[0]!;
        expect(JSON.stringify(action(refill))).toContain("-03-08");
      });

      test("a real date later in the line still dates the dose", () => {
        const r = top("gave tylenol 3/8 on 11/12", { medications: usual });
        expect(action(r)).toMatchObject({ amount: "3/8 tablet" });
        expect(day(r)).toBe("11/12");
      });

      describe("the odd cases (B-632)", () => {
        const lorazepam = [{ id: MET, name: "Lorazepam", strength: "0.5 mg", dose: "1 tablet" }];

        test("a 'no' about a symptom doesn't negate the dose: the fraction is the amount", () => {
          const r = top("no pain gave tylenol 3/8", { medications: usual });
          expect(action(r)).toMatchObject({ type: "logDose", status: "given", amount: "3/8 tablet" });
          expect(when(r)).toBe(NOW.toISOString());
        });

        test.each(["need to take tylenol 3/8", "need to give tylenol 3/8", "remember to give tylenol 3/8"])(
          "%s isn't a report of a dose, so it keeps its date",
          (line) => {
            const r = top(line, { medications: usual });
            expect(JSON.stringify(action(r))).toContain("-03-08");
            expect(JSON.stringify(action(r))).not.toContain("3/8 tablet");
          },
        );

        test.each([
          ["gave lorazepam 1/2", "0.5 mg"],
          ["gave lorazepam 3/8", "0.375 mg"],
        ])("%s is the %s strength: the usual dose, no date", (line, strength) => {
          const r = top(line, { medications: [{ ...lorazepam[0]!, strength }] });
          expect(action(r)).toMatchObject({ type: "logDose", amount: "1 tablet", note: null });
          expect(when(r)).toBe(NOW.toISOString());
        });

        test("'gave lorazepam 1/2 mg' at a 0.5 mg strength is the usual dose, no date (B-641)", () => {
          const r = top("gave lorazepam 1/2 mg", { medications: lorazepam });
          expect(action(r)).toMatchObject({ type: "logDose", amount: "1 tablet", note: null });
          expect(when(r)).toBe(NOW.toISOString());
        });

        test.each([
          ["gave lorazepam 1/2 mg", "0.5 mg", "0.5 mg", "0.5 mg"],
          ["gave lorazepam 1/2 mg", "0.5 mg", "2 tablets", "1/2 mg"],
          ["gave lorazepam 1/2 mg", "0.5 mg", null, "1/2 mg"],
          ["gave lorazepam 1/4 mg", "0.5 mg", "1 tablet", "1/4 mg"],
          ["gave lorazepam 1/2 mcg", "0.5 mg", "1 tablet", "1/2 mcg"],
        ])("%s at %s with a usual %s records %s", (line, strength, dose, amount) => {
          const r = top(line, { medications: [{ ...lorazepam[0]!, strength, dose }] });
          expect(action(r)).toMatchObject({ type: "logDose", amount, note: null });
          expect(when(r)).toBe(NOW.toISOString());
        });

        test.each([
          ["gave lorazepam 1/2", "0.5 mg", "2 tablets", "1/2"],
          ["gave lorazepam 1/2", "0.5 mg", null, "1/2"],
          ["gave lorazepam 1/2", "0.5 mg", "1 mg", "1/2"],
          ["gave lorazepam 1/2", "0.5 mg", "1 tablet", "1 tablet"],
          ["gave lorazepam 1/2", "0.5 mg", "0.5 mg", "0.5 mg"],
          ["gave lorazepam 3/8", "0.375 mg", "2 tablets", "3/8"],
        ])("bare %s at %s with a usual %s records %s, no date (B-648)", (line, strength, dose, amount) => {
          const r = top(line, { medications: [{ ...lorazepam[0]!, strength, dose }] });
          expect(action(r)).toMatchObject({ type: "logDose", amount, note: null });
          expect(when(r)).toBe(NOW.toISOString());
        });

        test.each([
          ["gave lorazepam 0.5", "0.5 mg", "2 tablets", "0.5"],
          ["gave lorazepam 0.5", "0.5 mg", null, "0.5"],
          ["gave lorazepam 0.5", "0.5 mg", "1 tablet", "1 tablet"],
          ["gave lorazepam 0.5", "0.5 mg", "0.5 mg", "0.5 mg"],
        ])("bare %s at %s with a usual %s records %s, no date (B-651)", (line, strength, dose, amount) => {
          const r = top(line, { medications: [{ ...lorazepam[0]!, strength, dose }] });
          expect(action(r)).toMatchObject({ type: "logDose", amount, note: null });
          expect(when(r)).toBe(NOW.toISOString());
        });

        describe("a whole number at the strength (B-662)", () => {
          const lisinopril = (dose: string | null) => ({
            medications: [{ id: LIS, name: "Lisinopril", strength: "10 mg", dose }],
          });

          test("with a usual 2 tablets, it asks: blocked, recording no amount, offering both", () => {
            const { readings } = parse("gave lisinopril 10", lisinopril("2 tablets"))[0]!;
            const [ask, ...rest] = readings;
            expect(ask!.asksAmount).toBe(true);
            expect(action(ask!)).toMatchObject({ type: "logDose", medicationId: LIS, amount: null });
            expect(ask!.warnings.some((w) => w.blocking)).toBe(true);
            const choices = rest.filter((r) => r.amountChoice);
            expect(choices.map((r) => r.amountChoice)).toEqual(["1 tablet", "2 tablets"]);
            expect(choices.map((r) => action(r))).toMatchObject([
              { amount: "1 tablet" },
              { amount: "2 tablets" },
            ]);
            expect(choices.every((r) => r.warnings.every((w) => !w.blocking))).toBe(true);
          });

          test.each([
            ["a usual 1 tablet", "1 tablet", "1 tablet"],
            ["no usual dose", null, null],
            ["a usual measure", "10 mg", "10 mg"],
          ])("with %s, it records directly", (_, dose, amount) => {
            const r = top("gave lisinopril 10", lisinopril(dose));
            expect(r.asksAmount).toBeUndefined();
            expect(action(r)).toMatchObject({ type: "logDose", amount, note: null });
          });

          test("a count typed too is the amount, with nothing to ask", () => {
            const r = top("gave 2 lisinopril 10", lisinopril("2 tablets"));
            expect(r.asksAmount).toBeUndefined();
            expect(action(r)).toMatchObject({ amount: "2 tablets" });
          });

          test.each([
            ["skipped lisinopril 10", "skipped"],
            ["didn't give lisinopril 10", "skipped"],
            ["refused lisinopril 10", "refused"],
            ["wouldn't take lisinopril 10", "refused"],
          ])("%s records as %s without asking or guessing an amount (B-718)", (line, status) => {
            const { readings } = parse(line, lisinopril("2 tablets"))[0]!;
            const r = readings[0]!;
            expect(r.asksAmount).toBeUndefined();
            expect(r.warnings.some((w) => w.blocking)).toBe(false);
            expect(action(r)).toMatchObject({ type: "logDose", medicationId: LIS, status, amount: null });
            expect(readings.some((o) => o.amountChoice)).toBe(false);
          });

          test("a not-given status carried to the next medication doesn't ask either (B-718)", () => {
            const parts = parse("skipped tylenol and lisinopril 10", {
              medications: [
                { id: APAP, name: "Tylenol", strength: "500 mg", dose: "2 tablets" },
                { id: LIS, name: "Lisinopril", strength: "10 mg", dose: "2 tablets" },
              ],
            });
            const r = parts[1]!.readings[0]!;
            expect(r.asksAmount).toBeUndefined();
            expect(action(r)).toMatchObject({ medicationId: LIS, status: "skipped", amount: null });
          });
        });

        test("a fraction that isn't the strength is still the amount", () => {
          const r = top("gave lorazepam 1/4", { medications: lorazepam });
          expect(action(r)).toMatchObject({ amount: "1/4 tablet" });
          expect(when(r)).toBe(NOW.toISOString());
        });

        test("'gave tylenol 3/8 at 9pm' is 3/8 tablet today at 9pm", () => {
          // 10pm on Nov 19 in Los Angeles, so 9pm has passed today.
          const now = new Date("2026-11-20T06:00:00Z");
          const r = top("gave tylenol 3/8 at 9pm", { medications: usual, now });
          expect(action(r)).toMatchObject({ amount: "3/8 tablet" });
          expect(day(r)).toBe("11/19");
          expect(
            new Date(when(r)!).toLocaleTimeString("en-US", {
              timeZone: "America/Los_Angeles",
              hour: "numeric",
              minute: "2-digit",
            }),
          ).toBe("9:00 PM");
        });
      });
    });

    test("a line forced to another kind keeps its date", () => {
      const r = top("n: 3/8 tylenol", { medications });
      expect(r.kind).toBe("note");
      expect(day(r)).toBe("3/8");
    });

    test("a forced dose reads the fraction as its amount", () => {
      expect(action(top("d: 3/8 tylenol for pain", { medications }))).toMatchObject({ amount: "3/8 tablet" });
    });

    test.each(["appt 3/8 tylenol review", "dr lee 3/8 tylenol refill", "pick up 3/8 tylenol"])(
      "%s has no dose verb, so 3/8 stays a date",
      (line) => {
        const r = top(line, { medications });
        expect(r.kind).not.toBe("dose");
        expect(JSON.stringify(action(r))).toContain("-03-08");
      },
    );
  });

  describe("a slash number after a measurement word isn't a date (B-578)", () => {
    const dated = (line: string) =>
      parse(line)[0]!.readings.some((r) => {
        const a = action(r);
        return JSON.stringify(a).includes("-12-08") || JSON.stringify(a).includes("-05-05");
      });

    test.each([
      "bp 12/8",
      "blood pressure 12/8",
      "bp: 12/8",
      "hr 12/8",
      "temp 12/8",
      "o2 sat 12/8",
      "weight 12/8",
      "sugar 12/8",
      "pain 5/5",
      "pain is 5/5",
      "pain level 5/5",
      "nausea 5/5",
      "n: bp 12/8",
    ])("%s gets no date", (line) => {
      expect(dated(line)).toBe(false);
    });

    test.each([
      "appt 12/8",
      "on 12/8",
      "bp on 12/8",
      "bp 12/8/26",
      "appt for bp 12/8",
      "e: bp 12/8",
      "todo: weight 12/8",
      "sat 12/8",
      "fever 12/8",
      "weighed 12/8",
      "bm 12/8",
      "slept 12/8",
      "pain 12/8",
      "dr lee 12/8",
    ])("%s keeps its date", (line) => {
      expect(dated(line)).toBe(true);
    });

    test("a date after a whole reading still dates it", () => {
      const r = top("bp 130/85 12/8");
      expect(action(r)).toMatchObject({ type: "logVital" });
      expect(when(r)).toContain("-12-08");
    });

    test("gave 1/6 tylenol stays an amount", () => {
      const medications = [{ id: APAP, name: "Tylenol", dose: "1 tablet" }];
      const r = top("gave 1/6 tylenol", { medications });
      expect(action(r)).toMatchObject({ amount: "1/6 tablet" });
      expect(when(r)).toBe(NOW.toISOString());
    });
  });

  describe("an application site isn't a medication's name (B-301)", () => {
    const DIC = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const withDirections = (directions: string) => [{ id: DIC, name: "Diclofenac", directions }];

    test.each([
      ["knee 3", "Apply to knee twice daily", "Knee"],
      ["knee 3/10", "Apply to knee twice daily", "Knee"],
      ["knee 3", "Apply to left knee twice daily", "Knee"],
      ["knee 3", "Apply to the left knee", "Knee"],
      ["knee 3", "Apply on knee, twice daily", "Knee"],
      ["shoulder 3", "Rub onto shoulder every morning", "Shoulder"],
      ["back 3", "Apply over lower back at bedtime", "Back"],
    ])("%s beside '%s' is a symptom", (line, directions, name) => {
      const r = top(line, { medications: withDirections(directions) });
      expect(r.kind).toBe("symptom");
      expect(action(r)).toMatchObject({ name, severity: 3 });
    });

    test.each([
      ["tongue 3", "Dissolve under the tongue as needed"],
      ["tongue 3", "Place under tongue twice daily"],
      ["eye 3", "1 drop in each eye twice daily"],
      ["ear 3", "Apply behind the ear every 3 days"],
    ])("%s beside '%s' isn't a dose", (line, directions) => {
      const readings = parse(line, { medications: withDirections(directions) })[0]!.readings;
      expect(readings.some((r) => r.kind === "dose")).toBe(false);
    });

    test.each([
      ["voltaren 2", "Voltaren, apply to knee twice daily"],
      ["voltaren 2", "Apply Voltaren to knee twice daily"],
      ["voltaren 2", "Apply to knee twice daily, Voltaren"],
      ["voltaren 2", "Apply to knee twice daily Voltaren"],
    ])("%s still names the medication in '%s'", (line, directions) => {
      expect(action(top(line, { medications: withDirections(directions) }))).toMatchObject({
        type: "logDose",
        medicationId: DIC,
        amount: "2",
      });
    });

    test("'gave diclofenac to knee' is a dose", () => {
      const r = top("gave diclofenac to knee", { medications: withDirections("Apply to knee twice daily") });
      expect(action(r)).toMatchObject({ type: "logDose", medicationId: DIC });
    });
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
    // "Pass" is the code's word, "med time" the screen's (B-695): both still mean the slot.
    ["gave evening pass", EVENING],
    ["gave evening passes", EVENING],
    ["gave evening med time", EVENING],
    ["evening med time given", EVENING],
    ["gave the pass", MORNING],
    ["gave med time", MORNING],
    ["gave the med times", MORNING],
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
    // "Time" is a med time only right after "med": alone it's another word.
    expect(top("gave evening time", withPasses).kind).toBe("note");
  });

  test.each([
    "couldn't give evening meds",
    "couldn’t give evening meds",
    "didn't give meds",
    "never gave evening meds",
    "evening meds not given",
    "forgot evening meds",
    "gave morning meds not",
  ])("%s never gives the pass (B-300)", (line) => {
    const readings = parse(line, withPasses)[0]!.readings;
    expect(readings.some((r) => r.actions.some((a) => a.type === "givePass"))).toBe(false);
    expect(readings[0]!.kind).toBe("note");
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

  describe("the group's catalog (symptom-catalog)", () => {
    const symptoms = [{ name: "Nausea" }, { name: "Knee pain" }, { name: "Fall" }, { name: "SOB" }];

    test.each([
      ["nausea 3", "Nausea", 3],
      ["NAUSEA 3/10", "Nausea", 3],
      ["knee   PAIN 4", "Knee pain", 4],
      ["sob 5", "SOB", 5],
      // An incident's canonical name too.
      ["fell in the hall", "Fall", null],
      // Only the same key: a similar name stays as typed (its card asks).
      ["knee pian 4", "Knee pian", 4],
      ["back pain 8", "Back pain", 8],
    ])("%s reads as %s", (line, name, severity) => {
      const r = top(line, { symptoms });
      expect(r.kind).toBe("symptom");
      expect(action(r)).toMatchObject({ type: "logSymptom", name, severity });
    });

    test("without a catalog, the words as typed", () => {
      expect(action(top("sob 5"))).toMatchObject({ name: "Sob" });
      expect(action(top("sob 5", { symptoms: [] }))).toMatchObject({ name: "Sob" });
    });
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

  test("an appointment with no time is now, with a warning; with a provider it's all day today", () => {
    const r = top("appointment");
    expect(action(r)).toMatchObject({ occurredAt: NOW.toISOString(), allDay: false, providerIds: [] });
    expect(warnings(r)).toEqual(["No time given, so it's set to now. Edit it to choose when."]);
    expect(blocking(r)).toEqual([]);
    // Changed (quick-entry): a provider's event with no time is all day today, like "Dr. Elena Alvarez".
    const withLee = top("appointment with dr lee");
    expect(action(withLee)).toMatchObject({
      occurredAt: at("2026-11-19T08:00:00Z"),
      allDay: true,
      providerIds: [LEE],
    });
    expect(warnings(withLee)).toEqual([]);
  });

  test("a fall is a symptom now (it was an event), with a note and an event as alternatives", () => {
    const readings = parse("fell in bathroom last night")[0]!.readings;
    expect(readings.map((r) => r.kind)).toEqual(["symptom", "note", "event"]);
    expect(action(readings[0]!)).toMatchObject({
      type: "logSymptom",
      name: "Fall",
      severity: null,
      note: "in bathroom",
      occurredAt: at("2026-11-19T06:00:00Z"), // 22:00 the evening before
    });
  });
});

describe("the user's lines (B-220)", () => {
  type Shape = {
    kind: string;
    title?: string;
    name?: string;
    occurredAt?: string;
    allDay?: boolean;
    place?: string | null;
    providerIds?: string[];
    dueOn?: string | null;
    dueTime?: string | null;
  };
  const shape = (r: QuickEntryReading): Shape => {
    const a = action(r);
    if (a.type === "addTodo")
      return { kind: r.kind, title: a.title, dueOn: a.dueOn ?? null, dueTime: a.dueTime ?? null };
    if (a.type === "addEvent")
      return {
        kind: r.kind,
        title: a.title,
        occurredAt: a.occurredAt,
        allDay: a.allDay,
        place: a.place ?? null,
        providerIds: a.providerIds,
      };
    if (a.type === "logSymptom") return { kind: r.kind, name: a.name, occurredAt: a.occurredAt };
    return { kind: r.kind, occurredAt: when(r)! };
  };
  const todo = (title: string, dueOn: string, dueTime: string | null = null) => ({
    kind: "todo",
    title,
    dueOn,
    dueTime,
  });
  const event = (
    title: string,
    iso: string,
    allDay: boolean,
    place: string | null,
    providerIds: string[],
  ) => ({
    kind: "event",
    title,
    occurredAt: at(iso),
    allDay,
    place,
    providerIds,
  });

  test.each<[string, Shape]>([
    // A provider and a day: an event linked to it, the day read ahead, all day without a time.
    [
      "Dr. Elena Alvarez on the 25th",
      event("Dr. Elena Alvarez", "2026-11-25T08:00:00Z", true, ALV_ADDRESS, [ALV]),
    ],
    // What picking a name from Matching names leaves: all day today.
    ["Dr. Elena Alvarez", event("Dr. Elena Alvarez", "2026-11-19T08:00:00Z", true, ALV_ADDRESS, [ALV])],
    // A bare weekday is the coming one for an event.
    ["see Dr. Alvarez friday", event("Dr. Elena Alvarez", "2026-11-20T08:00:00Z", true, ALV_ADDRESS, [ALV])],
    // The title is never the raw line.
    ["Alvarez tomorrow 3pm", event("Dr. Elena Alvarez", "2026-11-20T23:00:00Z", false, ALV_ADDRESS, [ALV])],
    [
      "Riverside Dialysis monday 9am",
      event("Riverside Dialysis", "2026-11-23T17:00:00Z", false, "12 River Rd", [RIVER]),
    ],
    ["PT at Riverside friday", event("PT", "2026-11-20T08:00:00Z", true, "12 River Rd", [RIVER])],
    // A visit verb looks back.
    ["saw Dr. Lee today", event("Dr. Sandra Lee", "2026-11-19T08:00:00Z", true, null, [LEE])],
    ["saw dr lee monday", event("Dr. Sandra Lee", "2026-11-16T08:00:00Z", true, null, [LEE])],
    [
      "had dialysis at Riverside this morning",
      event("Dialysis", "2026-11-19T16:00:00Z", false, "12 River Rd", [RIVER]),
    ],
    // Word order doesn't matter.
    ["Dr. Lee tomorrow 3pm", event("Dr. Sandra Lee", "2026-11-20T23:00:00Z", false, null, [LEE])],
    ["tomorrow 3pm Dr. Lee", event("Dr. Sandra Lee", "2026-11-20T23:00:00Z", false, null, [LEE])],
    // "next" and "last" say which way.
    ["Dr. Lee next friday", event("Dr. Sandra Lee", "2026-11-20T08:00:00Z", true, null, [LEE])],
    ["Dr. Lee last friday", event("Dr. Sandra Lee", "2026-11-13T08:00:00Z", true, null, [LEE])],
    // Incidents are symptoms with no severity.
    ["fell", { kind: "symptom", name: "Fall", occurredAt: NOW.toISOString() }],
    ["fell in the bathroom", { kind: "symptom", name: "Fall", occurredAt: NOW.toISOString() }],
    // Calls and emergencies are notes.
    ["called dr lee about refill", { kind: "note", occurredAt: NOW.toISOString() }],
    ["911 call", { kind: "note", occurredAt: NOW.toISOString() }],
    ["went to the ER at Riverside", { kind: "note", occurredAt: NOW.toISOString() }],
    ["urgent care", { kind: "note", occurredAt: NOW.toISOString() }],
    // A past-only kind reads a bare weekday back.
    ["dizzy monday", { kind: "symptom", name: "Dizzy", occurredAt: at("2026-11-16T16:00:00Z") }],
    ["dizzy last friday", { kind: "symptom", name: "Dizzy", occurredAt: at("2026-11-13T16:00:00Z") }],
    // A note is past-only (planner-2): a time ahead makes it a todo, due that day (and time).
    ["call the pharmacy tomorrow", todo("Call the pharmacy", "2026-11-20")],
    ["call the pharmacy tomorrow 3pm", todo("Call the pharmacy", "2026-11-20", "15:00")],
    ["next friday pick up walker", todo("Pick up walker", "2026-11-20")],
    ["pick up the walker next tue", todo("Pick up the walker", "2026-11-24")],
    ["call the pharmacy tonight", todo("Call the pharmacy", "2026-11-19", "22:00")],
    ["call back in 2 hours", todo("Call back", "2026-11-19", "10:00")],
    // A line asking for something, with a part of day and no day: the next such time.
    ["call the pharmacy in the morning", todo("Call the pharmacy", "2026-11-20", "08:00")],
    ["in the morning call the pharmacy", todo("Call the pharmacy", "2026-11-20", "08:00")],
    [
      "remember to water the plants in the morning",
      todo("Remember to water the plants", "2026-11-20", "08:00"),
    ],
    ["pick up the walker in the afternoon", todo("Pick up the walker", "2026-11-19", "14:00")],
    ["call the pharmacy at night", todo("Call the pharmacy", "2026-11-19", "22:00")],
    ["call the pharmacy at 9 in the morning", todo("Call the pharmacy", "2026-11-19", "09:00")],
    // Its measurement or complaint is what to ask about, not a report (B-635).
    ["check bp 120/80 in the morning", todo("Check bp 120/80", "2026-11-20", "08:00")],
    ["ask about pain in the morning", todo("Ask about pain", "2026-11-20", "08:00")],
    // So with a day ahead, and "tomorrow morning" is that morning (B-643).
    ["check bp 120/80 tomorrow", todo("Check bp 120/80", "2026-11-20")],
    ["ask about pain tomorrow morning", todo("Ask about pain", "2026-11-20", "08:00")],
    ["dinner with Ann tomorrow 6pm", todo("Dinner with Ann", "2026-11-20", "18:00")],
    // A later weekday on a request: the coming one, with its part of day (B-647).
    ["pick up walker next friday morning", todo("Pick up walker", "2026-11-20", "08:00")],
    ["check bp 120/80 friday", todo("Check bp 120/80", "2026-11-20")],
    // A note with no time ahead stays a note, now or read back like the other past-only kinds.
    ["called the pharmacy", { kind: "note", occurredAt: NOW.toISOString() }],
    ["called the pharmacy monday", { kind: "note", occurredAt: at("2026-11-16T16:00:00Z") }],
    ["called the pharmacy on the 25th", { kind: "note", occurredAt: at("2026-10-25T15:00:00Z") }],
    ["called the pharmacy at 5pm", { kind: "note", occurredAt: at("2026-11-19T01:00:00Z") }],
    ["walked in 3 min", { kind: "note", occurredAt: at("2026-11-19T16:03:00Z") }],
    // A line reporting what happened in a part of day stays a note, read back.
    ["slept badly in the morning", { kind: "note", occurredAt: at("2026-11-19T16:00:00Z") }],
    ["called the pharmacy in the morning", { kind: "note", occurredAt: at("2026-11-19T16:00:00Z") }],
    ["call from the pharmacy in the morning", { kind: "note", occurredAt: at("2026-11-19T16:00:00Z") }],
    ["call in the morning was fine", { kind: "note", occurredAt: at("2026-11-19T16:00:00Z") }],
  ])("%s", (line, expected) => {
    const r = top(line);
    expect(shape(r)).toEqual(expected);
    expect(blocking(r)).toEqual([]);
    expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
  });

  test.each([
    ["check bp 120/80 in the morning", ["todo", "note", "vital", "event"]],
    ["ask about pain in the morning", ["todo", "note", "symptom", "event"]],
    // A report stays as it is.
    ["bp 120/80 in the morning", ["vital", "note", "event"]],
    ["pain in the morning", ["symptom", "note", "event"]],
    ["check bp 120/80 this morning", ["vital", "note", "event"]],
    ["check bp 120/80 tomorrow", ["todo", "note", "vital", "event"]],
    ["ask about pain tomorrow morning", ["todo", "note", "symptom", "event"]],
    ["bp 120/80 tomorrow", ["vital", "todo", "note", "event"]],
    ["pain tomorrow morning", ["symptom", "todo", "note", "event"]],
    // A request naming a provider stays an event first, with or without a part of day.
    ["call dr lee in the morning", ["event", "todo", "note"]],
    ["call dr lee tomorrow", ["event", "todo", "note"]],
    ["call dr lee tomorrow morning", ["event", "todo", "note"]],
    ["check bp 120/80 friday", ["todo", "note", "vital", "event"]],
    ["bp 120/80 friday", ["vital", "note", "event"]],
  ])("a request with a part of day: %s", (line, kinds) => {
    expect(parse(line)[0]!.readings.map((r) => r.kind)).toEqual(kinds);
  });

  test("a report with a bare weekday still reads back to the last one", () => {
    expect(when(top("bp 120/80 friday"))).toBe("2026-11-13T16:00:00.000Z");
  });

  test("a request naming a provider tomorrow morning is an event at 08:00", () => {
    const r = top("call dr lee tomorrow morning");
    expect(r.kind).toBe("event");
    expect(action(r)).toMatchObject({ occurredAt: "2026-11-20T16:00:00.000Z", allDay: false });
  });

  test("a request naming the last weekday isn't ahead, so it offers no todo", () => {
    expect(parse("call the pharmacy last friday morning")[0]!.readings.map((r) => r.kind)).not.toContain(
      "todo",
    );
  });

  test.each([
    ["pain tomorrow morning", "symptom"],
    ["appt tomorrow morning", "event"],
  ])("only a request reads a part of day after tomorrow: %s keeps the day", (line, kind) => {
    const r = top(line);
    expect(r.kind).toBe(kind);
    expect(when(r)).toBe("2026-11-20T08:00:00.000Z"); // Midnight in Los Angeles.
  });

  test("an incident has no severity, and the words after it are its note", () => {
    expect(action(top("fell in the bathroom"))).toMatchObject({ severity: null, note: "in the bathroom" });
    expect(action(top("fell"))).toMatchObject({ severity: null, note: null });
    expect(action(top("had a fall"))).toMatchObject({ name: "Fall", note: null });
  });

  test("an incident offers the other kinds; a fall asleep isn't one", () => {
    expect(parse("fell")[0]!.readings.map((r) => r.kind)).toEqual(["symptom", "note", "event"]);
    expect(top("fell asleep at 9").kind).not.toBe("symptom");
  });

  test("a contact verb with a provider is a note, with the provider's event as the alternative", () => {
    const readings = parse("called dr lee about refill")[0]!.readings;
    expect(readings.map((r) => r.kind)).toEqual(["note", "event"]);
    // The note mentions Dr. Lee where the line names her, and links her.
    expect(action(readings[0]!)).toMatchObject({
      type: "addNote",
      text: "called @Dr. Sandra Lee about refill",
      providerIds: [LEE],
    });
    expect(action(readings[1]!)).toMatchObject({ title: "Refill", providerIds: [LEE] });
  });

  test.each([
    ["called dr lee about refill", "called @Dr. Sandra Lee about refill", [LEE]],
    ["Talked to Dr. Lee about her rest", "Talked to @Dr. Sandra Lee about her rest", [LEE]],
    ["went to the ER at Riverside", "went to the ER at @Riverside Dialysis", [RIVER]],
    ["emailed Dr. Alvarez about the bill", "emailed @Dr. Elena Alvarez about the bill", [ALV]],
    ["n: Dr. Lee is great", "@Dr. Sandra Lee is great", [LEE]],
    // No provider named, or only a first name: a plain note.
    ["urgent care", "urgent care", []],
    ["911 call", "911 call", []],
    ["Sandra said she's fine", "Sandra said she's fine", []],
  ])("the note for %s mentions its providers", (line, text, providerIds) => {
    const note = parse(line)
      .flatMap((p) => p.readings)
      .find((r) => r.kind === "note")!;
    expect(action(note)).toMatchObject({ type: "addNote", text, providerIds });
    expect(assistantActionZSchema.safeParse(action(note)).success).toBe(true);
  });

  test("an emergency at a named provider is a note, with the visit as the alternative", () => {
    const readings = parse("went to the ER at Riverside")[0]!.readings;
    expect(readings[0]!.kind).toBe("note");
    expect(action(readings.find((r) => r.kind === "event")!)).toMatchObject({
      title: "ER",
      place: "12 River Rd",
      providerIds: [RIVER],
    });
    // No provider named: nothing is linked.
    for (const r of parse("urgent care")[0]!.readings)
      if (r.kind === "event") expect(action(r)).toMatchObject({ providerIds: [] });
  });

  test("a place typed after 'at' wins over the provider's address", () => {
    expect(action(top("Dr. Alvarez friday at the Elm St office"))).toMatchObject({
      place: "the Elm St office",
      providerIds: [ALV],
    });
  });

  test("a first name alone doesn't make an event", () => {
    expect(top("Sandra said she's fine").kind).toBe("note");
    expect(top("Elena said she's fine").kind).toBe("note");
  });

  test("a mixed line: the BP, then the provider's event", () => {
    const parts = parse("bp 130/85, Dr. Lee friday 2pm");
    expect(parts.map((p) => p.readings[0]!.kind)).toEqual(["vital", "event"]);
    expect(action(parts[1]!.readings[0]!)).toMatchObject({
      title: "Dr. Sandra Lee",
      occurredAt: at("2026-11-20T22:00:00Z"),
      providerIds: [LEE],
    });
    // A dose that names its prescriber is still a dose.
    expect(top("gave metformin per dr lee").kind).toBe("dose");
  });

  test("a symptom beside a visit to a provider is the alternative", () => {
    expect(top("saw dr lee after the fall").kind).toBe("event");
  });
});

describe("the vocabulary", () => {
  const KIND_OF = {
    symptomIncident: "symptom",
    noteIncident: "note",
    visitVerb: "event",
    contactVerb: "note",
    appointmentWord: "event",
  } as const;
  const verbs = new Set(["visitVerb", "contactVerb"]);

  test.each(QUICK_ENTRY_VOCABULARY.map((entry) => [entry.phrase, entry.role, entry] as const))(
    "%s (%s)",
    (phrase, role, entry) => {
      if (role === "requestVerb" || role === "requestLead") {
        // Alone it picks nothing; opening a line with a part of day, it asks for a todo.
        expect(top(phrase).kind).toBe("note");
        expect(top(`${phrase} the thing in the evening`).kind).toBe("todo");
        return;
      }
      if (role === "newMedication" || role === "newProvider") {
        // Opening a line, a card that opens the Add sheet ("started" needs a strength or form to lead).
        const kind = role === "newMedication" ? "medication" : "provider";
        const r = top(`${phrase} ${role === "newMedication" ? "Amlodipine 5 mg" : "Dr Kim"}`);
        expect(r.kind).toBe(kind);
        expect(r.actions).toEqual([]);
        expect(r.newItem).toMatchObject({ kind, name: role === "newMedication" ? "Amlodipine" : "Dr Kim" });
        return;
      }
      if (role === "repeatWord") {
        // A repeating todo: "water the plants daily", "… every day".
        const r = top(`water the plants ${phrase}${phrase === "every" ? " day" : ""}`);
        expect(r.kind).toBe("todo");
        expect(action(r)).toMatchObject({ title: "Water the plants" });
        expect(action(r)).toHaveProperty("repeatRule", expect.stringMatching(/^FREQ=/));
        return;
      }
      if (role === "reportWord") {
        expect(top(`call the pharmacy ${phrase} in the evening`).kind).toBe("note");
        return;
      }
      if (verbs.has(role)) {
        // A verb alone picks nothing; with a provider it picks its role's kind.
        expect(top(phrase).kind).toBe("note");
        const r = top(`${phrase} dr lee`);
        expect(r.kind).toBe(KIND_OF[role]);
        const event = parse(`${phrase} dr lee friday`)[0]!.readings.find((x) => x.kind === "event")!;
        expect(action(event)).toMatchObject({ providerIds: [LEE] });
        // A visit looks back; a contact's event alternative looks ahead.
        expect(when(event)).toBe(at(role === "visitVerb" ? "2026-11-13T08:00:00Z" : "2026-11-20T08:00:00Z"));
        return;
      }
      const r = top(phrase);
      expect(r.kind).toBe(KIND_OF[role]);
      if (role === "symptomIncident") expect(action(r)).toMatchObject({ name: entry.name, severity: null });
    },
  );

  test("every symptom incident has its canonical name; no phrase is listed twice", () => {
    for (const e of QUICK_ENTRY_VOCABULARY) if (e.role === "symptomIncident") expect(e.name).toBeTruthy();
    const phrases = QUICK_ENTRY_VOCABULARY.map((e) => e.phrase);
    expect(new Set(phrases).size).toBe(phrases.length);
  });
});

describe("new medications and providers (B-762)", () => {
  const newItem = (line: string) => {
    const parts = parse(line);
    expect(parts).toHaveLength(1);
    const r = parts[0]!.readings[0]!;
    expect(r.actions).toEqual([]);
    return r;
  };

  test('"new med lisinopril 10 mg tablet" is a new medication with its name, strength and form, not the current Lisinopril', () => {
    const r = newItem("new med lisinopril 10 mg tablet");
    expect(r.kind).toBe("medication");
    expect(r.label).toBe("New medication");
    expect(r.newItem).toEqual({
      kind: "medication",
      name: "Lisinopril",
      strength: "10 mg",
      form: "tablet",
      directions: null,
    });
    // Nothing reads it as the group's Lisinopril.
    for (const other of parse("new med lisinopril 10 mg tablet")[0]!.readings)
      expect(JSON.stringify(other.actions)).not.toContain(LIS);
  });

  test('"add provider Dr Kim cardiology 555-0100" is a new provider with its name, specialty and phone', () => {
    const r = newItem("add provider Dr Kim cardiology 555-0100");
    expect(r.kind).toBe("provider");
    expect(r.label).toBe("New provider");
    expect(r.newItem).toEqual({
      kind: "provider",
      type: "clinician",
      name: "Dr Kim",
      specialty: "Cardiology",
      practiceId: null,
      phone: "555-0100",
      address: null,
    });
  });

  test.each([
    [
      "add medication amlodipine 5mg tablets once daily with food",
      { name: "Amlodipine", strength: "5 mg", form: "tablet", directions: "once daily with food" },
    ],
    ["new med insulin glargine 100 units/ml", { name: "Insulin glargine", strength: "100 units/mL" }],
    ["new med amoxicillin 250mg/5ml liquid", { name: "Amoxicillin", strength: "250 mg/5mL", form: "liquid" }],
    ["started metformin 500 mg", { name: "Metformin", strength: "500 mg", form: null }],
    ["new medication eye drops", { name: "Eye", form: "drops" }],
    ["new med", { name: "", strength: null, form: null, directions: null }],
  ])("%s", (line, draft) => {
    const r = newItem(line);
    expect(r.kind).toBe("medication");
    expect(r.newItem).toMatchObject({ kind: "medication", ...draft });
  });

  test.each([
    [
      "add provider dr kim, heart doctor, (555) 555-0100, 12 Main St, Springfield",
      {
        name: "Dr Kim",
        specialty: "Heart doctor",
        phone: "(555) 555-0100",
        address: "12 Main St, Springfield",
      },
    ],
    ["new doctor Dr Patel at Riverside", { name: "Dr Patel", practiceId: RIVER, address: null }],
    ["new doctor Dr Patel at 400 Example Ave", { practiceId: null, address: "400 Example Ave" }],
    [
      "add provider Example Pharmacy 555-0199",
      { type: "pharmacy", name: "Example Pharmacy", phone: "555-0199" },
    ],
    ["new provider Lakeside Clinic", { type: "practice", name: "Lakeside Clinic" }],
  ])("%s", (line, draft) => {
    const r = newItem(line);
    expect(r.kind).toBe("provider");
    expect(r.newItem).toMatchObject({ kind: "provider", ...draft });
  });

  test('a line opening "new med" or "add provider" stays whole; "started" alone is offered, not first', () => {
    expect(splitQuickEntry("add provider Dr Kim, cardiology, 555-0100")).toEqual([
      "add provider Dr Kim, cardiology, 555-0100",
    ]);
    expect(splitQuickEntry("started metformin 500 mg, bp 130/85")).toEqual([
      "started metformin 500 mg",
      "bp 130/85",
    ]);
    expect(top("started physical therapy").kind).toBe("note");
    expect(parse("started physical therapy")[0]!.readings.map((r) => r.kind)).toContain("medication");
    expect(top("started coughing").kind).toBe("symptom");
    expect(top("gave lisinopril").kind).toBe("dose");
  });
});

describe("dates", () => {
  const eventAt = (line: string, over?: Partial<QuickEntryContext>) => {
    const r = top(line, over);
    expect(r.kind).toBe("event");
    const a = action(r);
    return a.type === "addEvent" ? [a.occurredAt, a.allDay] : [];
  };

  test.each([
    // Ordinals and month-day forms, read ahead for an event.
    ["Dr. Lee 25th", "2026-11-25T08:00:00Z", true],
    ["Dr. Lee the 25th", "2026-11-25T08:00:00Z", true],
    ["Dr. Lee on the 25th", "2026-11-25T08:00:00Z", true],
    ["Dr. Lee on the 25th at 2pm", "2026-11-25T22:00:00Z", false],
    ["Dr. Lee Nov 25", "2026-11-25T08:00:00Z", true],
    ["Dr. Lee November 25th", "2026-11-25T08:00:00Z", true],
    ["Dr. Lee 25th nov", "2026-11-25T08:00:00Z", true],
    // A day of the month that has passed is next month's.
    ["Dr. Lee on the 10th", "2026-12-10T08:00:00Z", true],
    // Today's, with its time already gone, is next month's too.
    ["Dr. Lee the 19th at 7am", "2026-12-19T15:00:00Z", false],
    ["Dr. Lee the 19th at 3pm", "2026-11-19T23:00:00Z", false],
    // A month without the day moves on to one that has it.
    ["Dr. Lee the 31st", "2026-12-31T08:00:00Z", true],
    // "next" and "last" on an event.
    ["Dr. Lee next friday 2pm", "2026-11-20T22:00:00Z", false],
    ["Dr. Lee last friday 2pm", "2026-11-13T22:00:00Z", false],
  ])("%s → %s", (line, iso, allDay) => {
    expect(eventAt(line)).toEqual([at(iso), allDay]);
  });

  test.each([
    // Back for a past-only kind: this month's once passed, else last month's.
    ["dizzy on the 10th", "2026-11-10T16:00:00Z"],
    ["dizzy the 25th", "2026-10-25T15:00:00Z"], // 08:00 PDT
    ["dizzy nov 10", "2026-11-10T16:00:00Z"],
    ["dizzy last friday", "2026-11-13T16:00:00Z"],
    ["pain 4 last friday 2pm", "2026-11-13T22:00:00Z"],
  ])("%s → %s (a symptom)", (line, iso) => {
    const r = top(line);
    expect(r.kind).toBe("symptom");
    expect(when(r)).toBe(at(iso));
    expect(blocking(r)).toEqual([]);
  });

  test("'next friday' on a symptom is in the future, so it blocks", () => {
    const r = parse("dizzy next friday")[0]!.readings.find((x) => x.kind === "symptom")!;
    expect(blocking(r)).toEqual(["Can't be in the future"]);
  });

  test("an ordinal that counts isn't a day", () => {
    expect(findTime(["the", "2nd", "dose"])).toBeNull();
    expect(findTime(["3rd", "floor"])).toBeNull();
    expect(findTime(["on", "the", "2nd"])?.spec).toEqual({ day: { date: 2 } });
  });

  test("across the fall DST change (Nov 1, 2026)", () => {
    const now = new Date("2026-10-29T16:00:00Z"); // Thu 09:00 PDT
    expect(eventAt("Dr. Lee monday 9am", { now })).toEqual([at("2026-11-02T17:00:00Z"), false]); // PST
    expect(eventAt("Dr. Lee the 2nd", { now })).toEqual([at("2026-11-02T08:00:00Z"), true]);
    expect(eventAt("Dr. Lee the 28th", { now })).toEqual([at("2026-11-28T08:00:00Z"), true]);
    const back = new Date("2026-11-03T18:00:00Z"); // Tue 10:00 PST
    expect(when(top("dizzy last friday", { now: back }))).toBe(at("2026-10-30T17:00:00Z")); // 10:00 PDT
    expect(eventAt("saw dr lee on the 30th", { now: back })).toEqual([at("2026-10-30T07:00:00Z"), true]);
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

  test("a note line that says a time ahead is a todo, with the note (now, the whole line) next", () => {
    // Changed (planner-2): it was a reminder, a note dated ahead.
    const readings = parse("call the pharmacy tomorrow 3pm")[0]!.readings;
    expect(readings.map((r) => r.label)).toEqual(["Todo", "Note", "Event"]);
    expect(action(readings[0]!)).toEqual({
      type: "addTodo",
      title: "Call the pharmacy",
      assigneeId: null,
      dueOn: "2026-11-20",
      dueTime: "15:00",
      providerId: null,
      medicationId: null,
      eventId: null,
    });
    expect(action(readings[1]!)).toEqual({
      type: "addNote",
      title: null,
      text: "call the pharmacy tomorrow 3pm",
      occurredAt: NOW.toISOString(),
      providerIds: [],
    });
    for (const r of readings) {
      expect(blocking(r)).toEqual([]);
      expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
    }
  });

  test("a note line ahead can name its todo's assignee", () => {
    expect(action(top("pick up groceries tomorrow for Sam"))).toMatchObject({
      type: "addTodo",
      title: "Pick up groceries",
      assigneeId: SAM,
      dueOn: "2026-11-20",
    });
  });

  test("a provider or an appointment word still makes an event, with the todo as an alternative", () => {
    for (const line of ["Dr. Lee tomorrow 3pm", "appt tomorrow 2pm", "dialysis tomorrow 9:30 at Riverside"]) {
      const kinds = parse(line)[0]!.readings.map((r) => r.kind);
      expect(kinds[0], line).toBe("event");
      expect(kinds, line).toContain("todo");
    }
  });

  test("a note asked for with a time ahead is blocked, with the todo one tap away", () => {
    const readings = parse("n: call the pharmacy tomorrow")[0]!.readings;
    expect(readings.map((r) => r.kind)).toEqual(["note", "todo", "event"]);
    expect(blocking(readings[0]!)).toEqual(["Can't be in the future"]);
    expect(action(readings[1]!)).toMatchObject({ title: "Call the pharmacy", dueOn: "2026-11-20" });
    expect(blocking(readings[1]!)).toEqual([]);
  });

  test("a note's alternatives never date it ahead", () => {
    const lines = [
      "bp 120/80 tomorrow",
      "pain 5 next tuesday",
      "gave metformin in 2 hours",
      "appt friday 3pm",
    ];
    for (const line of [...lines, "todo: call pharmacy friday", "call the pharmacy tomorrow"]) {
      const note = parse(line)[0]!.readings.find((r) => r.kind === "note")!;
      expect(when(note), line).toBe(NOW.toISOString());
      expect(blocking(note), line).toEqual([]);
    }
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

describe("todos", () => {
  type Todo = { title: string; assigneeId: string | null; dueOn: string | null; dueTime: string | null };
  const todo = (line: string, over?: Partial<QuickEntryContext>) => {
    const r = top(line, over);
    expect(r.kind).toBe("todo");
    expect(r.label).toBe("Todo");
    const a = action(r);
    if (a.type !== "addTodo") throw new Error(`not a todo: ${a.type}`);
    return {
      title: a.title,
      assigneeId: a.assigneeId ?? null,
      dueOn: a.dueOn ?? null,
      dueTime: a.dueTime ?? null,
    };
  };
  const plain = (title: string, more: Partial<Todo> = {}): Todo => ({
    title,
    assigneeId: null,
    dueOn: null,
    dueTime: null,
    ...more,
  });

  test.each<[string, Todo]>([
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
    expect(todo(line)).toEqual(expected);
    expect(blocking(top(line))).toEqual([]);
    expect(assistantActionZSchema.safeParse(action(top(line))).success).toBe(true);
  });

  test("with no members known, a name stays in the title", () => {
    expect(todo("todo: call pharmacy for Sam", { members: [] })).toEqual(plain("Call pharmacy for Sam"));
  });

  test("two members with the name: nobody is assigned, and the card says so", () => {
    const members = [
      { id: SAM, name: "Sam Rivera" },
      { id: JO, name: "Sam Okafor" },
    ];
    expect(todo("todo: call pharmacy for Sam", { members })).toEqual(plain("Call pharmacy"));
    expect(warnings(top("todo: call pharmacy for Sam", { members }))).toEqual([
      "More than one member is called Sam, so nobody is assigned. Edit it to choose.",
    ]);
    // The full name settles it.
    expect(todo("todo: call pharmacy for sam okafor", { members })).toEqual(
      plain("Call pharmacy", { assigneeId: JO }),
    );
  });

  test("a due day already past is allowed, and the card says it's overdue", () => {
    const r = top("todo: send the form yesterday");
    expect(todo("todo: send the form yesterday")).toEqual(plain("Send the form", { dueOn: "2026-11-18" }));
    expect(warnings(r)).toEqual(["That's already past, so it's overdue."]);
    expect(blocking(r)).toEqual([]);
  });

  test("a todo needs words besides its due day", () => {
    const r = top("todo: friday");
    expect(r.kind).toBe("todo");
    expect(blocking(r)).toEqual(["Say what the todo is."]);
  });

  test("the alternative is a note of the same words", () => {
    const readings = parse("todo: call pharmacy friday")[0]!.readings;
    expect(readings.map((r) => r.label)).toEqual(["Todo", "Note"]);
    // A note now, with the whole line (notes are past-only).
    expect(action(readings[1]!)).toMatchObject({
      type: "addNote",
      text: "call pharmacy friday",
      occurredAt: NOW.toISOString(),
    });
  });

  test("without a prefix, a report is no todo and a request for a coming weekday is (B-647)", () => {
    expect(parse("called pharmacy friday")[0]!.readings.map((r) => r.kind)).not.toContain("todo");
    expect(top("call pharmacy friday").kind).toBe("todo");
  });

  test("in another zone, the due day and time are the recipient's", () => {
    // 16:00 UTC is 11:00 in New York, so "at 5" is 17:00 there.
    expect(todo("todo: call the office at 5", { timeZone: "America/New_York" })).toEqual(
      plain("Call the office", { dueOn: "2026-11-19", dueTime: "17:00" }),
    );
  });

  test("a todo beside other parts in one line", () => {
    const parts = parse("bp 130/85, todo: call pharmacy friday for Sam, gave metformin");
    expect(parts.map((p) => p.readings[0]!.kind)).toEqual(["vital", "todo", "dose"]);
    expect(action(parts[1]!.readings[0]!)).toMatchObject({
      type: "addTodo",
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

describe("repeats (B-254)", () => {
  type Repeating = {
    title: string;
    assigneeId: string | null;
    dueOn: string;
    dueTime: string | null;
    repeatRule: string;
  };
  const todoOf = (r: QuickEntryReading): Repeating => {
    const a = action(r);
    if (a.type !== "addTodo") throw new Error(`not a todo: ${a.type}`);
    return {
      title: a.title,
      assigneeId: a.assigneeId ?? null,
      dueOn: a.dueOn!,
      dueTime: a.dueTime ?? null,
      repeatRule: a.repeatRule!,
    };
  };
  const MONDAYS = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";

  test.each<[string, Repeating]>([
    // The item's line: no prefix, the first Monday ahead, the repeat's words out of the title.
    [
      "bins out every monday",
      { title: "Bins out", assigneeId: null, dueOn: "2026-11-23", dueTime: null, repeatRule: MONDAYS },
    ],
    // With a time and a member.
    [
      "bins out every monday 7am for Sam",
      { title: "Bins out", assigneeId: SAM, dueOn: "2026-11-23", dueTime: "07:00", repeatRule: MONDAYS },
    ],
    // Today included (Thursday), a day of the month, the phrase first.
    [
      "water plants every thursday",
      {
        title: "Water plants",
        assigneeId: null,
        dueOn: "2026-11-19",
        dueTime: null,
        repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
      },
    ],
    [
      "pay rent on the 1st of every month",
      {
        title: "Pay rent",
        assigneeId: null,
        dueOn: "2026-12-01",
        dueTime: null,
        repeatRule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1",
      },
    ],
    [
      "every other day check the feeding tube at 9pm",
      {
        title: "Check the feeding tube",
        assigneeId: null,
        dueOn: "2026-11-19",
        dueTime: "21:00",
        repeatRule: "FREQ=DAILY;INTERVAL=2",
      },
    ],
    // The weekday list as one part.
    [
      "walk the dog every mon, wed and fri",
      {
        title: "Walk the dog",
        assigneeId: null,
        dueOn: "2026-11-20",
        dueTime: null,
        repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      },
    ],
  ])("%s", (line, expected) => {
    const parts = parse(line);
    expect(parts).toHaveLength(1);
    const r = parts[0]!.readings[0]!;
    expect(r.kind).toBe("todo");
    expect(todoOf(r)).toEqual(expected);
    expect(blocking(r)).toEqual([]);
    expect(assistantActionZSchema.safeParse(action(r)).success).toBe(true);
    // The note stays one tap away, dated now with the whole line.
    expect(action(parts[0]!.readings.find((x) => x.kind === "note")!)).toMatchObject({
      text: line,
      occurredAt: NOW.toISOString(),
    });
  });

  test("todo: with a repeat", () => {
    const readings = parse("todo: put the bins out every monday for Sam")[0]!.readings;
    expect(readings.map((r) => r.label)).toEqual(["Todo", "Note"]);
    expect(todoOf(readings[0]!)).toEqual({
      title: "Put the bins out",
      assigneeId: SAM,
      dueOn: "2026-11-23",
      dueTime: null,
      repeatRule: MONDAYS,
    });
  });

  test("a dose line stays a log, with no repeating todo", () => {
    for (const line of ["gave tylenol every day", "gave tylenol every 4 hours"]) {
      const readings = parse(line)[0]!.readings;
      expect(readings[0]!.kind).toBe("dose");
      expect(readings.map((r) => r.kind)).not.toContain("todo");
    }
    expect(top("dizzy every day").kind).toBe("symptom");
    expect(top("bp 130/85 every monday").kind).toBe("vital");
  });

  test("a line that tells what happened, or adds a medication, keeps its repeat words", () => {
    expect(parse("she was tired every day")[0]!.readings.map((r) => r.kind)).not.toContain("todo");
    expect(top("new med lisinopril 10 mg daily").kind).toBe("medication");
  });

  test("a provider's line stays an event first, saying it won't repeat; the repeating todo second", () => {
    const readings = parse("appt dr lee every tuesday 2pm")[0]!.readings;
    expect(readings.map((r) => r.kind).slice(0, 2)).toEqual(["event", "todo"]);
    expect(action(readings[0]!)).toMatchObject({
      type: "addEvent",
      providerIds: [LEE],
      occurredAt: at("2026-11-24T22:00:00Z"),
      allDay: false,
    });
    expect(warnings(readings[0]!)).toEqual([
      "Quick entry can't make a repeating event, so this is only the first one. Make it a todo to repeat it.",
    ]);
    expect(blocking(readings[0]!)).toEqual([]);
    expect(todoOf(readings[1]!)).toMatchObject({
      dueOn: "2026-11-24",
      dueTime: "14:00",
      repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
    });
    // A provider named alone does the same.
    expect(
      parse("dr lee every monday")[0]!
        .readings.map((r) => r.kind)
        .slice(0, 2),
    ).toEqual(["event", "todo"]);
  });

  test("words that only look like a repeat read as before", () => {
    expect(top("everyone was tired").kind).toBe("symptom");
    expect(parse("everyone was tired")[0]!.readings.map((r) => r.kind)).not.toContain("todo");
    expect(top("call pharmacy every hour").kind).not.toBe("todo");
    const todo = action(top("call pharmacy friday"));
    expect(todo).not.toHaveProperty("repeatRule");
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
