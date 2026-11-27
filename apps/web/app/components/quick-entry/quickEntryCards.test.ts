import type { NewItemDraft, QuickEntryPart, QuickEntryReading } from "@caretook/data/schema";

import { describe, expect, test } from "vitest";
import {
  doseDraftFrom,
  entryDraftFrom,
  medicationDraftFrom,
  providerDraftFrom,
  QUICK_ENTRY_DRAFT,
} from "../../lib/assistant/quickEntryDraft";
import {
  buildCards,
  canSaveCards,
  cardActions,
  cardsAnnouncement,
  draftCardOf,
  draftSummary,
  editTarget,
  isDraftReading,
  markDraft,
  newItemLine,
  newItemPreview,
  newItemTarget,
  ONE_NEW_ITEM,
  openAfterSave,
  partsForRole,
  partKey,
  pruneCardState,
  savedText,
  withSymptomGates,
} from "./quickEntryCards";

const at = "2026-11-19T16:00:00.000Z";
const GROUP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";
const MED = "11111111-1111-4111-8111-111111111111";

const note = (text: string): QuickEntryReading => ({
  kind: "note",
  label: "Note",
  actions: [{ type: "addNote", text, occurredAt: at, providerIds: [] }],
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

describe("pruneCardState", () => {
  const parts: QuickEntryPart[] = [
    { text: "bp 120/80", readings: [note("bp 120/80")] },
    { text: "dizzy", readings: [note("dizzy")] },
  ];
  const first = partKey(0, parts[0]!);
  const second = partKey(1, parts[1]!);

  test("keeps state for keys still present and drops the rest", () => {
    const kept = pruneCardState(parts, {
      chosen: new Map([
        [first, 1],
        ["0:gone", 2],
      ]),
      removed: new Set([second, "1:gone"]),
      errors: new Map([
        [first, "Refused"],
        ["2:gone", "Stale"],
      ]),
    });
    expect([...kept.chosen]).toEqual([[first, 1]]);
    expect([...kept.removed]).toEqual([second]);
    expect([...kept.errors]).toEqual([[first, "Refused"]]);
  });

  test("the same text at another place is another card", () => {
    const kept = pruneCardState([parts[1]!], {
      chosen: new Map(),
      removed: new Set([second]),
      errors: new Map(),
    });
    expect(kept.removed.size).toBe(0);
  });

  test("no parts forgets everything", () => {
    const kept = pruneCardState([], {
      chosen: new Map([[first, 1]]),
      removed: new Set([first]),
      errors: new Map([[first, "Refused"]]),
    });
    expect([kept.chosen.size, kept.removed.size, kept.errors.size]).toEqual([0, 0, 0]);
  });

  test("returns the same maps when nothing changed, so rendering can't loop", () => {
    const state = {
      chosen: new Map([[first, 1]]),
      removed: new Set([second]),
      errors: new Map([[first, "Refused"]]),
    };
    const kept = pruneCardState(parts, state);
    expect(kept.chosen).toBe(state.chosen);
    expect(kept.removed).toBe(state.removed);
    expect(kept.errors).toBe(state.errors);
  });

  test("only the map with something to drop is replaced", () => {
    const state = {
      chosen: new Map([[first, 1]]),
      removed: new Set(["9:gone"]),
      errors: new Map<string, string>(),
    };
    const kept = pruneCardState(parts, state);
    expect(kept.chosen).toBe(state.chosen);
    expect(kept.removed).not.toBe(state.removed);
    expect(kept.errors).toBe(state.errors);
  });
});

describe("withSymptomGates (symptom-catalog)", () => {
  const catalog = [
    { id: "t-knee", name: "Knee pain" },
    { id: "t-nausea", name: "Nausea" },
  ];
  const symptom = (name: string): QuickEntryReading => ({
    kind: "symptom",
    label: "Symptom",
    actions: [{ type: "logSymptom", name, severity: 4, occurredAt: at }],
    confidence: 0.85,
    warnings: [],
  });
  const parts: QuickEntryPart[] = [
    { text: "knee pian 4", readings: [symptom("Knee pian"), note("knee pian 4")] },
    { text: "nausea 4", readings: [symptom("Nausea")] },
    { text: "itchy 4", readings: [symptom("Itchy")] },
    { text: "dizzy", readings: [note("dizzy")] },
  ];
  const key = partKey(0, parts[0]!);
  const gated = (choices = new Map()) => withSymptomGates(buildCards(parts, none, titleOf), catalog, choices);
  const names = (cards: ReturnType<typeof gated>) =>
    cards.map((c) => {
      const a = c.reading.actions[0]!;
      return a.type === "logSymptom" ? a.name : null;
    });

  test("an unanswered name like the catalog's saves as the closest one, and Save goes ahead", () => {
    const cards = gated();
    expect(names(cards)).toEqual(["Knee pain", "Nausea", "Itchy", null]);
    expect(cards.map((c) => c.symptomDefault ?? null)).toEqual([
      { typed: "Knee pian", using: "Knee pain", others: [] },
      null,
      null,
      null,
    ]);
    expect(cards[0]!.blocking).toEqual([]);
    expect(canSaveCards(cards)).toBe(true);
    expect(cardsAnnouncement(cards, titleOf)).not.toContain("can't be saved yet");
  });

  test("the default lists the typed name and the other similar names, closest first", () => {
    const wide = [
      { id: "t-left", name: "Left knee pain" },
      { id: "t-back", name: "Back pain" },
      { id: "t-knee", name: "Knee pain" },
    ];
    const part = { text: "pain knee 4", readings: [symptom("Pain knee")] };
    const cards = withSymptomGates(buildCards([part], none, titleOf), wide, new Map());
    expect(cards[0]!.symptomDefault).toEqual({
      typed: "Pain knee",
      using: "Knee pain",
      others: [{ id: "t-left", name: "Left knee pain" }],
    });
    expect(names(cards)).toEqual(["Knee pain"]);
    expect(canSaveCards(cards)).toBe(true);
  });

  test("an exact match has no default", () => {
    const cards = withSymptomGates(
      buildCards([{ text: "knee pain 4", readings: [symptom("Knee pain")] }], none, titleOf),
      catalog,
      new Map(),
    );
    expect(cards[0]!.symptomDefault).toBeUndefined();
    expect(names(cards)).toEqual(["Knee pain"]);
  });

  test("Use <name> saves the catalog's name; Add new restores the name as typed", () => {
    const used = gated(new Map([[key, { key: "knee pian", use: "Knee pain" }]]));
    expect(used[0]!.symptomDefault).toBeUndefined();
    expect(names(used)).toEqual(["Knee pain", "Nausea", "Itchy", null]);
    expect(canSaveCards(used)).toBe(true);

    const added = gated(new Map([[key, { key: "knee pian", use: null }]]));
    expect(added[0]!.symptomDefault).toBeUndefined();
    expect(names(added)).toEqual(["Knee pian", "Nausea", "Itchy", null]);
    expect(canSaveCards(added)).toBe(true);
  });

  test("an answer for another name falls back to the default", () => {
    const cards = gated(new Map([[key, { key: "knee pan", use: null }]]));
    expect(cards[0]!.symptomDefault?.typed).toBe("Knee pian");
    expect(names(cards)[0]).toBe("Knee pain");
  });

  test("pruneCardState drops answers for gone cards", () => {
    const symptoms = new Map([
      [key, { key: "knee pian", use: null }],
      ["9:gone", { key: "x", use: null }],
    ]);
    const kept = pruneCardState(parts, { ...none, errors: new Map(), symptoms });
    expect([...kept.symptoms!.keys()]).toEqual([key]);
  });
});

describe("buildCards", () => {
  const parts: QuickEntryPart[] = [
    { text: "hr 999", readings: [blocked, note("hr 999")] },
    {
      text: "gave met",
      readings: [dose(MED), dose("22222222-2222-4222-8222-222222222222", 0.85), note("gave met")],
    },
  ];

  test("each part shows its best reading, other kinds as 'Make it' buttons, and same-kind readings named by what they say", () => {
    const cards = buildCards(parts, none, titleOf);
    expect(
      cards.map((c) => [
        c.key,
        c.reading.kind,
        c.kindChoices.map((a) => a.label),
        c.alternatives.map((a) => a.label),
      ]),
    ).toEqual([
      ["0:hr 999", "vital", ["Make it a note"], []],
      ["1:gave met", "dose", ["Make it a note"], ["Medication 22 instead"]],
    ]);
    expect(cards[0]!.blocking).toEqual(["Heart rate: enter a whole number from 20 to 300 bpm."]);
    expect(cards[0]!.notices).toEqual(["Something to check"]);
    expect(canSaveCards(cards)).toBe(false);
  });

  test("a part read as symptom, event and note offers the two other kinds", () => {
    const symptom: QuickEntryReading = {
      kind: "symptom",
      label: "Symptom",
      actions: [{ type: "logSymptom", name: "Fall", occurredAt: at }],
      confidence: 0.9,
      warnings: [],
    };
    const event: QuickEntryReading = {
      kind: "event",
      label: "Event",
      actions: [{ type: "addEvent", title: "Fell", occurredAt: at, allDay: false }] as never,
      confidence: 0.6,
      warnings: [],
    };
    const part: QuickEntryPart = { text: "fell", readings: [symptom, event, note("fell")] };
    const [first] = buildCards([part], none, titleOf);
    expect(first!.kindChoices.map((c) => [c.index, c.label])).toEqual([
      [1, "Make it an event"],
      [2, "Make it a note"],
    ]);
    expect(first!.alternatives).toEqual([]);
    const [second] = buildCards([part], { ...none, chosen: new Map([[partKey(0, part), 2]]) }, titleOf);
    expect(second!.kindChoices.map((c) => c.label)).toEqual(["Make it a symptom", "Make it an event"]);
  });

  test("a chosen reading, and removed parts", () => {
    const cards = buildCards(
      parts,
      { chosen: new Map([[partKey(1, parts[1]!), 2]]), removed: new Set([partKey(0, parts[0]!)]) },
      titleOf,
    );
    expect(cards.map((c) => c.reading.kind)).toEqual(["note"]);
    expect(cards[0]!.kindChoices.map((a) => [a.index, a.label])).toEqual([[0, "Make it a dose"]]);
    expect(cards[0]!.alternatives).toEqual([]);
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
  expect(savedText(1, 1)).toBe("Saved 1 todo");
  expect(savedText(3, 1)).toBe("Saved 2 entries and 1 todo");
  expect(savedText(3, 2)).toBe("Saved 1 entry and 2 todos");
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

  test("a pass's Given all opens the Dose sheet on that pass", () => {
    const PASS = "77777777-7777-4777-8777-777777777777";
    const target = editTarget({ type: "givePass", passId: PASS, occurredAt: at }, GROUP);
    expect(target).toEqual({
      to: `/app/groups/${GROUP}/timeline/new/dose?pass=${PASS}`,
      state: { sheetOverTimeline: true },
    });
  });

  test("a todo opens the add-todo sheet filled in, coming back on close", () => {
    const SAM = "88888888-8888-4888-8888-888888888888";
    const target = editTarget(
      { type: "addTodo", title: "Call pharmacy", assigneeId: SAM, dueOn: "2026-11-20", dueTime: null },
      GROUP,
      "?kind=vital",
    );
    expect(target).toEqual({
      to: `/app/groups/${GROUP}/todos/new?dueOn=2026-11-20&title=Call+pharmacy&assigneeId=${SAM}`,
      state: { todoSheet: true },
    });
  });

  test("a repeating todo's Edit carries its repeatRule, and only a repeating one's (planner-3)", () => {
    const todo = { type: "addTodo", title: "Bins out", dueOn: "2026-11-23" } as const;
    const urlOf = (action: Parameters<typeof editTarget>[0]) => {
      const target = editTarget(action, GROUP);
      if (typeof target === "string") throw new Error("expected a link");
      return new URL(target.to, "https://example.test").searchParams;
    };
    expect(urlOf({ ...todo, repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO" }).get("repeatRule")).toBe(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
    );
    expect(urlOf({ ...todo, repeatRule: null }).has("repeatRule")).toBe(false);
    expect(urlOf(todo).has("repeatRule")).toBe(false);
  });

  test("notes and events are saved and opened on their page", () => {
    expect(editTarget({ type: "addNote", text: "Hi", occurredAt: at, providerIds: [] }, GROUP)).toBe(
      "saveAndOpen",
    );
  });
});

test("drafts are read only from quick entry's history state", () => {
  expect(entryDraftFrom(null)).toBeNull();
  expect(entryDraftFrom({ sheetOverTimeline: true })).toBeNull();
  expect(entryDraftFrom({ [QUICK_ENTRY_DRAFT]: { kind: "dose" } })).toBeNull();
  expect(doseDraftFrom({ [QUICK_ENTRY_DRAFT]: { kind: "vital" } })).toBeNull();
});

describe("openAfterSave", () => {
  test("a lone note or event opens its page", () => {
    expect(openAfterSave([{ type: "addNote", ids: ["n1"] }])).toBe("n1");
    expect(openAfterSave([{ type: "addEvent", ids: ["e1"] }])).toBe("e1");
  });
  test("a note plus a vital, or two notes, stays", () => {
    expect(
      openAfterSave([
        { type: "logVital", ids: ["v1"] },
        { type: "addNote", ids: ["n1"] },
      ]),
    ).toBeNull();
    expect(
      openAfterSave([
        { type: "addNote", ids: ["n1"] },
        { type: "addNote", ids: ["n2"] },
      ]),
    ).toBeNull();
  });
  test("a lone dose, vital or todo stays, and so does nothing saved", () => {
    expect(openAfterSave([{ type: "logDose", ids: ["d1"] }])).toBeNull();
    expect(openAfterSave([{ type: "addTodo", ids: ["t1"] }])).toBeNull();
    expect(openAfterSave([])).toBeNull();
  });
});

describe("the event draft (quick-entry slice 3)", () => {
  const ALV = "33333333-3333-4333-8333-333333333333";
  const LEE = "44444444-4444-4444-8444-444444444444";
  const event = (title: string, providerIds: string[]): QuickEntryReading => ({
    kind: "event",
    label: "Event",
    actions: [
      { type: "addEvent", title, occurredAt: at, allDay: true, providerIds, timeZone: "America/Los_Angeles" },
    ],
    confidence: 0.8,
    warnings: [],
  });
  const vital: QuickEntryReading = {
    kind: "vital",
    label: "Vital",
    actions: [
      {
        type: "logVital",
        readings: [{ type: "bloodPressure", systolic: 130, diastolic: 85 }],
        occurredAt: at,
      },
    ],
    confidence: 0.95,
    warnings: [],
  };
  const cardsOf = (parts: QuickEntryPart[], chosen = new Map<string, number>()) =>
    markDraft(buildCards(parts, { chosen, removed: new Set() }, titleOf));

  test("the first event with a provider opens as the draft; the rest are written", () => {
    const parts: QuickEntryPart[] = [
      { text: "bp 130/85", readings: [vital, note("bp 130/85")] },
      { text: "Dr. Lee friday 2pm", readings: [event("Dr. Lee", [LEE]), note("Dr. Lee friday 2pm")] },
    ];
    const cards = cardsOf(parts);
    expect(cards.map((c) => c.opensDraft)).toEqual([false, true]);
    const { draft, rest } = draftCardOf(cards);
    expect(draft?.text).toBe("Dr. Lee friday 2pm");
    expect(rest.map((c) => c.text)).toEqual(["bp 130/85"]);
  });

  test("a second provider event in the line is written directly", () => {
    const parts: QuickEntryPart[] = [
      { text: "Alvarez on the 25th", readings: [event("Dr. Elena Alvarez", [ALV])] },
      { text: "Dr. Lee friday", readings: [event("Dr. Lee", [LEE])] },
    ];
    const { draft, rest } = draftCardOf(cardsOf(parts));
    expect(draft?.text).toBe("Alvarez on the 25th");
    expect(rest.map((c) => c.text)).toEqual(["Dr. Lee friday"]);
  });

  test("none: an event without a provider, a note, or the provider event switched to a note", () => {
    const parts: QuickEntryPart[] = [
      { text: "party saturday", readings: [event("Party", [])] },
      { text: "Dr. Lee friday", readings: [event("Dr. Lee", [LEE]), note("Dr. Lee friday")] },
    ];
    const switched = cardsOf(parts, new Map([[partKey(1, parts[1]!), 1]]));
    expect(switched.some((c) => c.opensDraft)).toBe(false);
    expect(draftCardOf(switched)).toEqual({ draft: null, rest: switched });
    expect(draftCardOf(cardsOf([parts[0]!])).draft).toBeNull();
    expect(draftCardOf([]).draft).toBeNull();
  });

  test("buildCards alone marks nothing; the draft card's line", () => {
    const parts: QuickEntryPart[] = [{ text: "Dr. Lee", readings: [event("Dr. Lee", [LEE])] }];
    expect(buildCards(parts, none, titleOf)[0]!.opensDraft).toBe(false);
    expect(isDraftReading(parts[0]!.readings[0]!)).toBe(true);
    expect(draftSummary(["Dr. Elena Alvarez"], "Wed, Nov 25")).toBe(
      "Opens to finish · Dr. Elena Alvarez · Wed, Nov 25",
    );
    expect(draftSummary([], "Fri")).toBe("Opens to finish · Fri");
  });
});

describe("new medications and providers (B-762)", () => {
  const MED_DRAFT: NewItemDraft = {
    kind: "medication",
    name: "Lisinopril",
    strength: "10 mg",
    form: "tablet",
    directions: "once daily",
  };
  const PROVIDER_DRAFT: NewItemDraft = {
    kind: "provider",
    type: "clinician",
    name: "Dr Kim",
    specialty: "Cardiology",
    practiceId: null,
    phone: "555-0100",
    address: null,
  };
  const item = (draft: NewItemDraft): QuickEntryReading => ({
    kind: draft.kind,
    label: draft.kind === "medication" ? "New medication" : "New provider",
    actions: [],
    confidence: 0.97,
    warnings: [],
    newItem: draft,
  });
  const LEE = "44444444-4444-4444-8444-444444444444";
  const providerEvent: QuickEntryReading = {
    kind: "event",
    label: "Event",
    actions: [
      {
        type: "addEvent",
        title: "Dr. Lee",
        occurredAt: at,
        allDay: true,
        providerIds: [LEE],
        timeZone: "UTC",
      },
    ],
    confidence: 0.8,
    warnings: [],
  };
  const cardsOf = (parts: QuickEntryPart[]) => markDraft(buildCards(parts, none, titleOf));

  test("Save opens the Add sheet with the draft in history state, closing back to where it came from", () => {
    const med = newItemTarget(MED_DRAFT, GROUP);
    expect(med.to).toBe(`/app/groups/${GROUP}/medications/list/new`);
    expect(medicationDraftFrom(med.state)).toEqual(MED_DRAFT);
    expect(med.state).toMatchObject({ medicationSheet: true });
    const provider = newItemTarget(PROVIDER_DRAFT, GROUP);
    expect(provider.to).toBe(`/app/groups/${GROUP}/providers/new`);
    expect(providerDraftFrom(provider.state)).toEqual(PROVIDER_DRAFT);
    expect(provider.state).toMatchObject({ sheetOverProviders: true });
    expect(newItemTarget({ ...PROVIDER_DRAFT, type: "pharmacy" }, GROUP).to).toBe(
      `/app/groups/${GROUP}/providers/new?type=pharmacy`,
    );
    // Each sheet reads only its own draft; malformed fields are dropped.
    expect(providerDraftFrom(med.state)).toBeNull();
    expect(
      medicationDraftFrom({ [QUICK_ENTRY_DRAFT]: { kind: "medication", name: 3, form: "goo" } }),
    ).toEqual({
      kind: "medication",
      name: "",
      strength: null,
      form: null,
      directions: null,
    });
  });

  test("the first new item opens to finish, ahead of a provider event (written directly); a second is blocked", () => {
    const parts: QuickEntryPart[] = [
      { text: "Dr. Lee friday", readings: [providerEvent] },
      { text: "new med lisinopril", readings: [item(MED_DRAFT), note("new med lisinopril")] },
      { text: "add provider Dr Kim", readings: [item(PROVIDER_DRAFT)] },
    ];
    const cards = cardsOf(parts);
    expect(cards.map((c) => c.opensDraft)).toEqual([false, true, false]);
    expect(cards[2]!.blocking).toEqual([ONE_NEW_ITEM]);
    expect(canSaveCards(cards)).toBe(false);
    const { draft, rest } = draftCardOf(cards.slice(0, 2));
    expect(draft?.text).toBe("new med lisinopril");
    expect(rest.map((c) => c.text)).toEqual(["Dr. Lee friday"]);
    expect(cardActions([draft!])).toEqual([]);
    // Switched to its note, it's an ordinary card.
    const switched = markDraft(
      buildCards(
        parts.slice(1, 2),
        { chosen: new Map([[partKey(0, parts[1]!), 1]]), removed: new Set() },
        titleOf,
      ),
    );
    expect(switched[0]!.opensDraft).toBe(false);
  });

  test("a viewer's parts lose their new items", () => {
    const parts: QuickEntryPart[] = [{ text: "new med lisinopril", readings: [item(MED_DRAFT), note("x")] }];
    expect(partsForRole(parts, true)[0]!.readings.map((r) => r.kind)).toEqual(["medication", "note"]);
    expect(partsForRole(parts, false)[0]!.readings.map((r) => r.kind)).toEqual(["note"]);
  });

  test("the card's wording", () => {
    expect(newItemPreview(MED_DRAFT)).toEqual({
      title: "Lisinopril",
      detail: "10 mg · Tablet · once daily",
      when: "",
    });
    expect(newItemPreview({ ...MED_DRAFT, name: "", strength: null, form: null, directions: null })).toEqual({
      title: "New medication",
      detail: null,
      when: "",
    });
    expect(newItemPreview({ ...PROVIDER_DRAFT, practiceId: "p1" }, () => "Riverside Dialysis").detail).toBe(
      "Cardiology · Riverside Dialysis · 555-0100",
    );
    expect(newItemLine(MED_DRAFT)).toBe("Opens Add a medication to finish");
    expect(newItemLine(PROVIDER_DRAFT)).toBe("Opens Add a provider to finish");
  });
});
