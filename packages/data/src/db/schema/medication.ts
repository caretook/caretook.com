import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import {
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { careRecipientSchema } from "./careRecipient";
import { audits, enumCheck, id, timestamps } from "./columns";
import { providerSchema } from "./provider";
import { uuidV5 } from "./uuidV5";

// A care group's medication list: what the recipient takes, how and when,
// who prescribed it and which pharmacy fills it. Each belongs to one group.
//
// Shaped for PowerSync like provider: `group_id` on the row, ids made on the
// device, and soft deletes (`deleted_at`) so a removal reaches every device
// and the doses and changes already on the timeline can still name it.
//
// Doses and changes to the list are timeline entries (kinds `dose` and
// `medicationChange`, below), so the timeline is the medication's history.

export const MEDICATION_FORMS = [
  "tablet",
  "capsule",
  "liquid",
  "injection",
  "patch",
  "inhaler",
  "drops",
  "cream",
  "other",
] as const;
export type MedicationForm = (typeof MEDICATION_FORMS)[number];

/** Current, completed (a course that finished as planned) or discontinued (stopped early, with a reason). */
export const MEDICATION_STATUSES = ["current", "completed", "discontinued"] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

export const MEDICATION_STOP_REASONS = ["sideEffects", "ineffective", "prescriberStopped", "other"] as const;
export type MedicationStopReason = (typeof MEDICATION_STOP_REASONS)[number];

/**
 * Every day at fixed times ("08:00", in the recipient's time zone), or as
 * needed with an optional maximum per day.
 */
export type MedicationSchedule =
  { type: "scheduled"; times: string[] } | { type: "asNeeded"; maxPerDay?: number };

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const medicationSchema = pgTable(
  "medication",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Redundant while a group has one recipient; ready for several.
    recipientId: uuid("recipient_id").notNull(),
    name: text("name").notNull(),
    // As written on the label: "10 mg", "250 mg/5 mL".
    strength: text("strength"),
    form: text("form", { enum: MEDICATION_FORMS }),
    // What's given each time: "1 tablet", "2 puffs".
    dose: text("dose"),
    directions: text("directions"),
    // What it's for.
    reason: text("reason"),
    // Validated by `medicationScheduleZSchema`; the database doesn't check its shape.
    schedule: jsonb("schedule").$type<MedicationSchedule>().notNull(),
    status: text("status", { enum: MEDICATION_STATUSES }).notNull().default("current"),
    startedOn: date("started_on", { mode: "string" }),
    stoppedOn: date("stopped_on", { mode: "string" }),
    stopReason: text("stop_reason", { enum: MEDICATION_STOP_REASONS }),
    stopNote: text("stop_note"),
    // From the group's provider directory: a clinician or practice, and a pharmacy.
    prescriberId: uuid("prescriber_id"),
    pharmacyId: uuid("pharmacy_id"),
    lastFilledOn: date("last_filled_on", { mode: "string" }),
    // As written on the label: "30 tablets", "1 bottle (150 mL)".
    quantity: text("quantity"),
    refillsLeft: integer("refills_left"),
    rxNumber: text("rx_number"),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of composite FKs (documents), so anything attached to a
    // medication is guaranteed to be in the medication's group.
    unique("medication_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the medication's group. NO ACTION, like
    // timeline_entry: a recipient with medications can't be deleted on its own.
    foreignKey({
      name: "medication_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    // The prescriber and pharmacy must be in the same group. NO ACTION:
    // providers are only ever soft-deleted (a deleted one stays linked and
    // shows greyed); deleting the group removes everything at once.
    foreignKey({
      name: "medication_prescriber_fk",
      columns: [t.groupId, t.prescriberId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }),
    foreignKey({
      name: "medication_pharmacy_fk",
      columns: [t.groupId, t.pharmacyId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }),
    index("medication_group_name_idx").on(t.groupId, t.name),
    enumCheck("medication_form_check", t.form, MEDICATION_FORMS),
    enumCheck("medication_status_check", t.status, MEDICATION_STATUSES),
    enumCheck("medication_stop_reason_check", t.stopReason, MEDICATION_STOP_REASONS),
  ],
);

export type MedicationSchema = typeof medicationSchema;
export type MedicationSelect = InferSelectModel<MedicationSchema>;
export type MedicationInsert = Omit<InferInsertModel<MedicationSchema>, ProtectedField>;
export type MedicationUpdate = Partial<MedicationInsert>;
export type Medication = MedicationSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe): the same rules run in forms, on the device and
// on the server.
// ---------------------------------------------------------------------------

export const MEDICATION_LIMITS = {
  name: 200,
  strength: 60,
  dose: 120,
  directions: 1000,
  reason: 300,
  stopNote: 500,
  quantity: 60,
  rxNumber: 60,
  refillsMax: 99,
  scheduleTimes: 8,
  maxPerDay: 24,
  doseAmount: 120,
  doseNote: 500,
} as const;

/** Optional text: trimmed, and empty means none (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalDate = z.iso
  .date({ error: "Enter a valid date" })
  .nullish()
  .transform((v) => v ?? null);

const optionalId = z
  .uuid()
  .nullish()
  .transform((v) => v ?? null);

const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .enum(values)
    .nullish()
    .transform((v) => v ?? null);

const SCHEDULE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A time of day, 24-hour "HH:MM". */
export const scheduleTimeZSchema = z.string().regex(SCHEDULE_TIME_RE, { error: "Use a time like 08:00" });

/**
 * A medication's schedule. Scheduled times are unique and stored sorted;
 * they're times of day in the recipient's time zone, every day.
 */
export const medicationScheduleZSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("scheduled"),
    times: z
      .array(scheduleTimeZSchema)
      .min(1, { error: "Add at least one time" })
      .max(MEDICATION_LIMITS.scheduleTimes, {
        error: `At most ${MEDICATION_LIMITS.scheduleTimes} times a day`,
      })
      .refine((times) => new Set(times).size === times.length, { error: "List each time once" })
      .transform((times) => [...times].sort()),
  }),
  z.strictObject({
    type: z.literal("asNeeded"),
    maxPerDay: z
      .int({ error: "Enter a whole number" })
      .min(1, { error: "At least 1 a day" })
      .max(MEDICATION_LIMITS.maxPerDay, { error: `At most ${MEDICATION_LIMITS.maxPerDay} a day` })
      .optional(),
  }),
]);

/** Parse a `schedule` as stored (jsonb, or JSON text on a device); null when it's malformed. */
export const parseMedicationSchedule = (value: unknown): MedicationSchedule | null => {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  const parsed = medicationScheduleZSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

/** Every content field, as stored. */
const medicationFields = {
  name: z.string().trim().min(1, { error: "Enter a name" }).max(MEDICATION_LIMITS.name),
  strength: optionalText(MEDICATION_LIMITS.strength),
  form: optionalEnum(MEDICATION_FORMS),
  dose: optionalText(MEDICATION_LIMITS.dose),
  directions: optionalText(MEDICATION_LIMITS.directions),
  reason: optionalText(MEDICATION_LIMITS.reason),
  schedule: medicationScheduleZSchema,
  status: z.enum(MEDICATION_STATUSES).default("current"),
  startedOn: optionalDate,
  stoppedOn: optionalDate,
  stopReason: optionalEnum(MEDICATION_STOP_REASONS),
  stopNote: optionalText(MEDICATION_LIMITS.stopNote),
  prescriberId: optionalId,
  pharmacyId: optionalId,
  lastFilledOn: optionalDate,
  quantity: optionalText(MEDICATION_LIMITS.quantity),
  refillsLeft: z
    .int({ error: "Enter a whole number" })
    .min(0, { error: "Refills left can't be negative" })
    .max(MEDICATION_LIMITS.refillsMax)
    .nullish()
    .transform((v) => v ?? null),
  rxNumber: optionalText(MEDICATION_LIMITS.rxNumber),
};

type StatusFields = {
  status: MedicationStatus;
  startedOn: string | null;
  stoppedOn: string | null;
  stopReason: MedicationStopReason | null;
  stopNote: string | null;
};

/**
 * A stopped medication (completed or discontinued) needs the date it
 * stopped, and a discontinued one needs a reason.
 */
const statusRules = (value: StatusFields, ctx: z.RefinementCtx) => {
  if (value.status === "current") return;
  if (!value.stoppedOn) {
    ctx.addIssue({ code: "custom", path: ["stoppedOn"], message: "Enter the date it was stopped" });
  } else if (value.startedOn && value.stoppedOn < value.startedOn) {
    ctx.addIssue({ code: "custom", path: ["stoppedOn"], message: "It can't stop before it started" });
  }
  if (value.status === "discontinued" && !value.stopReason) {
    ctx.addIssue({ code: "custom", path: ["stopReason"], message: "Choose why it was stopped" });
  }
};

/** A current medication has no stop date, reason or note; a completed one no reason. */
const clearStopFields = <T extends StatusFields>(value: T): T =>
  value.status === "current"
    ? { ...value, stoppedOn: null, stopReason: null, stopNote: null }
    : value.status === "completed"
      ? { ...value, stopReason: null }
      : value;

/**
 * A medication's content. Used on create, and on update against the merged
 * row. Which prescriber and pharmacy are allowed (a clinician or practice,
 * and a pharmacy, in the same group) needs the database: `medicationService`
 * checks it.
 */
export const medicationContentZSchema = z
  .object(medicationFields)
  .superRefine(statusRules)
  .transform(clearStopFields);
export type MedicationContent = z.output<typeof medicationContentZSchema>;
export type MedicationContentInput = z.input<typeof medicationContentZSchema>;

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const medicationCreateZSchema = z
  .object({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    recipientId: z.uuid().optional(),
    ...medicationFields,
  })
  .superRefine(statusRules)
  .transform(clearStopFields);
export type MedicationCreateInput = z.input<typeof medicationCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const medicationUpsertZSchema = z
  .object({ id: z.uuid(), groupId: z.uuid(), recipientId: z.uuid().optional(), ...medicationFields })
  .superRefine(statusRules)
  .transform(clearStopFields);
export type MedicationUpsertInput = z.input<typeof medicationUpsertZSchema>;

/** Update input: any content field. The group and recipient never change. */
export const medicationUpdateZSchema = z.strictObject({
  name: medicationFields.name.optional(),
  strength: z.string().nullish(),
  form: z.enum(MEDICATION_FORMS).nullish(),
  dose: z.string().nullish(),
  directions: z.string().nullish(),
  reason: z.string().nullish(),
  schedule: medicationScheduleZSchema.optional(),
  status: z.enum(MEDICATION_STATUSES).optional(),
  startedOn: z.string().nullish(),
  stoppedOn: z.string().nullish(),
  stopReason: z.enum(MEDICATION_STOP_REASONS).nullish(),
  stopNote: z.string().nullish(),
  prescriberId: z.uuid().nullish(),
  pharmacyId: z.uuid().nullish(),
  lastFilledOn: z.string().nullish(),
  quantity: z.string().nullish(),
  refillsLeft: z.number().nullish(),
  rxNumber: z.string().nullish(),
});
export type MedicationUpdateInput = z.input<typeof medicationUpdateZSchema>;

/** A stored medication's content fields, ready to merge a patch over and re-validate. */
export const medicationContentOf = (medication: MedicationContent): MedicationContent => ({
  name: medication.name,
  strength: medication.strength,
  form: medication.form,
  dose: medication.dose,
  directions: medication.directions,
  reason: medication.reason,
  schedule: medication.schedule,
  status: medication.status,
  startedOn: medication.startedOn,
  stoppedOn: medication.stoppedOn,
  stopReason: medication.stopReason,
  stopNote: medication.stopNote,
  prescriberId: medication.prescriberId,
  pharmacyId: medication.pharmacyId,
  lastFilledOn: medication.lastFilledOn,
  quantity: medication.quantity,
  refillsLeft: medication.refillsLeft,
  rxNumber: medication.rxNumber,
});

// ---------------------------------------------------------------------------
// Prescriber and pharmacy: which provider types each may be.
// ---------------------------------------------------------------------------

export const PRESCRIBER_TYPES = ["clinician", "practice"] as const;
export const PHARMACY_TYPES = ["pharmacy"] as const;
export const isPrescriberType = (type: string) => (PRESCRIBER_TYPES as readonly string[]).includes(type);
export const isPharmacyType = (type: string) => (PHARMACY_TYPES as readonly string[]).includes(type);

/** The field issues for a refused prescriber or pharmacy, the same on the device and the server. */
export const BAD_PRESCRIBER_ISSUE = {
  path: "prescriberId",
  message: "Choose a clinician or practice in this care group",
} as const;
export const BAD_PHARMACY_ISSUE = {
  path: "pharmacyId",
  message: "Choose a pharmacy in this care group",
} as const;

// ---------------------------------------------------------------------------
// Timeline entry details for the two medication kinds (see timelineEntry.ts).
// ---------------------------------------------------------------------------

export const DOSE_STATUSES = ["given", "skipped", "refused"] as const;
export type DoseStatus = (typeof DOSE_STATUSES)[number];

/**
 * A `dose` entry: a medication was given, skipped or refused at the entry's
 * time. `scheduledFor` is the slot it answers ("08:00"), when it answers one.
 */
export const doseDetailsZSchema = z.strictObject({
  medicationId: z.uuid(),
  status: z.enum(DOSE_STATUSES),
  amount: z.string().trim().max(MEDICATION_LIMITS.doseAmount).nullish(),
  scheduledFor: scheduleTimeZSchema.nullish(),
  note: z.string().trim().max(MEDICATION_LIMITS.doseNote).nullish(),
});
export type DoseDetails = z.infer<typeof doseDetailsZSchema>;

/** The fields whose changes are recorded on the timeline. Refill, reason and provider edits aren't. */
export const MEDICATION_TRACKED_FIELDS = [
  "name",
  "strength",
  "form",
  "dose",
  "directions",
  "schedule",
] as const;
export type MedicationTrackedField = (typeof MEDICATION_TRACKED_FIELDS)[number];

export const MEDICATION_CHANGES = ["started", "changed", "stopped", "resumed"] as const;
export type MedicationChangeType = (typeof MEDICATION_CHANGES)[number];

export const MEDICATION_STOP_STATUSES = [
  "completed",
  "discontinued",
] as const satisfies readonly MedicationStatus[];

/** Tracked fields at one moment: all of them for `started`, only the changed ones otherwise. */
const medicationSummaryZSchema = z.strictObject({
  name: z.string().optional(),
  strength: z.string().nullable().optional(),
  form: z.enum(MEDICATION_FORMS).nullable().optional(),
  dose: z.string().nullable().optional(),
  directions: z.string().nullable().optional(),
  schedule: medicationScheduleZSchema.optional(),
});
export type MedicationSummary = z.infer<typeof medicationSummaryZSchema>;

/**
 * A `medicationChange` entry: written with the medication, never by hand.
 * - `started`: `after` has the tracked fields that are set.
 * - `changed`: `fields`, with `before` and `after` for just those.
 * - `stopped`: `stopStatus` (completed or discontinued), `stopReason`, `stopNote`.
 * - `resumed`: back to current.
 * A stop or restart saved together with field edits carries `fields`,
 * `before` and `after` too.
 */
export const medicationChangeDetailsZSchema = z.strictObject({
  medicationId: z.uuid(),
  change: z.enum(MEDICATION_CHANGES),
  fields: z.array(z.enum(MEDICATION_TRACKED_FIELDS)).min(1).optional(),
  before: medicationSummaryZSchema.optional(),
  after: medicationSummaryZSchema.optional(),
  stopStatus: z.enum(MEDICATION_STOP_STATUSES).optional(),
  stopReason: z.enum(MEDICATION_STOP_REASONS).nullish(),
  stopNote: z.string().nullish(),
});
export type MedicationChangeDetails = z.infer<typeof medicationChangeDetailsZSchema>;

type ChangeSource = Pick<MedicationContent, MedicationTrackedField | "status" | "stopReason" | "stopNote">;

const sameSchedule = (a: MedicationSchedule, b: MedicationSchedule) => {
  if (a.type === "scheduled") {
    return (
      b.type === "scheduled" && a.times.length === b.times.length && a.times.every((t, i) => t === b.times[i])
    );
  }
  return b.type === "asNeeded" && (a.maxPerDay ?? null) === (b.maxPerDay ?? null);
};

const sameField = (field: MedicationTrackedField, a: ChangeSource, b: ChangeSource) =>
  field === "schedule" ? sameSchedule(a.schedule, b.schedule) : (a[field] ?? null) === (b[field] ?? null);

const summaryOf = (source: ChangeSource, fields: readonly MedicationTrackedField[]): MedicationSummary =>
  Object.fromEntries(fields.map((field) => [field, source[field] ?? null]));

/**
 * What a save did to a medication, as a `medicationChange` entry's details
 * (without the medication's id), or null when nothing the timeline records
 * changed. `before` is null for a new medication.
 *
 * Pure, and shared: the service and the device both write the entry from it,
 * in the same transaction as the medication.
 */
export const medicationChange = (
  before: ChangeSource | null,
  after: ChangeSource,
): Omit<MedicationChangeDetails, "medicationId"> | null => {
  if (!before) {
    const set = MEDICATION_TRACKED_FIELDS.filter((field) => after[field] != null);
    return { change: "started", after: summaryOf(after, set) };
  }

  const fields = MEDICATION_TRACKED_FIELDS.filter((field) => !sameField(field, before, after));
  const edits = fields.length
    ? { fields, before: summaryOf(before, fields), after: summaryOf(after, fields) }
    : {};

  if (before.status !== after.status) {
    if (after.status === "current") return { change: "resumed", ...edits };
    return {
      change: "stopped",
      stopStatus: after.status,
      stopReason: after.stopReason ?? null,
      stopNote: after.stopNote ?? null,
      ...edits,
    };
  }
  return fields.length ? { change: "changed", ...edits } : null;
};

/** The namespace for change entry ids (a fixed, random UUID; never change it). */
export const MEDICATION_CHANGE_NAMESPACE = "3b8a6d14-52c7-4e0b-9f61-a4d07c2e5b93";

/**
 * A timestamp as the change id and the entry use it: ISO 8601 in UTC at
 * millisecond precision. Accepts a device's text ("2026-11-17T21:45:25.229000Z",
 * or with a space) as well as ISO; null when it isn't a time.
 */
export const toChangeTime = (value: string | Date): string | null => {
  const text = value instanceof Date ? value.toISOString() : value.trim().replace(" ", "T");
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(text);
  if (!m) return null;
  const ms = (m[2] ?? "").padEnd(3, "0").slice(0, 3);
  // Postgres writes a whole-hour offset as "+00".
  const offset = /^[+-]\d{2}$/.test(m[3] ?? "") ? `${m[3]}:00` : (m[3] ?? "Z");
  const date = new Date(`${m[1]}.${ms}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * A change entry's id: the version 5 UUID of the medication's id and the
 * time of the change (the medication's `updated_at` as the writer set it).
 * The device and the server derive the same id for the same save, so the
 * entry a device wrote and the one the service writes on upload are one row,
 * and a replayed upload changes nothing.
 */
export const medicationChangeId = (medicationId: string, changedAt: string | Date) => {
  const time = toChangeTime(changedAt);
  if (!time) throw new Error(`Not a time: ${String(changedAt)}`);
  return uuidV5(`${medicationId.toLowerCase()}:${time}`, MEDICATION_CHANGE_NAMESPACE);
};
