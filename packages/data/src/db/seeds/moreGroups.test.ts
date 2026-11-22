import { describe, expect, it } from "vitest";
import { medicationContentZSchema, timelineEntryContentZSchema } from "../schema";
import { USERS } from "./users";
import { MORE_GROUPS, MORE_USERS, seedRows } from "./moreGroups";

// Seeds write straight to the tables, skipping the services' validation, so
// check them against the same rules the API enforces.
const NOW = Date.UTC(2026, 10, 17, 20, 0);
describe("more groups seeds", () => {
  it("are valid entries for their kind, with notes and events in their live document", () => {
    for (const { entries, medicationEntry } of seedRows(NOW)) {
      for (const { row, documentText } of entries) {
        const { id: _id, groupId: _g, recipientId: _r, ...content } = row;
        const parsed = timelineEntryContentZSchema.safeParse(content);
        expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
        if (row.kind === "note" || row.kind === "event") {
          expect(row.body).toBeNull();
          expect(typeof documentText).toBe("string");
        }
      }
      const { id: _id, groupId: _g, recipientId: _r, ...change } = medicationEntry ?? {};
      const parsed = timelineEntryContentZSchema.safeParse(change);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    }
  });

  it("give every group a provider and a medication it prescribes", () => {
    for (const { provider, medication, groupId } of seedRows(NOW)) {
      expect(provider.groupId).toBe(groupId);
      expect(medication.prescriberId).toBe(provider.id);
      const { id: _id, groupId: _g, recipientId: _r, ...content } = medication;
      expect(medicationContentZSchema.parse(content)).toEqual(content);
    }
  });

  it("only name writers as authors", () => {
    for (const group of MORE_GROUPS) {
      const writers = new Set(group.members.filter((m) => m.role !== "viewer").map((m) => m.email));
      for (const entry of group.entries) expect(writers.has(entry.author)).toBe(true);
      expect(writers.has(group.medication.author)).toBe(true);
    }
  });

  it("give every group one owner", () => {
    for (const group of MORE_GROUPS) expect(group.members.filter((m) => m.role === "owner")).toHaveLength(1);
  });

  it("add new users only, leaving the existing ones' memberships alone", () => {
    const existing = new Set(USERS.map((u) => u.email));
    expect(MORE_USERS.some((u) => existing.has(u.email))).toBe(false);
    for (const group of MORE_GROUPS) for (const m of group.members) expect(existing.has(m.email)).toBe(false);
  });

  it("give every row its own id", () => {
    const ids = seedRows(NOW).flatMap((g) => [
      g.groupId,
      g.recipientId,
      g.provider.id,
      g.medication.id,
      g.medicationEntry?.id ?? "",
      ...g.entries.map((e) => e.row.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
