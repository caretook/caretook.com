import { SCRUB_SPECS, SCRUB_TABLES } from "@caretook/data/domain";
import { describe, expect, it } from "vitest";
import { schemaTables } from "../../data/src/db/roles/schemaTables";
import { UPLOAD_REGISTRY } from "./syncRegistry";

// The scrub spec (data-rights, slice 1) against the upload registry: every
// content column a device uploads has a rule saying what a delete leaves
// of it, and every rule names a real column that isn't the row's identity.
// No database.

const NEVER_SCRUBBED = ["id", "group_id", "recipient_id", "kind", "deleted_at"];

describe("the scrub spec", () => {
  it("covers every soft-delete table the registry uploads", () => {
    for (const table of SCRUB_TABLES) expect(UPLOAD_REGISTRY.has(table), table).toBe(true);
  });

  it("has a rule for every content column, and names only real columns", () => {
    const tables = schemaTables();
    for (const table of SCRUB_TABLES) {
      const rules = Object.keys(SCRUB_SPECS[table].columns);
      const content = UPLOAD_REGISTRY.get(table)!.columns.content;
      expect(
        content.filter((c) => !rules.includes(c)),
        `${table}: content columns with no rule`,
      ).toEqual([]);
      expect(
        rules.filter((c) => !tables[table]?.includes(c)),
        `${table}: rules naming no column`,
      ).toEqual([]);
      expect(
        rules.filter((c) => NEVER_SCRUBBED.includes(c)),
        `${table}: identity columns`,
      ).toEqual([]);
    }
  });
});
