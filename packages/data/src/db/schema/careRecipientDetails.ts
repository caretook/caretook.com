import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { ProtectedField } from "./columns";
import type { ContactPhone } from "./contactFields";

import { foreignKey, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { careRecipientSchema } from "./careRecipient";
import { audits, id, timestamps } from "./columns";
import {
  CONTACT_LIMITS,
  contactPhonesZSchema,
  optionalAddressZSchema,
  optionalEmailZSchema,
  optionalTextZSchema,
  phoneNumberZSchema,
} from "./contactFields";

// The recipient's sensitive details (profiles): their phones, email and
// address, insurance plans, and outside emergency contacts (people without
// an account, such as a neighbour). Owners, admins and caretakers only: it
// syncs through the `care_group_writers` stream, so viewers' devices never
// hold it. One row per recipient; its id is the recipient's id.
//
// Every write is online, through careRecipientDetailsService and
// emergencyContactService; nothing here is in the upload switch.

export const INSURANCE_RANKS = ["primary", "secondary", "other"] as const;
export type InsuranceRank = (typeof INSURANCE_RANKS)[number];

export const DETAILS_LIMITS = {
  insurance: 6,
  insurer: 120,
  planName: 120,
  memberId: 60,
  groupNumber: 60,
  outsideContacts: 10,
} as const;

/** One insurance plan, as stored. */
export type InsurancePlan = {
  id: string;
  rank: InsuranceRank;
  insurer: string;
  planName: string | null;
  memberId: string;
  groupNumber: string | null;
  phone: string | null;
};

/** Someone without an account on the emergency list. `emergencyRank` is their place on it, if any. */
export type OutsideContact = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string;
  emergencyRank: number | null;
};

export const careRecipientDetailsSchema = pgTable(
  "care_recipient_details",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .unique()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").notNull(),
    phones: jsonb("phones").$type<ContactPhone[]>().notNull().default([]),
    email: text("email"),
    // Multi-line.
    address: text("address"),
    insurance: jsonb("insurance").$type<InsurancePlan[]>().notNull().default([]),
    outsideContacts: jsonb("outside_contacts").$type<OutsideContact[]>().notNull().default([]),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // The recipient must be the group's; deleting it (or the group) removes these.
    foreignKey({
      name: "care_recipient_details_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id] as [AnyPgColumn, AnyPgColumn],
    }).onDelete("cascade"),
  ],
);

export type CareRecipientDetailsSchema = typeof careRecipientDetailsSchema;
export type CareRecipientDetailsSelect = InferSelectModel<CareRecipientDetailsSchema>;
export type CareRecipientDetailsInsert = Omit<InferInsertModel<CareRecipientDetailsSchema>, ProtectedField>;
export type CareRecipientDetails = CareRecipientDetailsSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe)
// ---------------------------------------------------------------------------

/** A new item's id: made here when the form sends none. */
const itemId = z.uuid().default(() => crypto.randomUUID());

const required = (max: number, error: string) => z.string().trim().min(1, { error }).max(max);

export const insurancePlanZSchema = z.strictObject({
  id: itemId,
  rank: z.enum(INSURANCE_RANKS).default("primary"),
  insurer: required(DETAILS_LIMITS.insurer, "Enter the insurer"),
  planName: optionalTextZSchema(DETAILS_LIMITS.planName),
  memberId: required(DETAILS_LIMITS.memberId, "Enter the member ID"),
  groupNumber: optionalTextZSchema(DETAILS_LIMITS.groupNumber),
  phone: phoneNumberZSchema
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});
export type InsurancePlanInput = z.input<typeof insurancePlanZSchema>;

/** Ids are unique within a list. */
const uniqueIds = <T extends { id: string }>(items: T[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: "Duplicate id" });
    seen.add(item.id);
  });
};

export const insurancePlansZSchema = z
  .array(insurancePlanZSchema)
  .max(DETAILS_LIMITS.insurance, { error: `At most ${DETAILS_LIMITS.insurance} insurance plans` })
  .superRefine((plans, ctx) => {
    uniqueIds(plans, ctx);
    // One primary and one secondary plan at most; any number of others.
    for (const rank of ["primary", "secondary"] as const) {
      plans.forEach((plan, i) => {
        if (plan.rank === rank && plans.findIndex((p) => p.rank === rank) !== i) {
          ctx.addIssue({ code: "custom", path: [i, "rank"], message: `Only one plan can be ${rank}` });
        }
      });
    }
  });

export const outsideContactZSchema = z.strictObject({
  id: itemId,
  name: required(CONTACT_LIMITS.name, "Enter a name"),
  relationship: optionalTextZSchema(CONTACT_LIMITS.relationship),
  phone: phoneNumberZSchema,
});
export type OutsideContactInput = z.input<typeof outsideContactZSchema>;

/**
 * The outside contacts, as owners and admins edit them. Their places on the
 * emergency list aren't part of it: those are set with the whole order
 * (`emergencyOrderZSchema`), and kept for contacts that stay.
 */
export const outsideContactsZSchema = z
  .array(outsideContactZSchema)
  .max(DETAILS_LIMITS.outsideContacts, {
    error: `At most ${DETAILS_LIMITS.outsideContacts} outside contacts`,
  })
  .superRefine(uniqueIds);

/**
 * What writers edit in the Contact and Insurance sheets. Each field is
 * optional: what's left out keeps its value. Outside contacts are edited
 * separately, by owners and admins (`outsideContactsZSchema`).
 */
export const careRecipientDetailsUpdateZSchema = z.strictObject({
  phones: contactPhonesZSchema.optional(),
  email: optionalEmailZSchema.optional(),
  address: optionalAddressZSchema.optional(),
  insurance: insurancePlansZSchema.optional(),
});
export type CareRecipientDetailsUpdateInput = z.input<typeof careRecipientDetailsUpdateZSchema>;
