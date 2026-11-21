import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { DoseDetails, MedicationChangeDetails, PassMovedDetails } from "../medications/medication";
import type { ConditionChangeDetails } from "../profiles/conditionChange";
import type { VitalDetails } from "./vitals";

import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { careRecipientSchema } from "../profiles/careRecipient";
import { audits, enumCheck, id, timestamps } from "../core/columns";
import { isStartOfDay } from "../core/entryTiming";
import { doseDetailsZSchema, medicationChangeEntryDetailsZSchema } from "../medications/medication";
import { conditionChangeDetailsZSchema } from "../profiles/conditionChange";
import { timeZoneZSchema } from "../core/timeZone";
import { vitalDetailsZSchema } from "./vitals";

export const TIMELINE_ENTRY_KINDS = [
  "note",
  "symptom",
  "event",
  "vital",
  "dose",
  "medicationChange",
  "conditionChange",
] as const;
export type TimelineEntryKind = (typeof TIMELINE_ENTRY_KINDS)[number];

/**
 * Kind-specific fields: a symptom's name and severity, a vital's readings,
 * a dose's medication and status, a medication change's what and why
 * (see medication.ts), a condition change's what (see conditionChange.ts).
 */
export type SymptomDetails = { name: string; severity?: number | null };
export type TimelineEntryDetails =
  | SymptomDetails
  | VitalDetails
  | DoseDetails
  | MedicationChangeDetails
  | PassMovedDetails
  | ConditionChangeDetails;

export const isSymptomDetails = (d: TimelineEntryDetails | null | undefined): d is SymptomDetails =>
  !!d && "name" in d;
export const isVitalDetails = (d: TimelineEntryDetails | null | undefined): d is VitalDetails =>
  !!d && "readings" in d;
export const isDoseDetails = (d: TimelineEntryDetails | null | undefined): d is DoseDetails =>
  !!d && "medicationId" in d && "status" in d;
export const isMedicationChangeDetails = (
  d: TimelineEntryDetails | null | undefined,
): d is MedicationChangeDetails => !!d && "medicationId" in d && "change" in d;
/** A pass's time moved (a `medicationChange` entry with no one medication). */
export const isPassMovedDetails = (d: TimelineEntryDetails | null | undefined): d is PassMovedDetails =>
  !!d && "change" in d && d.change === "passMoved";
/** A condition's add, edit, resolve or reactivate (a `conditionChange` entry). */
export const isConditionChangeDetails = (
  d: TimelineEntryDetails | null | undefined,
): d is ConditionChangeDetails => !!d && "conditionId" in d && "change" in d;

/**
 * Kinds written with a medication or a condition, never by hand:
 * `timelineEntryService` refuses to create or edit them (deleting one, as a
 * correction, is allowed).
 */
export const SYSTEM_WRITTEN_KINDS = [
  "medicationChange",
  "conditionChange",
] as const satisfies readonly TimelineEntryKind[];
export const isSystemWrittenKind = (kind: string) =>
  (SYSTEM_WRITTEN_KINDS as readonly string[]).includes(kind);

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

// One entry on a care group's shared timeline: a note, a symptom, an event,
// or vitals (one sitting's readings; see vitals.ts).
//
// Shaped for PowerSync: `group_id` sits on the row (sync rules filter by
// column, not by join), ids are client-generated, and deletes are soft
// (`deleted_at`) so other devices learn about them.
//
// `occurred_at` is when it happened; `created_at` is when the server got it,
// which can be hours later for an entry made offline. `time_zone` is the
// device's IANA zone, so "8am" stays 8am for a caretaker elsewhere.
export const timelineEntrySchema = pgTable(
  "timeline_entry",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Redundant while a group has one recipient; ready for several.
    recipientId: uuid("recipient_id").notNull(),
    kind: text("kind", { enum: TIMELINE_ENTRY_KINDS }).notNull(),
    occurredAt: timestampColumn("occurred_at").notNull(),
    timeZone: text("time_zone").notNull(),
    title: text("title"),
    body: text("body"),
    // Validated by the Zod schemas below (per kind); the database doesn't check its shape.
    details: jsonb("details").$type<TimelineEntryDetails>(),
    deletedAt: timestampColumn("deleted_at"),
    // Appointments and reminders (a future event or note; see entryTiming.ts).
    // When it ends: events only, after `occurred_at`, null when all-day.
    endsAt: timestampColumn("ends_at"),
    // Notes and events. `occurred_at` is then the start of its day in `time_zone`.
    allDay: boolean("all_day").notNull().default(false),
    // Where: events only.
    place: text("place"),
    // Cancelled ⇔ `cancelled_at` is set: events only. `cancelled_by` is
    // audit-style (set by the service, not an FK).
    cancelledAt: timestampColumn("cancelled_at"),
    cancelledBy: uuid("cancelled_by"),
    cancelReason: text("cancel_reason"),
    // The event a cancelled one was moved to, in the same group.
    rescheduledTo: uuid("rescheduled_to"),
    // Written through a member's AI assistant (connectors PRD): the client's
    // name at write time ("Claude"), kept after a disconnect. Only the
    // server's assistant runner sets it.
    via: text("via"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // The recipient must belong to the entry's group. NO ACTION (not
    // cascade): deleting a recipient profile fails while it has entries, so
    // one click can't wipe a timeline. Deleting the group still cascades.
    foreignKey({
      name: "timeline_entry_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    // The timeline query: one group, newest first, keyset-paginated.
    index("timeline_entry_group_occurred_idx").on(t.groupId, t.occurredAt.desc(), t.id.desc()),
    enumCheck("timeline_entry_kind_check", t.kind, TIMELINE_ENTRY_KINDS),
    // Target of composite FKs (note_document), so a row attached to an entry
    // is guaranteed to be in the entry's group.
    unique("timeline_entry_group_id_id_unique").on(t.groupId, t.id),
    // A rescheduled event points at its replacement in the same group. The
    // migration makes it ON DELETE SET NULL (rescheduled_to), which Drizzle
    // 0.45 can't express: deleting the new event only clears the link.
    foreignKey({
      name: "timeline_entry_rescheduled_to_fk",
      columns: [t.groupId, t.rescheduledTo],
      foreignColumns: [t.groupId, t.id],
    }),
  ],
);

export type TimelineEntrySchema = typeof timelineEntrySchema;
export type TimelineEntrySelect = InferSelectModel<TimelineEntrySchema>;
export type TimelineEntryInsert = Omit<InferInsertModel<TimelineEntrySchema>, ProtectedField>;
export type TimelineEntryUpdate = Partial<TimelineEntryInsert>;
export type TimelineEntry = TimelineEntrySelect;

// ---------------------------------------------------------------------------
// Zod schemas. Client-safe: the same rules run in forms and on the server.
// ---------------------------------------------------------------------------

const timeZone = timeZoneZSchema;
const occurredAt = z.iso.datetime({ offset: true });
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const TIMELINE_LIMITS = {
  title: 200,
  body: 10_000,
  symptomName: 120,
  severityMax: 10,
  place: 200,
  cancelReason: 500,
} as const;

export const symptomDetailsZSchema = z.strictObject({
  name: requiredText(TIMELINE_LIMITS.symptomName),
  severity: z.int().min(0).max(TIMELINE_LIMITS.severityMax).nullish(),
});

/** Fields every kind shares; what each kind requires is layered on below. */
const entryFields = {
  title: optionalText(TIMELINE_LIMITS.title),
  body: optionalText(TIMELINE_LIMITS.body),
  occurredAt,
  timeZone,
};

const noDetails = z.null().optional();

const timestampText = z.iso.datetime({ offset: true });
const onlyEvents = z.null({ error: "Only events have this" }).optional();

/** Kinds other than notes and events: never all-day, and none of an event's appointment fields. */
const notScheduled = {
  allDay: z.literal(false, { error: "Only notes and events can be all day" }).optional(),
  endsAt: onlyEvents,
  place: onlyEvents,
  cancelledAt: onlyEvents,
  cancelReason: onlyEvents,
  rescheduledTo: onlyEvents,
};

/** A note: it may be all day (a reminder for a day), nothing else an event has. */
const noteScheduling = { ...notScheduled, allDay: z.boolean().optional() };

/** An event's appointment fields: an end, all day, a place, and being cancelled or moved. */
const eventScheduling = {
  allDay: z.boolean().optional(),
  endsAt: timestampText.nullish(),
  place: optionalText(TIMELINE_LIMITS.place),
  cancelledAt: timestampText.nullish(),
  cancelReason: optionalText(TIMELINE_LIMITS.cancelReason),
  rescheduledTo: z.uuid().nullish(),
};

type Scheduled = {
  occurredAt: string;
  timeZone: string;
  allDay?: boolean;
  endsAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  rescheduledTo?: string | null;
};

/**
 * Rules across a note's or event's time fields: an all-day item starts at
 * the start of its day and has no end; an end is after the start; a reason
 * and a replacement only on a cancelled event.
 */
const checkScheduling = (value: Scheduled, ctx: z.core.$RefinementCtx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (value.allDay) {
    if (value.endsAt) issue("endsAt", "An all-day item has no end time");
    if (!isStartOfDay(value.occurredAt, value.timeZone))
      issue("occurredAt", "An all-day item starts at the start of its day");
  }
  if (value.endsAt && new Date(value.endsAt).getTime() <= new Date(value.occurredAt).getTime())
    issue("endsAt", "Must be after the start");
  if (!value.cancelledAt) {
    if (value.cancelReason) issue("cancelReason", "Only a cancelled event has a reason");
    if (value.rescheduledTo) issue("rescheduledTo", "Only a cancelled event can be rescheduled");
  }
};

/** A note's or event's text is its live document (note_document), never `body`. */
const noBody = z.null({ error: "Its text is its live document, not a body" }).optional();

/** Doses and medication changes are named by their medication, and say everything in `details`. */
const noTitle = optionalText(TIMELINE_LIMITS.title).refine((v) => v == null, {
  error: "It has no title: its medication names it",
});
const noText = z.null({ error: "It has no body: a dose's note is in its details" }).optional();

/**
 * The content of an entry, by kind: notes and events have no body (their
 * text is their live document); a note's title is optional and an event's
 * required. A symptom needs a name, vitals at least one reading, a dose and
 * a medication change their medication. Used on create, and on update
 * against the merged row.
 */
export const timelineEntryContentZSchema = z.discriminatedUnion("kind", [
  z
    .object({ ...entryFields, ...noteScheduling, kind: z.literal("note"), body: noBody, details: noDetails })
    .superRefine(checkScheduling),
  z.object({ ...entryFields, ...notScheduled, kind: z.literal("symptom"), details: symptomDetailsZSchema }),
  z
    .object({
      ...entryFields,
      ...eventScheduling,
      kind: z.literal("event"),
      title: requiredText(TIMELINE_LIMITS.title),
      body: noBody,
      details: noDetails,
    })
    .superRefine(checkScheduling),
  z.object({ ...entryFields, ...notScheduled, kind: z.literal("vital"), details: vitalDetailsZSchema }),
  z.object({
    ...entryFields,
    ...notScheduled,
    kind: z.literal("dose"),
    title: noTitle,
    body: noText,
    details: doseDetailsZSchema,
  }),
  z.object({
    ...entryFields,
    ...notScheduled,
    kind: z.literal("medicationChange"),
    title: noTitle,
    body: noText,
    details: medicationChangeEntryDetailsZSchema,
  }),
  z.object({
    ...entryFields,
    ...notScheduled,
    kind: z.literal("conditionChange"),
    title: noTitle,
    body: noText,
    details: conditionChangeDetailsZSchema,
  }),
]);
export type TimelineEntryContent = z.infer<typeof timelineEntryContentZSchema>;

/** Create input. `id` may come from an offline client; `recipientId` defaults to the group's recipient. */
export const timelineEntryCreateZSchema = z.intersection(
  z.object({ id: z.uuid().optional(), groupId: z.uuid(), recipientId: z.uuid().optional() }),
  timelineEntryContentZSchema,
);
export type TimelineEntryCreateInput = z.input<typeof timelineEntryCreateZSchema>;

/**
 * Upsert input (PowerSync's upload queue): a create whose `id` is required,
 * because the client made the row and replays must land on the same one.
 */
export const timelineEntryUpsertZSchema = z.intersection(
  z.object({ id: z.uuid(), groupId: z.uuid(), recipientId: z.uuid().optional() }),
  timelineEntryContentZSchema,
);
export type TimelineEntryUpsertInput = z.input<typeof timelineEntryUpsertZSchema>;

/** Update input: content only. Group, recipient and kind never change. */
export const timelineEntryUpdateZSchema = z.strictObject({
  title: entryFields.title,
  body: entryFields.body,
  occurredAt: occurredAt.optional(),
  timeZone: timeZone.optional(),
  // Checked against the entry's kind once merged with the stored row.
  details: z.union([symptomDetailsZSchema, vitalDetailsZSchema, doseDetailsZSchema]).nullish(),
  // Appointment fields, also checked against the kind once merged.
  allDay: z.boolean().optional(),
  endsAt: timestampText.nullish(),
  place: optionalText(TIMELINE_LIMITS.place),
  cancelledAt: timestampText.nullish(),
  cancelReason: optionalText(TIMELINE_LIMITS.cancelReason),
  rescheduledTo: z.uuid().nullish(),
});
export type TimelineEntryUpdateInput = z.input<typeof timelineEntryUpdateZSchema>;

export const timelineEntrySelectZSchema = createSelectSchema(timelineEntrySchema);
