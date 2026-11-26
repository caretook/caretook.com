// The component tests' browser lease helper, through this repo's real lease
// command (risa.json's hooks.lease) on a throwaway lease root, so it never
// takes one of the machine's real leases.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
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
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { holdLease } from "./browserLease";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const LEASE = (JSON.parse(readFileSync(join(REPO, "risa.json"), "utf8")) as { hooks: { lease: string } })
  .hooks.lease;

/**
 * Whether this checkout can run its lease command: each word that names a
 * program or a path resolves. A clone without the tool (CI after the move to
 * an external Risa) skips the tests that need a real lease.
 */
function canRun(command: string, cwd: string): boolean {
  const [program, ...rest] = command.split(/\s+/).filter((w) => w && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  if (!program) return false;
  const found = spawnSync("sh", ["-c", 'command -v "$1" >/dev/null', "x", program], { cwd }).status === 0;
  return found && rest.every((w) => !w.includes("/") || existsSync(resolve(cwd, w)));
}
const realLease = canRun(LEASE, REPO);

let root: string;
let main: string;
let leases: string;
let env: NodeJS.ProcessEnv;
const children: ChildProcess[] = [];
const releases: (() => Promise<void>)[] = [];

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "browser-lease-test-")));
  main = join(root, "main");
  mkdirSync(join(main, ".loops"), { recursive: true });
  leases = join(root, "leases");
  env = {
    ...process.env,
    CARETOOK_LEASE_ROOT: leases,
    CARETOOK_LEASE_POLL: "1",
    CARETOOK_BROWSER_SLOTS: "1",
    CARETOOK_BROWSER_WAIT: "60",
  };
  for (const k of ["CARETOOK_LEASES", "CARETOOK_BROWSER_LEASES", "CARETOOK_BROWSER_OLD_LEASES"])
    delete env[k];
});
afterEach(async () => {
  for (const release of releases.splice(0)) await release();
  for (const c of children.splice(0)) if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const held = (n = 1) => existsSync(join(leases, "browser", String(n)));
// Waits on a state (the lease's folder, a line of output) to come true.
const until = (cond: () => boolean) =>
  vi.waitFor(() => expect(cond()).toBe(true), { timeout: 10_000, interval: 50 });
const hold = async (opts: Parameters<typeof holdLease>[0] = {}) => {
  const lease = await holdLease({ repo: REPO, main, env, ...opts });
  releases.push(lease.release);
  return lease;
};
// A repo whose risa.json has the given hooks (for a missing or broken command).
const repoWith = (name: string, hooks: Record<string, string>) => {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "risa.json"), JSON.stringify({ name: "sample", hooks }));
  return dir;
};

describe.skipIf(!realLease)("the browser lease helper, through the real lease command", () => {
  it("holds a lease until released", async () => {
    const lease = await hold();
    expect(lease.held).toBe(true);
    expect(held()).toBe(true);
    await lease.release();
    expect(held()).toBe(false);
  });

  it("and a check's lease of the same kind exclude each other", async () => {
    // The check's: the tool's own lease, through the same command.
    const check = spawn("sh", ["-c", `${LEASE} "$@"`, "lease", "browser", "--label", "pnpm check"], {
      cwd: REPO,
      env: { ...env },
      stdio: ["pipe", "pipe", "inherit"],
    });
    children.push(check);
    let out = "";
    check.stdout.on("data", (d: Buffer) => (out += d.toString()));
    await until(() => /^lease 1 /m.test(out));

    let mine = false;
    const waiting = hold().then((lease) => ((mine = true), lease));
    // The helper is queued behind the check (lease.sh's waiting file), not holding.
    const waiters = join(leases, "browser", ".waiting");
    await until(() => existsSync(waiters) && readdirSync(waiters).length === 1);
    expect(mine).toBe(false);

    check.stdin.end();
    const lease = await waiting;
    expect(lease.held).toBe(true);
    expect(held()).toBe(true);
  });

  it("is released when the process it lives for exits", async () => {
    const vitest = spawn("sleep", ["60"], { stdio: "ignore" });
    children.push(vitest);
    await hold({ watch: vitest.pid });
    expect(held()).toBe(true);
    vitest.kill("SIGKILL");
    await until(() => !held());
  });

  it("takes over a dead holder's lease", async () => {
    mkdirSync(join(leases, "browser", "1"), { recursive: true });
    writeFileSync(
      join(leases, "browser", "1", "name"),
      `kind=browser\nworktree=${root}\ncheck=gone\npid=99999999\nstarted=${Math.floor(Date.now() / 1000)}\n`,
    );
    const lease = await hold();
    expect(lease.held).toBe(true);
    expect(held()).toBe(true);
  });

  it("runs a command with a leading env assignment, or a compound one", async () => {
    // The real command, its paths made absolute, from another repo's config.
    const real = LEASE.split(" ")
      .map((w) => (w.includes("/") ? resolve(REPO, w) : w))
      .join(" ");
    for (const [i, lease] of [`SHAPED_LEASE=1 ${real}`, `true && ${real}`].entries()) {
      const repo = repoWith(`shaped-${i}`, { lease });
      const held1 = await hold({ repo });
      expect(held1.held).toBe(true);
      expect(held()).toBe(true);
      await held1.release();
      expect(held()).toBe(false);
    }
  });
});

describe("the browser lease helper", () => {
  it("finds a command it can run, and not one it can't", () => {
    expect(canRun("sh -c true", REPO)).toBe(true);
    expect(canRun("A=1 sh", REPO)).toBe(true);
    expect(canRun("no-such-lease-command hold", REPO)).toBe(false);
    expect(canRun("bash scripts/no-such-lease.sh hold", REPO)).toBe(false);
  });

  it("fails loudly with no lease command, or one that can't run", async () => {
    await expect(holdLease({ repo: repoWith("none", {}), main, env })).rejects.toThrow(/no hooks\.lease/);
    await expect(
      holdLease({ repo: repoWith("broken", { lease: "no-such-lease-command" }), main, env }),
    ).rejects.toThrow(/no browser lease: the lease command \(no-such-lease-command\) exited with 127/);
    expect(held()).toBe(false);
  });

  it("takes no lease, and runs no command, with no .loops/ in the main checkout", async () => {
    const plain = join(root, "plain");
    mkdirSync(plain, { recursive: true });
    const lease = await holdLease({ repo: repoWith("none2", {}), main: plain, env });
    expect(lease.held).toBe(false);
    expect(held()).toBe(false);
    await lease.release();
  });
});
