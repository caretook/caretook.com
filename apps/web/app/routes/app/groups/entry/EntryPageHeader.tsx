import type { ReactNode } from "react";
import type { TitleState } from "./entryPage";
import type { LiveEntry } from "./useLiveEntry";

import { useState } from "react";
import { CancelEventDialog, EntryActions, useEventReschedule } from "~/components/entry";
import { ConfirmDialog } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { canReschedule } from "~/lib/eventReschedule";
import { KIND_META } from "~/lib/entryDisplay";
import { EntryHeader, EntryTime } from "./EntryHeader";
import { EntryPlaceRow } from "./EntryPlaceRow";
import { EntryTimeChip } from "./EntryTimeChip";
import { EntryTitleRegion } from "./EntryTitleRegion";
import { EntryWithRow } from "./EntryWithRow";
import { PeriodSuggestionChip } from "./PeriodSuggestionChip";
import { ShareButton } from "./ShareButton";

/**
 * The entry page's header, filled from its live entry: the title, when it
 * happened (a chip for writers), who's writing, and, once there's an entry to
 * link to, Share for everyone and the ⋯ menu for writers (an event's
 * Reschedule, its Cancel or Undo cancel, then Delete, each confirmed but Undo);
 * who it was with (providers); for writers on an event that says the
 * recipient moved, a care period to start; and, for events, where it is.
 */
export function EntryPageHeader({
  live,
  groupId,
  heading,
  title,
  pickDay,
  onPickTitle,
  editors,
}: {
  live: LiveEntry;
  groupId: string;
  heading: string;
  title: TitleState;
  /** Open the time chip first (`?when=pick`). */
  pickDay: boolean;
  /** A suggested title was chosen. */
  onPickTitle: (title: string) => void;
  editors: ReactNode;
}) {
  const { entry, canWrite, deleted, stored } = live;
  const noun = KIND_META[entry.kind].label.toLowerCase();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const rescheduling = useEventReschedule(groupId, canWrite && entry.kind === "event");
  // The title being typed counts for suggestions until it's saved (or someone else renames it).
  const [typed, setTyped] = useState<{ text: string; over: string | null } | null>(null);
  const currentTitle = typed && typed.over === entry.title ? typed.text : entry.title;
  const schedule = { occurredAt: entry.occurredAt, endsAt: entry.endsAt, allDay: entry.allDay };
  const liveKind = entry.kind === "event" || entry.kind === "note" ? entry.kind : null;

  return (
    <>
      <EntryHeader
        kind={entry.kind}
        title={
          <EntryTitleRegion
            state={title}
            heading={heading}
            kind={entry.kind}
            title={entry.title}
            groupId={groupId}
            onCommit={live.commitTitle}
            onPick={onPickTitle}
            onTextChange={(text) => setTyped({ text, over: entry.title })}
          />
        }
        time={
          canWrite && !deleted && liveKind ? (
            <EntryTimeChip
              kind={liveKind}
              schedule={schedule}
              timeZone={entry.timeZone}
              pickDay={pickDay}
              onChange={live.changeSchedule}
            />
          ) : (
            <>
              <EntryTime {...schedule} timeZone={entry.timeZone} />
              {!canWrite && " · You can view this"}
            </>
          )
        }
        actions={
          stored && (
            <>
              <ShareButton title={heading} path={appUrls.entry(groupId, entry.id)} />
              {canWrite && (
                <EntryActions
                  kind={entry.kind}
                  label={`Actions for this ${noun}`}
                  cancel={
                    entry.kind === "event"
                      ? {
                          cancelled: !!entry.cancelledAt,
                          onCancel: () => setConfirmCancel(true),
                          onUncancel: live.uncancel,
                          onReschedule: canReschedule(entry) ? () => rescheduling.ask(entry) : undefined,
                        }
                      : undefined
                  }
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </>
          )
        }
        editors={editors}
        with={
          !deleted && (
            <EntryWithRow
              entryId={entry.id}
              groupId={groupId}
              canWrite={canWrite}
              title={currentTitle}
              ensureStored={live.ensureStored}
            />
          )
        }
        suggestion={
          canWrite &&
          !deleted &&
          stored &&
          entry.kind === "event" &&
          !entry.cancelledAt && (
            <PeriodSuggestionChip
              groupId={groupId}
              entryId={entry.id}
              title={currentTitle}
              occurredAt={entry.occurredAt}
              allDay={entry.allDay}
            />
          )
        }
        place={
          !deleted &&
          entry.kind === "event" && (
            <EntryPlaceRow
              entryId={entry.id}
              place={entry.place}
              canWrite={canWrite}
              onCommit={live.commitPlace}
            />
          )
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete this ${noun}?`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          void live.remove();
        }}
        onClose={() => setConfirmDelete(false)}
      />
      <CancelEventDialog
        open={confirmCancel}
        onConfirm={(reason) => {
          setConfirmCancel(false);
          live.cancel(reason);
        }}
        onClose={() => setConfirmCancel(false)}
      />
      {rescheduling.sheet}
    </>
  );
}
