import type { OutsideContact } from "@caretook/data/schema";
import type { EmergencyMemberRow } from "./emergencyList";

import { describe, expect, it } from "vitest";
import {
  addableMembers,
  draftToSave,
  droppedNotes,
  emergencyBadges,
  emergencyEntries,
  emergencyMatches,
  emergencyPhoneLines,
  initialDraft,
  membersWithoutPhone,
  moveEntry,
  movedText,
  parseEmergencySave,
  withoutPhoneText,
} from "./emergencyList";

const PHONE = JSON.stringify([{ label: "Mobile", number: "(555) 010-1234" }]);

const member = (over: Partial<EmergencyMemberRow> & { user_id: string }): EmergencyMemberRow => ({
  name: over.user_id.toUpperCase(),
  relationship: null,
  emergency_rank: null,
  is_primary_contact: 0,
  emergency_dropped_at: null,
  share_phones: PHONE,
  ...over,
});

const rosa: OutsideContact = {
  id: "r",
  name: "Rosa Example",
  relationship: "Neighbour",
  phone: "555 010 4410",
  emergencyRank: 2,
};

describe("emergencyEntries", () => {
  it("orders members and outside contacts by rank, and leaves out anyone unranked", () => {
    const members = [
      member({ user_id: "b", emergency_rank: 3 }),
      member({ user_id: "a", emergency_rank: 1, is_primary_contact: 1 }),
      member({ user_id: "c" }),
    ];
    const entries = emergencyEntries(members, [rosa, { ...rosa, id: "x", emergencyRank: null }]);
    expect(entries.map((e) => e.key)).toEqual(["member:a", "outside:r", "member:b"]);
    expect(entries.map((e) => e.isPrimary)).toEqual([true, false, false]);
    expect(entries[1]).toMatchObject({ name: "Rosa Example", relationship: "Neighbour" });
  });

  it("sorts by rank across a gap left by a removed member", () => {
    const entries = emergencyEntries([member({ user_id: "a", emergency_rank: 4 })], [rosa]);
    expect(entries.map((e) => e.key)).toEqual(["outside:r", "member:a"]);
  });

  it("gives each number a call and text link named for the contact", () => {
    const [entry] = emergencyEntries([], [rosa]);
    const [line] = emergencyPhoneLines(entry!);
    expect(line?.action.label).toMatch(/^Call Rosa Example/);
    expect(line?.sms?.href).toMatch(/^sms:/);
  });
});

describe("notes and badges", () => {
  it("tells managers who fell off the list, until they're back on it", () => {
    const dropped = member({ user_id: "a", name: "Sam", emergency_dropped_at: "2026-11-19T10:00:00Z" });
    expect(droppedNotes([dropped])).toEqual([
      "Sam stopped sharing a phone number with the group, so they're no longer on the list.",
    ]);
    expect(droppedNotes([{ ...dropped, emergency_rank: 1 }])).toEqual([]);
    expect(droppedNotes([member({ user_id: "b" })])).toEqual([]);
  });

  it("badges the primary contact and everyone on the list", () => {
    expect(emergencyBadges({ emergency_rank: 1, is_primary_contact: 1 })).toEqual([
      "Primary contact",
      "Emergency contact",
    ]);
    expect(emergencyBadges({ emergency_rank: 2, is_primary_contact: 0 })).toEqual(["Emergency contact"]);
    expect(emergencyBadges({ emergency_rank: null, is_primary_contact: null })).toEqual([]);
  });
});

describe("the sheet's draft", () => {
  const members = [
    member({ user_id: "a", name: "Ann", emergency_rank: 1, is_primary_contact: 1 }),
    member({ user_id: "b", name: "Ben" }),
    member({ user_id: "c", name: "Cy", share_phones: null }),
  ];
  const unranked: OutsideContact = { ...rosa, id: "u", name: "Uma", emergencyRank: null };

  it("starts from the stored list, then outside contacts not on it", () => {
    const draft = initialDraft(members, [rosa, unranked]);
    expect(draft.entries.map((e) => e.key)).toEqual(["member:a", "outside:r", "outside:u"]);
    expect(draft.primaryUserId).toBe("a");
  });

  it("moves a row up or down, and not past either end", () => {
    expect(moveEntry(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveEntry(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveEntry(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveEntry(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(movedText("Rosa", 2, 3)).toBe("Rosa moved to 2 of 3.");
  });

  it("offers only members sharing a phone who aren't listed, and names the others", () => {
    const draft = initialDraft(members, [rosa]);
    expect(addableMembers(members, draft).map((m) => m.userId)).toEqual(["b"]);
    expect(membersWithoutPhone(members)).toEqual(["Cy"]);
    expect(withoutPhoneText(["Cy"])).toBe(
      "Cy doesn't share a phone number with the group, so they can't be added.",
    );
    expect(withoutPhoneText(["Cy", "Di", "Ed"])).toBe(
      "Cy, Di and Ed don't share a phone number with the group, so they can't be added.",
    );
    expect(withoutPhoneText([])).toBeNull();
  });

  it("saves the order, the outside contacts, and a primary only while they're listed", () => {
    const draft = initialDraft(members, [rosa]);
    const save = draftToSave(draft);
    expect(save.order).toEqual([
      { kind: "member", userId: "a" },
      { kind: "outside", id: "r" },
    ]);
    expect(save.outside).toEqual([
      { id: "r", name: "Rosa Example", relationship: "Neighbour", phone: "555 010 4410" },
    ]);
    expect(save.primaryUserId).toBe("a");
    expect(draftToSave({ ...draft, entries: draft.entries.slice(1) }).primaryUserId).toBeNull();
    expect(parseEmergencySave(JSON.stringify(save))).toEqual(save);
    expect(parseEmergencySave("nope")).toBeNull();
  });

  it("knows when the device has caught up with a save", () => {
    const save = draftToSave(initialDraft(members, [rosa]));
    expect(emergencyMatches(members, [rosa], save)).toBe(true);
    expect(emergencyMatches(members, [rosa], { ...save, primaryUserId: null })).toBe(false);
    expect(emergencyMatches(members, [rosa], { ...save, order: [...save.order].reverse() })).toBe(false);
  });
});
