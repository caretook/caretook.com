import type { ContactValues, InsurancePlan, OutsideContact, SharedField } from "../schema";

import { and, eq, inArray } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import {
  careGroupMemberSchema,
  careRecipientDetailsSchema,
  careRecipientSchema,
  memberContactShareSchema,
  userContactSchema,
  userSchema,
} from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { sharedContact, sharesAnything } from "../../domain/profiles/profileVisibility";

// Profiles for "Dev Family" (profiles slice 1): Grandma Pat's basics and
// note for helpers, her contact details and two insurance plans, an outside
// emergency contact, contact details and sharing for member@ and
// caretaker@, and the emergency list with a primary contact. All
// fictional: 555-01xx numbers, @example.com addresses, made-up member IDs.
//
// Own ids (…3f1d2bc0…), following list order: append only.

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

const profileId = (n: number) => `0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc0${String(n).padStart(4, "0")}`;

export const RECIPIENT_BASICS = {
  codeStatus: "dnrPolst",
  bloodType: "O+",
  primaryLanguage: "English",
  pronouns: "she/her",
  notes: "Hard of hearing on the left: sit on her right. Uses a walker indoors. Likes tea, not coffee.",
} as const;

export const RECIPIENT_INSURANCE: InsurancePlan[] = [
  {
    id: profileId(1),
    rank: "primary",
    insurer: "Medicare",
    planName: "Part A and B",
    memberId: "1EG4-TE5-MK72",
    groupNumber: null,
    phone: "(555) 010-3300",
  },
  {
    id: profileId(2),
    rank: "secondary",
    insurer: "Example Mutual Health",
    planName: "Medigap Plan G",
    memberId: "EMH-448120-07",
    groupNumber: "GRP-55021",
    phone: "(555) 010-3310",
  },
];

export const OUTSIDE_CONTACTS: OutsideContact[] = [
  {
    id: profileId(3),
    name: "Rosa Example",
    relationship: "Neighbour",
    phone: "(555) 010-4410",
    emergencyRank: 3,
  },
];

export const RECIPIENT_DETAILS = {
  phones: [{ label: "Home", number: "(555) 010-2231" }],
  email: "pat.example@example.com",
  address: "1428 Elm Street\nSpringfield, OR 97477",
  insurance: RECIPIENT_INSURANCE,
  outsideContacts: OUTSIDE_CONTACTS,
};

type SeedMember = {
  email: string;
  contactId: string;
  contact: ContactValues;
  relationship: string;
  sharedFields: SharedField[];
  emergencyRank: number | null;
  isPrimaryContact: boolean;
};

export const SEED_MEMBERS: SeedMember[] = [
  {
    email: "member@example.com",
    contactId: profileId(4),
    contact: {
      phones: [{ label: "Mobile", number: "(555) 010-1001" }],
      contactEmail: "dev.member.contact@example.com",
      address: "77 Example Court\nEugene, OR 97401",
    },
    relationship: "Son",
    // Not the address: viewers see the phone and email only.
    sharedFields: ["phones", "email"],
    emergencyRank: 1,
    isPrimaryContact: true,
  },
  {
    email: "caretaker@example.com",
    contactId: profileId(5),
    contact: {
      phones: [{ label: "Mobile", number: "(555) 010-1002" }],
      contactEmail: null,
      address: null,
    },
    relationship: "Aide from Sunrise Home Care",
    sharedFields: ["phones"],
    emergencyRank: 2,
    isPrimaryContact: false,
  },
];

export const seed = async () => {
  const db = getDb();

  // The basics (re-seeding sets them again).
  await db
    .update(careRecipientSchema)
    .set(RECIPIENT_BASICS)
    .where(and(eq(careRecipientSchema.id, DEV_RECIPIENT_ID), eq(careRecipientSchema.groupId, DEV_GROUP_ID)));

  await db
    .insert(careRecipientDetailsSchema)
    .values({
      id: DEV_RECIPIENT_ID,
      groupId: DEV_GROUP_ID,
      recipientId: DEV_RECIPIENT_ID,
      ...RECIPIENT_DETAILS,
      ...seedAudits,
    })
    .onConflictDoNothing({ target: careRecipientDetailsSchema.id });

  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(
      inArray(
        userSchema.email,
        SEED_MEMBERS.map((m) => m.email),
      ),
    );
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));

  const memberships = await db
    .select()
    .from(careGroupMemberSchema)
    .where(eq(careGroupMemberSchema.groupId, DEV_GROUP_ID));
  // Leave the emergency list alone once anyone has changed it.
  const listUntouched = memberships.every((m) => m.emergencyRank === null && !m.isPrimaryContact);

  for (const member of SEED_MEMBERS) {
    const userId = idByEmail.get(member.email);
    const membership = memberships.find((m) => m.userId === userId);
    if (!userId || !membership) continue;

    await db
      .insert(userContactSchema)
      .values({ id: member.contactId, userId, ...member.contact, ...seedAudits })
      .onConflictDoNothing();

    if (membership.sharedFields.length === 0 && membership.relationship === null) {
      await db
        .update(careGroupMemberSchema)
        .set({
          relationship: member.relationship,
          sharedFields: member.sharedFields,
          ...(listUntouched && {
            emergencyRank: member.emergencyRank,
            isPrimaryContact: member.isPrimaryContact,
          }),
        })
        .where(eq(careGroupMemberSchema.id, membership.id));

      // The projection, as memberSharingService would write it.
      const share = sharedContact(member.contact, member.sharedFields);
      if (sharesAnything(share)) {
        await db
          .insert(memberContactShareSchema)
          .values({ id: membership.id, groupId: DEV_GROUP_ID, userId, ...share, ...seedAudits })
          .onConflictDoNothing();
      }
    }
  }
};
