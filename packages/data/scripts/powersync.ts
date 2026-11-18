/**
 * The last step of `pnpm datastore:reset`: give this checkout's PowerSync a
 * fresh start, so the first sign-in after a reset just works.
 *
 * A reset drops the database's schema, which logical replication never sees as
 * deletes, so PowerSync's bucket storage would keep rows that no longer exist
 * (old `note_update`s with the old user ids, shown as "Former member"), and it
 * would keep the old JWKS for minutes (401, PSYNC_S2101). A restart alone fixes
 * the keys but not the storage, so this:
 *
 * 1. stops PowerSync, drops its replication slot and empties its bucket storage;
 * 2. starts it again, which replicates the new data from scratch;
 * 3. waits (at most 60 s) until the first replication is done, and until the
 *    JWKS PowerSync will fetch (`PS_JWKS_URL`) answers with a key. A fresh
 *    PowerSync has no cached keys, so its first sync request loads that set.
 *
 * Every step goes through `docker compose` from the repo root, so the project
 * (`CARETOOK_STACK`) and ports come from the root `.env` exactly as they do for
 * `pnpm datastore:up`: a loop worktree only touches its own stack. When this
 * stack's PowerSync isn't running (CI, the test-only stack), it skips with a
 * note. A slow readiness wait is a warning, not a failure: the dev server may
 * not be running yet, and PowerSync fetches the keys on its first request then.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../..");
const READY_TIMEOUT_MS = 60_000;
/** The admin token in powersync/service.yaml (local diagnostics only). */
const ADMIN_TOKEN = "local-dev-admin-token";
/** The service's port inside its container (powersync/service.yaml). */
const CONTAINER_PORT = "8080";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Result = { ok: boolean; out: string; err: string };

const compose = (...args: string[]): Result => {
  const res = spawnSync("docker", ["compose", ...args], { cwd: ROOT, encoding: "utf8" });
  return {
    ok: res.status === 0,
    out: (res.stdout ?? "").trim(),
    err: (res.stderr ?? res.error?.message ?? "").trim(),
  };
};

const mustCompose = (step: string, ...args: string[]) => {
  const res = compose(...args);
  if (!res.ok) {
    console.error(`❌ PowerSync reset failed (${step}): ${res.err || res.out}`);
    process.exit(1);
  }
  return res.out;
};

const psql = (service: string, user: string, sql: string) =>
  mustCompose(
    `${service}: ${sql}`,
    "exec",
    "-T",
    service,
    "psql",
    "-U",
    user,
    "-d",
    user,
    "-v",
    "ON_ERROR_STOP=1",
    "-Atqc",
    sql,
  );

const WORKING_DIR = '{{.Label "com.docker.compose.project.working_dir"}}';
const ps = compose("ps", "--status", "running", "--format", `{{.Name}}\t${WORKING_DIR}`, "powersync");
const [name, workingDir] = ps.out.split("\t");
if (!ps.ok || !name) {
  const why = ps.ok ? "isn't running" : "can't be reached through docker compose";
  console.log(`ℹ️  PowerSync ${why} in this checkout's stack: skipped its restart.`);
  process.exit(0);
}
// A checkout without its own stack (no root .env) resolves the default project,
// which another checkout started: never touch that one.
if (workingDir && resolve(workingDir) !== ROOT) {
  console.log(`ℹ️  ${name} belongs to ${workingDir}, not this checkout: skipped its restart.`);
  process.exit(0);
}
console.log(`↻ Restarting ${name} with empty bucket storage`);

mustCompose("stop", "stop", "powersync");

// The slot goes inactive once the service has stopped: drop it, or it keeps
// WAL forever, since the emptied storage makes PowerSync create a new one.
const SLOTS = "FROM pg_replication_slots WHERE slot_name LIKE 'powersync%'";
for (let i = 0; i < 20 && psql("postgres", "caretook", `SELECT count(*) ${SLOTS} AND active`) !== "0"; i++) {
  await sleep(500);
}
psql("postgres", "caretook", `SELECT pg_drop_replication_slot(slot_name) ${SLOTS} AND NOT active`);
// PowerSync recreates its schema (migrations) on start.
psql("powersync-storage", "powersync", "DROP SCHEMA IF EXISTS powersync CASCADE");

mustCompose("start", "start", "powersync");

const hostPort = mustCompose("port", "port", "powersync", CONTAINER_PORT).split(":").pop();
const base = `http://127.0.0.1:${hostPort}`;
const deadline = Date.now() + READY_TIMEOUT_MS;

type Diagnostics = {
  data?: {
    active_sync_rules?: {
      connections?: { initial_replication_done?: boolean; last_checkpoint_ts?: string }[];
    };
  };
};

/** Replication caught up: the snapshot is done and there is a checkpoint to sync. */
const replicated = async () => {
  try {
    const res = await fetch(`${base}/api/admin/v1/diagnostics`, {
      method: "POST",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return false;
    const connection = ((await res.json()) as Diagnostics).data?.active_sync_rules?.connections?.[0];
    return !!connection?.initial_replication_done && !!connection.last_checkpoint_ts;
  } catch {
    return false;
  }
};

// Fetched from inside the container, so it's the URL and network PowerSync uses.
// Better Auth creates the first key on this request if the reset left none.
const FETCH_JWKS = `fetch(process.env.PS_JWKS_URL, { signal: AbortSignal.timeout(5000) })
  .then((r) => r.json()).then((j) => { if (!j.keys?.length) process.exit(1); console.log(j.keys.map((k) => k.kid).join(", ")); })
  .catch(() => process.exit(1))`;
const jwksKeys = () => {
  const res = compose("exec", "-T", "powersync", "node", "-e", FETCH_JWKS);
  return res.ok ? res.out : null;
};

let isReplicated = false;
let keys: string | null = null;
while (Date.now() < deadline && !(isReplicated && keys)) {
  isReplicated ||= await replicated();
  if (isReplicated) keys ??= jwksKeys();
  if (!(isReplicated && keys)) await sleep(1000);
}

if (isReplicated && keys) {
  console.log(`✅ PowerSync ready on :${hostPort} (replicated; JWKS key ${keys})`);
} else {
  const missing = isReplicated
    ? "the dev server's JWKS (PS_JWKS_URL) didn't answer: is the dev server running? PowerSync fetches the keys on its first sync request"
    : "its first replication isn't done; check `docker compose logs powersync`";
  console.warn(`⚠️  PowerSync restarted, but after ${READY_TIMEOUT_MS / 1000} s ${missing}.`);
}
