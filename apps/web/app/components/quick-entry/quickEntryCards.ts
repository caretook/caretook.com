import type { AssistantAction, QuickEntryPart, QuickEntryReading } from "@caretook/data/schema";

import type { DoseDraft, EntryDraft } from "../../lib/quickEntryDraft";

import { appUrls } from "../../lib/appUrls";
import { QUICK_ENTRY_DRAFT } from "../../lib/quickEntryDraft";
import { TASK_SHEET_STATE } from "../../lib/taskSheetLink";
import { SHEET_LINK_STATE } from "../../lib/timelineSheet";

// The pure rules behind quick entry's cards: which reading each part shows,
// its alternatives, what blocks Save, and where Edit goes. web:unit tests it.

export type QuickEntryCard = {
  /** Stable while the line's text is: the part's place and its text. */
  key: string;
  text: string;
  /** The reading shown, and its index among the part's readings. */
  reading: QuickEntryReading;
  index: number;
  /** The other readings, as chips: their index and a label. */
  alternatives: { index: number; label: string }[];
  /** Messages that stop this card from saving. */
  blocking: string[];
  /** Messages worth a look that don't. */
  notices: string[];
};

/** The part's key: its place in the line and its text. */
export const partKey = (index: number, part: QuickEntryPart) => `${index}:${part.text}`;

/**
 * The cards for a line's parts: removed ones left out, each showing the
 * reading chosen for it (the best one until a chip picks another). An
 * alternative is named by its kind ("Note instead"), or by what it says when
 * several share a kind ("Metoprolol 25 mg instead").
 */
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
    const kindCount = (kind: string) => part.readings.filter((r) => r.kind === kind).length;
    return [
      {
        key,
        text: part.text,
        reading,
        index,
        alternatives: part.readings.flatMap((r, k) =>
          k === index ? [] : [{ index: k, label: `${kindCount(r.kind) > 1 ? titleOf(r) : r.label} instead` }],
        ),
        blocking: reading.warnings.filter((w) => w.blocking).map((w) => w.message),
        notices: reading.warnings.filter((w) => !w.blocking).map((w) => w.message),
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

/** "Saved 3 entries", "Saved 1 entry", "Saved 1 task", "Saved 2 entries and 1 task". */
export const savedText = (count: number, tasks = 0) => {
  const entries = count - tasks;
  if (!tasks) return `Saved ${counted(count, "entry", "entries")}`;
  if (!entries) return `Saved ${counted(tasks, "task", "tasks")}`;
  return `Saved ${counted(entries, "entry", "entries")} and ${counted(tasks, "task", "tasks")}`;
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
 * (and coming back to the timeline on close). A task opens the add-task
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
    case "addTask":
      return {
        to: appUrls.newTask(groupId, {
          title: action.title,
          assigneeId: action.assigneeId ?? undefined,
          dueOn: action.dueOn ?? undefined,
          dueTime: action.dueTime ?? undefined,
          providerId: action.providerId ?? undefined,
          medicationId: action.medicationId ?? undefined,
          eventId: action.eventId ?? undefined,
        }),
        state: { ...TASK_SHEET_STATE },
      };
    case "addNote":
    case "addEvent":
      return "saveAndOpen";
  }
};
