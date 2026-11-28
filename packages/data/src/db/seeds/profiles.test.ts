import { describe, expect, it } from "vitest";
import {
  careRecipientDetailsUpdateZSchema,
  careRecipientProfileZSchema,
  emergencyOrder,
  memberSharingZSchema,
  outsideContactsZSchema,
  userContactUpdateZSchema,
} from "../schema";
import { OUTSIDE_CONTACTS, RECIPIENT_BASICS, RECIPIENT_DETAILS, SEED_MEMBERS } from "./profiles";
import { canBeEmergencyContact, sharedContact } from "../../domain/profiles/profileVisibility";

// Seeds write straight to the tables, skipping the services' validation, so
// check them against the same rules the API enforces.
describe("profile seeds", () => {
  it("are a valid profile, details and outside contacts", () => {
    expect(careRecipientProfileZSchema.safeParse(RECIPIENT_BASICS).success).toBe(true);
    const { outsideContacts, ...details } = RECIPIENT_DETAILS;
    expect(careRecipientDetailsUpdateZSchema.parse(details)).toEqual(details);
    const contacts = outsideContacts.map(({ emergencyRank: _rank, ...c }) => c);
    expect(outsideContactsZSchema.parse(contacts)).toEqual(contacts);
  });

  it("are valid member contact details and sharing choices", () => {
    for (const member of SEED_MEMBERS) {
      expect(userContactUpdateZSchema.parse(member.contact)).toEqual(member.contact);
      expect(
        memberSharingZSchema.parse({ sharedFields: member.sharedFields, relationship: member.relationship }),
      ).toEqual({ sharedFields: member.sharedFields, relationship: member.relationship });
    }
  });

  it("only put members who share a phone on the emergency list, ranked 1…n", () => {
    for (const member of SEED_MEMBERS.filter((m) => m.emergencyRank !== null || m.isPrimaryContact)) {
      expect(canBeEmergencyContact(sharedContact(member.contact, member.sharedFields))).toBe(true);
    }
    expect(SEED_MEMBERS.filter((m) => m.isPrimaryContact)).toHaveLength(1);
    const order = emergencyOrder(
      SEED_MEMBERS.map((m) => ({ userId: m.email, emergencyRank: m.emergencyRank })),
      OUTSIDE_CONTACTS,
    );
    const ranks = [
      ...SEED_MEMBERS.map((m) => m.emergencyRank),
      ...OUTSIDE_CONTACTS.map((c) => c.emergencyRank),
    ].filter((r) => r !== null);
    expect(ranks.sort()).toEqual(order.map((_, i) => i + 1));
  });
});
