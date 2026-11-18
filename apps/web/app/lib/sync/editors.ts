import type { NoteEdit, RecentEditor } from "@caretook/data/schema";
import type { LiveDocument } from "../liveNow";
import type { LocalQuery } from "./timeline";

import {
  parseNoteEditors,
  RECENT_EDITORS_TICK_MS,
  RECENT_EDITORS_WINDOW_MS,
  recentEditors,
} from "@caretook/data/schema";
import { useEffect, useState } from "react";
import { liveDocuments } from "../liveNow";
import { useLiveQuery } from "./index";

// "Who's typing" on this device: each document's compacted `editors` plus
// its pending updates' authors, through the shared pure `recentEditors`.
// The entry page's avatars use `useRecentEditors`; the timeline's live dot
// and Live now banner use `useLiveDocuments` (`groupLiveEditorsQuery`), on
// the same `useNow` timer.

/** A document's `editors` (JSON text) and its pending updates' authors (a JSON array). */
export type EditorsRow = { id: string; editors: string | null; pending: string | null };

const editorsSelect = `SELECT d.id, d.editors,
         (SELECT json_group_array(json_object('createdBy', u.created_by, 'createdAt', u.created_at))
          FROM note_update u WHERE u.document_id = d.id) AS pending
       FROM note_document d`;

/** One document's editors row. */
export const documentEditorsQuery = (documentId: string): LocalQuery => ({
  sql: `${editorsSelect} WHERE d.id = ?`,
  params: [documentId],
});

const parsePending = (value: string | null): NoteEdit[] => {
  if (!value) return [];
  try {
    const rows = JSON.parse(value) as unknown;
    return Array.isArray(rows) ? (rows as NoteEdit[]).filter((r) => r && typeof r === "object") : [];
  } catch {
    return [];
  }
};

/** The row's recent editors other than the viewer, most recent first. */
export const toRecentEditors = (
  row: EditorsRow | undefined,
  {
    now,
    viewerId,
    windowMs = RECENT_EDITORS_WINDOW_MS,
  }: { now: number; viewerId: string; windowMs?: number },
): RecentEditor[] =>
  row
    ? recentEditors({
        editors: parseNoteEditors(row.editors),
        pending: parsePending(row.pending),
        now,
        windowMs,
        excludeUserId: viewerId,
      })
    : [];

/** `Date.now()`, refreshed every `tickMs`, so time-based signals expire without new rows. */
export const useNow = (tickMs = RECENT_EDITORS_TICK_MS) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  return now;
};

const NO_ROWS: EditorsRow[] = [];

/** Other members editing this document now, most recent first. Updates live, and expires on the timer. */
export const useRecentEditors = (documentId: string, viewerId: string) => {
  const query = documentEditorsQuery(documentId);
  const rows = useLiveQuery<EditorsRow>(query.sql, query.params, NO_ROWS);
  // A new edit can be up to a tick newer than `now`: still inside the window.
  const now = useNow();
  return toRecentEditors(rows[0], { now, viewerId });
};

/** A group document's editors row, with its entry's kind and title (live entries only). */
export type LiveEditorsRow = EditorsRow & { kind: string; title: string | null };

/** Every live (not deleted) note's and event's editors in the group, for the live dot and the Live now banner. */
export const groupLiveEditorsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT d.id, d.editors, e.kind, e.title,
         (SELECT json_group_array(json_object('createdBy', u.created_by, 'createdAt', u.created_at))
          FROM note_update u WHERE u.document_id = d.id) AS pending
       FROM note_document d JOIN timeline_entry e ON e.id = d.id
       WHERE d.group_id = ? AND e.deleted_at IS NULL`,
  params: [groupId],
});

const NO_LIVE_ROWS: LiveEditorsRow[] = [];

/**
 * The group's notes and events that other members are writing in now, the
 * most recently edited first (`liveDocuments`). Updates live, and expires on
 * the recent-editors timer. `titleOf` names an entry (a fallback for untitled notes).
 */
export const useLiveDocuments = (
  groupId: string,
  viewerId: string,
  titleOf: (row: LiveEditorsRow) => string,
): LiveDocument[] => {
  const query = groupLiveEditorsQuery(groupId);
  const rows = useLiveQuery<LiveEditorsRow>(query.sql, query.params, NO_LIVE_ROWS);
  const now = useNow();
  return liveDocuments(
    rows.map((row) => ({
      id: row.id,
      title: titleOf(row),
      editors: toRecentEditors(row, { now, viewerId }),
    })),
  );
};
