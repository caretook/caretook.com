import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { careRecipientSchema } from "../profiles/careRecipient";
import { audits, enumCheck, id, timestamps } from "../core/columns";
import { scheduleTimeZSchema } from "../medications/medication";
import { timeZoneZSchema } from "../core/timeZone";
import { parseRule, SERIES_LIMITS } from "./repeatRule";

// A repeating appointment or reminder (appointments-2, B-60): "dialysis,
// Mon Wed Fri at 6:00". The series holds the rule and a template; each
// visit is an ordinary timeline entry (`series_id`, `series_day`) with its
// own notes, providers and cancel, written 90 days ahead (by the device that
// makes the series, then topped up by the server). Past visits are never
// rewritten.
//
// The rule is expanded in floating wall-clock time and placed in
// `time_zone` (the recipient's at creation) with the zoned-day helpers, so
// "6:00" stays 6:00 across DST (seriesVisits.ts).
//
// Shaped for PowerSync like todo: `group_id` on the row, ids made on the
// device, soft deletes.

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

/** The kinds the column stores. New and edited series are events only (`kind` below); a stored note series is left alone. */
export const SERIES_KINDS = ["event", "note"] as const;
export type SeriesKind = (typeof SERIES_KINDS)[number];

export const appointmentSeriesSchema = pgTable(
  "appointment_series",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Redundant while a group has one recipient; ready for several.
    recipientId: uuid("recipient_id").notNull(),
    kind: text("kind", { enum: SERIES_KINDS }).notNull(),
    // RRULE text, Caretook's subset (repeatRule.ts): FREQ, INTERVAL, BYDAY,
    // BYMONTHDAY, COUNT or UNTIL.
    rule: text("rule").notNull(),
    // The first local day, and the wall-clock "HH:MM" (null when all day), in `time_zone`.
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    startTime: text("start_time"),
    allDay: boolean("all_day").notNull().default(false),
    timeZone: text("time_zone").notNull(),
    // The template each visit starts from.
    title: text("title"),
    durationMinutes: integer("duration_minutes"),
    place: text("place"),
    // Provider ids (checked in the group by the service), copied to each visit's links.
    providerIds: jsonb("provider_ids").$type<string[]>().notNull().default([]),
    // The last local day visits were written through.
    toppedUpThrough: date("topped_up_through", { mode: "string" }),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of the visits' composite FK (timeline_entry.series_id).
    unique("appointment_series_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the series' group (NO ACTION, like todo).
    foreignKey({
      name: "appointment_series_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    enumCheck("appointment_series_kind_check", t.kind, SERIES_KINDS),
    check("appointment_series_time_check", sql`(${t.allDay}) = (${t.startTime} IS NULL)`),
  ],
);

export type AppointmentSeriesSchema = typeof appointmentSeriesSchema;
export type AppointmentSeriesSelect = InferSelectModel<AppointmentSeriesSchema>;
export type AppointmentSeriesInsert = Omit<InferInsertModel<AppointmentSeriesSchema>, ProtectedField>;
export type AppointmentSeriesUpdate = Partial<AppointmentSeriesInsert>;
export type AppointmentSeries = AppointmentSeriesSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe): the same rules in the sheets, on the device and
// on the server.
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `At most ${max} characters` })
    .nullish()
    .transform((v) => (v ? v : null));

const ruleZSchema = z.string().superRefine((value, ctx) => {
  const parsed = parseRule(value);
  if (!parsed.ok) ctx.addIssue({ code: "custom", message: parsed.problem });
});

const localDate = z.iso.date({ error: "Enter a valid date" });

const seriesFields = {
  rule: ruleZSchema,
  startsOn: localDate,
  startTime: scheduleTimeZSchema.nullish().transform((v) => v ?? null),
  allDay: z.boolean().optional().default(false),
  timeZone: timeZoneZSchema,
  title: optionalText(SERIES_LIMITS.title),
  durationMinutes: z
    .int()
    .min(1, { error: "Must be at least a minute" })
    .max(SERIES_LIMITS.durationMinutes, { error: "At most a day" })
    .nullish()
    .transform((v) => v ?? null),
  place: optionalText(SERIES_LIMITS.place),
  providerIds: z
    .array(z.uuid())
    .max(SERIES_LIMITS.providers)
    .refine((ids) => new Set(ids).size === ids.length, { error: "A provider is listed twice" })
    .optional()
    .default([]),
  toppedUpThrough: localDate.nullish().transform((v) => v ?? null),
};

type CrossFields = {
  kind: string;
  rule: string;
  startsOn: string;
  startTime: string | null;
  allDay: boolean;
  title: string | null;
  durationMinutes: number | null;
  place: string | null;
};

/**
 * The rules across a series' fields: a time or all day (not both); an all-day
 * series has no length; an appointment series has a title, and only it has a
 * length and a place; an end date isn't before the start.
 */
export const seriesCrossFieldIssues = (value: CrossFields) => {
  const issues: { path: string; message: string }[] = [];
  if (value.allDay && value.startTime)
    issues.push({ path: "startTime", message: "An all-day item has no time" });
  if (!value.allDay && !value.startTime)
    issues.push({ path: "startTime", message: "Choose a time, or all day" });
  if (value.allDay && value.durationMinutes)
    issues.push({ path: "durationMinutes", message: "An all-day item has no end time" });
  if (value.kind === "event" && !value.title) issues.push({ path: "title", message: "Enter a title" });
  const parsed = parseRule(value.rule);
  if (parsed.ok && parsed.rule.end.type === "on" && parsed.rule.end.until < value.startsOn)
    issues.push({ path: "rule", message: "The end date is before the first day" });
  return issues;
};

const crossFields = (value: CrossFields, ctx: z.RefinementCtx) => {
  for (const issue of seriesCrossFieldIssues(value))
    ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
};

// Series are events only: a note is past-only, and a reminder is a todo.
const kind = z.literal("event", { error: "A series makes appointments" });

/** A series' content (everything but its group and recipient). On create, and on update against the merged row. */
export const appointmentSeriesContentZSchema = z.object({ kind, ...seriesFields }).superRefine(crossFields);
export type AppointmentSeriesContent = z.output<typeof appointmentSeriesContentZSchema>;
export type AppointmentSeriesContentInput = z.input<typeof appointmentSeriesContentZSchema>;

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const appointmentSeriesCreateZSchema = z
  .object({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    recipientId: z.uuid().optional(),
    kind,
    ...seriesFields,
  })
  .superRefine(crossFields);
export type AppointmentSeriesCreateInput = z.input<typeof appointmentSeriesCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const appointmentSeriesUpsertZSchema = z
  .object({ id: z.uuid(), groupId: z.uuid(), recipientId: z.uuid().optional(), kind, ...seriesFields })
  .superRefine(crossFields);
export type AppointmentSeriesUpsertInput = z.input<typeof appointmentSeriesUpsertZSchema>;

/** Update input: the rule and the template. The group, recipient and kind never change. */
export const appointmentSeriesUpdateZSchema = z.strictObject({
  rule: z.string().optional(),
  startsOn: z.string().optional(),
  startTime: z.string().nullish(),
  allDay: z.boolean().optional(),
  timeZone: z.string().optional(),
  title: z.string().nullish(),
  durationMinutes: z.number().nullish(),
  place: z.string().nullish(),
  providerIds: z.array(z.string()).optional(),
});
export type AppointmentSeriesUpdateInput = z.input<typeof appointmentSeriesUpdateZSchema>;

/** A stored series' content, ready to merge a patch over and re-validate. */
export const appointmentSeriesContentOf = (series: AppointmentSeries): AppointmentSeriesContentInput => ({
  // A stored note series carries its kind, so an edit of it is refused.
  kind: series.kind as "event",
  rule: series.rule,
  startsOn: series.startsOn,
  startTime: series.startTime,
  allDay: series.allDay,
  timeZone: series.timeZone,
  title: series.title,
  durationMinutes: series.durationMinutes,
  place: series.place,
  providerIds: series.providerIds,
  toppedUpThrough: series.toppedUpThrough,
});
