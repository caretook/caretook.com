// The tooling tests' Vitest projects split by owner (test-projects.mjs): every
// test under scripts/ sits in exactly one tooling project, and that project is
// its owner's. And the package scripts run each set: `pnpm test` leaves out
// exactly the slow tooling projects, `pnpm test:project` is plain Vitest on
// Caretook's two.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOLING_PROJECTS, misplaced, parseOwners } from "./test-projects.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
// Until the move: whose each file is comes from the core's manifest.
const MANIFEST = join(ROOT, "scripts/loops/boundary.manifest");
const ALL = [...TOOLING_PROJECTS.project, ...TOOLING_PROJECTS.core];

/** @returns {Map<string, string[]>} each listed test file's tooling projects */
const listed = () => {
  const projects = ALL.flatMap((p) => ["--project", p]);
  const out = execFileSync("pnpm", ["exec", "vitest", "list", "--filesOnly", "--json", ...projects], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
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

describe("misplaced", () => {
  const owners = parseOwners(
    "# a comment\nscripts/loops/a.test.mjs core\nscripts/loops/b.test.mjs project\n",
  );

  it("passes each test in one project of its owner's", () => {
    const byFile = new Map([
      ["scripts/loops/a.test.mjs", ["tooling:unit"]],
      ["scripts/loops/b.test.mjs", ["project:tooling"]],
      ["scripts/deploy/c.test.mjs", ["project:unit"]],
    ]);
    expect(misplaced([...byFile.keys()], byFile, owners)).toEqual([]);
  });

  it("names a test in the other owner's project, in two, in none, or listed but untracked", () => {
    const byFile = new Map([
      ["scripts/loops/a.test.mjs", ["project:unit"]],
      ["scripts/loops/b.test.mjs", ["project:unit", "project:tooling"]],
      ["scripts/x.test.mjs", ["core:unit"]],
    ]);
    expect(
      misplaced(
        ["scripts/loops/a.test.mjs", "scripts/loops/b.test.mjs", "scripts/d.test.mjs"],
        byFile,
        owners,
      ),
    ).toEqual([
      "scripts/loops/a.test.mjs (core): project:unit",
      "scripts/loops/b.test.mjs (project): project:unit, project:tooling",
      "scripts/d.test.mjs (project): in no tooling project",
      "scripts/x.test.mjs: listed, but not a tracked test",
    ]);
  });
});

describe("the real tooling projects", () => {
  it("hold every test under scripts/ once, in its owner's project", () => {
    const tracked = execFileSync("git", ["ls-files", "scripts/*.test.mjs"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter((f) => f && !f.startsWith("scripts/browser-checks/"));
    expect(misplaced(tracked, listed(), parseOwners(readFileSync(MANIFEST, "utf8")))).toEqual([]);
  }, 60_000);

  it("are run by the package scripts", () => {
    const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(scripts.test).toBe(
      "vitest run --project '!tooling:unit' --project '!tooling:browser' --project '!project:tooling'",
    );
    expect(scripts["test:project"]).toBe(
      `vitest run ${TOOLING_PROJECTS.project.map((p) => `--project ${p}`).join(" ")}`,
    );
  });
});
