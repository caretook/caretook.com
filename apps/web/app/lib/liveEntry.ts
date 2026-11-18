import type { TimelineEntryKind } from "@caretook/data/schema";

// The pure decisions behind a live entry (a note whose text is its live
// document). No database or React here: lib/sync/liveEntry.ts writes, and
// the entry route wires it to the editor. Unit-tested in web:unit.
//
// Lifecycle: `/entries/new?kind=note` opens a draft with an id made on the
// device. Nothing is written until the first real change (text in the
// document, or a title); then the entry and its document are saved together
// and the URL is replaced with `/entries/:id`.

/** The `:entryId` that means "a new entry": `/entries/new?kind=note`. */
export const NEW_ENTRY = "new";

/** Kinds started from the quick-add bar as a live document. Slice 2 adds "event". */
export const LIVE_ENTRY_KINDS = ["note"] as const satisfies readonly TimelineEntryKind[];
export type LiveEntryKind = (typeof LIVE_ENTRY_KINDS)[number];

export const isLiveEntryKind = (kind: string | null | undefined): kind is LiveEntryKind =>
  (LIVE_ENTRY_KINDS as readonly string[]).includes(kind ?? "");

export const entryUrl = (groupId: string, entryId: string) => `/app/groups/${groupId}/entries/${entryId}`;
export const newEntryUrl = (groupId: string, kind: LiveEntryKind) =>
  `${entryUrl(groupId, NEW_ENTRY)}?kind=${kind}`;

/** What a draft has so far: the document's plain text and the title field. */
export type DraftState = { saved: boolean; text: string; title: string };

/**
 * Whether to save the draft now. Only a real change counts: text in the
 * document or a title. Opening the editor, focusing it or toggling bold on
 * nothing doesn't, so a misfire leaves nothing on the timeline.
 */
export const shouldMaterialize = ({ saved, text, title }: DraftState) =>
  !saved && (text.trim() !== "" || title.trim() !== "");

/** The title a live entry is saved with. Notes may have none. */
export const savedTitle = (_kind: LiveEntryKind, title: string): string | null => title.trim() || null;
