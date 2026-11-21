import type { AssistantAction, QuickEntryPart, QuickEntryReading } from "@caretook/data/schema";

import type { DoseDraft, EntryDraft } from "../../lib/assistant/quickEntryDraft";

import { appUrls } from "../../lib/app-shell/appUrls";
import { QUICK_ENTRY_DRAFT } from "../../lib/assistant/quickEntryDraft";
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
};

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
        alternatives: part.readings.flatMap((r, k) =>
          k !== index && r.kind === reading.kind ? [{ index: k, label: `${titleOf(r)} instead` }] : [],
        ),
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

/** Every card's actions, in order, with the card each came from (for a refusal's message). */
export const cardActions = (cards: readonly QuickEntryCard[]) =>
  cards.flatMap((card) => card.reading.actions.map((action) => ({ action, key: card.key })));

/** Whether the cards can be saved: at least one, and none blocked. */
export const canSaveCards = (cards: readonly QuickEntryCard[]) =>
  cards.length > 0 && cards.every((c) => c.blocking.length === 0);

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
        .map(
          (c) =>
            `${c.reading.label}, ${titleOf(c.reading)}${c.blocking.length ? ", can't be saved yet" : ""}`,
        )
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
          amount: action.amount ?? null,
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

/** Marks the card that opens as the draft (`buildCards` leaves it to this): the first whose chosen reading is an event with a provider. */
export const markDraft = (cards: QuickEntryCard[]): QuickEntryCard[] => {
  const first = cards.findIndex((c) => isDraftReading(c.reading));
  return first < 0 ? cards : cards.map((c, i) => (i === first ? { ...c, opensDraft: true } : c));
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

/** The draft card's line: "Opens to finish · Dr. Elena Alvarez · Wed, Nov 25". */
export const draftSummary = (providerNames: readonly string[], when: string) =>
  ["Opens to finish", providerNames.join(", "), when].filter(Boolean).join(" · ");
