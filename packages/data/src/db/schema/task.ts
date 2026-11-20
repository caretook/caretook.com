import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { careRecipientSchema } from "./careRecipient";
import { audits, id, timestamps } from "./columns";
import { medicationSchema, scheduleTimeZSchema } from "./medication";
import { providerSchema } from "./provider";
import { timelineEntrySchema } from "./timelineEntry";
import { userSchema } from "./user";

// A care group's tasks: a shared todo list ("Call the pharmacy", "Pick up
// the walker"). A task has at most one assignee (a member, a name typed in
// for someone outside the group, or nobody), an optional due day with an
// optional wall-clock time in the recipient's zone, and a done state.
//
// Shaped for PowerSync like medication: `group_id` on the row, ids made on
// the device, soft deletes (`deleted_at`). The pure rules (state, order,
// who may complete) are in taskRules.ts.

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const taskSchema = pgTable(
  "task",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Redundant while a group has one recipient; ready for several.
    recipientId: uuid("recipient_id").notNull(),
    title: text("title").notNull(),
    // A member of the group (checked by the service when set or changed).
    // Deleting the account unassigns it.
    assigneeId: uuid("assignee_id").references(() => userSchema.id, { onDelete: "set null" }),
    // Someone outside the group ("Aunt May"), or a member who left. Never
    // together with `assignee_id`.
    assigneeName: text("assignee_name"),
    // The due day, and an optional "HH:MM" on it, both wall-clock in the
    // recipient's zone (like medication slots): never an instant.
    dueOn: date("due_on", { mode: "string" }),
    dueTime: text("due_time"),
    // Done ⇔ both set. `done_by` is audit-style (set by the service, not an FK).
    doneAt: timestampColumn("done_at"),
    doneBy: uuid("done_by"),
    // Links: a provider, a medication, an event. Providers and medications
    // are only soft-deleted (NO ACTION; the link greys "(removed)"). The
    // event FK is ON DELETE SET NULL ("event_id") in the migration, edited by
    // hand (Drizzle 0.45 can't express a column-list SET NULL).
    providerId: uuid("provider_id"),
    medicationId: uuid("medication_id"),
    eventId: uuid("event_id"),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of composite FKs (its notes document).
    unique("task_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the task's group (NO ACTION, like medication).
    foreignKey({
      name: "task_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    foreignKey({
      name: "task_provider_fk",
      columns: [t.groupId, t.providerId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }),
    foreignKey({
      name: "task_medication_fk",
      columns: [t.groupId, t.medicationId],
      foreignColumns: [medicationSchema.groupId, medicationSchema.id],
    }),
    // Hand-edited to ON DELETE SET NULL ("event_id") in the migration.
    foreignKey({
      name: "task_event_fk",
      columns: [t.groupId, t.eventId],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }),
    index("task_group_due_idx").on(t.groupId, t.dueOn),
    index("task_group_assignee_idx").on(t.groupId, t.assigneeId),
    check("task_assignee_check", sql`${t.assigneeId} IS NULL OR ${t.assigneeName} IS NULL`),
    check("task_due_time_check", sql`${t.dueTime} IS NULL OR ${t.dueOn} IS NOT NULL`),
    check("task_done_check", sql`(${t.doneAt} IS NULL) = (${t.doneBy} IS NULL)`),
  ],
);

export type TaskSchema = typeof taskSchema;
export type TaskSelect = InferSelectModel<TaskSchema>;
export type TaskInsert = Omit<InferInsertModel<TaskSchema>, ProtectedField>;
export type TaskUpdate = Partial<TaskInsert>;
export type Task = TaskSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe): the same rules in the form, on the device and
// on the server.
// ---------------------------------------------------------------------------

export const TASK_LIMITS = { title: 200, assigneeName: 120 } as const;

/** The field issue when a due time has no day. */
export const TIME_NEEDS_DAY_ISSUE = { path: "dueTime", message: "Choose a day for this time" } as const;
/** The field issue when a task names both a member and a typed-in assignee. */
export const ONE_ASSIGNEE_ISSUE = { path: "assigneeName", message: "Choose one assignee" } as const;
/** The field issue when only one of the done fields is set. */
export const DONE_TOGETHER_ISSUE = { path: "doneAt", message: "Done needs who and when" } as const;
/** The field issue when the assignee isn't a member of the group. */
export const ASSIGNEE_NOT_MEMBER_ISSUE = {
  path: "assigneeId",
  message: "Choose someone in this care group",
} as const;
/** The field issues when a link isn't live in the group (or the event isn't an event). */
export const BAD_TASK_LINK_ISSUES = {
  providerId: { path: "providerId", message: "Choose a provider in this care group" },
  medicationId: { path: "medicationId", message: "Choose a medication in this care group" },
  eventId: { path: "eventId", message: "Choose an appointment in this care group" },
} as const;

/** Optional text: trimmed, and empty means none (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `At most ${max} characters` })
    .nullish()
    .transform((v) => (v ? v : null));

const optionalId = z
  .uuid()
  .nullish()
  .transform((v) => v ?? null);

const taskTitle = z
  .string({ error: "Enter a task" })
  .trim()
  .min(1, { error: "Enter a task" })
  .max(TASK_LIMITS.title, { error: `At most ${TASK_LIMITS.title} characters` });

const dueOn = z.iso
  .date({ error: "Enter a valid date" })
  .nullish()
  .transform((v) => v ?? null);

const dueTime = scheduleTimeZSchema.nullish().transform((v) => v ?? null);

const taskFields = {
  title: taskTitle,
  assigneeId: optionalId,
  assigneeName: optionalText(TASK_LIMITS.assigneeName),
  dueOn,
  dueTime,
  providerId: optionalId,
  medicationId: optionalId,
  eventId: optionalId,
};

/** The content columns a writer edits (everything but the group, recipient, done and delete). */
export const TASK_CONTENT_FIELDS = [
  "title",
  "assigneeId",
  "assigneeName",
  "dueOn",
  "dueTime",
  "providerId",
  "medicationId",
  "eventId",
] as const;
export type TaskContentField = (typeof TASK_CONTENT_FIELDS)[number];

type CrossFields = {
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueOn?: string | null;
  dueTime?: string | null;
  doneAt?: string | null;
  doneBy?: string | null;
};

const addIssue = (ctx: z.RefinementCtx, issue: { path: string; message: string }) =>
  ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });

/** The cross-field rules: a time needs a day; one assignee at most; done fields together. */
export const taskCrossFieldIssues = (value: CrossFields) => {
  const issues: { path: string; message: string }[] = [];
  if (value.dueTime && !value.dueOn) issues.push(TIME_NEEDS_DAY_ISSUE);
  if (value.assigneeId && value.assigneeName) issues.push(ONE_ASSIGNEE_ISSUE);
  if (!!value.doneAt !== !!value.doneBy) issues.push(DONE_TOGETHER_ISSUE);
  return issues;
};

const crossFields = (value: CrossFields, ctx: z.RefinementCtx) => {
  for (const issue of taskCrossFieldIssues(value)) addIssue(ctx, issue);
};

/**
 * A task's content. Used on create, and on update against the merged row.
 * Whether the assignee is a member and the links are live in the group
 * needs the database: see `taskService`.
 */
export const taskContentZSchema = z
  .object({
    ...taskFields,
    doneAt: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    doneBy: optionalId,
  })
  .superRefine(crossFields);
export type TaskContent = z.output<typeof taskContentZSchema>;
export type TaskContentInput = z.input<typeof taskContentZSchema>;

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const taskCreateZSchema = z
  .object({ id: z.uuid().optional(), groupId: z.uuid(), recipientId: z.uuid().optional(), ...taskFields })
  .superRefine(crossFields);
export type TaskCreateInput = z.input<typeof taskCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const taskUpsertZSchema = z
  .object({ id: z.uuid(), groupId: z.uuid(), recipientId: z.uuid().optional(), ...taskFields })
  .superRefine(crossFields);
export type TaskUpsertInput = z.input<typeof taskUpsertZSchema>;

/** Update input: any content field. The group and recipient never change; done goes through complete and reopen. */
export const taskUpdateZSchema = z.strictObject({
  title: z.string().optional(),
  assigneeId: z.uuid().nullish(),
  assigneeName: z.string().nullish(),
  dueOn: z.string().nullish(),
  dueTime: z.string().nullish(),
  providerId: z.uuid().nullish(),
  medicationId: z.uuid().nullish(),
  eventId: z.uuid().nullish(),
});
export type TaskUpdateInput = z.input<typeof taskUpdateZSchema>;

/** A stored task's content and done fields, ready to merge a patch over and re-validate. */
export const taskContentOf = (task: {
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  dueTime: string | null;
  providerId: string | null;
  medicationId: string | null;
  eventId: string | null;
  doneAt: string | null;
  doneBy: string | null;
}): TaskContentInput => ({
  title: task.title,
  assigneeId: task.assigneeId,
  assigneeName: task.assigneeName,
  dueOn: task.dueOn,
  dueTime: task.dueTime,
  providerId: task.providerId,
  medicationId: task.medicationId,
  eventId: task.eventId,
  doneAt: task.doneAt,
  doneBy: task.doneBy,
});
