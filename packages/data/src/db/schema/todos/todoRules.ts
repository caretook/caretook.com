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

/** The group roles that write todos (create, edit, assign, complete any, delete). */
export const TODO_WRITER_ROLES = ["owner", "admin", "caretaker"] as const;

export const isTodoWriter = (role: string | null | undefined) =>
  !!role && (TODO_WRITER_ROLES as readonly string[]).includes(role);

/**
 * Whether someone may tick a todo done (or reopen it): writers always;
 * viewers only when it's assigned to them as a member (never a typed-in
 * name's todo). Non-members never.
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
  return role === "viewer" && !!userId && todo.assigneeId === userId;
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
