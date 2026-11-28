import type { VisitPrepData, VisitWindow } from "~/lib/appointments/visitPrep";

import { useEffect, useMemo, useState } from "react";
import { cachedSettings } from "~/lib/app-shell/me";
import { getSync } from "~/lib/sync";
import {
  insertNoteSection,
  loadDocumentText,
  loadVisitPrepData,
  loadVisitWindow,
} from "~/lib/appointments/visitPrep.sync";
import { hasVisitPrep, visitPrepSection } from "~/lib/appointments/visitPrep";
import type { NoteSectionLine } from "@caretook/data/domain";

export type VisitPrepPreview = {
  /** The window it found (null while loading): its start is the field's first value. */
  found: VisitWindow | null;
  /** The recipient's zone, for the start field. */
  timeZone: string | null;
  /** When the preview was opened: the window's end, and the start field's latest. */
  now: Date;
  /** The section as it would go in (null while loading). */
  lines: NoteSectionLine[] | null;
  /** Moves the window's start (ISO 8601). */
  setFrom: (iso: string) => void;
  /** Puts the section at the top of the appointment's notes; resolves to an error message, or null. */
  insert: () => Promise<string | null>;
};

/**
 * The visit prep sheet's state: the appointment's window (since the last
 * visit with its providers), a start that can be moved, and the section for
 * it, read from local data each time the start moves. Data and callbacks only.
 */
export function useVisitPrepPreview(groupId: string, appointmentId: string): VisitPrepPreview {
  const [now] = useState(() => new Date());
  const [found, setFound] = useState<VisitWindow | null>(null);
  const [rerun, setRerun] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [data, setData] = useState<{ from: string; data: VisitPrepData } | null>(null);

  useEffect(() => {
    let live = true;
    const db = getSync();
    void Promise.all([loadVisitWindow(db, appointmentId, now), loadDocumentText(db, appointmentId)]).then(
      ([windowFound, text]) => {
        if (!live) return;
        setFound(windowFound);
        setRerun(hasVisitPrep(text));
      },
    );
    return () => {
      live = false;
    };
  }, [appointmentId, now]);

  const span = useMemo(() => (found ? { ...found, from: from ?? found.from } : null), [found, from]);

  useEffect(() => {
    if (!span) return;
    let live = true;
    const db = getSync();
    const units = cachedSettings(db.userId).units;
    void loadVisitPrepData(db, { groupId, appointmentId, window: span, units, now }).then((next) => {
      if (live) setData({ from: span.from, data: next });
    });
    return () => {
      live = false;
    };
  }, [groupId, appointmentId, span, now]);

  const lines = useMemo(
    () => (span && data?.from === span.from ? visitPrepSection(data.data, span, { rerun }) : null),
    [span, data, rerun],
  );

  return {
    found,
    timeZone: data?.data.timeZone ?? null,
    now,
    lines,
    setFrom: (iso) => {
      // A start after now would be an empty window.
      setFrom(new Date(iso).getTime() > now.getTime() ? now.toISOString() : iso);
    },
    insert: async () => {
      if (!lines) return "Still reading what happened. Try again in a moment.";
      const res = await insertNoteSection(getSync(), { groupId, entryId: appointmentId, lines });
      return res.ok ? null : res.error;
    },
  };
}
