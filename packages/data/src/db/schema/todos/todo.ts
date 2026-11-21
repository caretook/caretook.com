import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { careRecipientSchema } from "../profiles/careRecipient";
import { audits, id, timestamps } from "../core/columns";
import { parseRule } from "../appointments/repeatRule";
import { medicationSchema, scheduleTimeZSchema } from "../medications/medication";
import { providerSchema } from "../providers/provider";
import { timelineEntrySchema } from "../timeline/timelineEntry";
import { userSchema } from "../auth/user";

// A care group's todos: a shared todo list ("Call the pharmacy", "Pick up
// the walker"). A todo has at most one assignee (a member, a name typed in
// for someone outside the group, or nobody), an optional due day with an
// optional wall-clock time in the recipient's zone, and a done state.
//
// Shaped for PowerSync like medication: `group_id` on the row, ids made on
// the device, soft deletes (`deleted_at`). The pure rules (state, order,
// who may complete) are in todoRules.ts.

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const todoSchema = pgTable(
  "todo",
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
    // Added through a member's AI assistant: the client's name at write time
    // (as timeline_entry.via). Only the server's assistant runner sets it.
    via: text("via"),
    // Repeating (planner-2): the RRULE text (the grammar `appointment_series.rule`
    // takes), the chain's anchor day (its first due day, reset when the rule or
    // due day changes) and the chain's id (its first todo's), shared by every
    // occurrence. All three or none; a rule needs a due day. A repeating todo
    // is one open row: ticking it makes the next (todoRepeat.ts).
    repeatRule: text("repeat_rule"),
    repeatStartsOn: date("repeat_starts_on", { mode: "string" }),
    repeatId: uuid("repeat_id"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of composite FKs (its notes document).
    unique("todo_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the todo's group (NO ACTION, like medication).
    foreignKey({
      name: "todo_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    foreignKey({
      name: "todo_provider_fk",
      columns: [t.groupId, t.providerId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }),
    foreignKey({
      name: "todo_medication_fk",
      columns: [t.groupId, t.medicationId],
      foreignColumns: [medicationSchema.groupId, medicationSchema.id],
    }),
    // Hand-edited to ON DELETE SET NULL ("event_id") in the migration.
    foreignKey({
      name: "todo_event_fk",
      columns: [t.groupId, t.eventId],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }),
    index("todo_group_due_idx").on(t.groupId, t.dueOn),
    index("todo_group_assignee_idx").on(t.groupId, t.assigneeId),
    check("todo_assignee_check", sql`${t.assigneeId} IS NULL OR ${t.assigneeName} IS NULL`),
    check("todo_due_time_check", sql`${t.dueTime} IS NULL OR ${t.dueOn} IS NOT NULL`),
    check("todo_done_check", sql`(${t.doneAt} IS NULL) = (${t.doneBy} IS NULL)`),
    check(
      "todo_repeat_check",
      sql`(${t.repeatRule} IS NULL) = (${t.repeatStartsOn} IS NULL) AND (${t.repeatRule} IS NULL) = (${t.repeatId} IS NULL)`,
    ),
    check("todo_repeat_due_check", sql`${t.repeatRule} IS NULL OR ${t.dueOn} IS NOT NULL`),
    index("todo_group_repeat_idx").on(t.groupId, t.repeatId),
  ],
);

export type TodoSchema = typeof todoSchema;
export type TodoSelect = InferSelectModel<TodoSchema>;
export type TodoInsert = Omit<InferInsertModel<TodoSchema>, ProtectedField>;
export type TodoUpdate = Partial<TodoInsert>;
export type Todo = TodoSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe): the same rules in the form, on the device and
// on the server.
// ---------------------------------------------------------------------------

export const TODO_LIMITS = { title: 200, assigneeName: 120 } as const;

/** The field issue when a due time has no day. */
export const TIME_NEEDS_DAY_ISSUE = { path: "dueTime", message: "Choose a day for this time" } as const;
/** The field issue when a todo names both a member and a typed-in assignee. */
export const ONE_ASSIGNEE_ISSUE = { path: "assigneeName", message: "Choose one assignee" } as const;
/** The field issue when only one of the done fields is set. */
export const DONE_TOGETHER_ISSUE = { path: "doneAt", message: "Done needs who and when" } as const;
/** The field issue when a repeating todo has no due day to start from. */
export const REPEAT_NEEDS_DAY_ISSUE = { path: "repeatRule", message: "Choose a due day to repeat" } as const;
/** The field issue when the assignee isn't a member of the group. */
export const ASSIGNEE_NOT_MEMBER_ISSUE = {
  path: "assigneeId",
  message: "Choose someone in this care group",
} as const;
/** The field issues when a link isn't live in the group (or the event isn't an event). */
export const BAD_TODO_LINK_ISSUES = {
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

const todoTitle = z
  .string({ error: "Enter a todo" })
  .trim()
  .min(1, { error: "Enter a todo" })
  .max(TODO_LIMITS.title, { error: `At most ${TODO_LIMITS.title} characters` });

const dueOn = z.iso
  .date({ error: "Enter a valid date" })
  .nullish()
  .transform((v) => v ?? null);

const dueTime = scheduleTimeZSchema.nullish().transform((v) => v ?? null);

/** RRULE text in the grammar repeating appointments take (`parseRule`); empty means none. */
const repeatRule = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .superRefine((v, ctx) => {
    if (v === null) return;
    const parsed = parseRule(v);
    if (!parsed.ok) ctx.addIssue({ code: "custom", message: parsed.problem });
  });

const todoFields = {
  title: todoTitle,
  assigneeId: optionalId,
  assigneeName: optionalText(TODO_LIMITS.assigneeName),
  dueOn,
  dueTime,
  providerId: optionalId,
  medicationId: optionalId,
  eventId: optionalId,
  repeatRule,
};

/** The content columns a writer edits (everything but the group, recipient, done and delete). */
export const TODO_CONTENT_FIELDS = [
  "title",
  "assigneeId",
  "assigneeName",
  "dueOn",
  "dueTime",
  "providerId",
  "medicationId",
  "eventId",
  "repeatRule",
] as const;
export type TodoContentField = (typeof TODO_CONTENT_FIELDS)[number];

type CrossFields = {
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueOn?: string | null;
  dueTime?: string | null;
  doneAt?: string | null;
  doneBy?: string | null;
  repeatRule?: string | null;
};

const addIssue = (ctx: z.RefinementCtx, issue: { path: string; message: string }) =>
  ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });

/** The cross-field rules: a time and a repeat need a day; one assignee at most; done fields together. */
export const todoCrossFieldIssues = (value: CrossFields) => {
  const issues: { path: string; message: string }[] = [];
  if (value.dueTime && !value.dueOn) issues.push(TIME_NEEDS_DAY_ISSUE);
  if (value.assigneeId && value.assigneeName) issues.push(ONE_ASSIGNEE_ISSUE);
  if (!!value.doneAt !== !!value.doneBy) issues.push(DONE_TOGETHER_ISSUE);
  if (value.repeatRule && !value.dueOn) issues.push(REPEAT_NEEDS_DAY_ISSUE);
  return issues;
};

const crossFields = (value: CrossFields, ctx: z.RefinementCtx) => {
  for (const issue of todoCrossFieldIssues(value)) addIssue(ctx, issue);
};

/**
 * A todo's content. Used on create, and on update against the merged row.
 * Whether the assignee is a member and the links are live in the group
 * needs the database: see `todoService`.
 */
export const todoContentZSchema = z
  .object({
    ...todoFields,
    doneAt: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    doneBy: optionalId,
  })
  .superRefine(crossFields);
export type TodoContent = z.output<typeof todoContentZSchema>;
export type TodoContentInput = z.input<typeof todoContentZSchema>;

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const todoCreateZSchema = z
  .object({ id: z.uuid().optional(), groupId: z.uuid(), recipientId: z.uuid().optional(), ...todoFields })
  .superRefine(crossFields);
export type TodoCreateInput = z.input<typeof todoCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const todoUpsertZSchema = z
  .object({ id: z.uuid(), groupId: z.uuid(), recipientId: z.uuid().optional(), ...todoFields })
  .superRefine(crossFields);
export type TodoUpsertInput = z.input<typeof todoUpsertZSchema>;

/**
 * A repeating todo's later occurrence as a device uploads it (the twin of
 * the one `todoService.complete` or `skip` makes): an upsert that also names
 * its chain and anchor. It must repeat and have a due day.
 */
export const todoOccurrenceZSchema = z
  .object({
    id: z.uuid(),
    groupId: z.uuid(),
    recipientId: z.uuid().optional(),
    ...todoFields,
    repeatStartsOn: z.iso.date({ error: "Enter a valid date" }),
    repeatId: z.uuid(),
  })
  .superRefine((value, ctx) => {
    crossFields(value, ctx);
    if (!value.repeatRule) ctx.addIssue({ code: "custom", path: ["repeatRule"], message: "Not a repeat" });
  });
export type TodoOccurrenceInput = z.input<typeof todoOccurrenceZSchema>;

/** Update input: any content field. The group and recipient never change; done goes through complete and reopen. */
export const todoUpdateZSchema = z.strictObject({
  title: z.string().optional(),
  assigneeId: z.uuid().nullish(),
  assigneeName: z.string().nullish(),
  dueOn: z.string().nullish(),
  dueTime: z.string().nullish(),
  providerId: z.uuid().nullish(),
  medicationId: z.uuid().nullish(),
  eventId: z.uuid().nullish(),
  /** RRULE text, or null to stop repeating. The anchor and chain follow (`repeatColumnsFor`). */
  repeatRule: z.string().nullish(),
});
export type TodoUpdateInput = z.input<typeof todoUpdateZSchema>;

/** A stored todo's content and done fields, ready to merge a patch over and re-validate. */
export const todoContentOf = (todo: {
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
  repeatRule?: string | null;
}): TodoContentInput => ({
  title: todo.title,
  assigneeId: todo.assigneeId,
  assigneeName: todo.assigneeName,
  dueOn: todo.dueOn,
  dueTime: todo.dueTime,
  providerId: todo.providerId,
  medicationId: todo.medicationId,
  eventId: todo.eventId,
  doneAt: todo.doneAt,
  doneBy: todo.doneBy,
  repeatRule: todo.repeatRule ?? null,
});
