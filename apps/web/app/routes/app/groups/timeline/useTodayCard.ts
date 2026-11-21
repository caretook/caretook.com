import type { UnitChoices } from "@caretook/data/schema";
import type { LatestVital } from "~/lib/core/rpc";
import type { TimelineData } from "./useTimelineData";
import type { TodayRow, TodayStatus } from "./todayStatus";

import { formatReading } from "@caretook/data/schema";
import { useState } from "react";
import { localTimeZone } from "~/lib/core/format";
import { clockTime } from "~/lib/medications/medicationDisplay";
import { attentionCounts, todayStatus, todaySummary } from "./todayStatus";
import { useMedicationStrip } from "./useMedicationStrip";
import { useTaskStrip } from "./useTaskStrip";

/**
 * The Today card's data: its four rows' contents and statuses, the collapsed
 * line, and the collapse switch (collapsed on every load, the server's
 * render too; a tap opens it until the page is left or reloaded).
 *
 * - `vitals`: every type's newest reading, newest first (empty: no row);
 * - `next`: the next appointment or reminder (null: no row);
 * - `medications` and `tasks`: the strips' hooks, remembered for the session
 *   (`ready`: known, so a row or nothing; `fresh`: read live, else dimmed);
 * - `status`: each row's urgency (`todayStatus`), at the passes' clock;
 * - `summary`: the collapsed line (`todaySummary`): overdue and due-soon
 *   counts first (`attentionCounts`), then the rest;
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
  const { now } = medications;
  const zone = localTimeZone();

  const vitals = [...latestVitals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const newest = vitals[0];
  const meds = medications.strip;
  const task = tasks.strip;

  const rows = {
    vitals: newest && { kind: "vitals", latestAt: newest.occurredAt },
    appointment: next.next && { kind: "appointment", entry: next.next },
    medications: meds && { kind: "medications", dueAt: meds.tomorrow ? null : meds.pass.at },
    tasks: task && { kind: "tasks", overdue: task.state === "overdue" },
  } satisfies Record<string, TodayRow | null | undefined>;
  const status: Record<keyof typeof rows, TodayStatus> = {
    vitals: rows.vitals ? todayStatus(rows.vitals, now, zone) : "neutral",
    appointment: rows.appointment ? todayStatus(rows.appointment, now, zone) : "neutral",
    medications: rows.medications ? todayStatus(rows.medications, now, zone) : "neutral",
    tasks: rows.tasks ? todayStatus(rows.tasks, now, zone) : "neutral",
  };
  const [collapsed, setCollapsed] = useState(true);

  const summary = todaySummary({
    counts: attentionCounts({
      doses: medications.ready ? medications.slots : [],
      tasks: tasks.ready ? tasks.tasks : [],
      appointment: next.next,
      now,
      timeZone: tasks.timeZone,
    }),
    vital: newest ? formatReading(newest.reading, units) : null,
    appointments: next.next ? next.more + 1 : 0,
    medications: meds && meds.state === "next" ? clockTime(meds.pass.time) : null,
    tasks: task ? task.more + 1 : 0,
  });

  const empty = !newest && !next.next && medications.ready && !meds && tasks.ready && !task;
  return { vitals, next, medications, tasks, status, summary, empty, collapsed, setCollapsed };
}

export type TodayCardData = ReturnType<typeof useTodayCard>;
