import type { QuickEntryPart, QuickEntryReading } from "@caretook/data/schema";

import { describe, expect, test } from "vitest";
import { doseDraftFrom, entryDraftFrom, QUICK_ENTRY_DRAFT } from "../../lib/quickEntryDraft";
import {
  buildCards,
  canSaveCards,
  cardActions,
  cardsAnnouncement,
  editTarget,
  partKey,
  savedText,
} from "./quickEntryCards";

const at = "2026-11-19T16:00:00.000Z";
const GROUP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";
const MED = "11111111-1111-4111-8111-111111111111";

const note = (text: string): QuickEntryReading => ({
  kind: "note",
  label: "Note",
  actions: [{ type: "addNote", text, occurredAt: at }],
  confidence: 0.4,
  warnings: [],
});
const dose = (medicationId: string, confidence = 0.9): QuickEntryReading => ({
  kind: "dose",
  label: "Dose",
  actions: [{ type: "logDose", medicationId, status: "given", amount: "1 tablet", occurredAt: at }],
  confidence,
  warnings: [],
});
const blocked: QuickEntryReading = {
  kind: "vital",
  label: "Vital",
  actions: [{ type: "logVital", readings: [{ type: "heartRate", value: 999 }], occurredAt: at }],
  confidence: 0.95,
  warnings: [
    { message: "Heart rate: enter a whole number from 20 to 300 bpm.", blocking: true },
    { message: "Something to check", blocking: false },
  ],
};
const titleOf = (r: QuickEntryReading) => {
  const a = r.actions[0]!;
  return a.type === "logDose" ? `Medication ${a.medicationId.slice(0, 2)}` : r.label;
};
const none = { chosen: new Map<string, number>(), removed: new Set<string>() };

describe("buildCards", () => {
  const parts: QuickEntryPart[] = [
    { text: "hr 999", readings: [blocked, note("hr 999")] },
    {
      text: "gave met",
      readings: [dose(MED), dose("22222222-2222-4222-8222-222222222222", 0.85), note("gave met")],
    },
  ];

  test("each part shows its best reading, with the others as chips (named by what they say when a kind repeats)", () => {
    const cards = buildCards(parts, none, titleOf);
    expect(cards.map((c) => [c.key, c.reading.kind, c.alternatives.map((a) => a.label)])).toEqual([
      ["0:hr 999", "vital", ["Note instead"]],
      ["1:gave met", "dose", ["Medication 22 instead", "Note instead"]],
    ]);
    expect(cards[0]!.blocking).toEqual(["Heart rate: enter a whole number from 20 to 300 bpm."]);
    expect(cards[0]!.notices).toEqual(["Something to check"]);
    expect(canSaveCards(cards)).toBe(false);
  });

  test("a chosen reading, and removed parts", () => {
    const cards = buildCards(
      parts,
      { chosen: new Map([[partKey(1, parts[1]!), 2]]), removed: new Set([partKey(0, parts[0]!)]) },
      titleOf,
    );
    expect(cards.map((c) => c.reading.kind)).toEqual(["note"]);
    expect(cards[0]!.alternatives.map((a) => a.index)).toEqual([0, 1]);
    expect(canSaveCards(cards)).toBe(true);
    expect(cardActions(cards)).toEqual([{ action: note("gave met").actions[0], key: "1:gave met" }]);
  });

  test("a choice past the readings falls back to the best", () => {
    const cards = buildCards(parts, { ...none, chosen: new Map([["0:hr 999", 9]]) }, titleOf);
    expect(cards[0]!.index).toBe(0);
  });

  test("no cards, nothing to save", () => {
    expect(canSaveCards([])).toBe(false);
  });
});

test("savedText and cardsAnnouncement", () => {
  expect(savedText(1)).toBe("Saved 1 entry");
  expect(savedText(3)).toBe("Saved 3 entries");
  const cards = buildCards([{ text: "hr 999", readings: [blocked] }], none, titleOf);
  expect(cardsAnnouncement(cards, titleOf)).toBe("1 card: Vital, Vital, can't be saved yet");
  expect(cardsAnnouncement([], titleOf)).toBe("");
});

describe("editTarget", () => {
  test("a vital opens the vitals sheet on its first type, with the draft in history state", () => {
    const target = editTarget(
      { type: "logVital", readings: [{ type: "heartRate", value: 72 }], note: "after lunch", occurredAt: at },
      GROUP,
      "?kind=vital",
    );
    expect(target).toEqual({
      to: `/app/groups/${GROUP}/timeline/new/vital?kind=vital&type=heartRate`,
      state: {
        sheetOverTimeline: true,
        [QUICK_ENTRY_DRAFT]: {
          kind: "vital",
          details: { readings: [{ type: "heartRate", value: 72 }] },
          body: "after lunch",
          occurredAt: at,
        },
      },
    });
    expect(entryDraftFrom(target !== "saveAndOpen" && target.state)).toMatchObject({ kind: "vital" });
  });

  test("a symptom and a dose", () => {
    const symptom = editTarget({ type: "logSymptom", name: "Pain", severity: 4, occurredAt: at }, GROUP);
    expect(symptom !== "saveAndOpen" && symptom.to).toBe(`/app/groups/${GROUP}/timeline/new/symptom`);
    const d = editTarget(
      { type: "logDose", medicationId: MED, status: "refused", amount: null, note: "spat", occurredAt: at },
      GROUP,
    );
    expect(d !== "saveAndOpen" && d.to).toBe(`/app/groups/${GROUP}/timeline/new/dose?medication=${MED}`);
    expect(doseDraftFrom(d !== "saveAndOpen" && d.state)).toEqual({
      status: "refused",
      amount: null,
      note: "spat",
      occurredAt: at,
    });
  });

  test("notes and events are saved and opened on their page", () => {
    expect(editTarget({ type: "addNote", text: "Hi", occurredAt: at }, GROUP)).toBe("saveAndOpen");
  });
});

test("drafts are read only from quick entry's history state", () => {
  expect(entryDraftFrom(null)).toBeNull();
  expect(entryDraftFrom({ sheetOverTimeline: true })).toBeNull();
  expect(entryDraftFrom({ [QUICK_ENTRY_DRAFT]: { kind: "dose" } })).toBeNull();
  expect(doseDraftFrom({ [QUICK_ENTRY_DRAFT]: { kind: "vital" } })).toBeNull();
});
