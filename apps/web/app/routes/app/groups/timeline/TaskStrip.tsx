import type { TaskStripState } from "~/lib/tasks/taskStrip";

import { ListTodo } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { taskStripText, taskStripWho } from "~/lib/tasks/taskStrip";
import { STALE, STRIP_CAP, STRIP_CLASS, STRIP_ICON, STRIP_SKELETON } from "./layout";
import { useTaskStrip } from "./useTaskStrip";

const TONE: Record<TaskStripState, { box: string; icon: string }> = {
  today: { box: "border-warning/50 bg-warning/10", icon: "text-warning" },
  overdue: { box: "border-error/50 bg-error/10", icon: "text-error" },
};

/**
 * The task strip (after the medication strip, viewers too): one line while
 * the group has open tasks overdue or due today. "Overdue: Call pharmacy ·
 * +2 more" (red) or "Today: Pick up walker" (amber), naming my task first.
 * The title opens the Tasks list, on Mine when the named task is mine (else
 * Everyone, so it's there).
 *
 * It never pops in (the tile cache): what it showed earlier this session
 * paints at once, dimmed (`data-stale`) until the device confirms it; on a
 * first visit a skeleton holds its 32 px.
 */
export function TaskStrip({ groupId }: { groupId: string }) {
  const { strip, ready, fresh } = useTaskStrip(groupId);
  if (!ready) return <div className={STRIP_SKELETON} aria-hidden="true" data-strip-skeleton="tasks" />;
  if (!strip) return null;

  const { lead, title, rest, text } = taskStripText(strip);
  const tone = TONE[strip.state];
  return (
    <div className={`${STRIP_CAP} ${fresh ? "" : STALE}`} data-stale={fresh ? undefined : ""}>
      <section
        aria-label="Tasks"
        data-task-strip
        data-strip-state={strip.state}
        data-strip-task={strip.task.id}
        // The strip family's box, in this state's colours.
        className={STRIP_CLASS.replace("border-base-300 bg-base-100", tone.box)}
      >
        <ListTodo className={`${STRIP_ICON} ${tone.icon}`} aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate py-1" title={text}>
          <span className="font-semibold">{lead}:</span>{" "}
          <Link
            to={appUrls.tasks(groupId, { who: taskStripWho(strip) })}
            className="link font-medium"
            aria-label={`${text}: open Tasks`}
            data-task-strip-open
          >
            {title}
          </Link>
          {rest && <span data-strip-rest> · {rest}</span>}
        </p>
      </section>
    </div>
  );
}
