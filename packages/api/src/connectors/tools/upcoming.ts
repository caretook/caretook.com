import { isError, todoService } from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso, zonedIsoOrNull } from "../time";
import {
  DAY_MS,
  entriesBetween,
  LIST_PAGE_MAX,
  UPCOMING_DEFAULT_DAYS,
  UPCOMING_MAX_DAYS,
} from "./readSupport";
import { asMember, loadGroup, loadMembers } from "./shared";
import {
  assigneeOf,
  dayInZone,
  endOfDay,
  startOfDay,
  todoRepeatText,
  todoState,
  upcomingListsSubtask,
} from "@caretook/data/domain";

const input = z.object({
  days: z
    .int()
    .min(1)
    .max(UPCOMING_MAX_DAYS)
    .optional()
    .describe(`How many days ahead (at most ${UPCOMING_MAX_DAYS}; default ${UPCOMING_DEFAULT_DAYS}).`),
});

/**
 * Events (appointments) and open todos from now on. Overdue todos come
 * first, then everything by day, an all-day or untimed item before a timed
 * one. Notes are past-only, so a note is never listed. A subtask lists only
 * when it's assigned or due before its parent (`upcomingListsSubtask`), with
 * its parent's title; one on its parent's day goes with the parent.
 */
export const upcoming = defineTool({
  name: "upcoming",
  title: "Upcoming events and todos",
  description: `Upcoming events (appointments) and open todos with a due day, overdue todos first, then by day and time; each item says whether it is an event or a todo. An event has place, end time, text and whether it is cancelled; a todo has its due day and time, assignee, if it repeats, how, and, for a step of another todo, the todo it is part of (partOf); a step is listed only when it is assigned or due before that todo. Includes what is happening now and today's all-day items. The next ${UPCOMING_DEFAULT_DAYS} days by default, at most ${UPCOMING_MAX_DAYS}; at most ${LIST_PAGE_MAX} items. Doses are not here: use todays_doses for today and dose_schedule for the days ahead.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const { timeZone } = loaded;
    const members = await loadMembers(ctx);
    if (isError(members)) return members;
    const who = new Map(members.map((m) => [m.id, m.name]));

    const days = args.days ?? UPCOMING_DEFAULT_DAYS;
    const now = ctx.now.getTime();
    // From the start of today, so one in progress and an all-day item are in.
    const from = startOfDay(dayInZone(ctx.now, timeZone), timeZone).toISOString();
    const end = new Date(now + days * DAY_MS);
    const to = end.toISOString();
    const found = await entriesBetween(ctx, { kinds: ["event"], from, to });
    if (isError(found)) return found;
    const todos = await todoService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(todos)) return todos;
    const lastDay = dayInZone(end, timeZone);

    const live = found.filter((e) => {
      const start = new Date(e.occurredAt).getTime();
      if (e.allDay) return now < endOfDay(start, e.timeZone);
      return start > now || (!!e.endsAt && new Date(e.endsAt).getTime() > now);
    });

    type Item =
      | {
          kind: "event";
          id: string;
          title: string | null;
          text: string | null;
          startsAt: string;
          endsAt: string | null;
          allDay: boolean;
          inProgress: boolean;
          place: string | null;
          cancelled: { at: string; reason: string | null } | null;
          author: string | null;
        }
      | {
          kind: "todo";
          id: string;
          title: string;
          dueOn: string;
          dueTime: string | null;
          overdue: boolean;
          assignee: { id: string | null; name: string | null } | null;
          repeats: string | null;
          partOf: { id: string; title: string } | null;
        };

    const events: Item[] = live.map((e) => ({
      id: e.id,
      kind: "event",
      title: e.title,
      text: e.body,
      startsAt: zonedIso(e.occurredAt, timeZone),
      endsAt: zonedIsoOrNull(e.endsAt, timeZone),
      allDay: !!e.allDay,
      inProgress: !e.allDay && new Date(e.occurredAt).getTime() <= now,
      place: e.place,
      cancelled: e.cancelledAt ? { at: zonedIso(e.cancelledAt, timeZone), reason: e.cancelReason } : null,
      author: e.createdBy ? (who.get(e.createdBy) ?? null) : null,
    }));
    const byId = new Map(todos.data.map((t) => [t.id, t]));
    const parentOf = (t: (typeof todos.data)[number]) => (t.parentId ? byId.get(t.parentId) : undefined);
    const todoItems: Item[] = todos.data
      .filter(
        (t) =>
          !t.doneAt && t.dueOn && t.dueOn <= lastDay && upcomingListsSubtask(t, parentOf(t)?.dueOn ?? null),
      )
      .map((t) => {
        const assignee = assigneeOf(t);
        const parent = parentOf(t);
        return {
          id: t.id,
          kind: "todo",
          title: t.title,
          dueOn: t.dueOn!,
          dueTime: t.dueTime,
          overdue: todoState(t, ctx.now, timeZone) === "overdue",
          assignee:
            assignee.type === "member"
              ? { id: assignee.userId, name: who.get(assignee.userId) ?? null }
              : assignee.type === "name"
                ? { id: null, name: assignee.name }
                : null,
          repeats: todoRepeatText(t),
          partOf: parent ? { id: parent.id, title: parent.title } : null,
        };
      });

    // Where an item sits in a day: all-day and untimed first, then by clock time.
    const day = (i: Item) => (i.kind === "todo" ? i.dueOn : i.startsAt.slice(0, 10));
    const clock = (i: Item) =>
      i.kind === "todo" ? (i.dueTime ?? "") : i.allDay ? "" : i.startsAt.slice(11, 16);
    const sorted = [...events, ...todoItems].sort(
      (a, b) =>
        Number(b.kind === "todo" && b.overdue) - Number(a.kind === "todo" && a.overdue) ||
        day(a).localeCompare(day(b)) ||
        clock(a).localeCompare(clock(b)) ||
        a.id.localeCompare(b.id),
    );
    const items = sorted.slice(0, LIST_PAGE_MAX);

    const line = (i: Item) =>
      i.kind === "todo"
        ? `- ${i.overdue ? "overdue " : ""}${i.dueOn}${i.dueTime ? ` ${i.dueTime}` : ""} todo: ${i.title}${i.partOf ? ` (part of ${i.partOf.title})` : ""}${i.assignee?.name ? ` (${i.assignee.name})` : ""}${i.repeats ? ` (repeats: ${i.repeats})` : ""}`
        : `- ${i.allDay ? `${i.startsAt.slice(0, 10)} all day` : i.startsAt} ${i.kind}${i.title ? `: ${i.title}` : ""}${i.place ? ` at ${i.place}` : ""}${i.cancelled ? " (cancelled)" : ""}`;
    const text = items.length
      ? [
          `${items.length} upcoming in the next ${days} days (${timeZone}):`,
          ...items.map(line),
          ...(sorted.length > items.length
            ? [`Showing the first ${items.length}; narrow \`days\` for the rest.`]
            : []),
        ].join("\n")
      : `Nothing upcoming in the next ${days} days.`;
    return {
      text,
      structured: { timeZone, days, items, more: sorted.length > items.length },
    };
  },
});
