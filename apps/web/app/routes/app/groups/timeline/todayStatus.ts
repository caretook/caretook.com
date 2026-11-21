import type { TaskRuleFields } from "@caretook/data/schema";
import type { TimedEntry } from "../../../../lib/appointments/upcoming";
import type { DoseSlot } from "../../../../lib/medications/dueDoses";

import { localDate, localTime, taskState } from "@caretook/data/schema";
import { entryTiming } from "../../../../lib/appointments/upcoming";
import { OVERDUE_AFTER_MINUTES } from "../../../../lib/medications/dueDoses";

// The Today card's rules (timeline-ux, B-169): how urgent each row is
// (`todayStatus`), what's overdue and due soon (`attentionCounts`) and the
// collapsed card's one line (`todaySummary`). Pure; web:unit tests them.

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
  /** Whether the task the row names is overdue (else it's due today). */
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

/** "Due soon": due now, or due within this long (doses, tasks and appointments alike). */
export const SOON_MS = HOUR;

/** A task due today without a time counts as due at this wall-clock time, in the recipient's zone. */
export const UNTIMED_TASK_TIME = "19:00";

/** What the collapsed card leads with, by kind: how many are overdue and how many due soon. */
export type AttentionCounts = {
  doses: { overdue: number; soon: number };
  tasks: { overdue: number; soon: number };
  /** The next appointment, in progress or starting within `SOON_MS` (0 or 1). */
  appointments: { soon: number };
};

const minutesOf = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * How many things are overdue and due soon at `now`, for the collapsed
 * card's red and orange counts:
 *
 * - doses: today's slots overdue (red); due, or upcoming within `SOON_MS` (orange);
 * - tasks (overdue or due today): overdue (red); due today within
 *   `SOON_MS`, or already past its time (orange). One without a time is due
 *   at `UNTIMED_TASK_TIME`, in the recipient's zone (`timeZone`);
 * - the next appointment: in progress, or starting within `SOON_MS`
 *   (orange); an all-day item has no start, so it never counts.
 */
export function attentionCounts({
  doses,
  tasks,
  appointment,
  now,
  timeZone,
}: {
  doses: readonly Pick<DoseSlot, "state" | "at">[];
  tasks: readonly Pick<TaskRuleFields, "doneAt" | "dueOn" | "dueTime">[];
  appointment: TimedEntry | null;
  now: Date | number;
  timeZone: string;
}): AttentionCounts {
  const at = typeof now === "number" ? now : now.getTime();
  const counts: AttentionCounts = {
    doses: { overdue: 0, soon: 0 },
    tasks: { overdue: 0, soon: 0 },
    appointments: { soon: 0 },
  };
  for (const slot of doses) {
    if (slot.state === "overdue") counts.doses.overdue++;
    else if (slot.state === "due") counts.doses.soon++;
    else if (slot.state === "upcoming" && new Date(slot.at).getTime() - at <= SOON_MS) counts.doses.soon++;
  }
  const clock = minutesOf(localTime(at, timeZone));
  for (const task of tasks) {
    const state = taskState(task, at, timeZone);
    if (state === "overdue") counts.tasks.overdue++;
    else if (state === "today" && minutesOf(task.dueTime ?? UNTIMED_TASK_TIME) - clock <= SOON_MS / MINUTE)
      counts.tasks.soon++;
  }
  if (appointment) {
    const timing = entryTiming(appointment, new Date(at));
    if (
      timing === "now" ||
      (timing === "upcoming" &&
        !appointment.allDay &&
        new Date(appointment.occurredAt).getTime() - at <= SOON_MS)
    )
      counts.appointments.soon = 1;
  }
  return counts;
}

/** What the collapsed card sums up, from the rows it would show (a missing part is a hidden row). */
export type TodaySummaryParts = {
  /** What's overdue and due soon (`attentionCounts`): it leads the line, and isn't repeated after. */
  counts: AttentionCounts;
  /** The newest reading, as the row words it ("BP 130/85 mmHg"). */
  vital?: string | null;
  /** How many appointments and reminders are ahead (the next one and the rest). */
  appointments?: number;
  /** The next pass's time ("20:00"), while nothing is overdue or due soon. */
  medications?: string | null;
  /** How many tasks the row counts (overdue and due today). */
  tasks?: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The collapsed card's line, in three parts: `overdue` ("3 overdue", red)
 * and `soon` ("2 due soon", orange) lead so they're never cut off, then
 * `rest` ("BP 130/85 mmHg · 1 appt · Meds 20:00 · 1 task today"), in the
 * card's order, without what the counts already hold. A part with nothing
 * to say is null (`rest` is "").
 */
export function todaySummary({ counts, vital, appointments = 0, medications, tasks = 0 }: TodaySummaryParts) {
  const overdue = counts.doses.overdue + counts.tasks.overdue;
  const soon = counts.doses.soon + counts.tasks.soon + counts.appointments.soon;
  const rest: string[] = [];
  if (vital) rest.push(vital);
  const appts = appointments - counts.appointments.soon;
  if (appts > 0) rest.push(plural(appts, "appt"));
  if (medications && !counts.doses.overdue && !counts.doses.soon) rest.push(`Meds ${medications}`);
  const today = tasks - counts.tasks.overdue - counts.tasks.soon;
  if (today > 0) rest.push(`${plural(today, "task")} today`);
  return {
    overdue: overdue ? `${overdue} overdue` : null,
    soon: soon ? `${soon} due soon` : null,
    rest: rest.join(" · "),
  };
}

export type TodaySummary = ReturnType<typeof todaySummary>;
