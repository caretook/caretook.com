import type { TimelineData } from "./useTimelineData";

import { useId, useState } from "react";
import { Link } from "react-router";
import { Chevron, Collapse, ICON_LG, LINK, Skeleton } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import {
  cancelledLabel,
  nextStripText,
  upcomingTitle,
  upcomingWhen,
} from "~/lib/appointments/upcomingLabels";
import { isPlannerTodo } from "~/lib/todos/plannerTodos";
import { dueText } from "~/lib/todos/todoDisplay";
import { useEasyUpcoming } from "./useEasyUpcoming";

const ITEM_LINK = "hover:bg-base-content/5 rounded-box -mx-2 block px-2 py-2";

/**
 * The next appointment, the Upcoming block's last line (B-191):
 * a button that opens the next five upcoming items under it, each a link to
 * its page, then "See all" to the Planner; another tap closes it. Closed on
 * every visit. The list mounts on the first open (its query waits until then)
 * and stays mounted, so closing can slide. Nothing when nothing is ahead.
 */
export function EasyNext({ next, now }: { next: TimelineData["next"]; now: Date }) {
  const group = useGroup();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const listId = useId();
  const text = nextStripText(next, now);
  if (!next.next || !text) return null;
  return (
    <div>
      <p className="text-xl" data-easy-next="">
        <button
          type="button"
          className="hover:text-muted inline-flex cursor-pointer items-center gap-1 text-left"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            setOpen((was) => !was);
            setOpened(true);
          }}
        >
          {text}
          <Chevron open={open} closed="down" className={ICON_LG} />
        </button>
      </p>
      <Collapse open={open} id={listId} data-easy-upcoming="">
        <div className="mt-2 space-y-2">{opened && <EasyUpcomingList groupId={group.id} />}</div>
      </Collapse>
    </div>
  );
}

/** The opened list: the next five, then See all. A skeleton until the device answers. */
function EasyUpcomingList({ groupId }: { groupId: string }) {
  const { items, ready, now, todoZone } = useEasyUpcoming(groupId);
  if (!ready)
    return (
      <div className="h-24">
        <Skeleton lines={4} />
      </div>
    );
  return (
    <>
      <ul aria-label="Next upcoming">
        {items.map((item) =>
          isPlannerTodo(item) ? (
            <li key={item.key} data-easy-upcoming-item={item.key}>
              <Link to={appUrls.todo(groupId, item.todo.id)} className={ITEM_LINK}>
                <span className="block text-xl font-medium break-words">{item.todo.title}</span>
                <span
                  className={`block text-base ${item.state === "overdue" ? "text-error-ink" : "text-muted"}`}
                >
                  {dueText(item.todo, now, todoZone)}
                </span>
              </Link>
            </li>
          ) : (
            <li key={item.id} data-easy-upcoming-item={item.id}>
              <Link to={appUrls.entry(groupId, item.id)} className={ITEM_LINK}>
                <span
                  className={`block text-xl font-medium break-words ${item.cancelledAt ? "line-through" : ""}`}
                >
                  {upcomingTitle(item)}
                </span>
                <span className="text-muted block text-base">
                  {[upcomingWhen(item, now), cancelledLabel(item)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
      <p className="text-xl">
        <Link to={appUrls.planner(groupId)} className={LINK} data-easy-upcoming-all="">
          See all
        </Link>
      </p>
    </>
  );
}
