import { describe, expect, it } from "vitest";
import {
  conditionSearchDocument,
  entrySearchDocument,
  medicationSearchDocument,
  providerSearchDocument,
  taskSearchDocument,
} from "./searchDocument";

const base = { id: "e1", groupId: "g1" };

describe("entrySearchDocument", () => {
  it("indexes a note's title, its document text and its author", () => {
    expect(
      entrySearchDocument({
        ...base,
        kind: "note",
        title: "Knee",
        body: null,
        documentText: "Walking better today.\nPT said keep going.",
        authorName: "Sam Rivera",
      }),
    ).toEqual({
      id: "e1",
      type: "entry",
      groupId: "g1",
      title: "Knee",
      body: "Walking better today.\nPT said keep going.\nSam Rivera",
    });
  });

  it("indexes an event's place and linked providers' names", () => {
    const doc = entrySearchDocument({
      ...base,
      kind: "event",
      title: "Cardiology visit",
      place: "Valley Heart Clinic",
      providerNames: ["Dr. Anita Patel", "Valley Heart Clinic"],
      documentText: "",
    });
    expect(doc?.title).toBe("Cardiology visit\nDr. Anita Patel\nValley Heart Clinic");
    expect(doc?.body).toBe("Valley Heart Clinic");
  });

  it("indexes a symptom's name as a title and its notes as body", () => {
    const doc = entrySearchDocument({
      ...base,
      kind: "symptom",
      title: null,
      body: "After lunch",
      details: { name: "Dizziness", severity: 4 },
    });
    expect(doc).toMatchObject({ title: "Dizziness", body: "After lunch" });
  });

  it("indexes a vital's reading type names, skipping unknown types", () => {
    const doc = entrySearchDocument({
      ...base,
      kind: "vital",
      details: {
        readings: [
          { type: "bloodPressure", systolic: 120, diastolic: 80 },
          { type: "sleep", value: 7 },
          { type: "futureType", value: 1 },
        ],
      },
    });
    expect(doc?.title).toBe("Blood pressure\nSleep");
  });

  it("indexes a dose's medication name and strength, and its note", () => {
    const doc = entrySearchDocument({
      ...base,
      kind: "dose",
      details: { medicationId: "m1", status: "given", note: "With breakfast" },
      medication: { name: "Lisinopril", strength: "10 mg" },
    });
    expect(doc).toMatchObject({ title: "Lisinopril 10 mg", body: "With breakfast" });
  });

  it("indexes a medication change's medication and stop note", () => {
    const doc = entrySearchDocument({
      ...base,
      kind: "medicationChange",
      details: {
        medicationId: "m1",
        change: "stopped",
        stopStatus: "discontinued",
        stopNote: "Made her dizzy",
      },
      medication: { name: "Oxybutynin", strength: null },
    });
    expect(doc).toMatchObject({ title: "Oxybutynin", body: "Made her dizzy" });
  });

  it("leaves out empty parts and a symptom name on another kind", () => {
    const doc = entrySearchDocument({
      ...base,
      kind: "note",
      title: "  ",
      details: { name: "not a symptom" },
      providerNames: [null, ""],
    });
    expect(doc).toMatchObject({ title: "", body: "" });
  });

  it("has no document for a deleted entry", () => {
    expect(entrySearchDocument({ ...base, kind: "note", title: "Gone", deletedAt: "2026-11-01" })).toBeNull();
  });
});

describe("providerSearchDocument", () => {
  it("indexes name and specialty as title, practice and notes as body", () => {
    expect(
      providerSearchDocument({
        id: "p1",
        groupId: "g1",
        name: "Dr. Anita Patel",
        specialty: "Cardiology",
        practiceName: "Valley Heart Clinic",
        documentText: "Prefers morning calls.",
      }),
    ).toEqual({
      id: "p1",
      type: "provider",
      groupId: "g1",
      title: "Dr. Anita Patel\nCardiology",
      body: "Valley Heart Clinic\nPrefers morning calls.",
    });
  });

  it("has no document for a deleted provider", () => {
    expect(
      providerSearchDocument({ id: "p1", groupId: "g1", name: "X", deletedAt: "2026-11-01" }),
    ).toBeNull();
  });
});

describe("medicationSearchDocument", () => {
  it("indexes name and strength as title, reason, directions and notes as body", () => {
    expect(
      medicationSearchDocument({
        id: "m1",
        groupId: "g1",
        name: "Metformin",
        strength: "500 mg",
        reason: "Blood sugar",
        directions: "Take with food",
        documentText: "Ask about the extended-release kind.",
      }),
    ).toEqual({
      id: "m1",
      type: "medication",
      groupId: "g1",
      title: "Metformin\n500 mg",
      body: "Blood sugar\nTake with food\nAsk about the extended-release kind.",
    });
  });

  it("has no document for a deleted medication", () => {
    expect(
      medicationSearchDocument({ id: "m1", groupId: "g1", name: "X", deletedAt: "2026-11-01" }),
    ).toBeNull();
  });
});

describe("taskSearchDocument", () => {
  const task = { id: "t1", groupId: "g1" };

  it.each([
    {
      name: "the title as title, the notes as body",
      source: { ...task, title: "Insurance form", documentText: "Fax it to Dr. Patel's office." },
      title: "Insurance form",
      body: "Fax it to Dr. Patel's office.",
    },
    {
      name: "a task without notes has an empty body",
      source: { ...task, title: "  Call the pharmacy ", documentText: null },
      title: "Call the pharmacy",
      body: "",
    },
    {
      name: "multi-line notes stay on their lines",
      source: { ...task, title: "Refill", documentText: "Ask about the generic.\nPickup Friday." },
      title: "Refill",
      body: "Ask about the generic.\nPickup Friday.",
    },
  ])("indexes $name", ({ source, title, body }) => {
    expect(taskSearchDocument(source)).toEqual({ id: "t1", type: "task", groupId: "g1", title, body });
  });

  it("has no document for a deleted task", () => {
    expect(
      taskSearchDocument({ ...task, title: "Insurance form", documentText: "x", deletedAt: "2026-11-01" }),
    ).toBeNull();
  });
});

describe("conditionSearchDocument", () => {
  const condition = { id: "c1", groupId: "g1" };

  it("indexes the name as title and the note as body", () => {
    expect(
      conditionSearchDocument({ ...condition, name: "Type 2 diabetes", note: "Diet-controlled" }),
    ).toEqual({
      id: "c1",
      type: "condition",
      groupId: "g1",
      title: "Type 2 diabetes",
      body: "Diet-controlled",
    });
  });

  it("has no document for a deleted condition", () => {
    expect(conditionSearchDocument({ ...condition, name: "Asthma", deletedAt: "2026-11-01" })).toBeNull();
  });
});

describe("entrySearchDocument for a condition change", () => {
  it("indexes the condition's name, and a rename's old name, as title", () => {
    const doc = entrySearchDocument({
      ...base,
      kind: "conditionChange",
      details: {
        conditionId: "c1",
        conditionName: "Type 2 diabetes",
        change: "changed",
        fields: ["name"],
        before: { name: "Diabetes" },
        after: { name: "Type 2 diabetes" },
      },
      authorName: "Sam Rivera",
    });
    expect(doc).toMatchObject({ title: "Type 2 diabetes\nDiabetes", body: "Sam Rivera" });
  });

  it("ignores a condition name on any other kind", () => {
    const doc = entrySearchDocument({ ...base, kind: "dose", details: { conditionName: "Asthma" } });
    expect(doc?.title).toBe("");
  });
});
