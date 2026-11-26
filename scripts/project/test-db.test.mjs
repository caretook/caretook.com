// test-db.sh, Caretook's shared test Postgres, against a throwaway repo that
// holds only this script (no core file: the integration tests run it with no
// Risa present), with a fake docker on PATH: nothing here touches real containers.
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { workerDatabaseName } from "../../packages/data/src/db/testDatabase.ts";

const HERE = new URL(".", import.meta.url).pathname;
const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: "pipe" }).trim();

const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
case $1 in
  ps) [[ "$*" != *caretook-shared-test* || -z \${FAKE_SHARED_ID:-} ]] || echo "$FAKE_SHARED_ID" ;;
  exec) [[ "$*" != *psql* ]] || printf '%s\n' "\${FAKE_PSQL:-0}" ;;
esac
exit 0
`;

let root, main, loops, log, env;
const sh = (args = [], opts = {}) =>
  spawnSync("bash", [join(main, "scripts/project/test-db.sh"), ...args], {
    cwd: opts.cwd ?? main,
    encoding: "utf8",
    env: { ...env, ...opts.env },
    input: "",
  });
const ok = (args, opts) => {
  const r = sh(args, opts);
  if (r.status !== 0) throw new Error(`test-db.sh ${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};
const calls = () => (existsSync(log) ? readFileSync(log, "utf8") : "");

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "test-db-test-")));
  main = join(root, "repo");
  loops = join(main, ".loops");
  log = join(root, "calls.log");
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  chmodSync(join(bin, "docker"), 0o755);
  env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_LOG: log, CARETOOK_SHARED_TEST_PORT: "" };
  execFileSync("git", ["init", "-q", "-b", "dev", main]);
  for (const [k, v] of [
    ["user.email", "test@example.com"],
    ["user.name", "Test"],
    ["commit.gpgsign", "false"],
  ])
    git(main, "config", k, v);
  mkdirSync(join(main, "scripts/project"), { recursive: true });
  copyFileSync(join(HERE, "test-db.sh"), join(main, "scripts/project/test-db.sh"));
  writeFileSync(join(main, ".gitignore"), ".loops/\n");
  git(main, "add", ".");
  git(main, "commit", "-q", "-m", "chore: init");
  git(main, "worktree", "add", "-q", "-b", "t", join(loops, "t-1"));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
beforeEach(() => rmSync(log, { force: true }));

describe("test-db.sh", () => {
  it("runs with no core file present", () => {
    expect(readdirSync(join(main, "scripts"))).toEqual(["project"]);
    expect(ok(["status"])).toMatch(/shared test Postgres: not running/);
  });

  it("says so outside a git repository, rather than exiting silently", () => {
    const lone = join(root, "lone");
    mkdirSync(lone, { recursive: true });
    copyFileSync(join(HERE, "test-db.sh"), join(lone, "test-db.sh"));
    const r = spawnSync("bash", [join(lone, "test-db.sh"), "status"], {
      cwd: lone,
      encoding: "utf8",
      env: { ...env, GIT_CEILING_DIRECTORIES: root },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/isn't in a git repository/);
  });

  it("finds a main checkout whose path has a space", () => {
    const spaced = join(root, "a repo");
    execFileSync("git", ["init", "-q", "-b", "dev", spaced]);
    mkdirSync(join(spaced, "scripts/project"), { recursive: true });
    copyFileSync(join(HERE, "test-db.sh"), join(spaced, "scripts/project/test-db.sh"));
    mkdirSync(join(spaced, ".loops", "w-1"), { recursive: true });
    const r = spawnSync("bash", [join(spaced, "scripts/project/test-db.sh"), "use", "w-1"], {
      cwd: spaced,
      encoding: "utf8",
      env,
    });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(existsSync(join(spaced, ".loops", "w-1", "packages/data/.env.test.local"))).toBe(true);
  });

  it("gives its port and Compose project as facts (the core's only copy of them)", () => {
    expect(ok(["facts"])).toBe("port=5436\nproject=caretook-shared-test\nrunning=no\n");
    expect(ok(["facts"], { env: { FAKE_SHARED_ID: "c0ffee" } })).toMatch(/^running=yes$/m);
    expect(ok(["facts"], { env: { CARETOOK_SHARED_TEST_PORT: "5999" } })).toMatch(/^port=5999$/m);
  });

  it("names databases for worktrees, and refuses to drop without a name", () => {
    expect(ok(["name", "Orchestration-5"]).trim()).toBe("caretook_test_orchestration_5");
    expect(ok(["name", "x".repeat(80)]).trim()).toHaveLength(63);
    expect(sh(["drop"]).status).not.toBe(0);
  });

  it("use points an older worktree's tests at its shared database", () => {
    const f = join(loops, "t-1", "packages/data/.env.test.local");
    mkdirSync(join(loops, "t-1", "packages/data"), { recursive: true });
    writeFileSync(f, 'DATABASE_URL="postgresql://caretook:password@localhost:1/caretook"\nPG_TEST_PORT=1\n');
    const r = sh(["use"], { cwd: join(loops, "t-1") });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^summary=caretook_test_t_1 on the shared test Postgres \(:5436\)$/m);
    // Its human line is for a terminal only: new.sh reads summary= and prints its own.
    expect(r.stderr).toBe("");
    const text = readFileSync(f, "utf8");
    expect(text).toMatch(/localhost:5436\/caretook_test_t_1"/);
    expect(text).toMatch(/^PG_TEST_PORT=5436$/m);
    expect(text).toMatch(/^SHARED_TEST_DB=1$/m);
  });

  it("lists each worktree database with its worker copies, and orphaned copies", () => {
    const gone = workerDatabaseName("caretook_test_gone", 1);
    const psql = [
      "caretook_test_a_1",
      "caretook_test_a_10",
      // An old-style copy lists as a database: tidy decides its owner by name.
      "caretook_test_a_1_w3",
      workerDatabaseName("caretook_test_a_1", 1),
      workerDatabaseName("caretook_test_a_1", 2),
      gone,
    ].join("\n");
    expect(ok(["list"], { env: { FAKE_SHARED_ID: "c0ffee", FAKE_PSQL: psql } })).toBe(
      "caretook_test_a_1 (+2 worker copies)\ncaretook_test_a_10\ncaretook_test_a_1_w3\n" +
        `${gone} (worker copy, its database is gone)\n`,
    );
    // tidy drops such an orphan by name.
    ok(["drop-db", gone], { env: { FAKE_SHARED_ID: "c0ffee", FAKE_PSQL: "" } });
    expect(calls()).toContain(`dropdb -U caretook --if-exists --force ${gone}`);
  });

  // tidy's orphans: what no worktree owns, decided by name here (B-440).
  it("names the databases no given worktree owns", () => {
    const orphans = (dbs, names) =>
      ok(["orphans", ...names], { env: { FAKE_SHARED_ID: "c0ffee", FAKE_PSQL: dbs.join("\n") } })
        .split("\n")
        .filter(Boolean)
        .map((l) => l.replace(/^orphan=/, ""));
    const names = ["foo-w2", "bar"];
    // A topic ending -w<n> owns its database; old-style copies are its worktree's.
    expect(
      orphans(
        [
          "caretook_test_foo_w2",
          "caretook_test_foo_w2_w1",
          "caretook_test_foo_w2_w16",
          "caretook_test_bar_w3",
          "caretook_test_gone_w1",
          "caretook_test_gone",
          "caretook_test_bar_w17",
          "caretook_test_barn",
        ],
        names,
      ),
    ).toEqual(["caretook_test_gone_w1", "caretook_test_gone", "caretook_test_bar_w17", "caretook_test_barn"]);
    // New-style worker copies go by their database's hash, never another's.
    const copy = workerDatabaseName("caretook_test_foo", 1);
    expect(orphans([copy, "caretook_test_foo_w1"], ["foo", "foo-w1"])).toEqual([]);
    expect(orphans([workerDatabaseName("caretook_test_foo", 17)], ["foo"])).toHaveLength(1);
    expect(orphans([copy], ["bar"])).toEqual([copy]);
    const long = `t-${"x".repeat(70)}`;
    const db = ok(["name", long]).trim();
    expect(orphans([db, `${db.slice(0, 59)}_w4`, workerDatabaseName(db, 3)], [long])).toEqual([]);
    // Not running: nothing to name.
    expect(ok(["orphans", "foo"])).toBe("");
  });

  it("down stops only the shared project", () => {
    ok(["down"]);
    expect(calls().trim()).toBe("docker compose -p caretook-shared-test down --remove-orphans");
  });
});
