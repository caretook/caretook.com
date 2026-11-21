import type { UnitChoices } from "@caretook/data/schema";
import type { LatestVital } from "~/lib/core/rpc";
import type { TodaySummary } from "./todayStatus";
import type { TimelineData } from "./useTimelineData";

import { formatReading, VITALS } from "@caretook/data/schema";
import { CalendarClock, ChevronDown, ListTodo } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { formatAgo } from "~/lib/core/format";
import { nextStripText, upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { taskStripText, taskStripWho } from "~/lib/tasks/taskStrip";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { STRIP_CAP } from "./layout";
import { TodayMedicationsRow } from "./TodayMedicationsRow";
import { TodayRow, TodayRowSkeleton } from "./TodayRow";
import { useTodayCard } from "./useTodayCard";

const VitalsIcon = KIND_META.vital.Icon;

/**
 * The collapsed card's line: "3 overdue" in red and "2 due soon" in orange
 * first, never cut off, then the rest, cut off with an ellipsis when it
 * doesn't fit. Nothing when there's nothing to say.
 */
function SummaryLine({ summary: { overdue, soon, rest } }: { summary: TodaySummary }) {
  const parts = [
    overdue && { text: overdue, className: "text-error shrink-0 font-semibold", data: "overdue" },
    soon && { text: soon, className: "text-warning shrink-0 font-semibold", data: "soon" },
    rest && {
      text: rest,
      className: "text-base-content/70 min-w-0 overflow-hidden text-ellipsis",
      data: "rest",
    },
  ].filter((p) => !!p);
  if (!parts.length) return null;
  return (
    <span className="flex min-w-0 whitespace-pre" data-today-summary>
      {parts.map((p, i) => (
        <span key={p.data} className={p.className} data-summary-part={p.data}>
          {i > 0 && <span className="text-base-content/40"> · </span>}
          {p.text}
        </span>
      ))}
    </span>
  );
}

/**
 * The Today card (B-169), above the full timeline: one row each for the
 * latest vitals, the next appointment, the medications due and the tasks
 * overdue (or due today), each hidden when it has nothing, each tinted by its
 * status (`todayStatus`) and ending in "See all ›" to its full view (the
 * vitals row instead shows all its readings in place when they don't fit,
 * B-186). Its header collapses it to one line ("3 overdue · 2 due soon · BP
 * 130/85 mmHg · 1 appt"): collapsed on every load, a tap opening it for the
 * page view. Viewers see it too (without Given all). The whole card hides
 * once every row is known to be empty.
 */
export function TodayCard({
  groupId,
  canWrite,
  latestVitals,
  next,
  now,
  units,
}: {
  groupId: string;
  canWrite: boolean;
  latestVitals: LatestVital[];
  next: TimelineData["next"];
  /** The history's end: where "next" is worked out from. */
  now: Date;
  units: UnitChoices;
}) {
  const today = useTodayCard({ groupId, latestVitals, next, units });
  if (today.empty) return null;
  const { collapsed, status, tasks } = today;
  const nextText = nextStripText(next, now);
  const task = tasks.strip && { ...taskStripText(tasks.strip), strip: tasks.strip };

  return (
    <section
      aria-labelledby="today-card-heading"
      data-today-card
      data-collapsed={collapsed ? "" : undefined}
      className={`rounded-box border-base-300 bg-base-100 overflow-hidden border ${STRIP_CAP}`}
    >
      <h2 id="today-card-heading" className="text-sm">
        <button
          type="button"
          className="flex min-h-9 w-full items-center gap-2 px-3 text-left"
          aria-expanded={!collapsed}
          aria-controls="today-card-rows"
          onClick={() => today.setCollapsed(!collapsed)}
          data-today-toggle
        >
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="font-semibold">Today</span>
          {collapsed && <SummaryLine summary={today.summary} />}
        </button>
      </h2>
      <ul
        id="today-card-rows"
        hidden={collapsed}
        className="divide-base-300 border-base-300 divide-y border-t"
      >
        {today.vitals.length > 0 && (
          <TodayRow
            row="vitals"
            status={status.vitals}
            Icon={VitalsIcon}
            iconClass="text-secondary"
            expandable
          >
            <span className="sr-only">Latest vitals: </span>
            {today.vitals.map(({ reading, occurredAt }, i) => (
              <span key={reading.type} title={VITALS[reading.type].label} data-vital={reading.type}>
                {i > 0 && <span className="text-base-content/40"> · </span>}
                <span className="font-semibold tabular-nums">{formatReading(reading, units)}</span>{" "}
                <time dateTime={occurredAt} className="text-base-content/60 text-xs">
                  {formatAgo(occurredAt)}
                </time>
              </span>
            ))}
          </TodayRow>
        )}
        {next.next && nextText && (
          <TodayRow
            row="appointment"
            status={status.appointment}
            Icon={CalendarClock}
            seeAll={appUrls.upcoming(groupId)}
            seeAllLabel="See all upcoming"
          >
            <Link
              to={appUrls.entry(groupId, next.next.id)}
              className="link-hover"
              aria-label={`${nextText}: open ${upcomingTitle(next.next)}`}
              data-next={next.next.id}
            >
              {nextText}
            </Link>
          </TodayRow>
        )}
        <TodayMedicationsRow
          groupId={groupId}
          canWrite={canWrite}
          medications={today.medications}
          status={status.medications}
        />
        {!tasks.ready ? (
          <TodayRowSkeleton row="tasks" />
        ) : (
          task && (
            <TodayRow
              row="tasks"
              status={status.tasks}
              Icon={ListTodo}
              stale={!tasks.fresh}
              seeAll={appUrls.tasks(groupId, { who: taskStripWho(task.strip) })}
              seeAllLabel="See all tasks"
            >
              <span title={task.text} data-task={task.strip.task.id} data-task-state={task.strip.state}>
                <span className="font-semibold">{task.lead}:</span> {task.title}
                {task.rest && <span> · {task.rest}</span>}
              </span>
            </TodayRow>
          )
        )}
      </ul>
    </section>
  );
}
