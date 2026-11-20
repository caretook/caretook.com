import { assigneeOf, doneOrder, isError, taskOrder, taskService, taskState } from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso, zonedIsoOrNull } from "../time";
import { DEFAULT_DAYS_BACK, daysAgo, LIST_PAGE_MAX, pageOf, pagingInput } from "./readSupport";
import { asMember, loadGroup, loadMembers } from "./shared";

const input = z.object({
  status: z
    .enum(["open", "done", "all"])
    .optional()
    .describe(
      `open (the default), done (finished in the last ${DEFAULT_DAYS_BACK} days, newest first) or all.`,
    ),
  mine: z.boolean().optional().describe("Only tasks assigned to you."),
  ...pagingInput,
});

/** The group's to-do list: open tasks by default, in the app's order. */
export const listTasks = defineTool({
  name: "list_tasks",
  title: "List tasks",
  description: `The care group's to-do list. Open tasks by default, overdue first, then by due day and time, undated last; done ones from the last ${DEFAULT_DAYS_BACK} days with status done or all. Each has its assignee, due day and time (in the care recipient's zone), state (overdue, today, upcoming, undated, done) and who finished it. At most ${LIST_PAGE_MAX} a page; pass nextCursor back for more.`,
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
    const res = await taskService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(res)) return res;

    const status = args.status ?? "open";
    const since = daysAgo(ctx.now, DEFAULT_DAYS_BACK).getTime();
    const mineOnly = (t: (typeof res.data)[number]) => !args.mine || t.assigneeId === ctx.authUser.id;
    const open = taskOrder(
      res.data.filter((t) => !t.doneAt && mineOnly(t)),
      ctx.now,
      timeZone,
    );
    const done = doneOrder(
      res.data.filter((t) => t.doneAt && new Date(t.doneAt).getTime() >= since && mineOnly(t)),
    );
    const ordered = status === "open" ? open : status === "done" ? done : [...open, ...done];
    const page = pageOf(ordered, args);

    const tasks = page.items.map((t) => {
      const assignee = assigneeOf(t);
      return {
        id: t.id,
        title: t.title,
        assignee:
          assignee.type === "member"
            ? { id: assignee.userId, name: who.get(assignee.userId) ?? null }
            : assignee.type === "name"
              ? { id: null, name: assignee.name }
              : null,
        dueOn: t.dueOn,
        dueTime: t.dueTime,
        state: taskState(t, ctx.now, timeZone),
        doneAt: zonedIsoOrNull(t.doneAt, timeZone),
        doneBy: t.doneBy ? (who.get(t.doneBy) ?? null) : null,
        providerId: t.providerId,
        medicationId: t.medicationId,
        eventId: t.eventId,
        createdAt: zonedIso(t.createdAt, timeZone),
      };
    });

    const line = (t: (typeof tasks)[number]) =>
      `- ${t.title} [${t.state}]${t.dueOn ? ` due ${t.dueOn}${t.dueTime ? ` ${t.dueTime}` : ""}` : ""}${t.assignee?.name ? ` (${t.assignee.name})` : ""}`;
    const text = tasks.length
      ? [
          `${tasks.length} task${tasks.length === 1 ? "" : "s"} (${timeZone}):`,
          ...tasks.map(line),
          ...(page.nextCursor ? ["More: call again with nextCursor."] : []),
        ].join("\n")
      : status === "open"
        ? "No open tasks."
        : "No tasks.";
    return { text, structured: { timeZone, tasks, nextCursor: page.nextCursor } };
  },
});
