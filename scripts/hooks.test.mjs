// The .githooks protections, against a throwaway repo with a bare "origin".
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HOOKS = new URL("../.githooks", import.meta.url).pathname;
const baseEnv = { ...process.env, CARETOOK_ALLOW_PROTECTED: "" };
const ok = (cwd, args, env = baseEnv) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env, stdio: "pipe" }).trim();
const refused = (cwd, args) => {
  try {
    execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: baseEnv, stdio: "pipe" });
  } catch (e) {
    return `${e.stdout}${e.stderr}`;
  }
  throw new Error(`expected "git ${args.join(" ")}" to be refused`);
};
const allow = { ...baseEnv, CARETOOK_ALLOW_PROTECTED: "1" };

let root, repo, origin;
const commitFile = (name, content, env) => {
  writeFileSync(join(repo, name), content);
  ok(repo, ["add", name], env);
  ok(repo, ["commit", "-q", "-m", `chore: edit ${name}`], env);
};

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "hooks-test-")));
  repo = join(root, "repo");
  origin = join(root, "origin.git");
  execFileSync("git", ["init", "-q", "--bare", origin]);
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  for (const [k, v] of [
    ["user.email", "test@example.com"],
    ["user.name", "Test"],
    ["commit.gpgsign", "false"],
    ["core.hooksPath", HOOKS],
  ])
    ok(repo, ["config", k, v]);
  mkdirSync(join(repo, "plans"));
  writeFileSync(join(repo, "plans/backlog.md"), "x\n");
  ok(repo, ["add", "."]);
  ok(repo, ["commit", "-q", "-m", "chore: init"], allow);
  ok(repo, ["remote", "add", "origin", origin]);
  ok(repo, ["push", "-q", "origin", "main"], allow);
  ok(repo, ["branch", "staging"], allow);
  ok(repo, ["switch", "-q", "-c", "dev"]);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("the protected branches", () => {
  // The hooks keep their own constant (they never read the tool's config), so
  // this keeps it equal to risa.json's branches.protected.
  it("are the project config's", () => {
    const config = JSON.parse(readFileSync(new URL("../risa.json", import.meta.url), "utf8"));
    const constant = /^PROTECTED_RE='\^\(([^)]*)\)\$'$/m.exec(
      readFileSync(join(HOOKS, "protect.sh"), "utf8"),
    );
    expect(constant?.[1].split("|").sort()).toEqual([...config.branches.protected].sort());
  });
});

describe("main and staging", () => {
  it("refuse commits, moves and pushes", () => {
    ok(repo, ["switch", "-q", "main"]);
    writeFileSync(join(repo, "a.txt"), "a\n");
    ok(repo, ["add", "a.txt"]);
    expect(refused(repo, ["commit", "-q", "-m", "chore: direct"])).toMatch(/refused: a commit on main/);
    ok(repo, ["reset", "-q", "--hard"]);
    ok(repo, ["switch", "-q", "dev"]);
    commitFile("plans/backlog.md", "y\n");
    expect(refused(repo, ["branch", "-f", "staging", "dev"])).toMatch(/refused: updating staging/);
    expect(refused(repo, ["push", "-q", "origin", "dev:main"])).toMatch(/refused: a push to main/);
    ok(repo, ["push", "-q", "origin", "dev"]); // dev is pushable
  });

  it("allow a fast-forward to the remote's copy (a pull after a PR merge)", () => {
    ok(repo, ["push", "-q", "origin", "dev:main"], allow); // stands in for the PR merge on GitHub
    ok(repo, ["fetch", "-q", "origin"]);
    ok(repo, ["branch", "-f", "main", "origin/main"]);
    expect(ok(repo, ["rev-parse", "main"])).toBe(ok(repo, ["rev-parse", "dev"]));
  });

  it("leave housekeeping alone (pack-refs, gc)", () => {
    ok(repo, ["pack-refs", "--all"]);
    ok(repo, ["gc", "-q"]);
    expect(ok(repo, ["rev-parse", "--verify", "staging"])).toMatch(/^[0-9a-f]{40}$/);
  });

  it("allow anything with CARETOOK_ALLOW_PROTECTED=1, and say so", () => {
    const out = execFileSync("git", ["-C", repo, "branch", "-f", "staging", "dev"], {
      encoding: "utf8",
      env: allow,
      stdio: "pipe",
    });
    expect(out).toBe("");
    expect(ok(repo, ["rev-parse", "staging"])).toBe(ok(repo, ["rev-parse", "dev"]));
  });
});

describe("dev", () => {
  it("takes direct commits: the backlog and small changes", () => {
    ok(repo, ["switch", "-q", "dev"]);
    commitFile("plans/backlog.md", "z\n");
    commitFile("plans/inbox.md", "- an idea\n");
    writeFileSync(join(repo, "feature.txt"), "f\n");
    ok(repo, ["add", "feature.txt"]);
    ok(repo, ["commit", "-q", "-m", "feat: feature"]);
  });

  it("takes merges, including one concluded after resolving a conflict", () => {
    ok(repo, ["switch", "-q", "-c", "prd/x"]);
    commitFile("work.txt", "prd\n");
    ok(repo, ["switch", "-q", "dev"]);
    ok(repo, ["merge", "-q", "--no-ff", "-m", "feat(x): land prd/x", "prd/x"]);

    ok(repo, ["switch", "-q", "-c", "prd/y"]);
    commitFile("work.txt", "y side\n");
    ok(repo, ["switch", "-q", "dev"]);
    commitFile("work.txt", "dev side\n", allow);
    expect(refused(repo, ["merge", "-q", "-m", "feat(y): land prd/y", "prd/y"])).toMatch(
      /CONFLICT|conflict/i,
    );
    writeFileSync(join(repo, "work.txt"), "resolved\n");
    ok(repo, ["add", "work.txt"]);
    ok(repo, ["commit", "-q", "--no-edit"]);
    expect(ok(repo, ["log", "-1", "--format=%p"]).split(" ")).toHaveLength(2);
  });
});

describe("commit messages", () => {
  it("must be Conventional Commits, merges included", () => {
    ok(repo, ["switch", "-q", "-c", "prd/z"]);
    const commit = (msg) => ["commit", "-q", "--allow-empty", "-m", msg];
    for (const msg of ["Add a thing", "feature(z): wrong type", "feat(z) no colon", "feat:missing space"])
      expect(refused(repo, commit(msg))).toMatch(/isn't a Conventional Commit/);
    for (const msg of [
      "feat(z): a thing (B-1)",
      "fix: a bug",
      "feat(api)!: breaking",
      "chore(z): merge dev into prd/z",
    ])
      ok(repo, commit(msg));
    ok(repo, ["switch", "-q", "-c", "slice/z/1"]);
    ok(repo, commit("feat(z): slice work"));
    ok(repo, ["switch", "-q", "prd/z"]);
    expect(refused(repo, ["merge", "-q", "--no-ff", "--no-edit", "slice/z/1"])).toMatch(
      /isn't a Conventional Commit/,
    );
    // A refused merge stays in progress: conclude it with a proper subject.
    ok(repo, ["commit", "-q", "-m", "feat(z): slice 1"]);
    expect(ok(repo, ["log", "-1", "--format=%p"]).split(" ")).toHaveLength(2);
    ok(repo, ["switch", "-q", "dev"]);
  });
});

describe("a slice's size at its merge", () => {
  // The merge's stderr (where the hook warns) and its exit code.
  const merge = (slice) => {
    const r = spawnSync("git", ["-C", repo, "merge", "-q", "--no-ff", "-m", `feat(w): ${slice}`, slice], {
      encoding: "utf8",
      env: baseEnv,
    });
    return { code: r.status, err: r.stderr };
  };
  const sliceOf = (n, files) => {
    ok(repo, ["switch", "-q", "prd/w"]);
    ok(repo, ["switch", "-q", "-c", `slice/w/${n}`]);
    for (let i = 0; i < files; i++) writeFileSync(join(repo, `w${n}-${i}.txt`), `${i}\n`);
    ok(repo, ["add", "."]);
    ok(repo, ["commit", "-q", "-m", `feat(w): slice ${n}`]);
    ok(repo, ["switch", "-q", "prd/w"]);
  };

  beforeAll(() => {
    ok(repo, ["switch", "-q", "dev"]);
    ok(repo, ["switch", "-q", "-c", "prd/w"]);
  });

  it("warns once, and still merges, when a slice changes more than 12 files", () => {
    sliceOf(1, 13);
    const { code, err } = merge("slice/w/1");
    expect(code).toBe(0);
    expect(err.match(/warning: slice\/w\/1 changes 13 files \(over 12\)/g)).toHaveLength(1);
    expect(err).toContain("about 8 files");
    expect(ok(repo, ["log", "-1", "--format=%p"]).split(" ")).toHaveLength(2);
  });

  it("says nothing for a slice of 8 files", () => {
    sliceOf(2, 8);
    const { code, err } = merge("slice/w/2");
    expect(code).toBe(0);
    expect(err).not.toContain("warning");
  });

  it("counts only the slice's own files after it merged prd/ for a fix", () => {
    sliceOf(3, 6);
    // prd/ moves on by 13 files; the slice merges it back in, then adds one more file.
    for (let i = 0; i < 13; i++) writeFileSync(join(repo, `p-${i}.txt`), `${i}\n`);
    ok(repo, ["add", "."]);
    ok(repo, ["commit", "-q", "-m", "feat(w): prd work"]);
    ok(repo, ["switch", "-q", "slice/w/3"]);
    ok(repo, ["merge", "-q", "--no-ff", "-m", "chore(w): merge prd/w for a fix", "prd/w"]);
    writeFileSync(join(repo, "w3-fix.txt"), "fix\n");
    ok(repo, ["add", "."]);
    ok(repo, ["commit", "-q", "-m", "fix(w): slice 3"]);
    ok(repo, ["switch", "-q", "prd/w"]);
    const { code, err } = merge("slice/w/3");
    expect(code).toBe(0);
    expect(err).not.toContain("warning");
  });
});
