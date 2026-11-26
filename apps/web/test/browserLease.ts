// Vitest's globalSetup for `web:components`: runs in Node once per run,
// before Chromium starts, and its teardown after Chromium closes.
//
// Component tests' Chromium counts against the same machine-wide `browser`
// lease as `pnpm prd browser`, so worktrees can't all start browsers together.
// The lease is the tool's, through the config's lease command (risa.json's
// `hooks.lease`): `<command> <kind> --label L --watch P` holds one, prints
// "lease <N> <dir>" once held, and releases when its stdin closes or P (this
// process) is gone, so even a SIGKILLed Vitest frees it.
//
// Only where the tool runs: the main checkout (worktrees sit inside its
// `.loops/`) has a `.loops/` folder. With none (CI, a plain clone) it takes no
// lease. With one, a lease command that's missing or can't run fails the run.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Release = () => Promise<void>;

/** This checkout's root (where risa.json sits). */
const REPO = fileURLToPath(new URL("../../../", import.meta.url));

/** The main checkout of the repo at `dir` (git's first worktree), or null outside git. */
export function mainCheckout(dir: string): string | null {
  try {
    const out = execFileSync("git", ["-C", dir, "worktree", "list", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return /^worktree (.+)$/m.exec(out)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The config's lease command, or an error saying why there's none. */
function leaseCommand(repo: string): string {
  const path = join(repo, "risa.json");
  let config: { hooks?: { lease?: unknown } };
  try {
    config = JSON.parse(readFileSync(path, "utf8")) as typeof config;
  } catch (error) {
    throw new Error(`browser lease: can't read ${path}: ${(error as Error).message}`, { cause: error });
  }
  const command = config.hooks?.lease;
  if (typeof command !== "string" || !command.trim()) {
    throw new Error(`browser lease: ${path} has no hooks.lease command`);
  }
  return command;
}

export type HoldOptions = {
  kind?: string;
  label?: string;
  /** This checkout's root: the config's folder and the command's working directory. */
  repo?: string;
  /** The main checkout, whose `.loops/` says whether to take a lease at all. */
  main?: string | null;
  /** The pid the lease lives for (default: this process). */
  watch?: number;
  env?: NodeJS.ProcessEnv;
};

/**
 * Holds a lease through the config's command and resolves once it's held, with
 * its release; with no `.loops/` in the main checkout, resolves at once with
 * nothing held. Rejects if the command is missing or exits before holding one.
 */
export function holdLease({
  kind = "browser",
  label = "web:components",
  repo = REPO,
  main = mainCheckout(repo),
  watch = process.pid,
  env = process.env,
}: HoldOptions = {}): Promise<{ held: boolean; release: Release }> {
  if (!main || !existsSync(join(main, ".loops"))) {
    return Promise.resolve({ held: false, release: async () => {} });
  }
  let command: string;
  try {
    command = leaseCommand(repo);
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  const args = [kind, "--label", label, "--watch", String(watch)];
  // As the core runs a hook (hooks.mjs): no `exec`, so a leading env assignment
  // or a compound command works too; the arguments go after its last word.
  const child = spawn("sh", ["-c", `${command} "$@"`, "lease", ...args], {
    cwd: repo,
    env,
    stdio: ["pipe", "pipe", "inherit"],
  });
  let exited = false;
  const gone = new Promise<void>((resolve) =>
    child.once("exit", () => {
      exited = true;
      resolve();
    }),
  );
  const release: Release = async () => {
    if (exited) return;
    child.stdin.end();
    await gone;
  };
  return new Promise((resolve, reject) => {
    let out = "";
    let done = false;
    const fail = (why: string) => {
      if (done) return;
      done = true;
      reject(new Error(`no ${kind} lease: the lease command (${command}) ${why}`));
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
      if (!done && /^lease \d+ .+$/m.test(out)) {
        done = true;
        resolve({ held: true, release });
      }
    });
    child.once("exit", (code, signal) => fail(`exited with ${code ?? signal}`));
    child.once("error", (error) => fail(`couldn't run: ${error.message}`));
  });
}

let release: Release | undefined;

export async function setup() {
  ({ release } = await holdLease());
}

export async function teardown() {
  await release?.();
}
