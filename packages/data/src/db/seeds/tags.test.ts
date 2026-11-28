import { describe, expect, it } from "vitest";
import { TAG_COLORS, TAG_TARGETS, recordTagId, tagId, targetOf } from "../schema";
import type { TagTarget } from "../schema";
import { seedRows as appointmentRows } from "./appointments";
import { DEV_GROUP_ID } from "./careGroups";
import { seedRows as medicationRows } from "./medications";
import { MORE_GROUPS, groupId as moreGroupId, seedRows as moreRows } from "./moreGroups";
import { seedRows as providerRows } from "./providers";
import { SECOND_GROUP_ENTRIES, SECOND_GROUP_ID, entryId as secondEntryId } from "./secondGroup";
import { seedRows } from "./tags";
import { TEDDER_GROUP_ID, seedRows as tedderRows } from "./tedderFamily";
import { SEED_ENTRIES, entryId as devEntryId } from "./timelineEntries";
import { seedRows as todoRows } from "./todos";

const NOW = Date.parse("2026-11-20T18:00:00Z");

const SEED_GROUP_IDS = [
  DEV_GROUP_ID,
  SECOND_GROUP_ID,
  ...MORE_GROUPS.map((_, g) => moreGroupId(g)),
  TEDDER_GROUP_ID,
];

/** Every live seeded record a tag can go on: its group, by type and id. */
const seededRecords = () => {
  const tedder = tedderRows(NOW);
  const more = moreRows(NOW);
  const records: Record<TagTarget, Map<string, string>> = {
    entry: new Map([
      ...SEED_ENTRIES.flatMap((e, i) => (e.deleted ? [] : [[devEntryId(i), DEV_GROUP_ID] as const])),
      ...SECOND_GROUP_ENTRIES.map((_, i) => [secondEntryId(i), SECOND_GROUP_ID] as const),
      ...appointmentRows(NOW).flatMap((g) => g.rows.map((r) => [r.id, r.groupId] as const)),
      ...more.flatMap((g) => g.entries.map((e) => [e.row.id, g.groupId] as const)),
      ...tedder.entries.map((e) => [e.row.id, TEDDER_GROUP_ID] as const),
      ...tedder.appointments.map((a) => [a.id, TEDDER_GROUP_ID] as const),
    ]),
    todo: new Map([
      ...todoRows(NOW).map((t) => [t.id, t.groupId] as const),
      ...tedder.todos.map((t) => [t.id, TEDDER_GROUP_ID] as const),
    ]),
    provider: new Map([
      ...providerRows().flatMap((g) => g.rows.map((r) => [r.id, r.groupId] as const)),
      ...more.map((g) => [g.provider.id, g.groupId] as const),
      ...tedder.providers.map((p) => [p.id, TEDDER_GROUP_ID] as const),
    ]),
    medication: new Map([
      ...medicationRows(NOW).flatMap((g) => g.rows.map((r) => [r.id, r.groupId] as const)),
      ...more.map((g) => [g.medication.id, g.groupId] as const),
      ...tedder.medications.map((m) => [m.row.id, TEDDER_GROUP_ID] as const),
    ]),
  };
  return records;
};

describe("tag seeds", () => {
  const { tags, links } = seedRows();

  it("derive every id", () => {
    for (const tag of tags) expect(tag.id).toBe(tagId(tag.groupId, tag.nameKey));
    for (const link of links) expect(link.id).toBe(recordTagId(link.tagId, targetOf(link)!.recordId));
    expect(new Set(tags.map((t) => t.id)).size).toBe(tags.length);
    expect(new Set(links.map((l) => l.id)).size).toBe(links.length);
  });

  it("give every seed group tags, each on a record", () => {
    for (const groupId of SEED_GROUP_IDS) {
      const own = tags.filter((t) => t.groupId === groupId);
      expect(own.length, groupId).toBeGreaterThan(0);
      for (const tag of own) expect(links.some((l) => l.tagId === tag.id)).toBe(true);
    }
  });

  it("put a tag on every taggable type", () => {
    expect(new Set(links.map((l) => targetOf(l)?.target))).toEqual(new Set(TAG_TARGETS));
  });

  it("link only live seeded records in the tag's own group", () => {
    const records = seededRecords();
    const groupOf = new Map(tags.map((t) => [t.id, t.groupId]));
    for (const link of links) {
      const found = targetOf(link)!;
      expect(records[found.target].get(found.recordId), `${found.target} ${found.recordId}`).toBe(
        link.groupId,
      );
      expect(groupOf.get(link.tagId)).toBe(link.groupId);
    }
  });

  it("color every tag from the palette, one color per tag in a group", () => {
    for (const tag of tags) expect(TAG_COLORS).toContain(tag.color);
    for (const groupId of SEED_GROUP_IDS) {
      const colors = tags.filter((t) => t.groupId === groupId).map((t) => t.color);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });
});
