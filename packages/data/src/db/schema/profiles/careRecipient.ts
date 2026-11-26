import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { date, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, enumCheck, id, timestamps } from "../core/columns";
import { timeZoneZSchema } from "../core/timeZone";

/** The recipient's wishes in an emergency. */
export const CODE_STATUSES = ["fullCode", "dnr", "dnrPolst"] as const;
export type CodeStatus = (typeof CODE_STATUSES)[number];

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const RECIPIENT_LIMITS = {
  name: 120,
  preferredName: 120,
  primaryLanguage: 60,
  pronouns: 40,
  notes: 1000,
} as const;

// The person a care group looks after: a profile, not an account. Exactly
// one per group for now (the unique group_id); dropping that constraint is
// all it takes to allow several later.
export const careRecipientSchema = pgTable(
  "care_recipient",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .unique()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    preferredName: text("preferred_name"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    // The note for helpers ("hard of hearing on the left; uses a walker").
    notes: text("notes"),
    // The recipient's IANA time zone: where they live. A medication's schedule
    // times are in it, so "8:00" is the same moment for a caretaker elsewhere.
    timeZone: text("time_zone").notNull(),
    // The medical basics every member sees (profiles).
    codeStatus: text("code_status", { enum: CODE_STATUSES }),
    bloodType: text("blood_type", { enum: BLOOD_TYPES }),
    primaryLanguage: text("primary_language"),
    pronouns: text("pronouns"),
    // When someone recorded "No known allergies" (an empty allergy list then
    // means none, not unknown). Cleared when an allergy is added.
    noKnownAllergiesAt: timestamp("no_known_allergies_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    }),
    // When someone recorded "No known conditions" (conditions). Cleared when
    // a condition is added.
    noKnownConditionsAt: timestamp("no_known_conditions_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    }),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of composite FKs (e.g. timeline_entry), so the database itself
    // guarantees a row's recipient belongs to the row's group.
    unique("care_recipient_group_id_id_unique").on(t.groupId, t.id),
    enumCheck("care_recipient_code_status_check", t.codeStatus, CODE_STATUSES),
    enumCheck("care_recipient_blood_type_check", t.bloodType, BLOOD_TYPES),
  ],
);

export type CareRecipientSchema = typeof careRecipientSchema;
export type CareRecipientSelect = InferSelectModel<CareRecipientSchema>;
export type CareRecipientInsert = Omit<InferInsertModel<CareRecipientSchema>, ProtectedField>;
export type CareRecipientUpdate = Partial<CareRecipientInsert>;
export type CareRecipient = CareRecipientSelect;

const name = z.string().trim().min(1, { error: "Enter a name" }).max(RECIPIENT_LIMITS.name);
/** Optional text: trimmed, and empty means none (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `At most ${max} characters` })
    .nullish()
    .transform((v) => (v ? v : null));

const preferredName = optionalText(RECIPIENT_LIMITS.preferredName);
const dateOfBirth = z.iso.date().nullish();
const timeZone = timeZoneZSchema;
const optionalTimeZone = timeZone.optional();

const codeStatus = z
  .enum(CODE_STATUSES)
  .nullish()
  .transform((v) => v ?? null);
const bloodType = z
  .enum(BLOOD_TYPES)
  .nullish()
  .transform((v) => v ?? null);
const primaryLanguage = optionalText(RECIPIENT_LIMITS.primaryLanguage);
const pronouns = optionalText(RECIPIENT_LIMITS.pronouns);
const notes = optionalText(RECIPIENT_LIMITS.notes);

export const careRecipientSelectZSchema = /* @__PURE__ */ createSelectSchema(careRecipientSchema);
export const careRecipientInsertZSchema = /* @__PURE__ */ createInsertSchema(careRecipientSchema, {
  name,
  preferredName,
  dateOfBirth,
  timeZone,
  codeStatus,
  bloodType,
  primaryLanguage,
  pronouns,
  notes,
});
export const careRecipientUpdateZSchema = /* @__PURE__ */ createUpdateSchema(careRecipientSchema, {
  name,
  preferredName,
  dateOfBirth,
  timeZone: optionalTimeZone,
  codeStatus,
  bloodType,
  primaryLanguage,
  pronouns,
  notes,
});

/**
 * The profile fields every member sees and writers edit: the name, preferred
 * name and birthday, the medical basics, the note for helpers and the time
 * zone (edited in group settings). Each is optional: what's left out keeps
 * its value, and an empty text clears it.
 * Plain zod, not a pick of `careRecipientUpdateZSchema`: the web app parses
 * with it, and drizzle-zod keeps all of zod (its locales, JSON Schema) in the
 * app's first chunks (B-872).
 */
export const careRecipientProfileZSchema = z
  .object({
    name,
    preferredName,
    dateOfBirth,
    codeStatus,
    bloodType,
    primaryLanguage,
    pronouns,
    notes,
    timeZone,
  })
  .partial();
export type CareRecipientProfileInput = z.infer<typeof careRecipientProfileZSchema>;
