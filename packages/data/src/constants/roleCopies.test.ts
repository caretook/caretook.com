import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseYaml } from "../db/roles/syncConfig";
import { GROUP_ROLE_NAMES, isWriterRole } from "./roles";

// Copies of the role sets that live outside this module, checked against it.

const syncConfig = () =>
  readFileSync(new URL("../../../../powersync/sync-config.yaml", import.meta.url), "utf8");

/** The roles a `role != '…' AND role != '…'` chain excludes, in its order. */
const excludedRoles = (sql: string) => [...sql.matchAll(/\brole\s*!=\s*'([^']*)'/g)].map((m) => m[1]);

describe("the sync config's writers stream", () => {
  it("excludes exactly the roles that aren't writers", () => {
    const root = parseYaml(syncConfig()) as { streams?: Record<string, { with?: Record<string, unknown> }> };
    const writerGroups = root.streams?.care_group_writers?.with?.writer_groups;
    expect(typeof writerGroups, "care_group_writers.with.writer_groups").toBe("string");

    const excluded = excludedRoles(writerGroups as string);
    expect(new Set(excluded).size, "each role once").toBe(excluded.length);
    expect([...excluded].sort()).toEqual(GROUP_ROLE_NAMES.filter((r) => !isWriterRole(r)).sort());
  });
});
