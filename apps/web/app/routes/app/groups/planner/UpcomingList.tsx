import type { ReactNode } from "react";
import type { ActionResult } from "~/lib/core/api";
import type { TimelineEntry } from "~/lib/core/rpc";
import type { UpcomingListData } from "./useUpcomingData";

import { canTagRecord, resolveUnits } from "@caretook/data/schema";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  CancelEventDialog,
  EntryActions,
  useEventCancel,
  useEventReschedule,
  useRemindMe,
  useSeriesScope,
} from "~/components/entry";
import { TagChips, useTagPicker } from "~/components/tags";
import { TodoTree, useTodoTick } from "~/components/todos";
import { ConfirmDialog, EmptyState, Message, TITLE_SECTION } from "~/components/ui";
import { useVisitPrep } from "~/components/visitPrep";
import { appUrls } from "~/lib/app-shell/appUrls";
import { canRemind } from "~/lib/calendars/remindMe";
import { canReschedule } from "~/lib/appointments/eventReschedule";
import { asksScope, ONLY_THIS_VISIT_STATE } from "~/lib/appointments/seriesScope";
import { plannerReturnState } from "~/lib/appointments/plannerReturn";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { removeEntry } from "~/lib/timeline/timeline.sync";
import { isUpcoming } from "~/lib/appointments/upcoming";
import { isPlannerTree } from "~/lib/todos/plannerTodos";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { UpcomingRow } from "./UpcomingRow";
import { usePlannerOpener } from "./usePlannerOpener";

// The Planner tab lists notes and events only, which show no vital readings: the default units do.
const UNITS = resolveUnits(null);

const LIST_CLASS = "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border";

/**
 * Upcoming's (or the Past tab's) items, a section per day under a sticky
 * heading ("Now", "Today", "Tomorrow", "Friday, Nov 27"), with `empty`
 * when there are none. `children` comes after the last section (the Past
 * tab's paging). Each item shows its tags' chips. Each has a ⋯ menu: Tags
 * (the picker) for whoever may tag it; for writers, Prepare for an
 * upcoming appointment, Reschedule, then Cancel or Undo cancel for events,
 * Print, then Delete, with one Cancel and one Delete confirm for the list;
 * for viewers, Print. A series visit's Edit, Reschedule, Cancel and Delete
 * ask Only this visit or This and later visits first (`useSeriesScope`).
 * The Planner tab's sections can also hold todo trees, one per day
 * (`plannerDayTrees`; todo-subtasks-3): the shared `TodoTree`, its top row
 * in the `card` look (lined up with the day's events) and its steps
 * indented under it; a step due before its top-level todo shows under its
 * dimmed ancestors. Writers get each row's quick add. One tick for the list
 * (Undo in the route's `TodoUndoStatus`).
 * `readOnly` (the easy roles' Planner): no ⋯ menus and no filter links.
 */
export function UpcomingList({
  data,
  groupId,
  label,
  empty,
  children,
  readOnly = false,
}: {
  data: UpcomingListData;
  groupId: string;
  /** The list's name for screen readers ("Upcoming", "Past events"). */
  label: string;
  empty: string;
  children?: ReactNode;
  /** Only the rows: no menus or filter links (the easy roles). */
  readOnly?: boolean;
}) {
  const { canWrite, userId, role } = useGroup();
  const tagPicker = useTagPicker();
  const todoNameOf = (id: string) => (id === userId ? "you" : data.nameOf(id));
  const cancelling = useEventCancel();
  const rescheduling = useEventReschedule(groupId, canWrite);
  const remind = useRemindMe(groupId);
  const tick = useTodoTick(groupId);
  const [deleting, setDeleting] = useState<string | null>(null);
  // The last delete's refusal (no permission): a local write, so the list says so itself.
  const [removeError, setRemoveError] = useState<string | null>(null);
  const remove = (entryId: string) =>
    void removeEntry(getSync(), entryId).then((res: ActionResult) =>
      setRemoveError(res.ok ? null : res.error),
    );
  const scope = useSeriesScope(canWrite);
  const navigate = useNavigate();
  // The entry page goes back to this tab (B-690).
  const opener = usePlannerOpener(false);
  const prep = useVisitPrep(groupId, canWrite, { openAfter: true, openState: plannerReturnState(opener) });
  const preparable = (entry: TimelineEntry) =>
    entry.kind === "event" && !entry.cancelledAt && !entry.rescheduledTo && isUpcoming(entry, data.now);
  const menuOf = (entry: TimelineEntry) => (
    <EntryActions
      kind={entry.kind}
      label={`Actions for ${upcomingTitle(entry)}`}
      onEdit={
        canWrite && asksScope(entry, data.now)
          ? () =>
              scope.ask(entry, "edit", {
                only: () =>
                  void navigate(appUrls.entry(groupId, entry.id), {
                    state: plannerReturnState(opener, ONLY_THIS_VISIT_STATE),
                  }),
              })
          : undefined
      }
      onTags={
        canTagRecord(role, { target: "entry", createdBy: entry.createdBy }, userId)
          ? () => tagPicker.ask({ target: "entry", recordId: entry.id, label: upcomingTitle(entry) })
          : undefined
      }
      onPrepare={canWrite && preparable(entry) ? () => prep.ask(entry) : undefined}
      onRemind={
        canRemind(entry, data.now)
          ? () => remind.ask({ id: entry.id, title: upcomingTitle(entry) })
          : undefined
      }
      printHref={appUrls.printEntry(groupId, entry.id)}
      cancel={
        canWrite && entry.kind === "event"
          ? {
              cancelled: !!entry.cancelledAt,
              onCancel: () => scope.ask(entry, "cancel", { only: () => cancelling.ask(entry.id) }),
              onUncancel: () => cancelling.undo(entry.id),
              onReschedule: canReschedule(entry)
                ? () => scope.ask(entry, "reschedule", { only: () => rescheduling.ask(entry) })
                : undefined,
            }
          : undefined
      }
      onDelete={
        canWrite
          ? () =>
              scope.ask(entry, "delete", {
                only: () => setDeleting(entry.id),
                onlyChosen: () => remove(entry.id),
              })
          : undefined
      }
    />
  );

  return (
    <section aria-labelledby="upcoming-list-heading" className="space-y-4" data-upcoming-list>
      <h2 id="upcoming-list-heading" className="sr-only">
        {label}
      </h2>
      {(removeError || cancelling.error || scope.error || tick.error) && (
        <Message tone="error">{removeError ?? cancelling.error ?? scope.error ?? tick.error}</Message>
      )}
      {data.sections.length === 0 && <EmptyState data-empty="">{empty}</EmptyState>}
      {data.sections.map((section) => (
        <section key={section.key} aria-labelledby={`day-${section.key}`} data-day={section.key}>
          <h3
            id={`day-${section.key}`}
            className={`${TITLE_SECTION} bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur lg:text-lg`}
          >
            {section.label}
          </h3>
          <ol className={LIST_CLASS}>
            {section.items.map((entry) =>
              isPlannerTree(entry) ? (
                // A branch's dimmed top row is the list look: the card's padding is its own.
                <li
                  key={entry.key}
                  className={entry.tree.context ? "px-3" : ""}
                  data-planner-tree={entry.key}
                >
                  <TodoTree
                    trees={[entry.tree]}
                    look="card"
                    adding={!readOnly}
                    nameOf={todoNameOf}
                    now={data.now.getTime()}
                    timeZone={data.todoZone ?? "UTC"}
                    onTick={(todo, done) => void (done ? tick.complete(todo) : tick.reopen(todo))}
                    busy={tick.busy}
                    tagsOf={(id) => data.tagsOf("todo", id)}
                    progressOf={data.progressOf}
                  />
                </li>
              ) : (
                <UpcomingRow
                  key={entry.id}
                  entry={entry}
                  groupId={groupId}
                  now={data.now}
                  units={UNITS}
                  authorName={data.nameOf(entry.createdBy)}
                  authorImage={data.imageOf(entry.createdBy)}
                  contacts={data.contactsOf(entry.id)}
                  rescheduledTo={data.rescheduledOf(entry)}
                  tags={<TagChips tags={data.tagsOf("entry", entry.id)} className="mt-0.5" />}
                  menu={readOnly ? undefined : menuOf(entry)}
                  readOnly={readOnly}
                />
              ),
            )}
          </ol>
        </section>
      ))}
      {children}
      <CancelEventDialog open={cancelling.asking} onConfirm={cancelling.confirm} onClose={cancelling.close} />
      {rescheduling.sheet}
      {remind.sheet}
      {scope.element}
      {prep.sheet}
      {tagPicker.sheet}
      <ConfirmDialog
        open={!!deleting}
        title="Delete this entry?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove(deleting);
          setDeleting(null);
        }}
      />
    </section>
  );
}
