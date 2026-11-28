// Caretook's own data, checked in GitHub CI: the tool's project-data check (its
// `project-check` command, named by risa.json's tool.prd) on this checkout. CI
// runs the Vitest projects, not the tooling step that runs the check locally, so
// this test keeps it there; locally it is skipped, since `pnpm test:tooling` and
// the check's tooling step already ran it. No core path: the tool's own command.
//
// And Caretook's role docs, everywhere: every role split (the core's generic doc, then
// Caretook's additions), each merged doc opening with its title, and
// the sections the prompts and docs name, across the seam where Caretook's additions
// carry on from the generic text, through the tool's `doc` command.
import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, readRisa } from "./risa.mjs";

const run = promisify(execFile);
// This checkout's own config, so the tool checks the files beside this test: on a
// machine with a machine config, a worktree's `risa` reads its main checkout's.
const env = { ...process.env, RISA_CONFIG: join(REPO_ROOT, "risa.json") };

describe.skipIf(!process.env.CI)("this checkout's project data", () => {
  it("passes the tool's project-data check", () => {
    const [cmd = "", ...args] = String(readRisa(REPO_ROOT).tool.prd).split(" ");
    const r = spawnSync(cmd, [...args, "project-check"], { cwd: REPO_ROOT, encoding: "utf8", env });
    expect(`${r.stdout}${r.stderr}`, "the check's lines").toContain("project-check: ok");
    expect(r.status).toBe(0);
  }, 60_000);
});

// The names other worktrees, the watchdog and GitHub share are built from the
// config's name (the lock, the markers, the launchd label com.caretook.prd-watchdog,
// the CI status context caretook-ci): an unsynced worktree, the loaded launchd job
// and the commit statuses already posted must still match, so the name stays.
describe("this checkout's shared names", () => {
  it("come from the name caretook", () => {
    expect(readRisa(REPO_ROOT).name).toBe("caretook");
  });
});

describe("this checkout's role docs", () => {
  const risa = readRisa(REPO_ROOT);
  const [cmd = "", ...prd] = String(risa.tool.prd).split(" ");
  /** The tool's merged doc for a role, or one section of it (without pnpm's `$ <script>` line). */
  const doc = async (/** @type {string[]} */ ...args) =>
    (await run(cmd, [...prd, "doc", ...args], { cwd: REPO_ROOT, env, encoding: "utf8" })).stdout.replace(
      /^\$ .*\n/,
      "",
    );
  /** @type {[string, { additions?: string, replacement?: string }][]} */
  const roles = Object.entries(risa.roles);

  it("every role is split: generic plus additions, none a replacement", () => {
    expect(roles.filter(([, e]) => e.replacement)).toEqual([]);
    expect(roles.map(([role]) => role).sort()).toEqual([
      "backlog",
      "hotfix",
      "inbox",
      "loop",
      "machinery",
      "orchestration",
      "orchestrator",
      "planner",
      "project-config",
      "recovery",
    ]);
  });

  it("the loop additions open with a pointer to the doc command, left out of the merged text", async () => {
    expect(readFileSync(join(REPO_ROOT, "docs/agents/loop.md"), "utf8")).toMatch(/^<!-- .*`risa doc loop`/);
    expect(await doc("loop")).not.toContain("<!--");
  }, 30_000);

  it("each merged doc opens with its title and intro, the generic one first", async () => {
    const texts = await Promise.all(roles.map(([role]) => doc(role)));
    texts.forEach((text, i) => expect(text, roles[i]?.[0]).toMatch(/^# .+\n\n[^#\n-].+\n/));
  }, 30_000);

  it("the sections the prompts and docs name are in the merged text", async () => {
    /** @type {[string, string, RegExp][]} */
    const sections = [
      ["loop", "Loop rules", /- \*\*A fix request is only:\*\*[\s\S]*- Work only inside your worktree\./],
      ["loop", "Hand-off", /^## Hand-off\n\nYour final message:/],
      ["loop", "Tests", /^## Tests\n/],
      ["loop", "Your worktree and stack", /Slots and ports/],
      ["orchestrator", "Models", /^## Models\n\n\*\*Coding goes to opus/],
      ["orchestrator", "Recovery", /\*\*Resuming as orchestrator:\*\*/],
      ["orchestrator", "The check gate", /^## The check gate\n[\s\S]*\*\*How each kind lands:\*\*/],
      [
        "orchestrator",
        "Rules across PRDs",
        /Migrations take the next number[\s\S]*Hot files get regions first/,
      ],
      ["planner", "Slice fields", /^## Slice fields\n[\s\S]*slice-fields\.mjs/],
      ["planner", "What to ask", /^## What to ask\n[\s\S]*\*\*Unattended\*\*/],
      ["planner", "The skeptic pass", /^## The skeptic pass\n[\s\S]*\*\*A second send-back\*\*/],
      ["backlog", "Deciding what's next", /Standing priorities:\n\n1\. Write the PRDs/],
      ["machinery", "Worktrees and leases", /\*\*`risa tidy`\*\*[\s\S]*- `new\.sh <kind>`[\s\S]*`risa wait/],
      ["machinery", "The dispatcher", /^## The dispatcher\n/],
      ["machinery", "The context watch", /^## The context watch\n/],
      ["machinery", "Recorded sessions", /^## Recorded sessions\n/],
      ["machinery", "The load gate", /^## The load gate\n/],
      ["orchestration", "Commit messages", /^## Commit messages\n/],
    ];
    const texts = await Promise.all(sections.map(([role, heading]) => doc(role, heading)));
    texts.forEach((text, i) => {
      const [role, heading, want] = sections[i] ?? [];
      expect(text, `${role}'s ${heading}`).toMatch(/** @type {RegExp} */ (want));
    });
  }, 30_000);
});
