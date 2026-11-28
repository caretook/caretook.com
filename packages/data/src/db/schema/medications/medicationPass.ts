import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { MedicationSchedule, PassMovedDetails, ScheduleSlot } from "./medication";

import { sql } from "drizzle-orm";
import {
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { careRecipientSchema } from "../profiles/careRecipient";
import { audits, id, timestamps } from "../core/columns";
import { isPassSlot, medicationScheduleZSchema, scheduleTimeZSchema, toChangeTime } from "./medication";
import { uuidV5 } from "../../../domain/core/uuidV5";

// A care group's medication passes: the rounds medications are given in
// ("Morning · 08:00", "Evening · 20:00"). A medication's schedule names the
// passes it's taken in (`{ passId }` slots, see medication.ts), so moving a
// pass's time moves every medication in it.
//
// Shaped for PowerSync like medication: `group_id` on the row, ids made on
// the device, soft deletes. Times are "HH:MM" in the recipient's time zone.

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const medicationPassSchema = pgTable(
  "medication_pass",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Redundant while a group has one recipient; ready for several.
    recipientId: uuid("recipient_id").notNull(),
    name: text("name").notNull(),
    // "HH:MM", in the recipient's time zone.
    time: text("time").notNull(),
    // Where it sits in the day's list; ties fall back to the time.
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("medication_pass_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the pass's group (NO ACTION, like medication).
    foreignKey({
      name: "medication_pass_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    // Live names are unique per group, whatever their case (the service says
    // so first; this is the backstop for two saves at once).
    uniqueIndex("medication_pass_group_name_live_unique")
      .on(t.groupId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export type MedicationPassSchema = typeof medicationPassSchema;
export type MedicationPassSelect = InferSelectModel<MedicationPassSchema>;
export type MedicationPassInsert = Omit<InferInsertModel<MedicationPassSchema>, ProtectedField>;
export type MedicationPassUpdate = Partial<MedicationPassInsert>;
export type MedicationPass = MedicationPassSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe): the same rules on the device and the server.
// ---------------------------------------------------------------------------

export const MEDICATION_PASS_LIMITS = {
  name: 40,
  /** Live passes per group. */
  live: 8,
  sortOrder: 1000,
} as const;

/** Every new care group starts with these (`medicationPassService.addDefaults`). */
export const DEFAULT_PASSES = [
  { name: "Morning", time: "08:00" },
  { name: "Evening", time: "20:00" },
] as const;

const passFields = {
  name: z.string().trim().min(1, { error: "Enter a name" }).max(MEDICATION_PASS_LIMITS.name),
  time: scheduleTimeZSchema,
  sortOrder: z.int().min(0).max(MEDICATION_PASS_LIMITS.sortOrder).default(0),
};

/** A pass's content: used on create, and on update against the merged row. */
export const medicationPassContentZSchema = z.object(passFields);
export type MedicationPassContent = z.output<typeof medicationPassContentZSchema>;
export type MedicationPassContentInput = z.input<typeof medicationPassContentZSchema>;

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const medicationPassCreateZSchema = z.object({
  id: z.uuid().optional(),
  groupId: z.uuid(),
  recipientId: z.uuid().optional(),
  ...passFields,
});
export type MedicationPassCreateInput = z.input<typeof medicationPassCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const medicationPassUpsertZSchema = medicationPassCreateZSchema.extend({ id: z.uuid() });
export type MedicationPassUpsertInput = z.input<typeof medicationPassUpsertZSchema>;

/** Update input: rename, retime or reorder. The group and recipient never change. */
export const medicationPassUpdateZSchema = z.strictObject({
  name: passFields.name.optional(),
  time: scheduleTimeZSchema.optional(),
  sortOrder: z.int().min(0).max(MEDICATION_PASS_LIMITS.sortOrder).optional(),
});
export type MedicationPassUpdateInput = z.input<typeof medicationPassUpdateZSchema>;

// ---------------------------------------------------------------------------
// Pass rules (pure; the service and the device share them).
// ---------------------------------------------------------------------------

/** What the rules need of a pass. */
export type PassLike = {
  id: string;
  name: string;
  time: string;
  sortOrder: number;
  deletedAt?: string | null;
};

const isLive = (pass: PassLike) => !pass.deletedAt;

/** What a deleted pass reads as: its delete cleared its name (data-rights). */
export const REMOVED_PASS = "Removed med time";

/** A pass's name as screens show it: a deleted one's, cleared, reads `REMOVED_PASS`. */
export const passLabel = (pass: Pick<PassLike, "name">) => pass.name.trim() || REMOVED_PASS;

/**
 * Passes in the day's order: by time, then name. The `sort_order` column is
 * still written but no longer orders anything (B-701).
 */
export const sortPasses = <P extends PassLike>(passes: readonly P[]): P[] =>
  [...passes].sort(
    (a, b) =>
      a.time.localeCompare(b.time) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );

/** A name as uniqueness compares it: trimmed, case ignored. */
export const passNameKey = (name: string) => name.trim().toLocaleLowerCase("en");

/** Whether a live pass other than `exceptId` already has this name. */
export const passNameTaken = (passes: readonly PassLike[], name: string, exceptId?: string) =>
  passes.some((p) => isLive(p) && p.id !== exceptId && passNameKey(p.name) === passNameKey(name));

/** Whether another live pass fits in the group. */
export const canAddPass = (passes: readonly PassLike[]) =>
  passes.filter(isLive).length < MEDICATION_PASS_LIMITS.live;

/** The field issue for a taken name, the same on the device and the server. */
export const PASS_NAME_TAKEN_ISSUE = {
  path: "name",
  message: "Another med time already has that name",
} as const;
/** Why another pass can't be added. */
export const TOO_MANY_PASSES_MESSAGE = `A care group can have at most ${MEDICATION_PASS_LIMITS.live} med times`;

/** The sort order a new pass takes: after every pass so far. */
export const nextSortOrder = (passes: readonly PassLike[]) =>
  Math.min(
    MEDICATION_PASS_LIMITS.sortOrder,
    passes.filter(isLive).reduce((max, p) => Math.max(max, p.sortOrder + 1), 0),
  );

/** Whether a schedule has a slot in this pass. */
export const scheduleHasPass = (schedule: MedicationSchedule, passId: string) =>
  schedule.type === "scheduled" && schedule.slots.some((slot) => isPassSlot(slot) && slot.passId === passId);

/**
 * A schedule with one pass taken out: its slot becomes a time of its own at
 * the pass's time, the amount kept. When the schedule already has a slot at
 * that time, that one stays (keeping its amount, else taking the pass's).
 * Unchanged (the same object) when the schedule isn't in the pass.
 */
export const withoutPass = (
  schedule: MedicationSchedule,
  pass: Pick<PassLike, "id" | "time">,
): MedicationSchedule => {
  if (!scheduleHasPass(schedule, pass.id) || schedule.type !== "scheduled") return schedule;
  const own = schedule.slots.find((slot) => !isPassSlot(slot) && slot.time === pass.time);
  const passSlot = schedule.slots.find((slot) => isPassSlot(slot) && slot.passId === pass.id);
  const amount = own?.amount ?? passSlot?.amount;
  const slots: ScheduleSlot[] = [
    ...schedule.slots.filter((slot) => slot !== own && slot !== passSlot),
    amount ? { time: pass.time, amount } : { time: pass.time },
  ];
  return medicationScheduleZSchema.parse({ type: "scheduled", slots });
};

/**
 * The upload's flag on a pass delete's schedule rewrite (the device's
 * `_metadata` on each medication `removePass` rewrites, B-1006): the server's
 * own delete rewrites every schedule naming the pass, so it drops a flagged
 * PATCH's `schedule` (the device's copy may be stale) and applies the rest.
 * A medication's own schedule edit is unflagged.
 */
export const PASS_REWRITE_METADATA = "medication:passRewrite";

/** One slot of a schedule at its time of day. */
export type TimedSlot = {
  /** "HH:MM" in the recipient's zone: the pass's time, or the slot's own. */
  time: string;
  /** The pass, for a slot in one. */
  passId: string | null;
  amount: string | null;
};

/**
 * When a schedule's slots fall: each slot with its time (a pass slot at its
 * pass's time; a deleted pass keeps its last time), sorted by time. A slot
 * whose pass isn't known is left out. Empty for as needed.
 */
export const slotTimes = (
  schedule: MedicationSchedule,
  passes: readonly Pick<PassLike, "id" | "time">[],
): TimedSlot[] => {
  if (schedule.type !== "scheduled") return [];
  const timeOf = new Map(passes.map((p) => [p.id, p.time]));
  return schedule.slots
    .flatMap((slot): TimedSlot[] => {
      const amount = slot.amount ?? null;
      if (!isPassSlot(slot)) return [{ time: slot.time, passId: null, amount }];
      const time = timeOf.get(slot.passId);
      return time ? [{ time, passId: slot.passId, amount }] : [];
    })
    .sort((a, b) => a.time.localeCompare(b.time) || (a.passId ?? "").localeCompare(b.passId ?? ""));
};

/** The medications a pass has: current, live ones with a slot in it (what the Passes screen lists). */
export const medicationsInPass = <
  M extends { schedule: MedicationSchedule; status: string; deletedAt?: string | null },
>(
  medications: readonly M[],
  passId: string,
) => medications.filter((m) => !m.deletedAt && m.status === "current" && scheduleHasPass(m.schedule, passId));

/** The namespace for pass-moved entry ids (a fixed, random UUID; never change it). */
export const PASS_MOVED_NAMESPACE = "8d0f3e52-6a1b-4c9d-b7e4-2f5a91c3d68e";

/**
 * A pass-moved entry's id: the version 5 UUID of the pass and the time of
 * the change (the pass's `updated_at` as the writer set it), so the device's
 * entry and the one the service writes on upload are one row.
 */
export const passMovedId = (passId: string, changedAt: string | Date) => {
  const time = toChangeTime(changedAt);
  if (!time) throw new Error(`Not a time: ${String(changedAt)}`);
  return uuidV5(`${passId.toLowerCase()}:${time}`, PASS_MOVED_NAMESPACE);
};

/**
 * What a save did to a pass, as a `medicationChange` entry's details, or null
 * when its time didn't change (a rename or reorder records nothing).
 * `medicationIds` are the live medications in the pass.
 */
export const passMoved = (
  before: Pick<PassLike, "time">,
  after: Pick<PassLike, "id" | "name" | "time">,
  medicationIds: readonly string[],
): PassMovedDetails | null =>
  before.time === after.time
    ? null
    : {
        change: "passMoved",
        passId: after.id,
        passName: after.name,
        beforeTime: before.time,
        afterTime: after.time,
        medicationIds: [...medicationIds].sort(),
      };
