// The doc budget guard (doc-budget.mjs): measuring, warn mode and land mode,
// against a throwaway git repo.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { budgetFor, measure, run } from "./doc-budget.mjs";

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
