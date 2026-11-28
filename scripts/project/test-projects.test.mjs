// The tooling tests' Vitest projects (test-projects.mjs): every test under
// scripts/ sits in exactly one tooling project. And the package scripts run each
// set: `pnpm test` leaves out exactly the slow tooling projects, `pnpm
// test:project` is plain Vitest on Caretook's two.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOLING_PROJECTS, misplaced } from "./test-projects.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** @returns {Map<string, string[]>} each listed test file's tooling projects */
const listed = () => {
  const projects = TOOLING_PROJECTS.flatMap((p) => ["--project", p]);
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
  it("passes each test in one tooling project", () => {
    const byFile = new Map([
      ["scripts/loops/a.test.mjs", ["project:tooling"]],
      ["scripts/deploy/c.test.mjs", ["project:unit"]],
    ]);
    expect(misplaced([...byFile.keys()], byFile)).toEqual([]);
  });

  it("names a test in another project, in two, in none, or listed but untracked", () => {
    const byFile = new Map([
      ["scripts/loops/a.test.mjs", ["web:unit"]],
      ["scripts/loops/b.test.mjs", ["project:unit", "project:tooling"]],
      ["scripts/x.test.mjs", ["project:unit"]],
    ]);
    expect(
      misplaced(["scripts/loops/a.test.mjs", "scripts/loops/b.test.mjs", "scripts/d.test.mjs"], byFile),
    ).toEqual([
      "scripts/loops/a.test.mjs: web:unit",
      "scripts/loops/b.test.mjs: project:unit, project:tooling",
      "scripts/d.test.mjs: in no tooling project",
      "scripts/x.test.mjs: listed, but not a tracked test",
    ]);
  });
});

describe("the real tooling projects", () => {
  it("hold every test under scripts/ once", () => {
    const tracked = execFileSync("git", ["ls-files", "scripts/*.test.mjs"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter((f) => f && !f.startsWith("scripts/browser-checks/"));
    expect(misplaced(tracked, listed())).toEqual([]);
  }, 60_000);

  it("are run by the package scripts", () => {
    const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(scripts.test).toBe("vitest run --project '!tooling:browser' --project '!project:tooling'");
    expect(scripts["test:project"]).toBe("vitest run --project project:unit --project project:tooling");
  });
});
