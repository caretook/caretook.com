import type { TimedEntry } from "../../../../lib/appointments/upcoming";

import { localDate } from "@caretook/data/schema";
import { entryTiming } from "../../../../lib/appointments/upcoming";
import { OVERDUE_AFTER_MINUTES } from "../../../../lib/medications/dueDoses";

// The Today card's rules (timeline-ux, B-169): how urgent each row is
// (`todayStatus`) and the collapsed card's one line (`todaySummary`). Pure;
// web:unit tests them.

/** A row's urgency: red, amber, blue, or none (daisyUI's `error`, `warning`, `info`). */
export type TodayStatus = "error" | "warning" | "info" | "neutral";

/** What `todayStatus` reads from each row. */
export type TodayRow =
  /** The newest of the latest vitals' readings. */
  | { kind: "vitals"; latestAt: string }
  /** The next appointment or reminder. */
  | { kind: "appointment"; entry: TimedEntry }
  /** The pass the row shows: its moment today, or null when it's tomorrow's (nothing left today). */
  | { kind: "medications"; dueAt: string | null }
  /** The task the row names, and whether it's overdue (else it's due today). */
  | { kind: "tasks"; overdue: boolean };

const HOUR = 3_600_000;
const MINUTE = 60_000;
/** Vitals turn amber once the newest reading is older than this. */
export const VITALS_STALE_MS = 24 * HOUR;
/** An appointment this close (or today) is blue. */
export const APPOINTMENT_SOON_MS = 2 * HOUR;

/**
 * A row's status at `now`, in the viewer's `timeZone` (an appointment's
 * "today"):
 *
 * - `error`: a dose overdue (`OVERDUE_AFTER_MINUTES` past its time, as the
 *   medication rules say) or an overdue task;
 * - `warning`: a dose due now (from its time until it's overdue), or vitals
 *   whose newest reading is more than a day old;
 * - `info`: an appointment in progress, starting within 2 hours, or today;
 * - otherwise `neutral`.
 */
export function todayStatus(
  row: TodayRow,
  now: Date | number,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): TodayStatus {
  const at = typeof now === "number" ? now : now.getTime();
  switch (row.kind) {
    case "vitals":
      return at - new Date(row.latestAt).getTime() > VITALS_STALE_MS ? "warning" : "neutral";
    case "medications": {
      if (!row.dueAt) return "neutral";
      const late = at - new Date(row.dueAt).getTime();
      if (late < 0) return "neutral";
      return late >= OVERDUE_AFTER_MINUTES * MINUTE ? "error" : "warning";
    }
    case "tasks":
      return row.overdue ? "error" : "neutral";
    case "appointment": {
      const { entry } = row;
      const timing = entryTiming(entry, new Date(at));
      if (timing === "past") return "neutral";
      if (timing === "now") return "info";
      // An all-day item's day is its own zone's.
      const day = localDate(entry.occurredAt, entry.allDay ? entry.timeZone : timeZone);
      if (day <= localDate(at, timeZone)) return "info";
      return !entry.allDay && new Date(entry.occurredAt).getTime() - at <= APPOINTMENT_SOON_MS
        ? "info"
        : "neutral";
    }
  }
}

/** What the collapsed card sums up, from the rows it would show (a missing part is a hidden row). */
export type TodaySummaryParts = {
  /** The newest reading, as the row words it ("BP 130/85 mmHg"). */
  vital?: string | null;
  /** How many appointments and reminders are ahead (the next one and the rest). */
  appointments?: number;
  /** The medications row: the pass's state and how many medications it still wants. */
  medications?: { state: "next" | "due" | "overdue"; count: number; time: string } | null;
  /** The tasks row: how many are overdue, and how many in all (overdue and due today). */
  tasks?: { overdue: number; total: number } | null;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The collapsed card's line: "BP 130/85 mmHg · 1 appt · 2 meds due · 1 task
 * overdue". Each row it would show adds its part, in the card's order; empty
 * with nothing to show.
 */
export function todaySummary({ vital, appointments, medications, tasks }: TodaySummaryParts): string {
  const parts: string[] = [];
  if (vital) parts.push(vital);
  if (appointments) parts.push(plural(appointments, "appt"));
  if (medications)
    parts.push(
      medications.state === "next"
        ? `Meds ${medications.time}`
        : `${plural(medications.count, "med")} ${medications.state}`,
    );
  if (tasks?.total)
    parts.push(
      tasks.overdue ? `${plural(tasks.overdue, "task")} overdue` : `${plural(tasks.total, "task")} today`,
    );
  return parts.join(" · ");
}
