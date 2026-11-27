// Caretook's own data, checked in GitHub CI: the tool's project-data check (its
// `project-check` command, named by risa.json's tool.prd) on this checkout. CI
// runs the Vitest projects, not the tooling step that runs the check locally, so
// this test keeps it there; locally it is skipped, since `pnpm test:tooling` and
// the check's tooling step already ran it. No core path: the tool's own command.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, readRisa } from "./risa.mjs";

describe.skipIf(!process.env.CI)("this checkout's project data", () => {
  it("passes the tool's project-data check", () => {
    const [cmd = "", ...args] = String(readRisa(REPO_ROOT).tool.prd).split(" ");
    const { RISA_CONFIG: _, ...env } = process.env;
    const r = spawnSync(cmd, [...args, "project-check"], { cwd: REPO_ROOT, encoding: "utf8", env });
    expect(`${r.stdout}${r.stderr}`, "the check's lines").toContain("project-check: ok");
    expect(r.status).toBe(0);
  }, 60_000);
});
