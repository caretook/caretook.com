import type { TimelineData } from "./useTimelineData";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import {
  cancelledLabel,
  nextStripText,
  upcomingTitle,
  upcomingWhen,
} from "~/lib/appointments/upcomingLabels";
import { isUpcomingTask } from "~/lib/tasks/upcomingTasks";
import { dueText } from "~/lib/tasks/taskDisplay";
import { useSimpleUpcoming } from "./useSimpleUpcoming";

const ITEM_LINK = "hover:bg-base-content/5 rounded-box -mx-2 block px-2 py-2";

/**
 * The next appointment or reminder, the Upcoming block's last line (B-191):
 * a button that opens the next five upcoming items under it, each a link to
 * its page, then "See all" to Upcoming; another tap closes it. Closed on
 * every visit. Nothing when nothing is ahead.
 */
export function SimpleNext({ next, now }: { next: TimelineData["next"]; now: Date }) {
  const group = useGroup();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const text = nextStripText(next, now);
  if (!next.next || !text) return null;
  return (
    <div>
      <p className="text-xl" data-simple-next="">
        <button
          type="button"
          className="hover:text-base-content/80 inline-flex cursor-pointer items-center gap-1 text-left"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((was) => !was)}
        >
          {text}
          <ChevronDown
            aria-hidden="true"
            className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </p>
      <div id={listId} hidden={!open} className="mt-2 space-y-2" data-simple-upcoming="">
        {open && <SimpleUpcomingList groupId={group.id} />}
      </div>
    </div>
  );
}

/** The opened list: the next five, then See all. A skeleton until the device answers. */
function SimpleUpcomingList({ groupId }: { groupId: string }) {
  const { items, ready, now, taskZone } = useSimpleUpcoming(groupId);
  if (!ready) return <div className="skeleton rounded-box h-24" aria-hidden="true" />;
  return (
    <>
      <ul aria-label="Next upcoming">
        {items.map((item) =>
          isUpcomingTask(item) ? (
            <li key={item.key} data-simple-upcoming-item={item.key}>
              <Link to={appUrls.task(groupId, item.task.id)} className={ITEM_LINK}>
                <span className="block text-xl font-medium break-words">{item.task.title}</span>
                <span
                  className={`block text-base ${item.state === "overdue" ? "text-error" : "text-base-content/70"}`}
                >
                  {dueText(item.task, now, taskZone)}
                </span>
              </Link>
            </li>
          ) : (
            <li key={item.id} data-simple-upcoming-item={item.id}>
              <Link to={appUrls.entry(groupId, item.id)} className={ITEM_LINK}>
                <span
                  className={`block text-xl font-medium break-words ${item.cancelledAt ? "line-through" : ""}`}
                >
                  {upcomingTitle(item)}
                </span>
                <span className="text-base-content/70 block text-base">
                  {[upcomingWhen(item, now), cancelledLabel(item)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
      <p className="text-xl">
        <Link to={appUrls.upcoming(groupId)} className="link" data-simple-upcoming-all="">
          See all
        </Link>
      </p>
    </>
  );
}
