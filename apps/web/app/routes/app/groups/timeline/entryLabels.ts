import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";

import { VITALS } from "@caretook/data/schema";

import { KIND_META } from "../../../../lib/timeline/entryDisplay";
import { formatTime } from "../../../../lib/core/format";

// The timeline's words for entries: link and menu names, and the empty list.
// Pure, so web:unit tests it.

type Labelled = { kind: TimelineEntryKind; title: string | null; occurredAt: string };

/** A short name for the entry: its title, else its kind, and its time ("PT visit at 9:30 AM"). */
export const entryLabel = (entry: Labelled) =>
  `${entry.title || KIND_META[entry.kind].label.toLowerCase()} at ${formatTime(entry.occurredAt)}`;

/** The name of a row's open link: "Open note at 9:30 AM", or "Edit …" for an edit sheet. */
export const openLabel = (entry: Labelled, sheet: boolean) =>
  `${sheet ? "Edit" : "Open"} ${entryLabel(entry)}`;

/** The name of an entry's ⋯ menu: "Actions for symptom at 9:30 AM". */
export const actionsLabel = (entry: Labelled) =>
  `Actions for ${KIND_META[entry.kind].label.toLowerCase()} at ${formatTime(entry.occurredAt)}`;

/**
 * What an empty timeline says, naming the filters that are on: "No symptoms
 * by Alex Rivera yet." (`authorName` is the author filter's name.) With a
 * search (`q`): "No symptoms by Alex Rivera match “fall”." With a vital
 * type (`vital`, under the vital kind): "No blood pressure readings yet."
 * With symptom types (`symptomNames`, the chosen catalog names, under the
 * symptom kind): "No pain or nausea on the timeline yet." With a tag
 * (`tagName`): "No notes tagged “Knee” on the timeline yet."
 */
export const emptyTimelineText = (
  kind: TimelineEntryKind | null,
  authorName?: string | null,
  q?: string | null,
  vital?: VitalType | null,
  symptomNames?: readonly string[] | null,
  tagName?: string | null,
) => {
  const what =
    vital && kind === "vital"
      ? vitalReadings(vital)
      : symptomNames?.length && kind === "symptom"
        ? orList(symptomNames.map(lowerFirst))
        : kind
          ? KIND_META[kind].plural.toLowerCase()
          : "entries";
  const tagged = tagName ? ` tagged “${tagName}”` : "";
  if (q) {
    return `No ${what}${tagged}${authorName ? ` by ${authorName}` : ""} match “${q}”.`;
  }
  if (!kind && !authorName && !tagName) return "Nothing on the timeline yet.";
  return authorName
    ? `No ${what}${tagged} by ${authorName} yet.`
    : `No ${what}${tagged} on the timeline yet.`;
};

/** A vital type's readings, as a sentence names them: "blood pressure readings", "oxygen (SpO₂) readings". */
const vitalReadings = (vital: VitalType) => `${lowerFirst(VITALS[vital].label)} readings`;

/** A label as a sentence's middle has it: "Knee pain" is "knee pain". */
const lowerFirst = (label: string) => `${label.charAt(0).toLowerCase()}${label.slice(1)}`;

/** "a", "a or b", "a, b or c". */
const orList = (names: readonly string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
