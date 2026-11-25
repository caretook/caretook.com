import type { AssistantAction, NewItemDraft, QuickEntryPart, QuickEntryReading } from "@caretook/data/schema";

import type { DoseDraft, EntryDraft } from "../../lib/assistant/quickEntryDraft";

import { FORM_LABELS, similarSymptoms, symptomKey, symptomName } from "@caretook/data/schema";
import { appUrls } from "../../lib/app-shell/appUrls";
import { QUICK_ENTRY_DRAFT } from "../../lib/assistant/quickEntryDraft";
import { MEDICATION_SHEET_STATE } from "../../lib/medications/medicationSheets";
import { PROVIDER_SHEET_STATE } from "../../lib/providers/providerSheetLink";
import { TODO_SHEET_STATE } from "../../lib/todos/todoSheetLink";
import { SHEET_LINK_STATE } from "../../lib/timeline/timelineSheet";

// The pure rules behind quick entry's cards: which reading each part shows,
// its alternatives, what blocks Save, and where Edit goes. web:unit tests it.

export type QuickEntryCard = {
  /** Stable while the line's text is: the part's place and its text. */
  key: string;
  text: string;
  /** The reading shown, and its index among the part's readings. */
  reading: QuickEntryReading;
  index: number;
  /** Other readings of the same kind (two medications), as named chips: their index and a label. */
  alternatives: { index: number; label: string }[];
  /** The other kinds the part reads as, one button each ("Make it a note"), on that kind's best reading. */
  kindChoices: { index: number; kind: string; label: string }[];
  /** Messages that stop this card from saving. */
  blocking: string[];
  /** Messages worth a look that don't. */
  notices: string[];
  /** Save opens this card on the new-event page to finish, instead of writing it (`draftCardOf`). */
  opensDraft: boolean;
  /**
   * A symptom whose name is new to the group but like some it has
   * (`withSymptomGates`): the card asks "Use <name>" or "Add new", and
   * Save waits for the answer.
   */
  symptomGate?: SymptomGate;
};

/** A symptom card's question: the name as typed, and the catalog's similar names. */
export type SymptomGate = { name: string; similar: { id: string; name: string }[] };

/**
 * A symptom card's answer, by card key: `use` is the catalog name chosen,
 * null for "Add new". It answers only the name it was given for (`key`).
 */
export type SymptomChoice = { key: string; use: string | null };

/**
 * The parts as a member may save them: a viewer's lose their new medication
 * and provider readings (adding either is a writer's), so no such card shows.
 */
export const partsForRole = (parts: readonly QuickEntryPart[], canWrite: boolean): QuickEntryPart[] =>
  canWrite
    ? [...parts]
    : parts.map((part) => ({ ...part, readings: part.readings.filter((r) => !r.newItem) }));

/** The part's key: its place in the line and its text. */
export const partKey = (index: number, part: QuickEntryPart) => `${index}:${part.text}`;

/**
 * The cards for a line's parts: removed ones left out, each showing the
 * reading chosen for it (the best one until a button picks another). The card's
 * kind is its chip; each other kind is a button ("Make it a note"), and other
 * readings of the same kind are named by what they say ("Metoprolol 25 mg instead").
 */
export const makeItLabel = (label: string) =>
  `Make it ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label.toLowerCase()}`;

const medicationOf = (reading: QuickEntryReading) => {
  const action = reading.actions[0];
  return action?.type === "logDose" ? action.medicationId : null;
};

export const buildCards = (
  parts: readonly QuickEntryPart[],
  { chosen, removed }: { chosen: ReadonlyMap<string, number>; removed: ReadonlySet<string> },
  titleOf: (reading: QuickEntryReading) => string,
): QuickEntryCard[] =>
  parts.flatMap((part, i) => {
    const key = partKey(i, part);
    if (removed.has(key)) return [];
    const wanted = chosen.get(key) ?? 0;
    const index = wanted < part.readings.length ? wanted : 0;
    const reading = part.readings[index]!;
    return [
      {
        key,
        text: part.text,
        reading,
        index,
        alternatives: part.readings.flatMap((r, k) => {
          if (k === index || r.kind !== reading.kind) return [];
          // A dose that asks its amount offers the amounts, by name, only on its own medication's card.
          const sameMedication = medicationOf(r) === medicationOf(reading);
          if (r.amountChoice) return sameMedication ? [{ index: k, label: r.amountChoice }] : [];
          if (r.asksAmount && sameMedication) return [];
          return [{ index: k, label: `${titleOf(r)} instead` }];
        }),
        kindChoices: part.readings.flatMap((r, k) =>
          r.kind !== reading.kind && part.readings.findIndex((o) => o.kind === r.kind) === k
            ? [{ index: k, kind: r.kind, label: makeItLabel(r.label) }]
            : [],
        ),
        blocking: reading.warnings.filter((w) => w.blocking).map((w) => w.message),
        notices: reading.warnings.filter((w) => !w.blocking).map((w) => w.message),
        opensDraft: false,
      },
    ];
  });

/**
 * The catalog check on symptom cards (symptom-catalog), as the symptom sheet
 * does it, on the device's catalog: the parser already took an exact
 * match's spelling, so a name with similar ones (`similarSymptoms`) asks
 * on its card, until answered. An answer to "Use <name>" saves that name;
 * "Add new" saves the name as typed. Pure.
 */
export const withSymptomGates = (
  cards: readonly QuickEntryCard[],
  catalog: readonly { id: string; name: string }[],
  choices: ReadonlyMap<string, SymptomChoice>,
): QuickEntryCard[] =>
  cards.map((card) => {
    const [action, ...more] = card.reading.actions;
    if (action?.type !== "logSymptom" || more.length) return card;
    const choice = choices.get(card.key);
    if (choice && choice.key === symptomKey(action.name)) {
      if (choice.use === null) return card;
      return { ...card, reading: { ...card.reading, actions: [{ ...action, name: choice.use }] } };
    }
    const { exact, similar } = similarSymptoms(action.name, catalog);
    if (exact || !similar.length) return card;
    return { ...card, symptomGate: { name: symptomName(action.name), similar } };
  });

/** What the box remembers per card: the reading chosen, the cards removed, a refusal's message, a symptom's answer. */
export type QuickEntryCardState = {
  chosen: ReadonlyMap<string, number>;
  removed: ReadonlySet<string>;
  errors: ReadonlyMap<string, string>;
  symptoms?: ReadonlyMap<string, SymptomChoice>;
};

const keepMapKeys = <V>(map: ReadonlyMap<string, V>, keys: ReadonlySet<string>): ReadonlyMap<string, V> =>
  [...map.keys()].every((k) => keys.has(k)) ? map : new Map([...map].filter(([k]) => keys.has(k)));

/**
 * Card state only for the keys of the current parts, so a removal never
 * outlives the text it belonged to. A map or set with nothing to drop comes
 * back as the same object, so applying this while rendering can't loop.
 */
export const pruneCardState = (
  parts: readonly QuickEntryPart[],
  { chosen, removed, errors, symptoms }: QuickEntryCardState,
): QuickEntryCardState => {
  const keys = new Set(parts.map((part, i) => partKey(i, part)));
  return {
    chosen: keepMapKeys(chosen, keys),
    removed: [...removed].every((k) => keys.has(k))
      ? removed
      : new Set([...removed].filter((k) => keys.has(k))),
    errors: keepMapKeys(errors, keys),
    ...(symptoms && { symptoms: keepMapKeys(symptoms, keys) }),
  };
};

/** Every card's actions, in order, with the card each came from (for a refusal's message). */
export const cardActions = (cards: readonly QuickEntryCard[]) =>
  cards.flatMap((card) => card.reading.actions.map((action) => ({ action, key: card.key })));

/** Whether a card waits on something: a blocking message, or a symptom's unanswered question. */
const waits = (card: QuickEntryCard) => card.blocking.length > 0 || !!card.symptomGate;

/** Whether the cards can be saved: at least one, and none blocked. */
export const canSaveCards = (cards: readonly QuickEntryCard[]) =>
  cards.length > 0 && cards.every((c) => !waits(c));

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Saved 3 entries", "Saved 1 entry", "Saved 1 todo", "Saved 2 entries and 1 todo". */
export const savedText = (count: number, todos = 0) => {
  const entries = count - todos;
  if (!todos) return `Saved ${counted(count, "entry", "entries")}`;
  if (!entries) return `Saved ${counted(todos, "todo", "todos")}`;
  return `Saved ${counted(entries, "entry", "entries")} and ${counted(todos, "todo", "todos")}`;
};

/** What the cards say, for screen readers: "2 cards: Vital, BP 130/85 mmHg; Dose, Metformin 500 mg". */
export const cardsAnnouncement = (
  cards: readonly QuickEntryCard[],
  titleOf: (r: QuickEntryReading) => string,
) =>
  cards.length
    ? `${cards.length} ${cards.length === 1 ? "card" : "cards"}: ${cards
        .map((c) => `${c.reading.label}, ${titleOf(c.reading)}${waits(c) ? ", can't be saved yet" : ""}`)
        .join("; ")}`
    : "";

// ---------------------------------------------------------------------------
// Edit: the usual sheet, filled in
// ---------------------------------------------------------------------------

/**
 * Where Edit takes a card: symptoms and vitals to the add sheet, doses to
 * the Dose sheet on that medication (a pass's Given all to the Dose sheet on
 * the pass), each filled in through history state
 * (and coming back to the timeline on close). A todo opens the add-todo
 * sheet filled in through its URL (closing comes back). Notes and events
 * have no sheet: their page is where they're written, so Edit saves the
 * card and opens it.
 */
export const editTarget = (
  action: AssistantAction,
  groupId: string,
  search?: string,
  /** The line couldn't tell the amount: the Dose sheet starts empty, not on the usual dose. */
  asksAmount = false,
): { to: string; state: Record<string, unknown> } | "saveAndOpen" => {
  const state = (draft: EntryDraft | DoseDraft) => ({ ...SHEET_LINK_STATE, [QUICK_ENTRY_DRAFT]: draft });
  switch (action.type) {
    case "logVital":
      return {
        to: appUrls.newSheet(groupId, "vital", { type: action.readings[0]?.type, search }),
        state: state({
          kind: "vital",
          details: { readings: action.readings },
          body: action.note ?? null,
          occurredAt: action.occurredAt,
        }),
      };
    case "logSymptom":
      return {
        to: appUrls.newSheet(groupId, "symptom", { search }),
        state: state({
          kind: "symptom",
          details: { name: action.name, severity: action.severity ?? null },
          body: action.note ?? null,
          occurredAt: action.occurredAt,
        }),
      };
    case "logDose":
      return {
        to: appUrls.newDose(groupId, { medicationId: action.medicationId, search }),
        state: state({
          status: action.status,
          amount: asksAmount ? "" : (action.amount ?? null),
          note: action.note ?? null,
          occurredAt: action.occurredAt,
        }),
      };
    case "givePass":
      // The Dose sheet on that pass: its medications one by one, with Given all.
      return {
        to: appUrls.newDose(groupId, { passId: action.passId, search }),
        state: { ...SHEET_LINK_STATE },
      };
    case "addTodo":
      return {
        to: appUrls.newTodo(groupId, {
          title: action.title,
          assigneeId: action.assigneeId ?? undefined,
          dueOn: action.dueOn ?? undefined,
          dueTime: action.dueTime ?? undefined,
          providerId: action.providerId ?? undefined,
          medicationId: action.medicationId ?? undefined,
          eventId: action.eventId ?? undefined,
          repeatRule: action.repeatRule ?? undefined,
        }),
        state: { ...TODO_SHEET_STATE },
      };
    case "addNote":
    case "addEvent":
      return "saveAndOpen";
  }
};

/**
 * The entry to open after a line saved: its id when the whole line wrote
 * exactly one thing and it's a note or an event (their pages hold the live
 * document); nothing otherwise (several entries, a vital, a dose, a todo).
 * `saved` is each action's type with the ids it wrote, in order. Pure.
 */
export const openAfterSave = (
  saved: readonly { type: AssistantAction["type"]; ids: readonly string[] }[],
): string | null => {
  const written = saved.filter((s) => s.ids.length > 0);
  const only = written.length === 1 ? written[0]! : null;
  if (!only || only.ids.length !== 1) return null;
  return only.type === "addNote" || only.type === "addEvent" ? only.ids[0]! : null;
};

// ---------------------------------------------------------------------------
// The event draft: a provider event opens on the new-event page to finish
// ---------------------------------------------------------------------------

/** Whether a reading is an event with a provider (it can open as the draft). */
export const isDraftReading = (reading: QuickEntryReading) => {
  const [action, ...more] = reading.actions;
  return !more.length && action?.type === "addEvent" && action.providerIds.length > 0;
};

/** What a second new medication or provider in one line says: only one Add sheet can open. */
export const ONE_NEW_ITEM =
  "Add one new medication or provider at a time: remove this one, or save it after.";

/**
 * Marks the card that opens to finish (`buildCards` leaves it to this): the
 * first new medication or provider (its Add sheet), else the first event with
 * a provider (the new-event page). Any later new item is blocked (`ONE_NEW_ITEM`).
 */
export const markDraft = (cards: QuickEntryCard[]): QuickEntryCard[] => {
  const newItem = cards.findIndex((c) => !!c.reading.newItem);
  const first = newItem >= 0 ? newItem : cards.findIndex((c) => isDraftReading(c.reading));
  if (first < 0) return cards;
  return cards.map((c, i) =>
    i === first
      ? { ...c, opensDraft: true }
      : c.reading.newItem
        ? { ...c, blocking: [...c.blocking, ONE_NEW_ITEM] }
        : c,
  );
};

/**
 * What Save does with a line: the card that opens as the draft (or null),
 * and the rest, written as one batch. Only the first provider event opens;
 * any later one is written directly. Pure.
 */
export const draftCardOf = (cards: readonly QuickEntryCard[]) => {
  const draft = cards.find((c) => c.opensDraft) ?? null;
  return { draft, rest: cards.filter((c) => c !== draft) };
};

// ---------------------------------------------------------------------------
// New medications and providers: Save opens the Add sheet filled in
// ---------------------------------------------------------------------------

/**
 * Where a new medication or provider card opens: the Add sheet (over the
 * medication list, or the directory) with the draft in history state, and
 * the sheet's own state, so closing it comes back here. Nothing is written
 * until the sheet saves. Pure.
 */
export const newItemTarget = (
  draft: NewItemDraft,
  groupId: string,
): { to: string; state: Record<string, unknown> } =>
  draft.kind === "medication"
    ? {
        to: appUrls.newMedication(groupId, "list"),
        state: { ...MEDICATION_SHEET_STATE, [QUICK_ENTRY_DRAFT]: draft },
      }
    : {
        to: appUrls.newProvider(groupId, draft.type === "clinician" ? {} : { type: draft.type }),
        state: { ...PROVIDER_SHEET_STATE, [QUICK_ENTRY_DRAFT]: draft },
      };

/**
 * A new item card's wording: its name ("Lisinopril", or "New medication"
 * with none), and what else the sheet will start with ("10 mg · Tablet ·
 * once daily"; "Cardiology · 555-0100"). `practiceName` names a practice it's at.
 */
export const newItemPreview = (
  draft: NewItemDraft,
  practiceName?: (id: string) => string | undefined,
): { title: string; detail: string | null; when: string } => {
  const parts =
    draft.kind === "medication"
      ? [draft.strength, draft.form && FORM_LABELS[draft.form], draft.directions]
      : [draft.specialty, draft.practiceId && practiceName?.(draft.practiceId), draft.phone, draft.address];
  const fallback = draft.kind === "medication" ? "New medication" : "New provider";
  return {
    title: draft.name || fallback,
    detail: parts.filter(Boolean).join(" · ") || null,
    when: "",
  };
};

/** A new item card's line: "Opens Add a medication to finish". */
export const newItemLine = (draft: NewItemDraft) =>
  `Opens Add a ${draft.kind === "medication" ? "medication" : "provider"} to finish`;

/** The draft card's line: "Opens to finish · Dr. Elena Alvarez · Wed, Nov 25". */
export const draftSummary = (providerNames: readonly string[], when: string) =>
  ["Opens to finish", providerNames.join(", "), when].filter(Boolean).join(" · ");
