import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";
import type { VitalDetails } from "./vitals";

import { foreignKey, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { careRecipientSchema } from "./careRecipient";
import { audits, enumCheck, id, timestamps } from "./columns";
import { vitalDetailsZSchema } from "./vitals";

export const TIMELINE_ENTRY_KINDS = ["note", "symptom", "event", "vital"] as const;
export type TimelineEntryKind = (typeof TIMELINE_ENTRY_KINDS)[number];

/** Kind-specific fields: a symptom's name and severity, a vital's readings. */
export type SymptomDetails = { name: string; severity?: number | null };
export type TimelineEntryDetails = SymptomDetails | VitalDetails;

export const isSymptomDetails = (d: TimelineEntryDetails | null | undefined): d is SymptomDetails =>
  !!d && "name" in d;
export const isVitalDetails = (d: TimelineEntryDetails | null | undefined): d is VitalDetails =>
  !!d && "readings" in d;

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

/** A valid IANA time zone name, as the runtime understands it. */
export const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const timeZone = z.string().refine(isTimeZone, { message: "Unknown time zone" });
const occurredAt = z.iso.datetime({ offset: true });
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const TIMELINE_LIMITS = { title: 200, body: 10_000, symptomName: 120, severityMax: 10 } as const;

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

/** A note's text is its live document (note_document), never `body`. */
const noBody = z.null({ error: "A note's text is its live document, not a body" }).optional();

/**
 * The content of an entry, by kind: a note has no body (its text is its live
 * document) and an optional title, an event needs a title, a symptom a name,
 * vitals at least one reading. Used on create, and on update against the merged row.
 */
export const timelineEntryContentZSchema = z.discriminatedUnion("kind", [
  z.object({ ...entryFields, kind: z.literal("note"), body: noBody, details: noDetails }),
  z.object({ ...entryFields, kind: z.literal("symptom"), details: symptomDetailsZSchema }),
  z.object({
    ...entryFields,
    kind: z.literal("event"),
    title: requiredText(TIMELINE_LIMITS.title),
    details: noDetails,
  }),
  z.object({ ...entryFields, kind: z.literal("vital"), details: vitalDetailsZSchema }),
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
  details: z.union([symptomDetailsZSchema, vitalDetailsZSchema]).nullish(),
});
export type TimelineEntryUpdateInput = z.input<typeof timelineEntryUpdateZSchema>;

export const timelineEntrySelectZSchema = createSelectSchema(timelineEntrySchema);
