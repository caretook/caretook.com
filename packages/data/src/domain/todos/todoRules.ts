import { WRITER_ROLES, completesOnlyAssigned, hasGroupRole } from "../../constants/roles";
import { repeatText } from "../appointments/repeatRule";
import { localDate } from "../core/entryTiming";

// The todos' pure rules (client-safe): the one place that says what state a
// todo is in, how lists are ordered, who may complete one, and who it's
// assigned to. The device, the screens and the service all lean on these.
//
// The due day and time are wall-clock in the recipient's zone (like
// medication slots): "Friday 17:00" stays Friday 17:00 across a DST change
// and when the recipient's zone changes. State is worked out from them, now
// and the zone; it's never stored.

/** What a rule needs of a todo. Rows from Postgres and the device both fit. */
export type TodoRuleFields = {
  id: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  dueTime: string | null;
  doneAt: string | null;
  createdAt: string;
};

export type TodoState = "done" | "overdue" | "today" | "upcoming" | "undated";

const timeFormats = new Map<string, Intl.DateTimeFormat>();
const timeFormat = (timeZone: string) => {
  let format = timeFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    timeFormats.set(timeZone, format);
  }
  return format;
};

/** The wall-clock time an instant falls on in a zone, as "HH:MM:SS". */
export const localTime = (instant: string | number | Date, timeZone: string) => {
  const parts = timeFormat(timeZone).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}:${part("second")}`;
};

/**
 * Where a todo stands at `now` in the recipient's zone. A todo due today
 * without a time is "today" until the day ends there; one with a time is
 * overdue once that time has passed.
 */
export const todoState = (
  todo: Pick<TodoRuleFields, "doneAt" | "dueOn" | "dueTime">,
  now: Date | number | string,
  timeZone: string,
): TodoState => {
  if (todo.doneAt) return "done";
  if (!todo.dueOn) return "undated";
  const today = localDate(now, timeZone);
  if (todo.dueOn < today) return "overdue";
  if (todo.dueOn > today) return "upcoming";
  if (todo.dueTime && localTime(now, timeZone) > `${todo.dueTime}:00`) return "overdue";
  return "today";
};

const STATE_RANK: Record<TodoState, number> = { overdue: 0, today: 1, upcoming: 2, undated: 3, done: 4 };

/**
 * Open todos in list order: overdue first (by due), then today, then later
 * days; within a day all-day before timed, then by time. Undated todos come
 * last, newest first. Ties fall back to when they were made, then the id.
 */
export const todoOrder = <T extends TodoRuleFields>(
  todos: readonly T[],
  now: Date | number | string,
  timeZone: string,
): T[] =>
  todos
    .map((todo) => ({ todo, rank: STATE_RANK[todoState(todo, now, timeZone)] }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const x = a.todo;
      const y = b.todo;
      if (!x.dueOn || !y.dueOn) {
        // Undated (or done): newest first.
        if (x.createdAt !== y.createdAt) return x.createdAt < y.createdAt ? 1 : -1;
        return x.id < y.id ? -1 : 1;
      }
      if (x.dueOn !== y.dueOn) return x.dueOn < y.dueOn ? -1 : 1;
      if (!x.dueTime !== !y.dueTime) return x.dueTime ? 1 : -1;
      if (x.dueTime && y.dueTime && x.dueTime !== y.dueTime) return x.dueTime < y.dueTime ? -1 : 1;
      if (x.createdAt !== y.createdAt) return x.createdAt < y.createdAt ? -1 : 1;
      return x.id < y.id ? -1 : 1;
    })
    .map(({ todo }) => todo);

/** Done todos, newest `done_at` first (then the id). */
export const doneOrder = <T extends Pick<TodoRuleFields, "id" | "doneAt">>(todos: readonly T[]): T[] =>
  [...todos].sort((a, b) => {
    const x = a.doneAt ?? "";
    const y = b.doneAt ?? "";
    if (x !== y) return x < y ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  });

// ---------------------------------------------------------------------------
// Who
// ---------------------------------------------------------------------------

export type TodoAssignee =
  { type: "member"; userId: string } | { type: "name"; name: string } | { type: "none" };

/** Who a todo is assigned to: the one reader of `assignee_id` and `assignee_name`. */
export const assigneeOf = (todo: Pick<TodoRuleFields, "assigneeId" | "assigneeName">): TodoAssignee => {
  if (todo.assigneeId) return { type: "member", userId: todo.assigneeId };
  const name = todo.assigneeName?.trim();
  if (name) return { type: "name", name };
  return { type: "none" };
};

/** The group roles that write todos (create, edit, assign, complete any, delete): the writers. */
export const TODO_WRITER_ROLES = WRITER_ROLES;

export const isTodoWriter = (role: string | null | undefined) => hasGroupRole(TODO_WRITER_ROLES, role);

/** The roles that may only tick (and untick) a todo assigned to them; from the role module. */
export { TODO_COMPLETER_ROLES } from "../../constants/roles";

/** Whether `role` only completes its own todos (`TODO_COMPLETER_ROLES`). */
export const isTodoCompleter = completesOnlyAssigned;

/**
 * Whether someone may tick a todo done (or reopen it): writers always; a
 * viewer or an easy role only when it's assigned to them as a member (never
 * a typed-in name's todo, never an unassigned one). Non-members never.
 */
export const canCompleteTodo = ({
  role,
  userId,
  todo,
}: {
  role: string | null | undefined;
  userId: string | null | undefined;
  todo: Pick<TodoRuleFields, "assigneeId">;
}) => {
  if (isTodoWriter(role)) return true;
  return isTodoCompleter(role) && !!userId && todo.assigneeId === userId;
};

/** Every column a todo has besides its done fields and bookkeeping. */
const NON_DONE_FIELDS = [
  "groupId",
  "recipientId",
  "title",
  "assigneeId",
  "assigneeName",
  "dueOn",
  "dueTime",
  "providerId",
  "medicationId",
  "eventId",
  "deletedAt",
  "repeatRule",
  "repeatStartsOn",
  "repeatId",
  "parentId",
] as const;

const normalize = (value: unknown) => (value === undefined || value === "" ? null : value);

/**
 * True when `after` differs from `before` in the done fields at most
 * (`done_at`, `done_by`): the only change a viewer may make, and only to a
 * todo assigned to them. A field missing from `after` is unchanged.
 */
export const completionOnly = (before: object, after: object) => {
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return NON_DONE_FIELDS.every((field) => !(field in a) || normalize(a[field]) === normalize(b[field]));
};

// ---------------------------------------------------------------------------
// Repeats (planner-2). Making the next occurrence needs rrule, so it lives in
// `@caretook/data/series` (todoRepeat.ts); these don't.
// ---------------------------------------------------------------------------

/** A todo's repeat columns: all set (a repeating todo) or all null. */
export type TodoRepeatColumns = {
  repeatRule: string | null;
  repeatStartsOn: string | null;
  repeatId: string | null;
};

/**
 * The repeat columns a todo gets when it's written with `after`'s rule and
 * due day. No rule (or no day): none. A new repeat starts a chain on this
 * todo (its id) anchored on the due day. A changed rule or due day keeps the
 * chain and moves the anchor to the due day; otherwise nothing changes. The
 * device and the server both use this, so they agree.
 */
export const repeatColumnsFor = (
  id: string,
  before: (Partial<TodoRepeatColumns> & { dueOn: string | null }) | null,
  after: { repeatRule: string | null; dueOn: string | null },
): TodoRepeatColumns => {
  if (!after.repeatRule || !after.dueOn) return { repeatRule: null, repeatStartsOn: null, repeatId: null };
  if (!before?.repeatRule || !before.repeatId || !before.repeatStartsOn)
    return { repeatRule: after.repeatRule, repeatStartsOn: after.dueOn, repeatId: id };
  if (before.repeatRule !== after.repeatRule || before.dueOn !== after.dueOn)
    return { repeatRule: after.repeatRule, repeatStartsOn: after.dueOn, repeatId: before.repeatId };
  return { repeatRule: before.repeatRule, repeatStartsOn: before.repeatStartsOn, repeatId: before.repeatId };
};

/** A repeating todo's rule in words ("Every Mon at 9:00"), or null when it doesn't repeat. */
export const todoRepeatText = (
  todo: Pick<TodoRuleFields, "dueTime"> & Partial<Pick<TodoRepeatColumns, "repeatRule" | "repeatStartsOn">>,
) =>
  todo.repeatRule
    ? repeatText({
        rule: todo.repeatRule,
        startTime: todo.dueTime,
        startsOn: todo.repeatStartsOn ?? undefined,
      })
    : null;

/**
 * The upload's flag on an Undo's soft delete of the next occurrence (the
 * device's `_metadata` on that write, B-382): the server removes it only
 * when it's still untouched (`todoService.removeUndoneNext`), unlike an
 * explicit delete.
 */
export const UNDO_NEXT_METADATA = "todo:undoNext";

/**
 * The upload's flag on a tick's next occurrence (the device's `_metadata` on
 * the twin `completeTodo` writes, B-387): the server's own tick makes that
 * row, so a flagged twin never creates one (`todoService.upsertOccurrence`).
 * A stale tick's twin can't bring back a chain someone stopped meanwhile; a
 * skip's twin is unflagged, a writer's create.
 */
export const TICK_NEXT_METADATA = "todo:tickNext";
