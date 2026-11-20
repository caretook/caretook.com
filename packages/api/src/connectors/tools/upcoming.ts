import { dayInZone, endOfDay, isError, startOfDay } from "@caretook/data";
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
import { loadGroup, loadMembers } from "./shared";

const input = z.object({
  days: z
    .int()
    .min(1)
    .max(UPCOMING_MAX_DAYS)
    .optional()
    .describe(`How many days ahead (at most ${UPCOMING_MAX_DAYS}; default ${UPCOMING_DEFAULT_DAYS}).`),
});

/**
 * Appointments (events) and reminders (future notes) from now on, soonest
 * first, including one in progress and today's all-day items.
 */
export const upcoming = defineTool({
  name: "upcoming",
  title: "Upcoming appointments and reminders",
  description: `Upcoming appointments (events) and reminders (future notes), soonest first, with place, end time, text and whether one is cancelled. Includes what is happening now and today's all-day items. The next ${UPCOMING_DEFAULT_DAYS} days by default, at most ${UPCOMING_MAX_DAYS}; at most ${LIST_PAGE_MAX} items.`,
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
    const to = new Date(now + days * DAY_MS).toISOString();
    const found = await entriesBetween(ctx, { kinds: ["event", "note"], from, to });
    if (isError(found)) return found;

    const live = found.filter((e) => {
      const start = new Date(e.occurredAt).getTime();
      if (e.allDay) return now < endOfDay(start, e.timeZone);
      return start > now || (!!e.endsAt && new Date(e.endsAt).getTime() > now);
    });
    live.sort(
      (a, b) =>
        dayInZone(new Date(a.occurredAt), timeZone).localeCompare(
          dayInZone(new Date(b.occurredAt), timeZone),
        ) ||
        Number(!!b.allDay) - Number(!!a.allDay) ||
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() ||
        a.id.localeCompare(b.id),
    );

    const items = live.slice(0, LIST_PAGE_MAX).map((e) => ({
      id: e.id,
      kind: e.kind === "event" ? "appointment" : "reminder",
      title: e.title,
      text: e.body,
      startsAt: zonedIso(e.occurredAt, timeZone),
      endsAt: zonedIsoOrNull(e.endsAt, timeZone),
      allDay: e.allDay,
      inProgress: !e.allDay && new Date(e.occurredAt).getTime() <= now,
      place: e.place,
      cancelled: e.cancelledAt ? { at: zonedIso(e.cancelledAt, timeZone), reason: e.cancelReason } : null,
      author: e.createdBy ? (who.get(e.createdBy) ?? null) : null,
    }));

    const line = (i: (typeof items)[number]) =>
      `- ${i.allDay ? `${i.startsAt.slice(0, 10)} all day` : i.startsAt} ${i.kind}${i.title ? `: ${i.title}` : ""}${i.place ? ` at ${i.place}` : ""}${i.cancelled ? " (cancelled)" : ""}`;
    const text = items.length
      ? [
          `${items.length} upcoming in the next ${days} days (${timeZone}):`,
          ...items.map(line),
          ...(live.length > items.length
            ? [`Showing the first ${items.length}; narrow \`days\` for the rest.`]
            : []),
        ].join("\n")
      : `Nothing upcoming in the next ${days} days.`;
    return {
      text,
      structured: { timeZone, days, items, more: live.length > items.length },
    };
  },
});
