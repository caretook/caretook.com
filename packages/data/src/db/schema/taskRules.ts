import { localDate } from "./entryTiming";

// The tasks' pure rules (client-safe): the one place that says what state a
// task is in, how lists are ordered, who may complete one, and who it's
// assigned to. The device, the screens and the service all lean on these.
//
// The due day and time are wall-clock in the recipient's zone (like
// medication slots): "Friday 17:00" stays Friday 17:00 across a DST change
// and when the recipient's zone changes. State is worked out from them, now
// and the zone; it's never stored.

/** What a rule needs of a task. Rows from Postgres and the device both fit. */
export type TaskRuleFields = {
  id: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  dueTime: string | null;
  doneAt: string | null;
  createdAt: string;
};

export type TaskState = "done" | "overdue" | "today" | "upcoming" | "undated";

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
 * Where a task stands at `now` in the recipient's zone. A task due today
 * without a time is "today" until the day ends there; one with a time is
 * overdue once that time has passed.
 */
export const taskState = (
  task: Pick<TaskRuleFields, "doneAt" | "dueOn" | "dueTime">,
  now: Date | number | string,
  timeZone: string,
): TaskState => {
  if (task.doneAt) return "done";
  if (!task.dueOn) return "undated";
  const today = localDate(now, timeZone);
  if (task.dueOn < today) return "overdue";
  if (task.dueOn > today) return "upcoming";
  if (task.dueTime && localTime(now, timeZone) > `${task.dueTime}:00`) return "overdue";
  return "today";
};

const STATE_RANK: Record<TaskState, number> = { overdue: 0, today: 1, upcoming: 2, undated: 3, done: 4 };

/**
 * Open tasks in list order: overdue first (by due), then today, then later
 * days; within a day all-day before timed, then by time. Undated tasks come
 * last, newest first. Ties fall back to when they were made, then the id.
 */
export const taskOrder = <T extends TaskRuleFields>(
  tasks: readonly T[],
  now: Date | number | string,
  timeZone: string,
): T[] =>
  tasks
    .map((task) => ({ task, rank: STATE_RANK[taskState(task, now, timeZone)] }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const x = a.task;
      const y = b.task;
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
    .map(({ task }) => task);

/** Done tasks, newest `done_at` first (then the id). */
export const doneOrder = <T extends Pick<TaskRuleFields, "id" | "doneAt">>(tasks: readonly T[]): T[] =>
  [...tasks].sort((a, b) => {
    const x = a.doneAt ?? "";
    const y = b.doneAt ?? "";
    if (x !== y) return x < y ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  });

// ---------------------------------------------------------------------------
// Who
// ---------------------------------------------------------------------------

export type TaskAssignee =
  { type: "member"; userId: string } | { type: "name"; name: string } | { type: "none" };

/** Who a task is assigned to: the one reader of `assignee_id` and `assignee_name`. */
export const assigneeOf = (task: Pick<TaskRuleFields, "assigneeId" | "assigneeName">): TaskAssignee => {
  if (task.assigneeId) return { type: "member", userId: task.assigneeId };
  const name = task.assigneeName?.trim();
  if (name) return { type: "name", name };
  return { type: "none" };
};

/** The group roles that write tasks (create, edit, assign, complete any, delete). */
export const TASK_WRITER_ROLES = ["owner", "admin", "caretaker"] as const;

export const isTaskWriter = (role: string | null | undefined) =>
  !!role && (TASK_WRITER_ROLES as readonly string[]).includes(role);

/**
 * Whether someone may tick a task done (or reopen it): writers always;
 * viewers only when it's assigned to them as a member (never a typed-in
 * name's task). Non-members never.
 */
export const canCompleteTask = ({
  role,
  userId,
  task,
}: {
  role: string | null | undefined;
  userId: string | null | undefined;
  task: Pick<TaskRuleFields, "assigneeId">;
}) => {
  if (isTaskWriter(role)) return true;
  return role === "viewer" && !!userId && task.assigneeId === userId;
};

/** Every column a task has besides its done fields and bookkeeping. */
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
 * task assigned to them. A field missing from `after` is unchanged.
 */
export const completionOnly = (before: object, after: object) => {
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return NON_DONE_FIELDS.every((field) => !(field in a) || normalize(a[field]) === normalize(b[field]));
};
