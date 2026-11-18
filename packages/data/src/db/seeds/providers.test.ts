import { describe, expect, it } from "vitest";
import { canLinkProviders, providerContentZSchema } from "../schema";
import {
  DEV_FAMILY_PROVIDERS,
  SECOND_GROUP_PROVIDERS,
  SEED_GROUPS,
  seedProviderContent,
  seedRows,
} from "./providers";
import { SECOND_GROUP_ENTRIES } from "./secondGroup";
import { entryId as devFamilyEntryId, SEED_ENTRIES } from "./timelineEntries";

// Seeds write straight to the tables, skipping the services' validation, so
// check them against the same rules the API enforces.
describe("provider seeds", () => {
  it("are valid providers", () => {
    const problems = seedRows().flatMap(({ rows }) =>
      rows.flatMap((row) => {
        const parsed = providerContentZSchema.safeParse(row);
        return parsed.success
          ? []
          : [{ name: row.name, issues: parsed.error.issues.map((i) => i.path.join(".")) }];
      }),
    );
    expect(problems).toEqual([]);
  });

  it("store exactly what the schema would", () => {
    for (const p of [...DEV_FAMILY_PROVIDERS, ...SECOND_GROUP_PROVIDERS]) {
      const content = seedProviderContent(p, null);
      expect(providerContentZSchema.parse(content)).toEqual(content);
    }
  });

  it("point clinicians at a practice or pharmacy in the same group", () => {
    for (const { rows } of seedRows()) {
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const row of rows.filter((r) => r.practiceId)) {
        expect(["practice", "pharmacy"]).toContain(byId.get(row.practiceId ?? "")?.type);
      }
    }
    expect(seedRows()[0]?.rows.some((r) => r.practiceId)).toBe(true);
  });

  it("include the kinds a directory needs in Dev Family, and one provider in Dev Family 2", () => {
    const types = new Set(DEV_FAMILY_PROVIDERS.map((p) => p.type));
    expect([...types].sort()).toEqual(["clinician", "other", "pharmacy", "practice"]);
    expect(DEV_FAMILY_PROVIDERS.some((p) => p.isPrimary)).toBe(true);
    expect(DEV_FAMILY_PROVIDERS.some((p) => p.status === "past")).toBe(true);
    expect(DEV_FAMILY_PROVIDERS.some((p) => p.notes)).toBe(true);
    expect(SECOND_GROUP_PROVIDERS).toHaveLength(1);
  });

  it("link only to live notes and events in their own group", () => {
    const kindById = new Map<string, { kind: string; deleted?: boolean }>(
      SEED_ENTRIES.map((e, i) => [devFamilyEntryId(i), e]),
    );
    const [devFamily, secondGroup] = seedRows();
    expect(devFamily?.links.length).toBeGreaterThan(0);
    for (const link of devFamily?.links ?? []) {
      const entry = kindById.get(link.entryId);
      expect(entry && canLinkProviders(entry.kind) && !entry.deleted).toBe(true);
      expect(link.groupId).toBe(SEED_GROUPS[0]?.groupId);
    }
    expect(secondGroup?.links).toHaveLength(1);
    expect(SECOND_GROUP_ENTRIES.some((e) => e.title === "Hearing aid fitting")).toBe(true);
  });

  it("give each group its own ids", () => {
    const ids = seedRows().flatMap(({ rows }) => rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
