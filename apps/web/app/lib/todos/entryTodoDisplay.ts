import { canHaveNoteDocument } from "@caretook/data/schema";
import { fold, queryTokens } from "../providers/providerDirectory";
import { dayLabel } from "@caretook/data/domain";

// The words for entry ↔ todo links (planner-3), pure so web:unit tests them
// (relative imports): the timeline's open-todo mark, a linked entry's name
// on the todo page, and the todo page's "Link an entry" choices.

/** The timeline's mark on a note or event with open todos: "1 todo", "2 todos"; none at 0. */
export const openTodosMark = (count: number | undefined) =>
  !count || count < 1 ? null : `${count} ${count === 1 ? "todo" : "todos"}`;

/** A text's first line with anything in it, trimmed ("" for none). */
export const firstLine = (text: string | null | undefined) =>
  (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";

type Named = { kind: string; title: string | null };

/** A linked note's or event's name: its title, else its text's first line, else its kind ("Note"). */
export const linkedEntryName = (entry: Named, text: string | null | undefined) =>
  entry.title?.trim() || firstLine(text) || (entry.kind === "event" ? "Event" : "Note");

export type LinkableEntry = Named & { id: string; occurredAt: string; text: string | null };

export type EntryLinkOption = { id: string; label: string; description: string };

/** How many entries the picker lists at most. */
export const ENTRY_PICKER_LIMIT = 20;

/**
 * The todo page's "Link an entry" choices: notes and events (only those
 * kinds) matching every typed word of their title or text, newest first
 * (the query's order), each saying its kind and day ("Note · Yesterday").
 */
export const entryLinkOptions = (
  entries: readonly LinkableEntry[],
  typed: string,
  now: Date,
  where: { timeZone?: string; locale?: string } = {},
  limit = ENTRY_PICKER_LIMIT,
): EntryLinkOption[] => {
  const tokens = queryTokens(typed);
  const zone = where.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return entries
    .filter((e) => canHaveNoteDocument(e.kind))
    .filter((e) => {
      const haystack = fold(`${e.title ?? ""} ${e.text ?? ""}`);
      return tokens.every((t) => haystack.includes(t));
    })
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      label: linkedEntryName(e, e.text),
      description: `${e.kind === "event" ? "Event" : "Note"} · ${dayLabel(e.occurredAt, zone, now, where.locale)}`,
    }));
};
