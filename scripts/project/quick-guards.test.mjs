// The guards that read source by path (B-370): `vitest --changed` can't select
// them, so each must sit in a project every slice and quick check runs. Reads the
// Vitest projects (`vitest list`) and check-body.sh's project list.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { QUICK_GUARDS, guardsOutside, quickProjects } from "./test-projects.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** @returns {Map<string, string[]>} each guard's Vitest projects */
const listed = () => {
  const names = QUICK_GUARDS.map((f) => f.replace(/^.*\//, ""));
  const out = execFileSync(
    "pnpm",
    ["exec", "vitest", "list", "--filesOnly", "--json", "--project", "*", ...names],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  /** @type {{ file: string, projectName: string }[]} */
  const rows = JSON.parse(out.slice(out.indexOf("[")));
  /** @type {Map<string, string[]>} */
  const byFile = new Map();
  for (const { file, projectName } of rows) {
    const path = relative(ROOT, file);
    byFile.set(path, [...(byFile.get(path) ?? []), projectName]);
  }
  return byFile;
};

describe("the quick check's guards", () => {
  const body = readFileSync(join(ROOT, "scripts/project/check-body.sh"), "utf8");

  it("reads check-body.sh's project list", () => {
    expect(quickProjects("x\nunit=(--project a:unit --project b:unit)\n")).toEqual(["a:unit", "b:unit"]);
    expect(() => quickProjects("no list")).toThrow(/unit=/);
    expect(quickProjects(body)).toContain("project:unit");
  });

  it("are each in a project every quick check runs", () => {
    const byFile = listed();
    expect([...byFile.keys()].sort()).toEqual([...QUICK_GUARDS].sort());
    expect(guardsOutside(QUICK_GUARDS, byFile, quickProjects(body))).toEqual([]);
  }, 30_000);

  it("fail on a project list without project:unit, or a guard in no project", () => {
    const byFile = new Map([
      ["scripts/project/sync-matrix.test.mjs", ["project:unit"]],
      ["packages/data/src/db/roles/rolesSql.test.ts", ["data:unit"]],
    ]);
    expect(guardsOutside(QUICK_GUARDS, byFile, ["data:unit", "web:unit", "server:unit"])).toEqual([
      "scripts/project/sync-matrix.test.mjs: in project:unit, none of which a quick check runs",
    ]);
    expect(guardsOutside(QUICK_GUARDS, new Map(), ["project:unit", "data:unit"])).toHaveLength(2);
  });
});
