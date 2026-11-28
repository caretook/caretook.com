// Caretook's own read of risa.json (risa.mjs): the hints its scripts print name the
// tool's commands as the config calls them, so with the names set to `risa` in a
// copy of Caretook's config they say `risa`; and no Caretook script's hint spells
// the names out itself.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT, readRisa, toolCommand } from "./risa.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "risa-read-")));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const copy = (/** @type {Record<string, any>} */ change) => {
  const dir = mkdtempSync(join(tmp, "repo-"));
  writeFileSync(join(dir, "risa.json"), JSON.stringify({ ...readRisa(REPO_ROOT), ...change }));
  return dir;
};
const cli = (/** @type {string[]} */ ...args) =>
  spawnSync(process.execPath, [join(HERE, "risa.mjs"), ...args], { encoding: "utf8" });

describe("the tool's command names, from risa.json", () => {
  it("are this repo's own names here", () => {
    const { tool } = readRisa(REPO_ROOT);
    expect(toolCommand(REPO_ROOT, "prd")).toBe(tool.prd);
    expect(toolCommand(REPO_ROOT, "backlog")).toBe(tool.backlog);
    expect(cli("tool", "prd").stdout).toBe(`${tool.prd}\n`);
  });

  it("follow a copy of Caretook's config with the names set to risa", () => {
    const dir = copy({ tool: { prd: "risa", backlog: "risa backlog" } });
    expect(toolCommand(dir, "prd")).toBe("risa");
    expect(toolCommand(dir, "backlog")).toBe("risa backlog");
    const r = cli("tool", "prd", dir);
    expect(r.stdout).toBe("risa\n");
    expect(r.status).toBe(0);
  });

  it("fall back to the bare name when the config doesn't say, or isn't there", () => {
    expect(toolCommand(copy({ tool: undefined }), "prd")).toBe("prd");
    expect(toolCommand(join(tmp, "nowhere"), "backlog")).toBe("backlog");
  });

  it("refuses anything but `tool prd` or `tool backlog`, saying how to call it", () => {
    for (const r of [cli("tool", "other"), cli()]) {
      expect(r.status).toBe(2);
      expect(r.stdout).toBe("");
      expect(r.stderr).toMatch(/^usage: risa\.mjs tool <prd\|backlog> \[root\]\n$/);
    }
  });

  it("no Caretook script's printed hint spells the names out: each reads them through risa.mjs", () => {
    for (const file of [
      "serve.sh",
      "test-db.sh",
      "doc-budget.mjs",
      "../../packages/data/test/globalSetup.ts",
    ]) {
      const code = readFileSync(join(HERE, file), "utf8")
        .split("\n")
        .filter((l) => !/^\s*(#|\/\/|\*)/.test(l));
      expect(
        code.filter((l) => /\bpnpm (prd|backlog)\b/.test(l)),
        file,
      ).toEqual([]);
    }
  });
});
