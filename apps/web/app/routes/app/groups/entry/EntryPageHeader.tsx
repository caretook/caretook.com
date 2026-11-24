import type { ReactNode } from "react";
import type { TitleState } from "./entryPage";
import type { LiveEntry } from "./useLiveEntry";

import { useRef, useState } from "react";
import {
  CancelEventDialog,
  EntryActions,
  SeriesScopeDialog,
  useEventReschedule,
  useRemindMe,
  useSeriesScope,
} from "~/components/entry";
import { ConfirmDialog, Message, ViaTag } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { canRemind } from "~/lib/calendars/remindMe";
import { canReschedule } from "~/lib/appointments/eventReschedule";
import { asksScope } from "~/lib/appointments/seriesScope";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { EntryHeader, EntryTime } from "./EntryHeader";
import { EntryPlaceRow } from "./EntryPlaceRow";
import { EntryRepeat } from "./EntryRepeat";
import { EntryTimeChip } from "./EntryTimeChip";
import { EntryTitleRegion } from "./EntryTitleRegion";
import { EntryWithRow } from "./EntryWithRow";
import { PeriodSuggestionChip } from "./PeriodSuggestionChip";
import { ShareButton } from "./ShareButton";

/**
 * The entry page's header, filled from its live entry: the title, when it
 * happened (a chip for writers), who's writing, and, once there's an entry to
 * link to, Share and the ⋯ menu (for writers, an event's Reschedule, its
 * Cancel or Undo cancel, then Print and Delete, each confirmed but Undo; for
 * viewers, Print);
 * who it was with (providers); for writers on an event that says the
 * recipient moved, a care period to start; and, for events, where it is.
 * On an upcoming series visit, the ⋯ menu's Edit, Reschedule, Cancel and
 * Delete, and a title, time or place typed here, ask Only this visit or
 * This and later visits first.
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
  const { entry, canWrite, canSetUp, deleted, stored } = live;
  const noun = KIND_META[entry.kind].label.toLowerCase();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const rescheduling = useEventReschedule(groupId, canSetUp && entry.kind === "event");
  const remind = useRemindMe(groupId);
  const scope = useSeriesScope(canSetUp && !!entry.seriesId);
  // The title being typed counts for suggestions until it's saved (or someone else renames it).
  const [typed, setTyped] = useState<{ text: string; over: string | null } | null>(null);
  const currentTitle = typed && typed.over === entry.title ? typed.text : entry.title;
  const schedule = { occurredAt: entry.occurredAt, endsAt: entry.endsAt, allDay: entry.allDay };
  const liveKind = entry.kind === "event" || entry.kind === "note" ? entry.kind : null;
  const titleInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <EntryHeader
        kind={entry.kind}
        title={
          <EntryTitleRegion
            key={live.editRevision}
            state={title}
            heading={heading}
            kind={entry.kind}
            title={entry.title}
            groupId={groupId}
            inputRef={titleInput}
            onCommit={live.commitTitle}
            onPick={onPickTitle}
            onTextChange={(text) => setTyped({ text, over: entry.title })}
          />
        }
        time={
          canWrite && !deleted && liveKind ? (
            <EntryTimeChip
              key={live.editRevision}
              kind={liveKind}
              schedule={schedule}
              timeZone={entry.timeZone}
              pickDay={pickDay}
              // A new event's day picked first: a title is what saves it (B-692).
              onFirstDayPick={() => titleInput.current?.focus()}
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
              <EntryActions
                kind={entry.kind}
                label={`Actions for this ${noun}`}
                onEdit={
                  canSetUp && asksScope(entry, new Date())
                    ? () => scope.ask(entry, "edit", { only: live.onlyThisVisit })
                    : undefined
                }
                cancel={
                  canSetUp && entry.kind === "event"
                    ? {
                        cancelled: !!entry.cancelledAt,
                        onCancel: () => scope.ask(entry, "cancel", { only: () => setConfirmCancel(true) }),
                        onUncancel: live.uncancel,
                        onReschedule: canReschedule(entry)
                          ? () => scope.ask(entry, "reschedule", { only: () => rescheduling.ask(entry) })
                          : undefined,
                      }
                    : undefined
                }
                onRemind={
                  canRemind(entry, new Date())
                    ? () => remind.ask({ id: entry.id, title: heading })
                    : undefined
                }
                // Everyone can print; writers delete any entry, an Easy helper their own.
                onPrint={() => window.print()}
                onDelete={
                  canWrite
                    ? () =>
                        scope.ask(entry, "delete", {
                          only: () => setConfirmDelete(true),
                          onlyChosen: () => void live.remove(),
                          done: live.leave,
                        })
                    : undefined
                }
              />
            </>
          )
        }
        editors={editors}
        via={entry.via && <ViaTag via={entry.via} />}
        repeat={<EntryRepeat live={live} />}
        with={
          !deleted && (
            <EntryWithRow
              entryId={entry.id}
              groupId={groupId}
              canWrite={canSetUp}
              title={currentTitle}
              ensureStored={live.ensureStored}
              pending={live.pendingProviders}
              onDropPending={live.dropProvider}
            />
          )
        }
        suggestion={
          canSetUp &&
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
              key={live.editRevision}
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
      {remind.sheet}
      {scope.element}
      <SeriesScopeDialog
        open={live.scopeAsked}
        action="edit"
        onChoose={live.chooseScope}
        onClose={() => live.chooseScope(null)}
      />
      {scope.error && <Message tone="error">{scope.error}</Message>}
    </>
  );
}
