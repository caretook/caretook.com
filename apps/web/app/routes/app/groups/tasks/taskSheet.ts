import type { AssigneeMember } from "./assigneeOptions";
import type { SyncDb } from "~/lib/sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { medicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { taskEventChoicesQuery } from "~/lib/tasks/tasks.sync";
import { membersQuery, readRows, toTimelineEntries } from "~/lib/timeline/timeline.sync";
import { listSearch, openedFromApp } from "~/lib/tasks/taskSheets";
import { RECENT_EVENT_DAYS } from "./taskLinks";

// Sheets over the task list are child routes (`tasks/new`,
// `tasks/:taskId/edit`): the list stays mounted underneath, with its chip
// and scroll position. Like the medication list's sheets.

/**
 * Close the sheet by leaving its route: back, when it was opened by one of
 * the app's links; otherwise (a bookmark, a reload) the list replaces it,
 * with its chip kept. Only the first call counts.
 */
export function useCloseTaskSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const { search } = location;
  const { id } = useGroup();
  const closed = useRef(false);
  return useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (openedFromApp(state)) void navigate(-1);
    else void navigate(appUrls.tasks(id, listSearch(search)), { replace: true, preventScrollReset: true });
  }, [navigate, state, search, id]);
}

/** The group's members as the sheet's loader reads them, so the first render has them. */
export const loadMembers = (db: SyncDb, groupId: string) => readRows<MemberRow>(db, membersQuery(groupId));

/** Who a task can be assigned to, live: the group's members. */
export function useAssigneeMembers(groupId: string, initial: MemberRow[]): AssigneeMember[] {
  const q = membersQuery(groupId);
  const rows = useLiveQuery<MemberRow>(q.sql, q.params, initial);
  return useMemo(() => rows.map((r) => ({ userId: r.user_id, name: r.name })), [rows]);
}

// --- Link choices (tasks slice 3) -------------------------------------------

/** What the task form's link pickers read: providers and medications (deleted too, for a chosen one's chip) and recent and upcoming events. */
export type LinkChoiceRows = {
  providerRows: ProviderRow[];
  medicationRows: MedicationRow[];
  eventRows: EntryRow[];
  /** The earliest event the appointment picker reads (ISO 8601): 30 days back from when the sheet opened. */
  eventsFrom: string;
  chosenEventId: string | null;
};

/** The pickers' rows as the sheet's loader reads them, so the first render has them. */
export const loadLinkChoices = async (
  db: SyncDb,
  groupId: string,
  chosenEventId: string | null,
  now = Date.now(),
): Promise<LinkChoiceRows> => {
  const eventsFrom = new Date(now - RECENT_EVENT_DAYS * 86_400_000).toISOString();
  const [providerRows, medicationRows, eventRows] = await Promise.all([
    readRows<ProviderRow>(db, providersQuery(groupId, { includeDeleted: true })),
    readRows<MedicationRow>(db, medicationsQuery(groupId, { includeDeleted: true })),
    readRows<EntryRow>(db, taskEventChoicesQuery(groupId, eventsFrom, chosenEventId)),
  ]);
  return { providerRows, medicationRows, eventRows, eventsFrom, chosenEventId };
};

/** The pickers' choices, live: a provider added on another device shows while the sheet is open. */
export function useLinkChoices(groupId: string, initial: LinkChoiceRows) {
  const pq = providersQuery(groupId, { includeDeleted: true });
  const mq = medicationsQuery(groupId, { includeDeleted: true });
  const evq = taskEventChoicesQuery(groupId, initial.eventsFrom, initial.chosenEventId);
  const providerRows = useLiveQuery<ProviderRow>(pq.sql, pq.params, initial.providerRows);
  const medicationRows = useLiveQuery<MedicationRow>(mq.sql, mq.params, initial.medicationRows);
  const eventRows = useLiveQuery<EntryRow>(evq.sql, evq.params, initial.eventRows);
  return useMemo(
    () => ({
      providers: toProviders(providerRows),
      medications: toMedications(medicationRows),
      events: toTimelineEntries(eventRows),
    }),
    [providerRows, medicationRows, eventRows],
  );
}

export type LinkChoices = ReturnType<typeof useLinkChoices>;
