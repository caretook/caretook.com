// stack.sh and serve.sh, Caretook's dev stack behind the config's stack hooks,
// against a throwaway repo that holds only scripts/project (no core file), with
// fake docker, pnpm and lsof on PATH: nothing here touches real containers.
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const HERE = new URL(".", import.meta.url).pathname;
const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: "pipe" }).trim();

const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
case $1 in
  ps) if [[ "$*" == *status=running* ]]; then [[ -z \${FAKE_RUNNING_IDS:-} ]] || echo "$FAKE_RUNNING_IDS"
      elif [[ "$*" == *-aq* && "$*" != *-test ]]; then [[ -z \${FAKE_STACK_IDS:-} ]] || echo "$FAKE_STACK_IDS"; fi ;;
esac
exit 0
`;

let root, main, loops, log, env;
const run = (script, args = [], opts = {}) =>
  spawnSync("bash", [join(main, "scripts/project", script), ...args], {
    cwd: opts.cwd ?? main,
    encoding: "utf8",
    env: { ...env, ...opts.env },
    input: "",
  });
const ok = (args, opts) => {
  const r = run("stack.sh", args, opts);
  if (r.status !== 0) throw new Error(`stack.sh ${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};
const facts = (out) =>
  Object.fromEntries(
    out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
const calls = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
const read = (...p) => readFileSync(join(...p), "utf8");

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "project-stack-test-")));
  main = join(root, "repo");
  loops = join(main, ".loops");
  log = join(root, "calls.log");
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  writeFileSync(join(bin, "pnpm"), '#!/usr/bin/env bash\necho "pnpm $*" >> "$FAKE_LOG"\n');
  writeFileSync(join(bin, "lsof"), '#!/usr/bin/env bash\n[[ "$*" == *":${FAKE_LISTEN:-none}"* ]]\n');
  for (const f of ["docker", "pnpm", "lsof"]) chmodSync(join(bin, f), 0o755);
  env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_LOG: log, CARETOOK_SHARED_TEST_PORT: "" };
  execFileSync("git", ["init", "-q", "-b", "dev", main]);
  for (const [k, v] of [
    ["user.email", "test@example.com"],
    ["user.name", "Test"],
    ["commit.gpgsign", "false"],
  ])
    git(main, "config", k, v);
  // Only Caretook's scripts: the stack runs with no core file present.
  cpSync(HERE, join(main, "scripts/project"), { recursive: true });
  writeFileSync(join(main, ".gitignore"), ".loops/\n.env\n.env.*\n");
  git(main, "add", ".");
  git(main, "commit", "-q", "-m", "chore: init");
  mkdirSync(join(loops, "t-1"), { recursive: true });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
beforeEach(() => rmSync(log, { force: true }));

describe("slot facts", () => {
  it("gives each slot its ports, project and container", () => {
    expect(facts(ok(["status", "--slot", "2"]))).toEqual({
      slot: "2",
      project: "caretook-loop2",
      web_port: "6273",
      pg_port: "6234",
      pg_test_port: "6235",
      powersync_port: "6280",
      cdp_offset: "2000",
      url: "http://localhost:6273",
      pg_container: "caretook-loop2-postgres-1",
      summary: "Postgres     :6234   PowerSync :6280",
    });
    expect(facts(ok(["status", "--slot", "12"]))).toMatchObject({ web_port: "7273", pg_port: "7234" });
    expect(run("stack.sh", ["status", "--slot", "20"]).status).not.toBe(0);
  });

  it("probes whether a slot is in use: a worktree's .env names it, or a port listens", () => {
    expect(facts(ok(["status", "--slot", "3", "--probe"])).in_use).toBe("no");
    expect(facts(ok(["status", "--slot", "3", "--probe"], { env: { FAKE_LISTEN: "6380" } })).in_use).toBe(
      "yes",
    );
    mkdirSync(join(loops, "x"), { recursive: true });
    writeFileSync(join(loops, "x", ".env"), "CARETOOK_STACK=caretook-loop3\n");
    expect(facts(ok(["status", "--slot", "3", "--probe"])).in_use).toBe("yes");
    rmSync(join(loops, "x"), { recursive: true });
  });
});

describe("up and down", () => {
  const dir = () => join(loops, "t-1");

  it("refuses a stack while the main checkout lacks its env files", () => {
    const r = run("stack.sh", ["up", "--check"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/missing .*packages\/data\/\.env/);
  });

  it("writes the env files for a slot, then starts, reads and takes down the stack", () => {
    mkdirSync(join(main, "packages/data"), { recursive: true });
    mkdirSync(join(main, "apps/web"), { recursive: true });
    writeFileSync(join(main, "packages/data/.env"), 'DATABASE_URL="x"\nSEED_USER_PASSWORD="pw-fictional"\n');
    writeFileSync(join(main, "apps/web/.env"), 'BETTER_AUTH_URL="x"\nCRON_SECRET="s"\n');
    ok(["up", "--check"]);

    expect(run("stack.sh", ["up", dir()]).stderr).toMatch(/needs --slot/);
    expect(ok(["up", dir(), "--slot", "4", "--base", "prd/t", "--env-only"])).toMatch(/^slot=4$/m);
    expect(read(dir(), ".env")).toMatch(/^CARETOOK_STACK=caretook-loop4$/m);
    expect(read(dir(), "apps/web/.env")).toMatch(/^WEB_PORT=6473$/m);
    expect(read(dir(), ".env.loop")).toMatch(/^BASE_BRANCH=prd\/t\nBASE=http:\/\/localhost:6473\n/m);
    expect(read(dir(), ".env.loop")).toMatch(/^SEED_USER_PASSWORD="pw-fictional"$/m);
    expect(calls()).toBe("");

    // A stack it has: started again, its facts unchanged, the test env written.
    const up = run("stack.sh", ["up", dir()]);
    expect(up.status).toBe(0);
    expect(facts(up.stdout)).toMatchObject({
      slot: "4",
      project: "caretook-loop4",
      url: "http://localhost:6473",
    });
    expect(calls()).toMatch(/pnpm datastore:start/);
    expect(read(dir(), "packages/data/.env.test.local")).toMatch(/:5436\/caretook_test_t_1"/);
    expect(facts(ok(["status", dir()]))).toEqual(facts(up.stdout));

    const ready = (e) => run("stack.sh", ["ready", dir()], { env: e });
    expect(ready({}).stdout).toMatch(/^containers=0\/0\nready=no$/m);
    expect(ready({ FAKE_STACK_IDS: "a", FAKE_RUNNING_IDS: "a" }).status).toBe(0);

    ok(["down", dir(), "--teardown-only"]);
    expect(calls()).toMatch(/docker compose -p caretook-loop4 down --remove-orphans/);
    expect(existsSync(join(dir(), ".env"))).toBe(true);

    const down = ok(["down", dir(), "--base", "dev"]);
    expect(facts(down).project).toBe("caretook-loop4");
    for (const f of [".env", "packages/data/.env", "apps/web/.env"])
      expect(existsSync(join(dir(), f)), f).toBe(false);
    // .env.loop keeps the base it had, not the one given.
    expect(read(dir(), ".env.loop")).toBe("SLOT=\nBASE_BRANCH=prd/t\n");
    expect(read(dir(), "packages/data/.env.test.local")).toMatch(/caretook_test_t_1/);
    rmSync(log, { force: true });
    expect(ok(["down", dir()])).toBe("");
    expect(ok(["status", dir()])).toBe("");
    expect(calls()).toBe("");
  });

  it("undoes a half-made stack when starting it fails", () => {
    const failing = join(root, "failbin");
    mkdirSync(failing, { recursive: true });
    writeFileSync(join(failing, "pnpm"), "#!/usr/bin/env bash\nexit 3\n");
    chmodSync(join(failing, "pnpm"), 0o755);
    const r = run("stack.sh", ["up", dir(), "--slot", "5", "--base", "prd/t"], {
      env: { PATH: `${failing}:${env.PATH}` },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/stack up failed: taking it down again/);
    expect(existsSync(join(dir(), ".env"))).toBe(false);
    expect(read(dir(), ".env.loop")).toBe("SLOT=\nBASE_BRANCH=prd/t\n");
  });
});

describe("serve.sh", () => {
  it("runs with no core file present, and serves only a worktree with a stack", () => {
    const r = run("serve.sh", ["t-1"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/t-1 has no stack, so no dev server/);
  });
});
