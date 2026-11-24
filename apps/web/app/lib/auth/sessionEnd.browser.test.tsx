import type { SyncDb } from "~/lib/sync";

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { KEPT_COPY_LIMIT_MS } from "./localCopyRules";
import { expireKeptCopy } from "./keptCopy";
import { endSession } from "./session";
import { countWaiting, open, setTestDatabaseFile } from "../sync/client";
import { getSync, installTestDatabase } from "../sync/index";
import { TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../test/fixtures";

// A session the server ended (sync-safety slice 4, B-290), on a real local
// database (a file of its own, never connected) through the device client's
// `open` and the session's `endSession`: with a change waiting, the copy is
// kept closed for its owner and everything else cached about them is
// forgotten; their next open keeps the queue, anyone else's clears it, and a
// copy kept past its limit is cleared without anyone signing in.

const OTHER_USER = "6a1f0c2e-7b3d-4e5f-8a9b-0c1d2e3f4a5b";
const ENTRY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1d01";

const open_: SyncDb[] = [];
const openFor = async (userId: string) => {
  const db = await open(userId);
  open_.push(db);
  await installTestDatabase(db);
  return db;
};

const queueLength = (db: SyncDb) =>
  db.powersync.get<{ n: number }>("SELECT count(*) AS n FROM ps_crud").then((r) => Number(r.n));

/** What the signed-in user leaves in localStorage (fictional values). */
const leaveUserKeys = () => {
  localStorage.setItem("caretook:session-user", JSON.stringify({ id: TEST_USER.id, email: TEST_USER.email }));
  localStorage.setItem(`caretook:session-confirmed:${TEST_USER.id}`, String(Date.now()));
  localStorage.setItem(`caretook:settings:${TEST_USER.id}`, JSON.stringify({ units: {} }));
  localStorage.setItem(`caretook:settings-pending:${TEST_USER.id}`, JSON.stringify({ easyMode: "easy" }));
  localStorage.setItem(`caretook:lastGroup:${TEST_USER.id}`, TEST_GROUP.id);
  localStorage.setItem(`caretook:recentSearches:${TEST_USER.id}`, JSON.stringify(["walk"]));
};

const caretookKeys = () =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith("caretook:"))
    .sort();

/** A note written on this device, not uploaded yet. */
const writeNote = (db: SyncDb) =>
  db.powersync.execute(
    `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
     VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', 'Fictional walk')`,
    [ENTRY, TEST_GROUP.id, TEST_RECIPIENT.id],
  );

beforeEach(() => {
  localStorage.clear();
  setTestDatabaseFile({
    dbFilename: `test-session-end-${crypto.randomUUID()}.sqlite`,
    enableMultiTabs: false,
    useWebWorker: false,
  });
});

afterEach(async () => {
  await installTestDatabase(null);
  for (const db of open_.splice(0)) await db.powersync.close().catch(() => undefined);
  setTestDatabaseFile(null);
  localStorage.clear();
});

describe("a session the server ended", () => {
  test("with a change waiting: kept for its owner, nothing else cached about them", async () => {
    const db = await openFor(TEST_USER.id);
    await writeNote(db);
    leaveUserKeys();
    expect(await endSession()).toBe("keep");
    // Closed: no screen can read it.
    expect(() => getSync()).toThrow();
    expect(caretookKeys()).toEqual([
      `caretook:settings-pending:${TEST_USER.id}`,
      "caretook:sync-kept",
      "caretook:sync-owner",
    ]);
    // The file still holds the change.
    expect(await countWaiting(null)).toBe(1);

    // The owner's next sign-in opens it with the queue, no longer kept.
    const again = await openFor(TEST_USER.id);
    expect(await queueLength(again)).toBe(1);
    expect(localStorage.getItem("caretook:sync-kept")).toBeNull();
  });

  test("someone else opening a kept copy clears it first", async () => {
    const db = await openFor(TEST_USER.id);
    await writeNote(db);
    leaveUserKeys();
    expect(await endSession()).toBe("keep");
    const other = await openFor(OTHER_USER);
    expect(await queueLength(other)).toBe(0);
    expect(await other.powersync.getAll("SELECT id FROM timeline_entry")).toEqual([]);
    expect(caretookKeys()).toEqual(["caretook:sync-owner"]);
  });

  test("with nothing waiting: wiped", async () => {
    await openFor(TEST_USER.id);
    leaveUserKeys();
    expect(await endSession()).toBe("wipe");
    expect(caretookKeys()).toEqual([]);
  });
});

describe("expireKeptCopy", () => {
  const keep = async () => {
    const db = await openFor(TEST_USER.id);
    await writeNote(db);
    leaveUserKeys();
    expect(await endSession()).toBe("keep");
  };

  test("leaves a copy kept for less than its limit", async () => {
    await keep();
    localStorage.setItem("caretook:sync-kept", String(Date.now() - KEPT_COPY_LIMIT_MS + 60_000));
    expect(await expireKeptCopy()).toBe(false);
    expect(await countWaiting(null)).toBe(1);
  });

  test("clears a copy kept past its limit, without anyone signing in", async () => {
    await keep();
    localStorage.setItem("caretook:sync-kept", String(Date.now() - KEPT_COPY_LIMIT_MS - 60_000));
    expect(await expireKeptCopy()).toBe(true);
    expect(await countWaiting(null)).toBe(0);
    expect(caretookKeys()).toEqual([]);
  });
});
