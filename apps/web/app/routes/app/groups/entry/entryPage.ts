import type { TimelineEntryKind } from "@caretook/data/schema";
import type { EventDraft } from "../../../../lib/assistant/quickEntryDraft";
import type { EntryPageData } from "./loadEntry";

import { isLiveEntryKind, isUnnamedEvent, titleField } from "../../../../lib/live-notes/liveEntry";

// The entry page's pure decisions: what it's called, what the title region
// shows, and when the title chips appear. No React or database; unit-tested
// in web:unit (so imports stay relative).

/**
 * The page's heading (and the read-only title): the title, else "New note"
 * on a draft, else the kind's label ("Note").
 */
export const entryHeading = (label: string, title: string | null | undefined, draft: boolean): string =>
  title || (draft ? `New ${label.toLowerCase()}` : label);

/** What the title region shows: an editable field (and what's in it), or the heading as text. */
export type TitleState =
  | { editable: true; value: string; placeholder: string }
  | { editable: false; value?: undefined; placeholder?: undefined };

/**
 * Writers name notes and events here, until the entry is deleted. An unnamed
 * event (saved as "Event") shows an empty field asking for a title.
 */
export const titleState = ({
  kind,
  title,
  saved,
  canWrite,
  deleted,
}: {
  kind: TimelineEntryKind;
  title: string | null;
  /** Whether the entry is stored (not a draft). */
  saved: boolean;
  canWrite: boolean;
  deleted: boolean;
}): TitleState => {
  if (!canWrite || deleted || !isLiveEntryKind(kind)) return { editable: false };
  return { editable: true, ...titleField(kind, title, saved) };
};

/** Suggested names show while an editable event is unnamed and nothing is typed in the field. */
export const showTitleChips = ({
  editable,
  kind,
  title,
  typed,
}: {
  editable: boolean;
  kind: TimelineEntryKind;
  title: string | null;
  typed: string;
}): boolean => editable && isUnnamedEvent(kind, title) && typed.trim() === "";

/**
 * A new event's page opened from quick entry (its draft in history state):
 * the draft's title, time, all day, place and providers, on top of
 * `?provider=`'s. Anything else (a stored entry, a note, no draft) is the
 * page's data as it was. Nothing is written here.
 */
export const withEventDraft = (data: EntryPageData, draft: EventDraft | null): EntryPageData =>
  !draft || !data.isNew || data.entry.kind !== "event"
    ? data
    : {
        ...data,
        withProviders: [...new Set([...data.withProviders, ...draft.providerIds])],
        entry: {
          ...data.entry,
          title: draft.title,
          occurredAt: draft.occurredAt,
          timeZone: draft.timeZone,
          allDay: draft.allDay,
          place: draft.place,
        },
        heading: entryHeading("Event", draft.title, true),
      };
