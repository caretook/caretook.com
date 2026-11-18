import type * as Y from "yjs";
import type { TimelineEntryKind } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/api";
import type { MaterializeInput } from "~/lib/sync/liveEntry";
import type { EntryRow } from "~/lib/sync/timeline";
import type { EntryPageData } from "./loadEntry";

import { canHaveNoteDocument, noteText } from "@caretook/data/schema";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { isLiveEntryKind, savedTitle, shouldMaterialize } from "~/lib/liveEntry";
import { getSync, useLiveQuery } from "~/lib/sync";
import { materializeLiveEntry } from "~/lib/sync/liveEntry";
import { removeEntry, toTimelineEntry, updateEntry } from "~/lib/sync/timeline";
import { entrySql } from "./loadEntry";

export type LiveEntry = {
  /** The entry as it is now: the stored row (live), else the draft. */
  entry: { id: string; kind: TimelineEntryKind; title: string | null; occurredAt: string };
  /** Whether the entry is stored (false while it's a draft). */
  stored: boolean;
  /** Opened as `/entries/new` (stays true after the draft is saved). */
  isNew: boolean;
  /** Live: a role changed on another device shows without a reload. */
  canWrite: boolean;
  /** It was stored and is gone (deleted here or elsewhere). */
  deleted: boolean;
  /** For the editor: saves a draft on its first real change; resolves true once saved. Stable. */
  ensureSaved: (doc: Y.Doc) => Promise<boolean>;
  /** Saves a draft with this title, or renames the entry. */
  commitTitle: (title: string) => void;
  /** A draft keeps it as the time it's saved with; a stored entry is updated. */
  changeTime: (occurredAt: string) => void;
  /** Soft-deletes the entry, then goes back to the timeline. */
  remove: () => Promise<void>;
  /** The last failed write's message, cleared by the next one that works. */
  saveError: string | null;
};

/**
 * A live entry's state and writes: the stored entry (live), or a draft that
 * nothing is written for until its first real change (see lib/liveEntry.ts).
 * Then the entry and its document are saved together and the URL is
 * replaced with `/entries/:id`; the id never changes, so the page and its
 * editor stay mounted. Returns data and callbacks only.
 */
export function useLiveEntry(data: EntryPageData, groupId: string): LiveEntry {
  const { canWrite } = useGroup();
  const navigate = useNavigate();

  // The draft's fields, read when it's saved.
  const [draft] = useState(data.entry);
  const [isNew] = useState(data.isNew);

  // The stored entry, live: other members' renames, and deletion.
  const rows = useLiveQuery<EntryRow>(entrySql, [draft.id, groupId], data.entryRows);
  const live = rows[0] ? toTimelineEntry(rows[0]) : null;
  const [seen, setSeen] = useState(!!live);
  if (live && !seen) setSeen(true);
  const deleted = seen && !live;

  // Saving: once, on the first real change (text or a title).
  const saved = useRef(!isNew && data.hasDocument);
  const titleRef = useRef(draft.title ?? "");
  // A time picked on a draft is the time it's saved with.
  const [draftOccurredAt, setDraftOccurredAt] = useState(draft.occurredAt);
  const occurredAtRef = useRef(draft.occurredAt);
  const saving = useRef<Promise<boolean> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback((): Promise<boolean> => {
    if (saved.current) return Promise.resolve(true);
    saving.current ??= (async () => {
      if (!canHaveNoteDocument(draft.kind)) return false;
      const input: MaterializeInput = {
        id: draft.id,
        groupId,
        kind: draft.kind,
        title: isLiveEntryKind(draft.kind) ? savedTitle(draft.kind, titleRef.current) : draft.title,
        occurredAt: occurredAtRef.current,
        timeZone: draft.timeZone,
      };
      const res = await materializeLiveEntry(getSync(), input);
      saving.current = null;
      if (!res.ok) {
        setSaveError(res.error);
        return false;
      }
      setSaveError(null);
      saved.current = true;
      // Back from here goes to the timeline, and the link is the entry's own.
      if (isNew) void navigate(appUrls.entry(groupId, draft.id), { replace: true });
      return true;
    })();
    return saving.current;
  }, [draft, groupId, isNew, navigate]);

  // The editor asks on each local change until this says it's saved.
  const ensureSaved = useCallback(
    (doc: Y.Doc) => {
      if (saved.current) return Promise.resolve(true);
      // An existing entry only lacks its document: the text decides.
      const ready = shouldMaterialize({
        saved: false,
        text: noteText(doc),
        title: isNew ? titleRef.current : "",
      });
      return ready ? save() : Promise.resolve(false);
    },
    [save, isNew],
  );

  const kind = live?.kind ?? draft.kind;
  const reportWrite = (res: ActionResult) => setSaveError(res.ok ? null : res.error);

  const commitTitle = (next: string) => {
    titleRef.current = next;
    // A draft's title is saved with it. (An existing entry is renamed, even one still without its document.)
    if (isNew && !saved.current) {
      if (shouldMaterialize({ saved: false, text: "", title: next })) void save();
      return;
    }
    if (!isLiveEntryKind(kind)) return;
    void updateEntry(getSync(), draft.id, { title: savedTitle(kind, next) }).then(reportWrite);
  };

  const changeTime = (next: string) => {
    occurredAtRef.current = next;
    setDraftOccurredAt(next);
    if (!saved.current) return;
    void updateEntry(getSync(), draft.id, { occurredAt: next }).then(reportWrite);
  };

  const remove = async () => {
    const res = await removeEntry(getSync(), draft.id);
    if (!res.ok) return setSaveError(res.error);
    void navigate(appUrls.timeline(groupId));
  };

  return {
    entry: {
      id: draft.id,
      kind,
      title: live ? live.title : draft.title,
      occurredAt: live?.occurredAt ?? draftOccurredAt,
    },
    stored: !!live,
    isNew,
    canWrite,
    deleted,
    ensureSaved,
    commitTitle,
    changeTime,
    remove,
    saveError,
  };
}
