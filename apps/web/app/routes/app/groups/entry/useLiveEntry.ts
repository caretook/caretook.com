import type * as Y from "yjs";
import type { TimelineEntryKind } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";
import type { Schedule } from "~/lib/appointments/entrySchedule";
import type { RepeatChoice } from "~/lib/appointments/repeatChoice";
import type { MaterializeInput } from "~/lib/live-notes/liveEntry.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { EntryPageData } from "./loadEntry";

import { canHaveNoteDocument, noteText } from "@caretook/data/schema";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { isLiveEntryKind, savedTitle, shouldMaterialize } from "~/lib/live-notes/liveEntry";
import { getSync, useLiveQuery } from "~/lib/sync";
import { cancelEvent, uncancelEvent } from "~/lib/appointments/appointments.sync";
import { draftTiming } from "~/lib/appointments/repeatChoice";
import { createSeries } from "~/lib/appointments/series.sync";
import { materializeLiveEntry } from "~/lib/live-notes/liveEntry.sync";
import { linkProvider } from "~/lib/providers/providers.sync";
import { removeEntry, toTimelineEntry, updateEntry } from "~/lib/timeline/timeline.sync";
import { entrySql } from "./loadEntry";

export type LiveEntry = {
  /** The entry as it is now: the stored row (live), else the draft. */
  entry: {
    id: string;
    kind: TimelineEntryKind;
    title: string | null;
    occurredAt: string;
    timeZone: string;
    endsAt: string | null;
    allDay: boolean;
    place: string | null;
    /** An event's cancel: when, by whom (the server's record) and why. */
    cancelledAt: string | null;
    cancelledBy: string | null;
    cancelReason: string | null;
    /** A cancelled event's new one, after a reschedule that kept it. */
    rescheduledTo: string | null;
    /** The member's AI assistant it was added through ("Claude"), or null. */
    via: string | null;
    /** The repeating series it's a visit of (appointments-2), or null. */
    seriesId: string | null;
  };
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
  /** When it is (start, end, all day): a draft keeps it to be saved with; a stored entry is updated. */
  changeSchedule: (schedule: Schedule) => void;
  /** An event's place (null clears it): a draft with a place is saved; a stored entry is updated. */
  commitPlace: (place: string | null) => void;
  /** Cancels a stored event, with an optional reason (it stays, marked Cancelled). */
  cancel: (reason: string) => void;
  /** Undoes a cancel. */
  uncancel: () => void;
  /** Soft-deletes the entry, then goes back to the timeline. */
  remove: () => Promise<void>;
  /** Saves a draft now (to link a provider to it); resolves true once it's stored. The editor stays mounted. */
  ensureStored: () => Promise<boolean>;
  /** The last failed write's message, cleared by the next one that works. */
  saveError: string | null;
  /** A new entry's repeat, chosen but not saved yet (a draft saves it as a series); null for none. */
  repeat: { choice: RepeatChoice; rule: string } | null;
  /**
   * Set how a new entry repeats (null: it doesn't). A draft keeps it and is
   * saved as a series; an entry already saved becomes the series' first visit now.
   */
  applyRepeat: (choice: RepeatChoice, rule: string | null) => void;
};

/**
 * A live entry's state and writes: the stored entry (live), or a draft that
 * nothing is written for until its first real change (see lib/live-notes/liveEntry.ts).
 * Then the entry and its document are saved together and the URL is
 * replaced with `/entries/:id`; the id never changes, so the page and its
 * editor stay mounted. Returns data and callbacks only.
 */
export function useLiveEntry(data: EntryPageData, groupId: string): LiveEntry {
  const { canWrite, recipient } = useGroup();
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
  // A time (or place) picked on a draft is what it's saved with.
  const initialSchedule: Schedule = { occurredAt: draft.occurredAt, endsAt: null, allDay: false };
  const [draftSchedule, setDraftSchedule] = useState(initialSchedule);
  const scheduleRef = useRef(initialSchedule);
  const [draftPlace, setDraftPlace] = useState<string | null>(null);
  const placeRef = useRef<string | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A repeat picked on a draft: the draft is saved as a series, and becomes its first visit.
  const [repeat, setRepeat] = useState<LiveEntry["repeat"]>(null);
  const repeatRef = useRef<string | null>(null);

  /** Make a series from this entry (its first visit keeps the entry's id), with the schedule, title and place given. */
  const startSeries = useCallback(
    async (rule: string, from: { schedule: Schedule; title: string | null; place: string | null }) => {
      if (!isLiveEntryKind(draft.kind)) return { ok: false as const, error: "Only notes and events repeat" };
      const timing = draftTiming(from.schedule, {
        entryTimeZone: draft.timeZone,
        recipientTimeZone: recipient?.timeZone ?? draft.timeZone,
      });
      return createSeries(
        getSync(),
        {
          groupId,
          kind: draft.kind,
          rule,
          ...timing,
          title: savedTitle(draft.kind, from.title ?? ""),
          place: draft.kind === "event" ? from.place : null,
          providerIds: data.withProvider ? [data.withProvider] : [],
        },
        { firstVisit: draft.id },
      );
    },
    [draft, groupId, recipient, data.withProvider],
  );

  const save = useCallback((): Promise<boolean> => {
    if (saved.current) return Promise.resolve(true);
    saving.current ??= (async () => {
      if (!canHaveNoteDocument(draft.kind)) return false;
      if (repeatRef.current) {
        const made = await startSeries(repeatRef.current, {
          schedule: scheduleRef.current,
          title: titleRef.current,
          place: placeRef.current,
        });
        saving.current = null;
        if (!made.ok) {
          setSaveError(made.error);
          return false;
        }
        setSaveError(null);
        saved.current = true;
        repeatRef.current = null;
        setRepeat(null);
        if (isNew) void navigate(appUrls.entry(groupId, draft.id), { replace: true });
        return true;
      }
      const input: MaterializeInput = {
        id: draft.id,
        groupId,
        kind: draft.kind,
        title: isLiveEntryKind(draft.kind) ? savedTitle(draft.kind, titleRef.current) : draft.title,
        occurredAt: scheduleRef.current.occurredAt,
        timeZone: draft.timeZone,
        allDay: scheduleRef.current.allDay,
        endsAt: draft.kind === "event" ? scheduleRef.current.endsAt : null,
        place: draft.kind === "event" ? placeRef.current : null,
      };
      const res = await materializeLiveEntry(getSync(), input);
      saving.current = null;
      if (!res.ok) {
        setSaveError(res.error);
        return false;
      }
      setSaveError(null);
      saved.current = true;
      // A new appointment from a provider's page is with them.
      if (data.withProvider) {
        const linked = await linkProvider(getSync(), draft.id, data.withProvider);
        if (!linked.ok) setSaveError(linked.error);
      }
      // Back from here goes to the timeline, and the link is the entry's own.
      if (isNew) void navigate(appUrls.entry(groupId, draft.id), { replace: true });
      return true;
    })();
    return saving.current;
  }, [draft, groupId, isNew, navigate, data.withProvider, startSeries]);

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

  const changeSchedule = (next: Schedule) => {
    scheduleRef.current = next;
    setDraftSchedule(next);
    // Picking a time alone never saves a draft, unless it's an appointment
    // with a provider (from their page): then it's ready to prepare.
    if (isNew && !saved.current) {
      if (data.withProvider) void save();
      return;
    }
    const { occurredAt, allDay, endsAt } = next;
    void updateEntry(getSync(), draft.id, {
      occurredAt,
      allDay,
      ...(kind === "event" && { endsAt }),
    }).then(reportWrite);
  };

  const commitPlace = (next: string | null) => {
    placeRef.current = next;
    setDraftPlace(next);
    // A typed place is a real change: a draft is saved with it.
    if (isNew && !saved.current) {
      if (next) void save();
      return;
    }
    void updateEntry(getSync(), draft.id, { place: next }).then(reportWrite);
  };

  const cancel = (reason: string) => void cancelEvent(getSync(), draft.id, reason).then(reportWrite);
  const uncancel = () => void uncancelEvent(getSync(), draft.id).then(reportWrite);

  const applyRepeat = (choice: RepeatChoice, rule: string | null) => {
    // Saved already (a title or text came first): it becomes the series' first visit now.
    if (rule && live && !live.seriesId) {
      const schedule = { occurredAt: live.occurredAt, endsAt: live.endsAt ?? null, allDay: !!live.allDay };
      void startSeries(rule, { schedule, title: live.title, place: live.place ?? null }).then((made) =>
        setSaveError(made.ok ? null : made.error),
      );
      return;
    }
    repeatRef.current = rule;
    setRepeat(rule ? { choice, rule } : null);
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
      timeZone: live?.timeZone ?? draft.timeZone,
      occurredAt: live?.occurredAt ?? draftSchedule.occurredAt,
      endsAt: live ? (live.endsAt ?? null) : draftSchedule.endsAt,
      allDay: live ? !!live.allDay : draftSchedule.allDay,
      place: live ? (live.place ?? null) : draftPlace,
      cancelledAt: live?.cancelledAt ?? null,
      cancelledBy: live?.cancelledBy ?? null,
      cancelReason: live?.cancelReason ?? null,
      rescheduledTo: live?.rescheduledTo ?? null,
      via: live?.via ?? null,
      seriesId: live?.seriesId ?? null,
    },
    stored: !!live,
    isNew,
    canWrite,
    deleted,
    ensureSaved,
    commitTitle,
    changeSchedule,
    commitPlace,
    cancel,
    uncancel,
    remove,
    ensureStored: save,
    saveError,
    repeat,
    applyRepeat,
  };
}
