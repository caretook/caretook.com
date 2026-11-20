import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { boolean, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { careRecipientSchema } from "../profiles/careRecipient";
import { audits, enumCheck, id, timestamps } from "../core/columns";
import { FUTURE_DATE_MESSAGE, isStartOfDay } from "../core/entryTiming";
import { toChangeTime } from "../medications/medication";
import { providerSchema } from "../providers/provider";

// Care periods: where the recipient's care happens, over time (at home, in
// hospital, in rehab…). A group has one track of them: stored by start only,
// a period ends where the next one starts, and the latest is current. Gaps
// and overlaps can't be stored. The track's rules are in carePeriodTrack.ts.
//
// Shaped for PowerSync like medication: `group_id` on the row, ids made on
// the device, and soft deletes (`deleted_at`) so a removal reaches every
// device. Deleting one extends the period before it.

/** The settings, in display order. Append new ones; a build that doesn't know one shows it as Other. */
export const CARE_PERIOD_TYPES = [
  "home",
  "emergency",
  "hospital",
  "rehab",
  "assistedLiving",
  "memoryCare",
  "nursingHome",
  "hospiceHome",
  "hospiceFacility",
  "other",
] as const;
export type CarePeriodType = (typeof CARE_PERIOD_TYPES)[number];

export const isCarePeriodType = (value: unknown): value is CarePeriodType =>
  (CARE_PERIOD_TYPES as readonly unknown[]).includes(value);

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const carePeriodSchema = pgTable(
  "care_period",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Redundant while a group has one recipient; ready for several (one track each).
    recipientId: uuid("recipient_id").notNull(),
    type: text("type", { enum: CARE_PERIOD_TYPES }).notNull(),
    // "Mercy General, cardiac unit". Required for `other`.
    label: text("label"),
    // Where: a provider from the group's directory (a hospital, a facility).
    placeProviderId: uuid("place_provider_id"),
    // "Room 412, bed B".
    placeDetail: text("place_detail"),
    // When it started. A date-only start is the first instant of its day in
    // the recipient's time zone, and shows without a time.
    startedAt: timestampColumn("started_at").notNull(),
    dateOnly: boolean("date_only").notNull().default(false),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of composite FKs (its notes document).
    unique("care_period_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the period's group (NO ACTION, like medication).
    foreignKey({
      name: "care_period_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    // The place is in the same group. NO ACTION: providers are only ever
    // soft-deleted (a deleted one stays linked and shows greyed).
    foreignKey({
      name: "care_period_place_fk",
      columns: [t.groupId, t.placeProviderId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }),
    index("care_period_group_started_idx").on(t.groupId, t.startedAt),
    enumCheck("care_period_type_check", t.type, CARE_PERIOD_TYPES),
  ],
);

export type CarePeriodSchema = typeof carePeriodSchema;
export type CarePeriodSelect = InferSelectModel<CarePeriodSchema>;
export type CarePeriodInsert = Omit<InferInsertModel<CarePeriodSchema>, ProtectedField>;
export type CarePeriodUpdate = Partial<CarePeriodInsert>;
export type CarePeriod = CarePeriodSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe): the same rules run in the form, on the device
// and on the server.
// ---------------------------------------------------------------------------

export const CARE_PERIOD_LIMITS = { label: 120, placeDetail: 200 } as const;

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

/** The field issue when an Other period has no label. */
export const OTHER_NEEDS_LABEL_ISSUE = { path: "label", message: "Say what this is" } as const;
/** The field issue when the place isn't a live provider in the group (the same on the device and the server). */
export const BAD_PLACE_ISSUE = {
  path: "placeProviderId",
  message: "Choose a place in this care group",
} as const;
/** The field issue for a start in the future: planned moves are appointments. */
export const FUTURE_START_ISSUE = { path: "startedAt", message: FUTURE_DATE_MESSAGE } as const;
/** The field issue for a date-only start that isn't the start of its day in the recipient's zone. */
export const DATE_ONLY_ISSUE = {
  path: "startedAt",
  message: "A start without a time is at the start of its day",
} as const;

const carePeriodFields = {
  type: z.enum(CARE_PERIOD_TYPES, { error: "Choose where care is" }),
  label: optionalText(CARE_PERIOD_LIMITS.label),
  placeProviderId: optionalId,
  placeDetail: optionalText(CARE_PERIOD_LIMITS.placeDetail),
  startedAt: z.iso.datetime({ offset: true, error: "Enter when it started" }),
  dateOnly: z.boolean().default(false),
};

const otherNeedsLabel = (value: { type: CarePeriodType; label: string | null }, ctx: z.RefinementCtx) => {
  if (value.type === "other" && !value.label)
    ctx.addIssue({
      code: "custom",
      path: [OTHER_NEEDS_LABEL_ISSUE.path],
      message: OTHER_NEEDS_LABEL_ISSUE.message,
    });
};

/**
 * A period's content. Used on create, and on update against the merged row.
 * Whether the place is a live provider in the group, the start isn't in the
 * future and a date-only start is at the start of its day need the clock,
 * the recipient's zone or the database: see `carePeriodStartIssue` and
 * `carePeriodService`.
 */
export const carePeriodContentZSchema = z.object(carePeriodFields).superRefine(otherNeedsLabel);
export type CarePeriodContent = z.output<typeof carePeriodContentZSchema>;
export type CarePeriodContentInput = z.input<typeof carePeriodContentZSchema>;

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const carePeriodCreateZSchema = z
  .object({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    recipientId: z.uuid().optional(),
    ...carePeriodFields,
  })
  .superRefine(otherNeedsLabel);
export type CarePeriodCreateInput = z.input<typeof carePeriodCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const carePeriodUpsertZSchema = z
  .object({ id: z.uuid(), groupId: z.uuid(), recipientId: z.uuid().optional(), ...carePeriodFields })
  .superRefine(otherNeedsLabel);
export type CarePeriodUpsertInput = z.input<typeof carePeriodUpsertZSchema>;

/** Update input: any content field. The group and recipient never change. */
export const carePeriodUpdateZSchema = z.strictObject({
  type: z.enum(CARE_PERIOD_TYPES, { error: "Choose where care is" }).optional(),
  label: z.string().nullish(),
  placeProviderId: z.uuid().nullish(),
  placeDetail: z.string().nullish(),
  startedAt: z.string().optional(),
  dateOnly: z.boolean().optional(),
});
export type CarePeriodUpdateInput = z.input<typeof carePeriodUpdateZSchema>;

/** A stored period's content fields, ready to merge a patch over and re-validate. */
export const carePeriodContentOf = (period: {
  type: string;
  label: string | null;
  placeProviderId: string | null;
  placeDetail: string | null;
  startedAt: string;
  dateOnly: boolean;
}): CarePeriodContentInput => ({
  type: period.type as CarePeriodType,
  label: period.label,
  placeProviderId: period.placeProviderId,
  placeDetail: period.placeDetail,
  // Postgres reads back "2026-11-17 10:00:00.000+00": the schema wants ISO.
  startedAt: toChangeTime(period.startedAt) ?? period.startedAt,
  dateOnly: period.dateOnly,
});

/**
 * What's wrong with a start, or null: it's more than `skewMs` after `now`
 * (planned moves are appointments), or it's date-only and not the start of
 * its day in the recipient's zone. Exactly `now + skewMs` is allowed. The
 * device passes its 5 minutes (`DEVICE_FUTURE_SKEW_MS`), the server its hour.
 */
export const carePeriodStartIssue = (
  { startedAt, dateOnly }: { startedAt: string; dateOnly: boolean },
  { now, skewMs, timeZone }: { now: Date; skewMs: number; timeZone: string },
) => {
  const at = new Date(startedAt).getTime();
  if (!Number.isFinite(at)) return null;
  if (at > now.getTime() + skewMs) return FUTURE_START_ISSUE;
  if (dateOnly && !isStartOfDay(startedAt, timeZone)) return DATE_ONLY_ISSUE;
  return null;
};
