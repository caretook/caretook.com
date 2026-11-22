import type { SeriesRow } from "~/lib/appointments/series.sync";
import type { LiveEntry } from "./useLiveEntry";

import { repeatText } from "@caretook/data/schema";
import { Repeat } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { RepeatMark } from "~/components/entry";
import { useGroup } from "~/lib/app-shell/group";
import { defaultChoice, draftTiming } from "~/lib/appointments/repeatChoice";
import { seriesQuery, toRepeatInput } from "~/lib/appointments/series.sync";
import { useLiveQuery } from "~/lib/sync";

// The field's preview needs rrule: its folder loads only when Repeat opens.
const RepeatSheet = lazy(() => import("~/components/repeat").then((m) => ({ default: m.RepeatSheet })));

/** Stable: useLiveQuery restarts on a new starting array. */
const NO_ROWS: SeriesRow[] = [];

/**
 * How the entry repeats (appointments-2), under its time. A series visit
 * shows its rule in words ("Every Mon, Wed, Fri at 6:00"), for viewers too.
 * A new note or event (writers) gets a Repeat button that opens the repeat
 * sheet; a repeat chosen on a draft shows here until the draft is saved as
 * a series.
 */
export function EntryRepeat({ live }: { live: LiveEntry }) {
  const { entry, canSetUp, isNew, deleted, repeat } = live;
  const { recipient } = useGroup();
  const [open, setOpen] = useState(false);
  const query = seriesQuery(entry.seriesId);
  const rows = useLiveQuery<SeriesRow>(query.sql, query.params, NO_ROWS);
  if (deleted || (entry.kind !== "event" && entry.kind !== "note")) return null;

  if (entry.seriesId) {
    const series = toRepeatInput(rows[0]);
    return (
      <p className="text-base-content/70 flex items-center gap-1 text-sm" data-repeat-text>
        <RepeatMark seriesId={entry.seriesId} />
        <span>{series ? repeatText(series) : "Repeats"}</span>
      </p>
    );
  }
  // Series are events only: a note has no Repeat.
  if (!canSetUp || !isNew || entry.kind !== "event") return null;
  const kind = "event";

  const schedule = { occurredAt: entry.occurredAt, endsAt: entry.endsAt, allDay: entry.allDay };
  const timing = draftTiming(schedule, {
    entryTimeZone: entry.timeZone,
    recipientTimeZone: recipient?.timeZone ?? entry.timeZone,
  });
  const label = repeat ? repeatText({ ...timing, rule: repeat.rule, kind }) : "Doesn't repeat";

  return (
    <>
      <button
        type="button"
        className="badge badge-ghost hover:bg-base-300 h-auto cursor-pointer gap-1 py-0.5"
        aria-label={`Repeat: ${label}`}
        onClick={() => setOpen(true)}
        data-repeat-button
      >
        <Repeat className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <RepeatSheet
            initial={repeat?.choice ?? defaultChoice(timing.startsOn)}
            timing={timing}
            kind={kind}
            onClose={() => setOpen(false)}
            onDone={(choice, rule) => {
              setOpen(false);
              live.applyRepeat(choice, rule);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
