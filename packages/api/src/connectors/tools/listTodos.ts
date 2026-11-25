import {
  assigneeOf,
  doneOrder,
  entryTodoService,
  isError,
  todoOrder,
  todoRepeatText,
  todoService,
  todoState,
} from "@caretook/data";
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
  mine: z.boolean().optional().describe("Only todos assigned to you."),
  ...pagingInput,
});

/** The group's to-do list: open todos by default, in the app's order. */
export const listTodos = defineTool({
  name: "list_todos",
  title: "List todos",
  description: `The care group's to-do list. Open todos by default, overdue first, then by due day and time, undated last; done ones from the last ${DEFAULT_DAYS_BACK} days with status done or all. Each has its assignee, due day and time (in the care recipient's zone), repeats (the rule in words, or null), the linked event (eventId, the first) and every linked note and event (linkedEntryIds), state (overdue, today, upcoming, undated, done) and who finished it. At most ${LIST_PAGE_MAX} a page; pass nextCursor back for more.`,
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
    const res = await todoService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(res)) return res;

    const status = args.status ?? "open";
    const since = daysAgo(ctx.now, DEFAULT_DAYS_BACK).getTime();
    const mineOnly = (t: (typeof res.data)[number]) => !args.mine || t.assigneeId === ctx.authUser.id;
    const open = todoOrder(
      res.data.filter((t) => !t.doneAt && mineOnly(t)),
      ctx.now,
      timeZone,
    );
    const done = doneOrder(
      res.data.filter((t) => t.doneAt && new Date(t.doneAt).getTime() >= since && mineOnly(t)),
    );
    const ordered = status === "open" ? open : status === "done" ? done : [...open, ...done];
    const page = pageOf(ordered, args);
    // Links are rows (planner-3): `eventId` stays, the first linked event.
    const linked = await entryTodoService.linkedEntriesOf(
      asMember(ctx),
      page.items.map((t) => t.id),
    );
    if (isError(linked)) return linked;

    const todos = page.items.map((t) => {
      const assignee = assigneeOf(t);
      const entries = linked.get(t.id) ?? [];
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
        repeats: todoRepeatText(t),
        state: todoState(t, ctx.now, timeZone),
        doneAt: zonedIsoOrNull(t.doneAt, timeZone),
        doneBy: t.doneBy ? (who.get(t.doneBy) ?? null) : null,
        providerId: t.providerId,
        medicationId: t.medicationId,
        eventId: entries.find((e) => e.kind === "event")?.entryId ?? null,
        linkedEntryIds: entries.map((e) => e.entryId),
        createdAt: zonedIso(t.createdAt, timeZone),
      };
    });

    const line = (t: (typeof todos)[number]) =>
      `- ${t.title} [${t.state}]${t.dueOn ? ` due ${t.dueOn}${t.dueTime ? ` ${t.dueTime}` : ""}` : ""}${t.assignee?.name ? ` (${t.assignee.name})` : ""}`;
    const text = todos.length
      ? [
          `${todos.length} todo${todos.length === 1 ? "" : "s"} (${timeZone}):`,
          ...todos.map(line),
          ...(page.nextCursor ? ["More: call again with nextCursor."] : []),
        ].join("\n")
      : status === "open"
        ? "No open todos."
        : "No todos.";
    return { text, structured: { timeZone, todos, nextCursor: page.nextCursor } };
  },
});
