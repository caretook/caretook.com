import type { UnitChoices } from "@caretook/data/schema";
import type { LatestVital } from "~/lib/core/rpc";
import type { TimelineData } from "./useTimelineData";
import type { TodayStatus } from "./todayStatus";

import { formatReading } from "@caretook/data/schema";
import { localTimeZone } from "~/lib/core/format";
import { clockTime } from "~/lib/medications/medicationDisplay";
import { todayStatus, todaySummary } from "./todayStatus";
import { useMedicationStrip } from "./useMedicationStrip";
import { useTaskStrip } from "./useTaskStrip";
import { useTodayCardCollapsed } from "./useTodayCardCollapsed";

/**
 * The Today card's data: its four rows' contents and statuses, the collapsed
 * line, and the collapse switch (remembered on this device).
 *
 * - `vitals`: every type's newest reading, newest first (empty: no row);
 * - `next`: the next appointment or reminder (null: no row);
 * - `medications` and `tasks`: the strips' hooks, remembered for the session
 *   (`ready`: known, so a row or nothing; `fresh`: read live, else dimmed);
 * - `status`: each row's urgency (`todayStatus`), at the passes' clock;
 * - `empty`: every row known and none to show (the card hides).
 */
export function useTodayCard({
  groupId,
  latestVitals,
  next,
  units,
}: {
  groupId: string;
  latestVitals: LatestVital[];
  next: TimelineData["next"];
  units: UnitChoices;
}) {
  const medications = useMedicationStrip(groupId);
  const tasks = useTaskStrip(groupId);
  const [collapsed, setCollapsed] = useTodayCardCollapsed();
  const { now } = medications;
  const zone = localTimeZone();

  const vitals = [...latestVitals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const newest = vitals[0];
  const meds = medications.strip;
  const task = tasks.strip;

  const status: Record<"vitals" | "appointment" | "medications" | "tasks", TodayStatus> = {
    vitals: newest ? todayStatus({ kind: "vitals", latestAt: newest.occurredAt }, now, zone) : "neutral",
    appointment: next.next ? todayStatus({ kind: "appointment", entry: next.next }, now, zone) : "neutral",
    medications: meds
      ? todayStatus({ kind: "medications", dueAt: meds.tomorrow ? null : meds.pass.at }, now, zone)
      : "neutral",
    tasks: task ? todayStatus({ kind: "tasks", overdue: task.state === "overdue" }, now, zone) : "neutral",
  };

  const summary = todaySummary({
    vital: newest ? formatReading(newest.reading, units) : null,
    appointments: next.next ? next.more + 1 : 0,
    medications: meds && {
      state: meds.state,
      count: meds.state === "next" ? meds.pass.slots.length : meds.pass.open.length,
      time: clockTime(meds.pass.time),
    },
    tasks: task && { overdue: task.overdue, total: task.more + 1 },
  });

  const empty = !newest && !next.next && medications.ready && !meds && tasks.ready && !task;
  return { vitals, next, medications, tasks, status, summary, empty, collapsed, setCollapsed };
}

export type TodayCardData = ReturnType<typeof useTodayCard>;
