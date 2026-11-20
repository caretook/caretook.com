import type { TimelineEntryKind } from "@caretook/data/schema";

// The pure decisions behind a live entry (a note or event whose text is its
// live document). No database or React here: lib/live-notes/liveEntry.sync.ts writes, and
// the entry route wires it to the editor. Unit-tested in web:unit.
//
// Lifecycle: `/entries/new?kind=note|event` opens a draft with an id made on the
// device. Nothing is written until the first real change (text in the
// document, or a title); then the entry and its document are saved together
// and the URL is replaced with `/entries/:id`.

/** The `:entryId` that means "a new entry": `/entries/new?kind=note`. */
export const NEW_ENTRY = "new";

/** Kinds started from the quick-add bar as a live document. */
export const LIVE_ENTRY_KINDS = ["note", "event"] as const satisfies readonly TimelineEntryKind[];
export type LiveEntryKind = (typeof LIVE_ENTRY_KINDS)[number];

export const isLiveEntryKind = (kind: string | null | undefined): kind is LiveEntryKind =>
  (LIVE_ENTRY_KINDS as readonly string[]).includes(kind ?? "");

/** What a draft has so far: the document's plain text and the title field. */
export type DraftState = { saved: boolean; text: string; title: string };

/**
 * Whether to save the draft now. Only a real change counts: text in the
 * document or a title. Opening the editor, focusing it or toggling bold on
 * nothing doesn't, so a misfire leaves nothing on the timeline.
 */
export const shouldMaterialize = ({ saved, text, title }: DraftState) =>
  !saved && (text.trim() !== "" || title.trim() !== "");

/** What an event is called until someone names it. */
export const DEFAULT_EVENT_TITLE = "Event";

/**
 * The title a live entry is saved with. Notes may have none. An event needs
 * one, so an unnamed event (never named, or its name cleared) is "Event":
 * writing is never blocked on naming it.
 */
export const savedTitle = (kind: LiveEntryKind, title: string): string | null =>
  title.trim() || (kind === "event" ? DEFAULT_EVENT_TITLE : null);

/** Whether an event still has no name of its own: none yet, or the default "Event". */
export const isUnnamedEvent = (kind: string, title: string | null | undefined) =>
  kind === "event" && [DEFAULT_EVENT_TITLE, ""].includes(title?.trim() ?? "");

/**
 * What the title field shows and asks for. An unnamed event shows an empty
 * field: "Title" on a draft, then the gentle "Add a title" once it's saved
 * as "Event". A note's title is optional.
 */
export const titleField = (
  kind: LiveEntryKind,
  title: string | null,
  saved: boolean,
): { value: string; placeholder: string } => {
  if (kind === "note") return { value: title ?? "", placeholder: "Title (optional)" };
  if (!isUnnamedEvent(kind, title)) return { value: title ?? "", placeholder: "Title" };
  return saved ? { value: "", placeholder: "Add a title" } : { value: "", placeholder: "Title" };
};
