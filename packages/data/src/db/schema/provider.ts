import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { ProtectedField } from "./columns";

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
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { audits, enumCheck, id, timestamps } from "./columns";

// A care group's directory of providers: clinicians, practices and
// facilities, pharmacies, and other contacts (an aide, a neighbor, the
// insurer's nurse line). Each belongs to one group; nothing is shared across
// groups.
//
// Shaped for PowerSync like timeline_entry: `group_id` on the row, ids made
// on the device, and soft deletes (`deleted_at`) so a removal reaches every
// device and entries linked to it can still show its name, greyed.

export const PROVIDER_TYPES = ["clinician", "practice", "pharmacy", "other"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_STATUSES = ["current", "past"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/** Types a clinician (or another contact) can say they work at. */
export const PRACTICE_TYPES = ["practice", "pharmacy"] as const satisfies readonly ProviderType[];
export const isPracticeType = (type: string): type is (typeof PRACTICE_TYPES)[number] =>
  (PRACTICE_TYPES as readonly string[]).includes(type);

/**
 * A practice or pharmacy becoming something clinicians can't work at. Refused
 * while live providers name it as their practice (practice ↔ pharmacy is fine).
 */
export const leavesPracticeTypes = (from: string, to: string) => isPracticeType(from) && !isPracticeType(to);

/** The field issue for that refusal, the same on the device and the server. */
export const PRACTICE_IN_USE_ISSUE = {
  path: "type",
  message: "Clinicians are linked to this practice. Move them to another practice first.",
} as const;

/**
 * Why a practice or pharmacy can't be deleted while live providers name it
 * as their practice: the same on the device and the server
 * (providerService:practiceHasProviders).
 */
export const PRACTICE_HAS_PROVIDERS_MESSAGE =
  "Providers are linked to this practice. Move them to another practice, or delete them, first.";

/** A labelled phone number ("Office", "Fax", "After hours"). */
export type ProviderPhone = { label: string; number: string };

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const providerSchema = pgTable(
  "provider",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    type: text("type", { enum: PROVIDER_TYPES }).notNull(),
    name: text("name").notNull(),
    // A clinician's specialty, or another contact's role.
    specialty: text("specialty"),
    // The practice (or pharmacy) a clinician works at, in the same group.
    practiceId: uuid("practice_id"),
    phones: jsonb("phones").$type<ProviderPhone[]>().notNull().default([]),
    email: text("email"),
    // Multi-line.
    address: text("address"),
    website: text("website"),
    status: text("status", { enum: PROVIDER_STATUSES }).notNull().default("current"),
    // Pinned on top of the list. Any number may be. (`primary` is an SQL keyword.)
    isPrimary: boolean("is_primary").notNull().default(false),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of composite FKs (practice_id, links, documents), so anything
    // attached to a provider is guaranteed to be in the provider's group.
    unique("provider_group_id_id_unique").on(t.groupId, t.id),
    // The practice must be in the same group. NO ACTION: providers are only
    // ever soft-deleted; deleting the group removes them all at once.
    foreignKey({
      name: "provider_practice_fk",
      columns: [t.groupId, t.practiceId],
      foreignColumns: [t.groupId, t.id] as [AnyPgColumn, AnyPgColumn],
    }),
    index("provider_group_name_idx").on(t.groupId, t.name),
    enumCheck("provider_type_check", t.type, PROVIDER_TYPES),
    enumCheck("provider_status_check", t.status, PROVIDER_STATUSES),
  ],
);

export type ProviderSchema = typeof providerSchema;
export type ProviderSelect = InferSelectModel<ProviderSchema>;
export type ProviderInsert = Omit<InferInsertModel<ProviderSchema>, ProtectedField>;
export type ProviderUpdate = Partial<ProviderInsert>;
export type Provider = ProviderSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe): the same rules run in forms, on the device and
// on the server.
// ---------------------------------------------------------------------------

export const PROVIDER_LIMITS = {
  name: 200,
  specialty: 120,
  phones: 6,
  phoneLabel: 40,
  phoneNumber: 40,
  email: 254,
  address: 500,
  website: 500,
} as const;

/** Optional text: trimmed, and empty means none (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

// Digits with the usual separators, an optional leading +, and an optional
// extension ("x123", "ext. 123", "#123").
const PHONE_RE = /^\+?[\d\s().-]*\d[\d\s().-]*(?:\s*(?:x|ext\.?|#)\s*\d+)?$/i;

export const providerPhoneZSchema = z.strictObject({
  label: z.string().trim().max(PROVIDER_LIMITS.phoneLabel).default(""),
  number: z
    .string()
    .trim()
    .min(1, { error: "Enter a phone number" })
    .max(PROVIDER_LIMITS.phoneNumber)
    .regex(PHONE_RE, { error: "Use digits, spaces, ( ) - . and an optional + or extension" }),
});

export const providerPhonesZSchema = z
  .array(providerPhoneZSchema)
  .max(PROVIDER_LIMITS.phones, { error: `At most ${PROVIDER_LIMITS.phones} phone numbers` });

/**
 * A website as typed: `https://` is assumed when there's no scheme. Only
 * http and https, with a host that has a dot ("clinic.example").
 */
export const isWebsite = (value: string) => {
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
};

const email = z
  .string()
  .trim()
  .max(PROVIDER_LIMITS.email)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, { error: "Enter an email address" });

const website = optionalText(PROVIDER_LIMITS.website).refine((v) => v === null || isWebsite(v), {
  error: "Enter a web address, like clinic.example",
});

/** Every content field, as stored. */
const providerFields = {
  type: z.enum(PROVIDER_TYPES),
  name: z.string().trim().min(1, { error: "Enter a name" }).max(PROVIDER_LIMITS.name),
  specialty: optionalText(PROVIDER_LIMITS.specialty),
  practiceId: z
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  phones: providerPhonesZSchema.default([]),
  email,
  address: optionalText(PROVIDER_LIMITS.address),
  website,
  status: z.enum(PROVIDER_STATUSES).default("current"),
  isPrimary: z.boolean().default(false),
};

/** Practices and pharmacies are the places others work at, so they don't have one themselves. */
const typeRules = (value: { type: ProviderType; practiceId: string | null }, ctx: z.RefinementCtx) => {
  if (value.practiceId && isPracticeType(value.type)) {
    ctx.addIssue({
      code: "custom",
      path: ["practiceId"],
      message: "A practice or pharmacy can't belong to another practice",
    });
  }
};

/**
 * A provider's content. Used on create, and on update against the merged
 * row. Which practice is allowed (a practice or pharmacy in the same group,
 * not deleted) needs the database: `providerService` checks it.
 */
export const providerContentZSchema = z.object(providerFields).superRefine(typeRules);
export type ProviderContent = z.output<typeof providerContentZSchema>;
export type ProviderContentInput = z.input<typeof providerContentZSchema>;

/** Create input. `id` may come from an offline device. */
export const providerCreateZSchema = z
  .object({ id: z.uuid().optional(), groupId: z.uuid(), ...providerFields })
  .superRefine(typeRules)
  .refine((v) => !v.id || v.id !== v.practiceId, {
    path: ["practiceId"],
    error: "A provider can't be its own practice",
  });
export type ProviderCreateInput = z.input<typeof providerCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const providerUpsertZSchema = z
  .object({ id: z.uuid(), groupId: z.uuid(), ...providerFields })
  .superRefine(typeRules)
  .refine((v) => v.id !== v.practiceId, {
    path: ["practiceId"],
    error: "A provider can't be its own practice",
  });
export type ProviderUpsertInput = z.input<typeof providerUpsertZSchema>;

/** Update input: any content field. The group never changes. */
export const providerUpdateZSchema = z.strictObject({
  type: providerFields.type.optional(),
  name: providerFields.name.optional(),
  specialty: z.string().nullish(),
  practiceId: z.uuid().nullish(),
  phones: providerPhonesZSchema.optional(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  website: z.string().nullish(),
  status: providerFields.status.unwrap().optional(),
  isPrimary: z.boolean().optional(),
});
export type ProviderUpdateInput = z.input<typeof providerUpdateZSchema>;

/** Parse `phones` as stored (jsonb, or JSON text on a device); anything malformed is no phones. */
export const parseProviderPhones = (value: unknown): ProviderPhone[] => {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  const parsed = providerPhonesZSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
};
