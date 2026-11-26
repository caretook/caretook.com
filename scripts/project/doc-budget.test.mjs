// The doc budget guard (doc-budget.mjs): measuring, warn mode and land mode,
// against a throwaway git repo.
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  budgetFor,
  docSizes,
  isLandExempt,
  longStatuses,
  measure,
  registryRows,
  run,
} from "./doc-budget.mjs";

const KB = 1024;
let repo;
const g = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" });
const put = (p, bytes) => {
  mkdirSync(dirname(join(repo, p)), { recursive: true });
  writeFileSync(join(repo, p), "x".repeat(bytes));
};
const cli = (...argv) => {
  const out = [],
    err = [];
  const code = run([...argv, "--repo", repo], { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join("\n"), err: err.join("\n") };
};
const commit = (m) => {
  g("add", "-A");
  g("commit", "-q", "-m", m);
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "doc-budget-"));
  g("init", "-q", "-b", "dev");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "t");
  put("docs/domain/small.md", 5 * KB);
  put("docs/domain/big.md", 12 * KB); // over 10 KB, unchanged
  put("docs/domain/shrinks.md", 14 * KB);
  put("docs/domain/grows.md", 11 * KB);
  put("AGENTS.md", 7 * KB);
  commit("base");
  g("branch", "base");
  put("docs/domain/shrinks.md", 12 * KB);
  put("docs/domain/grows.md", 11 * KB + 1);
  put("docs/agents/new.md", 14 * KB);
  put("scripts/loops/docs/loop.md", 1 * KB);
  put("scripts/loops/docs/other.md", 1 * KB);
  commit("change");
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("budgets", () => {
  it("takes the folder budget for a new file", () => {
    expect(budgetFor("docs/agents/new.md")).toBe(15 * KB);
    expect(budgetFor("docs/domain/x.md")).toBe(10 * KB);
    expect(budgetFor("docs/domain/sub/x.md")).toBeNull();
    expect(budgetFor("README.md")).toBeNull();
  });
  it("a split role's two halves add up to the role's figure", () => {
    const roles = [
      ["hotfix", "docs/agents/hotfix.md", 15 * KB],
      ["loop", "docs/agents/loop.md", 15 * KB],
      ["recovery", "docs/agents/recovery.md", 15 * KB],
      ["orchestrator", "docs/agents/orchestrator.md", 15 * KB],
      ["planner", "docs/agents/planner.md", 15 * KB],
      ["backlog", "docs/agents/backlog.md", 15 * KB],
      ["inbox", "docs/agents/inbox.md", 15 * KB],
      ["machinery", "docs/agents/machinery.md", 15 * KB],
      ["project-config", "docs/agents/project-config.md", 15 * KB],
      ["orchestration", "docs/orchestration.md", 17 * KB],
    ];
    for (const [role, additions, figure] of roles)
      expect(budgetFor(`scripts/loops/docs/${role}.md`) + budgetFor(additions)).toBe(figure);
  });
  it("measures a file a budget names by its path, outside docs/", () => {
    const sizes = docSizes(repo);
    expect(sizes["AGENTS.md"]).toBe(7 * KB);
    expect(sizes["scripts/loops/docs/loop.md"]).toBe(1 * KB);
    expect(sizes).not.toHaveProperty("scripts/loops/docs/other.md");
    expect(docSizes(repo, "HEAD")["scripts/loops/docs/loop.md"]).toBe(1 * KB);
  });
  it("a new doc in docs/agents/ gets 15 KB", () => {
    const [r] = measure({ "docs/agents/n.md": 15 * KB }, {});
    expect(r).toMatchObject({ budget: 15 * KB, status: "within" });
    expect(measure({ "docs/agents/n.md": 15 * KB + 1 }, {})[0].status).toBe("grown");
  });
  it("classifies within, over and grown", () => {
    const r = measure(
      { "docs/domain/a.md": 5 * KB, "docs/domain/b.md": 12 * KB, "docs/domain/c.md": 13 * KB },
      {
        "docs/domain/a.md": 5 * KB,
        "docs/domain/b.md": 12 * KB,
        "docs/domain/c.md": 12 * KB,
      },
    );
    expect(r.map((x) => x.status)).toEqual(["within", "over", "grown"]);
  });
});

describe("modes", () => {
  it("warn exits 0 with docs over budget and lists them", () => {
    const r = cli("warn");
    expect(r.code).toBe(0);
    expect(r.out).toContain("docs/domain/big.md");
    expect(r.out).not.toContain("small.md");
  });
  it("warn exits 0 even outside a repo", () => {
    const r = run(["warn", "--repo", tmpdir(), "--head", "nope"], { out: () => {}, err: () => {} });
    expect(r).toBe(0);
  });
  it("land passes for an over-budget doc that is unchanged or shrank", () => {
    g("checkout", "-q", "-b", "ok", "base");
    put("docs/domain/shrinks.md", 12 * KB);
    commit("shrink only");
    const r = cli("land", "base", "--head", "ok");
    expect(r.code).toBe(0);
    g("checkout", "-q", "dev");
  });
  it("land fails for a grown over-budget doc and names it", () => {
    const r = cli("land", "base", "--head", "dev");
    expect(r.code).toBe(1);
    expect(r.err).toContain("docs/domain/grows.md");
    expect(r.err).toContain("budget 10240 B");
    expect(r.err).toContain("base 11264 B");
    expect(r.err).not.toContain("big.md");
    expect(r.err).not.toContain("shrinks.md");
  });
});

describe("land exemptions", () => {
  it("no configured doc is exempt; a custom entry can be", () => {
    expect(isLandExempt("AGENTS.md")).toBe(false);
    expect(isLandExempt("docs/loops.md")).toBe(false);
    expect(isLandExempt("docs/domain/timeline.md")).toBe(false);
    expect(isLandExempt("docs/agents/loop.md")).toBe(false);
    const budgets = [{ pattern: "docs/x.md", bytes: 10, landExempt: true }];
    expect(isLandExempt("docs/x.md", budgets)).toBe(true);
    expect(budgetFor("docs/x.md", budgets)).toBe(10);
  });
});

describe("plan status warnings", () => {
  const write = (dir, p, text) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  };
  const status = (bytes) => `# Plan\n\n## Status\n\n${"x".repeat(bytes)}\n\n## Slice 1: a\n`;
  it("warns for a running topic's long _Status_, not a done one's or a short one", () => {
    const dir = mkdtempSync(join(tmpdir(), "doc-budget-status-"));
    try {
      write(
        dir,
        "plans/backlog.md",
        [
          "# Backlog",
          "",
          "## PRDs",
          "",
          "| PRD | Flags | After | Hot files | Doc and notes |",
          "| --- | ----- | ----- | --------- | ------------- |",
          "| `long` | standing | — | — | — |",
          "| `short` | — | — | — | — |",
          "| `old` | done | — | — | — |",
          "| `noplan` | — | — | — | — |",
          "",
        ].join("\n"),
      );
      write(dir, "plans/long-plan.md", status(7 * KB));
      write(dir, "plans/short-plan.md", status(5 * KB));
      write(dir, "plans/old-plan.md", status(9 * KB));
      expect(longStatuses(dir).map((r) => r.topic)).toEqual(["long"]);
      const out = [];
      expect(run(["warn", "--repo", dir], { out: (s) => out.push(s), err: () => {} })).toBe(0);
      expect(out.join("\n")).toContain("plans/long-plan.md's _Status_ is 7.0 KB, over 6.0 KB");
      expect(out.join("\n")).toContain("pnpm prd status-trim long");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("says nothing without a backlog", () => {
    expect(longStatuses(tmpdir())).toEqual([]);
  });
  // The registry's header is the core's (it writes the table); this file keeps a
  // copy. Reading this checkout's own backlog ties the two: a column the core adds
  // fails here instead of warn mode printing 'plan status: skipped'.
  it("reads this checkout's own registry table", () => {
    const backlog = readFileSync(new URL("../../plans/backlog.md", import.meta.url), "utf8");
    const rows = registryRows(backlog);
    expect(rows).not.toBeNull();
    expect(rows?.length).toBeGreaterThan(0);
  });
});

// Exit 1 is a breach and only that (land.sh refuses with "grows a doc"): a budgets
// file that doesn't load is exit 2 in land mode and a skipped warning in warn mode.
describe("a budgets file that doesn't load", () => {
  let dir;
  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "doc-budget-broken-")));
    for (const f of ["doc-budget.mjs", "risa.mjs", "status-trim.mjs"])
      copyFileSync(new URL(`./${f}`, import.meta.url), join(dir, f));
    writeFileSync(join(dir, "doc-budget.config.mjs"), 'throw new Error("a broken budgets file");\n');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const cli = (...argv) =>
    spawnSync("node", [join(dir, "doc-budget.mjs"), ...argv, "--repo", dir], { encoding: "utf8" });

  it("exits 2 in land mode, never 1", () => {
    const r = cli("land", "HEAD");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("doc budget: can't measure (the budgets didn't load: a broken budgets file)");
  });

  it("skips in warn mode and exits 0", () => {
    const r = cli("warn");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("doc budget: skipped (the budgets didn't load: a broken budgets file)");
  });
});
