import type { LinkedEntry } from "./useTodoEntryLinks";

import { CalendarClock, NotebookPen, X } from "lucide-react";
import { Link } from "react-router";
import { Badge, IconButton, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { formatTime } from "~/lib/core/format";
import { cancelledLabel, timeRange, upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { useEntryOpenerState } from "~/lib/timeline/entryOrigin";
import { linkedEntryName } from "~/lib/todos/entryTodoDisplay";

export const LINK_ROW = "hover:bg-base-200/50 relative isolate flex items-center gap-3 px-3 py-2.5";
export const STRETCHED =
  "block truncate font-medium outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2";

export function IconDot({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-full"
    >
      {children}
    </span>
  );
}

/** A link row's Remove (writers): unlinks it, leaving both sides. */
export function RemoveLink({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <IconButton
      label={`Remove link to ${name}`}
      icon={X}
      onPress={onRemove}
      className="relative z-10"
      data-todo-link-remove=""
    />
  );
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();
/** "Wed, Jun 9" in a zone (cached per zone). */
const shortDay = (iso: string, zone: string) => {
  let f = dayFormats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: zone,
    });
    dayFormats.set(zone, f);
  }
  return f.format(new Date(iso));
};

/**
 * A linked note or event: its name (an event's title; a note's title or
 * first line) opening its page (whose Back returns here, B-936), and its day; a cancelled event struck
 * through and labelled. Writers get Remove, which unlinks it and leaves
 * both the entry and the todo.
 */
export function EntryLinkRow({
  groupId,
  entry,
  text,
  onRemove,
}: {
  groupId: string;
  entry: LinkedEntry;
  /** The entry's document text (a note's first line comes from it). */
  text: string;
  /** Writers: unlink it. */
  onRemove?: () => void;
}) {
  const opener = useEntryOpenerState();
  const isEvent = entry.kind === "event";
  const cancelled = isEvent ? cancelledLabel(entry) : null;
  const name = isEvent ? upcomingTitle(entry) : linkedEntryName(entry, text);
  // Its day where it happens (an all-day one's own zone), with the time.
  const zone = entry.allDay ? entry.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = shortDay(entry.occurredAt, zone);
  const when = isEvent ? `${day} · ${timeRange(entry)}` : `${day} · ${formatTime(entry.occurredAt)}`;
  return (
    <li className={LINK_ROW} data-todo-link={entry.kind} data-cancelled={cancelled ? "" : undefined}>
      <IconDot>{isEvent ? <CalendarClock className="size-4" /> : <NotebookPen className="size-4" />}</IconDot>
      <div className="min-w-0 flex-1">
        <p className="text-muted text-sm">{isEvent ? "Event" : "Note"}</p>
        <Link
          to={appUrls.entry(groupId, entry.id)}
          state={opener}
          className={`${STRETCHED} ${cancelled ? "text-faint line-through" : ""}`}
          data-todo-link-name
        >
          {name}
        </Link>
        <p className="text-muted text-sm" data-todo-link-when>
          <span className={cancelled ? "line-through" : ""}>{when}</span>
          {cancelled && (
            <Badge tone={STATUS_TONE.past} className="ms-2 no-underline">
              {cancelled}
            </Badge>
          )}
        </p>
      </div>
      {onRemove && <RemoveLink name={name} onRemove={onRemove} />}
    </li>
  );
}
