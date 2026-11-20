import type { AssigneeMember } from "./assigneeOptions";
import type { SyncDb } from "~/lib/sync";
import type { MemberRow } from "~/lib/sync/timeline";

import { useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { useLiveQuery } from "~/lib/sync";
import { membersQuery, readRows } from "~/lib/sync/timeline";
import { listSearch, openedFromApp } from "~/lib/taskSheets";

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
