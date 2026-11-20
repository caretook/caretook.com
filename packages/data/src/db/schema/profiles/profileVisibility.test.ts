import type { GroupRoleName } from "../../../constants/roles";
import type { RecipientFieldGroup } from "./profileVisibility";

import { describe, expect, it } from "vitest";
import {
  canBeEmergencyContact,
  canEditRecipient,
  canManageEmergencyContacts,
  canReadRecipient,
  readableRecipientGroups,
  sharedContact,
  sharesAnything,
  visibleSharedFields,
} from "./profileVisibility";

const ROLES: (GroupRoleName | null)[] = ["owner", "admin", "caretaker", "viewer", null];

// role → [identity, basics, details, outsideContacts]
const READS: Record<string, boolean[]> = {
  owner: [true, true, true, true],
  admin: [true, true, true, true],
  caretaker: [true, true, true, true],
  viewer: [true, true, false, false],
  null: [false, false, false, false],
};
const EDITS: Record<string, boolean[]> = {
  owner: [true, true, true, true],
  admin: [true, true, true, true],
  caretaker: [true, true, true, false],
  viewer: [false, false, false, false],
  null: [false, false, false, false],
};
const GROUPS: RecipientFieldGroup[] = ["identity", "basics", "details", "outsideContacts"];

describe("recipient visibility", () => {
  for (const role of ROLES) {
    it(`${String(role)} reads and edits what the table says`, () => {
      expect(GROUPS.map((g) => canReadRecipient(role, g))).toEqual(READS[String(role)]);
      expect(GROUPS.map((g) => canEditRecipient(role, g))).toEqual(EDITS[String(role)]);
    });
  }

  it("lists the groups a role reads", () => {
    expect(readableRecipientGroups("viewer")).toEqual(["identity", "basics"]);
    expect(readableRecipientGroups("caretaker")).toEqual([
      "identity",
      "basics",
      "details",
      "outsideContacts",
    ]);
    expect(readableRecipientGroups(undefined)).toEqual([]);
  });

  it("lets only owners and admins manage the emergency list", () => {
    expect(ROLES.map(canManageEmergencyContacts)).toEqual([true, true, false, false, false]);
  });
});

describe("member sharing", () => {
  const contact = {
    phones: [{ label: "Mobile", number: "555 010 1001" }],
    contactEmail: "me@example.com",
    address: "1 Example Way",
  };

  it("shares nothing by default", () => {
    const share = sharedContact(contact, []);
    expect(share).toEqual({ phones: null, email: null, address: null });
    expect(sharesAnything(share)).toBe(false);
    expect(canBeEmergencyContact(share)).toBe(false);
  });

  it("shows only the chosen fields", () => {
    const share = sharedContact(contact, ["phones", "address"]);
    expect(share).toEqual({ phones: contact.phones, email: null, address: "1 Example Way" });
    expect(visibleSharedFields(share)).toEqual(["phones", "address"]);
    expect(canBeEmergencyContact(share)).toBe(true);
  });

  it("shares nothing for a chosen field left empty", () => {
    const share = sharedContact({ phones: [], contactEmail: null, address: "" }, [
      "phones",
      "email",
      "address",
    ]);
    expect(share).toEqual({ phones: null, email: null, address: null });
    expect(canBeEmergencyContact(share)).toBe(false);
    expect(sharedContact(null, ["phones"])).toEqual({ phones: null, email: null, address: null });
  });

  it("never shows a contact email unless it's chosen", () => {
    expect(sharedContact(contact, ["phones"]).email).toBeNull();
    expect(sharedContact(contact, ["email"]).email).toBe("me@example.com");
  });
});
