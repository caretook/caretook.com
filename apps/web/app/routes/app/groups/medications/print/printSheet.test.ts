import type { PrintMedicationInput, PrintProviderInput, PrintRecipient } from "./printSheet";

import { describe, expect, it } from "vitest";
import { addDays, dayIn, printSheet } from "./printSheet";

const ZONE = "America/Los_Angeles";
// 10:00 on Nov 18, 2026 in Los Angeles (18:00 UTC).
const NOW = new Date("2026-11-18T18:00:00Z");

const recipient: PrintRecipient = {
  name: "Patricia Example",
  preferredName: "Grandma Pat",
  dateOfBirth: "1941-03-14",
  timeZone: ZONE,
};

let n = 0;
const med = (patch: Partial<PrintMedicationInput> & { name: string }): PrintMedicationInput => ({
  id: `m${++n}`,
  strength: null,
  form: null,
  dose: null,
  directions: null,
  reason: null,
  schedule: { type: "asNeeded" },
  status: "current",
  startedOn: null,
  stoppedOn: null,
  stopReason: null,
  stopNote: null,
  prescriberId: null,
  pharmacyId: null,
  type: null,
  ...patch,
});

const provider = (patch: Partial<PrintProviderInput> & { id: string; name: string }): PrintProviderInput => ({
  type: "clinician",
  phones: [],
  ...patch,
});

const sheet = (medications: PrintMedicationInput[], providers: PrintProviderInput[] = []) =>
  printSheet({ recipient, groupName: "Dev Family", medications, providers, now: NOW, locale: "en-US" });

describe("days", () => {
  it("takes the day in the recipient's zone", () => {
    // 02:00 UTC on Nov 19 is still Nov 18 in Los Angeles.
    expect(dayIn(new Date("2026-11-19T02:00:00Z"), ZONE)).toBe("2026-11-18");
    expect(dayIn(new Date("2026-11-19T02:00:00Z"), "UTC")).toBe("2026-11-19");
  });
  it("falls back to the device's zone for a missing or unknown one", () => {
    expect(dayIn(NOW, "Not/AZone")).toBe(dayIn(NOW, null));
  });
  it("moves across months and years", () => {
    expect(addDays("2026-11-18", -90)).toBe("2026-08-20");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("the header", () => {
  it("has the name with the preferred name, the date of birth, the group and the day printed", () => {
    const s = sheet([]);
    expect(s.recipient).toEqual({ name: "Patricia Example (Grandma Pat)", dateOfBirth: "Mar 14, 1941" });
    expect(s.groupName).toBe("Dev Family");
    expect(s.printedOn).toBe("Nov 18, 2026");
  });
  it("prints the recipient's day, not UTC's", () => {
    const late = printSheet({
      recipient,
      medications: [],
      providers: [],
      now: new Date("2026-11-19T03:00:00Z"),
      locale: "en-US",
    });
    expect(late.printedOn).toBe("Nov 18, 2026");
  });
  it("leaves out a missing date of birth, and a preferred name that's the name", () => {
    const s = printSheet({
      recipient: { name: "Lou Example", preferredName: "lou example", dateOfBirth: null, timeZone: ZONE },
      medications: [],
      providers: [],
      now: NOW,
      locale: "en-US",
    });
    expect(s.recipient).toEqual({ name: "Lou Example", dateOfBirth: null });
  });
  it("has an empty header with no recipient", () => {
    const s = printSheet({ recipient: null, medications: [], providers: [], now: NOW, locale: "en-US" });
    expect(s.recipient).toEqual({ name: "", dateOfBirth: null });
    expect(s.groupName).toBe("");
  });
});

describe("current medications", () => {
  it("are sorted by name, case and numbers ignored, deleted ones left out", () => {
    const s = sheet([
      med({ name: "metformin" }),
      med({ name: "Acetaminophen" }),
      med({ name: "Vitamin B12" }),
      med({ name: "Vitamin B6" }),
      med({ name: "Gone", deletedAt: "2026-11-01T00:00:00Z" }),
      med({ name: "Amoxicillin", status: "completed", stoppedOn: "2026-11-04" }),
    ]);
    expect(s.current.map((r) => r.title)).toEqual([
      "Acetaminophen",
      "metformin",
      "Vitamin B6",
      "Vitamin B12",
    ]);
  });
  it("say what, how, why, who and since when", () => {
    const s = sheet(
      [
        med({
          id: "lis",
          name: "Lisinopril",
          strength: "10 mg",
          form: "tablet",
          dose: "1 tablet",
          directions: " With water ",
          reason: "Blood pressure",
          schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
          startedOn: "2026-07-21",
          prescriberId: "p1",
        }),
      ],
      [provider({ id: "p1", name: "Dr. Example" })],
    );
    expect(s.current[0]).toEqual({
      id: "lis",
      title: "Lisinopril 10 mg",
      form: "Tablet",
      dose: "1 tablet",
      directions: "With water",
      schedule: "8:00 and 20:00",
      reason: "Blood pressure",
      prescriber: "Dr. Example",
      started: "Jul 21, 2026",
    });
  });
  it("read schedules by pass, with amounts that differ from the dose", () => {
    const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
    const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";
    const s = printSheet({
      recipient,
      medications: [
        med({
          name: "Metformin",
          dose: "500 mg",
          schedule: {
            type: "scheduled",
            slots: [{ passId: MORNING, amount: "1000 mg" }, { passId: EVENING }, { time: "14:00" }],
          },
        }),
      ],
      providers: [],
      passes: [
        { id: MORNING, name: "Morning", time: "08:00", sortOrder: 0 },
        { id: EVENING, name: "Evening", time: "20:00", sortOrder: 1 },
      ],
      now: NOW,
    });
    expect(s.current[0]?.schedule).toBe("Morning (1000 mg), Evening and 14:00");
  });
  it("keep a deleted prescriber's name, and have none for an unknown one", () => {
    const s = sheet(
      [med({ name: "A", prescriberId: "gone" }), med({ name: "B", prescriberId: "missing" })],
      [provider({ id: "gone", name: "Dr. Former", deletedAt: "2026-10-01T00:00:00Z" })],
    );
    expect(s.current.map((r) => r.prescriber)).toEqual(["Dr. Former", null]);
  });
});

describe("current medications by type", () => {
  const groups = (medications: PrintMedicationInput[]) =>
    sheet(medications).currentGroups.map((g) => [g.type, g.heading, g.rows.map((r) => r.title)]);
  it("group in the order Prescription, Over the counter, Supplement, Other, Type not set", () => {
    expect(
      groups([
        med({ name: "Zinc cream", type: "other" }),
        med({ name: "Old tablet", type: null }),
        med({ name: "Vitamin D", type: "supplement" }),
        med({ name: "Ibuprofen", type: "otc" }),
        med({ name: "Lisinopril", type: "prescription" }),
      ]),
    ).toEqual([
      ["prescription", "Prescriptions", ["Lisinopril"]],
      ["otc", "Over the counter", ["Ibuprofen"]],
      ["supplement", "Supplements", ["Vitamin D"]],
      ["other", "Other", ["Zinc cream"]],
      [null, "Type not set", ["Old tablet"]],
    ]);
  });
  it("leave out empty groups", () => {
    expect(
      groups([med({ name: "Vitamin D", type: "supplement" }), med({ name: "Old", type: null })]).map(
        (g) => g[0],
      ),
    ).toEqual(["supplement", null]);
    expect(groups([])).toEqual([]);
  });
  it("keep no type last even when it is the only other group, and read an undefined type as none", () => {
    const s = sheet([
      med({ name: "A", type: null }),
      med({ name: "B", type: "prescription" }),
      med({ name: "C", type: undefined }),
    ]);
    expect(s.currentGroups.map((g) => g.type)).toEqual(["prescription", null]);
    expect(s.currentGroups[1]!.rows.map((r) => r.title)).toEqual(["A", "C"]);
  });
  it("sort each group by name and flatten to current in group order", () => {
    const s = sheet([
      med({ name: "b-otc", type: "otc" }),
      med({ name: "metformin", type: "prescription" }),
      med({ name: "a-otc", type: "otc" }),
      med({ name: "Amoxicillin", type: "prescription" }),
    ]);
    expect(s.currentGroups.map((g) => g.rows.map((r) => r.title))).toEqual([
      ["Amoxicillin", "metformin"],
      ["a-otc", "b-otc"],
    ]);
    expect(s.current.map((r) => r.title)).toEqual(["Amoxicillin", "metformin", "a-otc", "b-otc"]);
  });
  it("leave stopped medications as one list, whatever their type", () => {
    const s = sheet([
      med({ name: "Old rx", type: "prescription", status: "completed", stoppedOn: "2026-11-04" }),
      med({ name: "Old vit", type: "supplement", status: "discontinued", stoppedOn: "2026-11-10" }),
    ]);
    expect(s.currentGroups).toEqual([]);
    expect(s.stopped.map((r) => r.title)).toEqual(["Old vit", "Old rx"]);
  });
});

describe("recently stopped medications", () => {
  it("are those stopped in the last 90 days, the 90th day included, newest first", () => {
    const s = sheet([
      med({ name: "Oxybutynin", status: "discontinued", stoppedOn: "2026-10-29", stopReason: "sideEffects" }),
      med({ name: "Amoxicillin", status: "completed", stoppedOn: "2026-11-04" }),
      med({ name: "Edge", status: "completed", stoppedOn: "2026-08-20" }),
      med({ name: "Too old", status: "completed", stoppedOn: "2026-08-19" }),
      med({ name: "No date", status: "completed", stoppedOn: null }),
      med({
        name: "Deleted",
        status: "completed",
        stoppedOn: "2026-11-10",
        deletedAt: "2026-11-11T00:00:00Z",
      }),
    ]);
    expect(s.stopped.map((r) => r.title)).toEqual(["Amoxicillin", "Oxybutynin", "Edge"]);
  });
  it("say how and when they stopped, with the reason and note for a discontinued one", () => {
    const s = sheet([
      med({
        name: "Oxybutynin",
        strength: "5 mg",
        status: "discontinued",
        stoppedOn: "2026-10-29",
        stopReason: "sideEffects",
        stopNote: "Dry mouth",
      }),
      med({ name: "Amoxicillin", status: "completed", stoppedOn: "2026-11-04" }),
      med({ name: "Other", status: "discontinued", stoppedOn: "2026-11-01", stopReason: "ineffective" }),
    ]);
    expect(
      s.stopped.map(({ title, statusLabel, stopped, why }) => ({ title, statusLabel, stopped, why })),
    ).toEqual([
      { title: "Amoxicillin", statusLabel: "Completed", stopped: "Nov 4, 2026", why: null },
      { title: "Other", statusLabel: "Discontinued", stopped: "Nov 1, 2026", why: "Not working" },
      {
        title: "Oxybutynin 5 mg",
        statusLabel: "Discontinued",
        stopped: "Oct 29, 2026",
        why: "Side effects: Dry mouth",
      },
    ]);
  });
});

describe("contacts", () => {
  const providers = [
    provider({
      id: "doc",
      name: "Dr. Zed",
      phones: [
        { label: "Office", number: "(555) 010-2200" },
        { label: "After hours", number: "(555) 010-2299" },
      ],
    }),
    provider({ id: "doc2", name: "Dr. Able", phones: [] }),
    provider({
      id: "rx",
      type: "pharmacy",
      name: "Corner Pharmacy",
      phones: [{ label: "Pharmacy", number: "(555) 010-4400" }],
    }),
    provider({ id: "unused", name: "Dr. Unused", phones: [{ label: "Office", number: "1" }] }),
    provider({ id: "gone", name: "Dr. Gone", deletedAt: "2026-10-01T00:00:00Z" }),
  ];

  it("list each prescriber and pharmacy once, prescribers first, by name, with the first phone", () => {
    const s = sheet(
      [
        med({ name: "A", prescriberId: "doc", pharmacyId: "rx" }),
        med({ name: "B", prescriberId: "doc", pharmacyId: "rx" }),
        med({ name: "C", prescriberId: "doc2" }),
        med({ name: "D", prescriberId: "gone" }),
      ],
      providers,
    );
    expect(s.contacts).toEqual([
      { id: "doc2", name: "Dr. Able", role: "Prescriber", phone: null },
      {
        id: "doc",
        name: "Dr. Zed",
        role: "Prescriber",
        phone: { label: "Office", number: "(555) 010-2200" },
      },
      {
        id: "rx",
        name: "Corner Pharmacy",
        role: "Pharmacy",
        phone: { label: "Pharmacy", number: "(555) 010-4400" },
      },
    ]);
  });
  it("include recently stopped medications' providers, not older ones'", () => {
    const s = sheet(
      [
        med({ name: "A", status: "completed", stoppedOn: "2026-11-04", prescriberId: "doc" }),
        med({ name: "B", status: "completed", stoppedOn: "2025-01-01", prescriberId: "unused" }),
      ],
      providers,
    );
    expect(s.contacts.map((c) => c.id)).toEqual(["doc"]);
  });
  it("say when one provider is both", () => {
    const s = sheet(
      [med({ name: "A", prescriberId: "doc" }), med({ name: "B", pharmacyId: "doc" })],
      providers,
    );
    expect(s.contacts).toEqual([expect.objectContaining({ id: "doc", role: "Prescriber and pharmacy" })]);
  });
});
