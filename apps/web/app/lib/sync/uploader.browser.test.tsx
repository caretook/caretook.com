import type { SyncDb } from "./index";
import type { UploadCall, UploadInput, UploadResult } from "./uploader";
import type { TryStore } from "./uploadTries";

import { OWN_DOSE_COPY_METADATA } from "@caretook/data/schema";
import { ORPCError } from "@orpc/client";
import { afterEach, describe, expect, test } from "vitest";
import { closeSync, installTestDatabase } from "./index";
import { UploadFailedError, uploadQueued } from "./uploader";
import { SET_ASIDE_SPAN_MS, tryCounter } from "./uploadTries";
import { SYNC_WRITE_LIMIT } from "@caretook/data/domain";
import { openTestDatabase, queuedWrites, syncDown } from "../../../test/database";
import { flattenFixtures, fx, TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../test/fixtures";

// The uploader (sync-safety slice 2, B-285) on the test device's local
// database, with the server stubbed: a refused op is recorded in the
// local-only `unsaved_change` table (data, code, issues, label) before the
// whole batch is acknowledged; the wipe at sign-out clears the records.
// Then a `failed` op (slice 3, B-286): only the ops before it are
// acknowledged until it has failed often enough, then it is set aside.
// Then a 400 for the whole request (test-health-2, B-374): the batch is sent
// again one op per request, so one malformed op can't hold the queue.
// Then whole writes (sync-safety-3, B-294): a batch ends at a whole write,
// each op carries its write, and every rule above works per write.

let db: SyncDb | null = null;

afterEach(async () => {
  await installTestDatabase(null);
  await db?.powersync.close().catch(() => undefined);
  db = null;
});

const open = async () => {
  db = await openTestDatabase(TEST_USER.id);
  return db;
};

/** A server that answers each op with `answer(op)`, keeping what it was sent. */
const server = (answer: (op: UploadInput["ops"][number]) => UploadResult) => {
  const sent: UploadInput[] = [];
  const call: UploadCall = (input) => {
    sent.push(input);
    return Promise.resolve({ results: input.ops.map(answer) });
  };
  return { call, sent };
};

type Stored = {
  table_name: string;
  row_id: string;
  op: string;
  data: string | null;
  code: string;
  issues: string | null;
  outcome: string;
  label: string | null;
  line_key: string;
};

const recorded = (d: SyncDb) =>
  d.powersync.getAll<Stored>(
    "SELECT table_name, row_id, op, data, code, issues, outcome, label, line_key FROM unsaved_change ORDER BY recorded_at, table_name",
  );

const ENTRY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1a01";
const MEDICATION = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1b01";

describe("uploadQueued: a dose's own copy (B-614)", () => {
  const DOSE = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1c01";
  const OTHER_MEMBER = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1d01";

  const undoDoseWrittenBy = async (d: SyncDb, author: string) => {
    await syncDown(
      d,
      flattenFixtures([
        fx.group(),
        fx.recipient(),
        fx.dose({ id: DOSE, medicationId: MEDICATION, createdBy: author }),
      ]),
    );
    await d.powersync.execute(
      "UPDATE timeline_entry SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ["2027-06-09T12:00:00.000000Z", "2027-06-09T12:00:00.000000Z", TEST_USER.id, DOSE],
    );
    const { call, sent } = server((op) => ({ id: op.id, status: "applied" }));
    await uploadQueued(d.powersync, call);
    return sent[0]!.ops[0]!;
  };

  test("flags a PATCH of a dose the device holds as this member's", async () => {
    const op = await undoDoseWrittenBy(await open(), TEST_USER.id);
    expect(op).toMatchObject({ op: "PATCH", metadata: OWN_DOSE_COPY_METADATA });
  });

  test("leaves a deliberate change of another member's dose unflagged", async () => {
    const op = await undoDoseWrittenBy(await open(), OTHER_MEMBER);
    expect(op.op).toBe("PATCH");
    expect(op.metadata).toBeUndefined();
  });
});

describe("uploadQueued", () => {
  test("records a refused op with its data, code, issues and label, and acknowledges the whole batch", async () => {
    const d = await open();
    const medication = fx.medication({ id: MEDICATION, name: "Lisinopril" });
    await syncDown(d, flattenFixtures([fx.group(), fx.recipient(), medication]));
    await d.powersync.execute(
      `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
       VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', 'Walk')`,
      [ENTRY, TEST_GROUP.id, TEST_RECIPIENT.id],
    );
    await d.powersync.execute("UPDATE medication SET dose = ? WHERE id = ?", ["20 mg", MEDICATION]);
    expect(await queuedWrites(d)).toHaveLength(2);

    const issues = [{ path: "dose", message: "Too large" }];
    const { call, sent } = server((op) =>
      op.table === "medication"
        ? { id: op.id, status: "rejected", code: "medicationService:invalid", issues }
        : { id: op.id, status: "applied" },
    );
    await uploadQueued(d.powersync, call);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.ops.map((o) => [o.op, o.table])).toEqual([
      ["PUT", "timeline_entry"],
      ["PATCH", "medication"],
    ]);
    expect(await queuedWrites(d)).toEqual([]);
    const rows = await recorded(d);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      table_name: "medication",
      row_id: MEDICATION,
      op: "PATCH",
      code: "medicationService:invalid",
      outcome: "refused",
      // Not in the op's data: read from the local row before the server's copy replaces it.
      label: "Lisinopril",
      line_key: `medication:${MEDICATION}`,
    });
    const [row] = rows;
    expect(JSON.parse(row?.data ?? "null")).toEqual({ dose: "20 mg" });
    expect(JSON.parse(row?.issues ?? "null")).toEqual(issues);
  });

  test("a refused DELETE is recorded without a label; an applied batch records nothing", async () => {
    const d = await open();
    await syncDown(d, flattenFixtures([fx.group(), fx.recipient(), fx.provider({ name: "Dr. Example" })]));
    await d.powersync.execute("DELETE FROM provider");
    const refuse = server((op) => ({ id: op.id, status: "rejected", code: "permissions:unauthorized" }));
    await uploadQueued(d.powersync, refuse.call);
    const rows = await recorded(d);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ op: "DELETE", table_name: "provider", label: null, issues: null });
    expect(await queuedWrites(d)).toEqual([]);

    await d.powersync.execute(
      `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
       VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', 'Walk')`,
      [ENTRY, TEST_GROUP.id, TEST_RECIPIENT.id],
    );
    await uploadQueued(d.powersync, server((op) => ({ id: op.id, status: "applied" })).call);
    expect(await recorded(d)).toHaveLength(1);
    expect(await queuedWrites(d)).toEqual([]);
  });

  test("a note's update is labelled by its entry and grouped with its document", async () => {
    const d = await open();
    const note = fx.note({ title: "Walk in the park", text: "Fictional" });
    await syncDown(d, flattenFixtures([fx.group(), fx.recipient(), note]));
    const document = await d.powersync.get<{ id: string }>("SELECT id FROM note_document");
    await d.powersync.execute(
      "INSERT INTO note_update (id, group_id, document_id, data) VALUES (uuid(), ?, ?, 'AAA=')",
      [TEST_GROUP.id, document.id],
    );
    await uploadQueued(
      d.powersync,
      server((op) => ({ id: op.id, status: "rejected", code: "permissions:unauthorized" })).call,
    );
    const [row] = await recorded(d);
    expect(row).toMatchObject({
      table_name: "note_update",
      label: "Walk in the park",
      line_key: `note_document:${document.id}`,
    });
  });

  test("a request that fails as a whole records nothing and acknowledges nothing", async () => {
    const d = await open();
    await d.powersync.execute(
      `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
       VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', 'Walk')`,
      [ENTRY, TEST_GROUP.id, TEST_RECIPIENT.id],
    );
    const offline: UploadCall = () => Promise.reject(new TypeError("Failed to fetch"));
    await expect(uploadQueued(d.powersync, offline)).rejects.toThrow("Failed to fetch");
    expect(await queuedWrites(d)).toHaveLength(1);
    expect(await recorded(d)).toEqual([]);
  });

  test("the records are gone after the device is wiped (sign-out's clear)", async () => {
    const d = await open();
    await d.powersync.execute(
      `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
       VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', 'Walk')`,
      [ENTRY, TEST_GROUP.id, TEST_RECIPIENT.id],
    );
    await uploadQueued(
      d.powersync,
      server((op) => ({ id: op.id, status: "rejected", code: "permissions:unauthorized" })).call,
    );
    expect(await recorded(d)).toHaveLength(1);
    await installTestDatabase(d);
    // The sign-out path: `wipeDevice` → `closeSync` → the client's `clear` (disconnectAndClear, VACUUM).
    await closeSync();
    const reopened = await d.powersync.getAll("SELECT id FROM unsaved_change").catch(() => null);
    // `clear` closes the database: reopen the same file to read what's left.
    if (reopened === null) {
      const again = await openTestDatabase(TEST_USER.id);
      expect(await again.powersync.getAll("SELECT id FROM unsaved_change")).toEqual([]);
      await again.powersync.close();
    } else expect(reopened).toEqual([]);
  });
});

describe("uploadQueued: an op the server couldn't process (B-286)", () => {
  const NOTES = ["One", "Two", "Three"].map((title, i) => ({
    id: `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1e0${i}`,
    title,
  }));

  /** Three new notes, queued in order. */
  const queueNotes = async (d: SyncDb) => {
    for (const { id, title } of NOTES)
      await d.powersync.execute(
        `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
         VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', ?)`,
        [id, TEST_GROUP.id, TEST_RECIPIENT.id, title],
      );
  };

  /** A server that can't process the op for `failing` and stops there, as sync.upload does. */
  const failingServer = (failing: string) => {
    const sent: UploadInput[] = [];
    const call: UploadCall = (input) => {
      sent.push(input);
      const results: UploadResult[] = [];
      for (const op of input.ops) {
        if (op.id === failing) {
          results.push({ id: op.id, status: "failed", code: "sync:failed" });
          break;
        }
        results.push({ id: op.id, status: "applied" });
      }
      return Promise.resolve({ results });
    };
    return { call, sent };
  };

  const memory = (): TryStore & { value: string | null } => {
    const store = {
      value: null as string | null,
      read: () => store.value,
      write: (value: string | null) => {
        store.value = value;
      },
    };
    return store;
  };

  const queuedIds = async (d: SyncDb) => (await queuedWrites(d)).map((w) => w.id);

  test("after a failed op at index 1 only the first leaves the queue, and the upload throws", async () => {
    const d = await open();
    await queueNotes(d);
    const { call } = failingServer(NOTES[1]!.id);
    const tries = tryCounter(memory());
    await expect(uploadQueued(d.powersync, call, { tries })).rejects.toBeInstanceOf(UploadFailedError);
    expect(await queuedIds(d)).toEqual([NOTES[1]!.id, NOTES[2]!.id]);
    expect(await recorded(d)).toEqual([]);
  });

  test("after a failed op at index 0 nothing leaves the queue", async () => {
    const d = await open();
    await queueNotes(d);
    const { call } = failingServer(NOTES[0]!.id);
    await expect(uploadQueued(d.powersync, call, { tries: tryCounter(memory()) })).rejects.toBeInstanceOf(
      UploadFailedError,
    );
    expect(await queuedIds(d)).toEqual(NOTES.map((n) => n.id));
  });

  test("a request that fails as a whole counts no try", async () => {
    const d = await open();
    await queueNotes(d);
    const store = memory();
    const offline: UploadCall = () => Promise.reject(new TypeError("Failed to fetch"));
    await expect(uploadQueued(d.powersync, offline, { tries: tryCounter(store) })).rejects.toThrow(
      "Failed to fetch",
    );
    expect(store.value).toBeNull();
  });

  test("once the counter says so, the op is set aside with its data, leaves the queue, and the next op uploads", async () => {
    const d = await open();
    await queueNotes(d);
    const failing = NOTES[1]!;
    const { call, sent } = failingServer(failing.id);
    const store = memory();
    const tries = tryCounter(store);
    let clock = Date.UTC(2027, 5, 9, 12);
    const now = () => clock;

    // Four tries over three minutes: still held, the first note acknowledged on the first.
    for (let i = 0; i < 4; i++) {
      await expect(uploadQueued(d.powersync, call, { tries, now })).rejects.toBeInstanceOf(UploadFailedError);
      clock += SET_ASIDE_SPAN_MS / 2;
    }
    expect(await queuedIds(d)).toEqual([failing.id, NOTES[2]!.id]);
    expect(await recorded(d)).toEqual([]);

    // The fifth: set aside, acknowledged; the rest of the batch waits for the next upload.
    await uploadQueued(d.powersync, call, { tries, now });
    expect(await queuedIds(d)).toEqual([NOTES[2]!.id]);
    const rows = await recorded(d);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      table_name: "timeline_entry",
      row_id: failing.id,
      op: "PUT",
      code: "sync:failed",
      outcome: "set_aside",
      label: "Two",
      issues: null,
    });
    expect(JSON.parse(rows[0]?.data ?? "null")).toMatchObject({ title: "Two", kind: "note" });
    expect(store.value).toBeNull();

    await uploadQueued(d.powersync, call, { tries, now });
    expect(sent.at(-1)?.ops.map((o) => o.id)).toEqual([NOTES[2]!.id]);
    expect(await queuedWrites(d)).toEqual([]);
  });
});

describe("uploadQueued: a request refused as a whole with a 400 (B-374)", () => {
  const NOTES = ["One", "Two", "Three"].map((title, i) => ({
    id: `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1f0${i}`,
    title,
  }));
  /** The second note's title: the stand-in server's input schema refuses it. */
  const MALFORMED = "x".repeat(600);

  const queueNotes = async (d: SyncDb, titles = NOTES.map((n) => n.title)) => {
    for (const [i, { id }] of NOTES.entries())
      await d.powersync.execute(
        `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
         VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', ?)`,
        [id, TEST_GROUP.id, TEST_RECIPIENT.id, titles[i]],
      );
  };

  const queuedIds = async (d: SyncDb) => (await queuedWrites(d)).map((w) => w.id);

  const badRequest = (index: number) =>
    new ORPCError("BAD_REQUEST", {
      message: "Input validation failed",
      data: { issues: [{ path: ["ops", index, "data", "title"], message: "Too long" }] },
    });

  /**
   * A server whose input schema refuses a request holding a malformed op with
   * a 400, as oRPC does, and otherwise applies every op. `alone(n)` answers
   * the nth single-op request instead (1-based), when it returns an answer.
   */
  const strictServer = (alone: (n: number) => Promise<UploadResult[]> | null = () => null) => {
    const sent: UploadInput[] = [];
    const applied: string[] = [];
    let singles = 0;
    const call: UploadCall = async (input) => {
      sent.push(input);
      if (input.ops.length === 1) {
        const answer = alone(++singles);
        if (answer) return { results: await answer };
      }
      const malformed = input.ops.findIndex((op) => op.data?.title === MALFORMED);
      if (malformed >= 0) throw badRequest(malformed);
      applied.push(...input.ops.map((op) => op.id));
      return { results: input.ops.map((op) => ({ id: op.id, status: "applied" as const })) };
    };
    return { call, sent, applied };
  };

  test("resends the batch one op at a time: the good ops apply, the malformed one is recorded with its data, and the queue empties", async () => {
    const d = await open();
    await queueNotes(d, ["One", MALFORMED, "Three"]);
    const { call, sent, applied } = strictServer();
    await uploadQueued(d.powersync, call);

    expect(sent.map((input) => input.ops.map((op) => op.id))).toEqual([
      NOTES.map((n) => n.id),
      [NOTES[0]!.id],
      [NOTES[1]!.id],
      [NOTES[2]!.id],
    ]);
    expect(applied).toEqual([NOTES[0]!.id, NOTES[2]!.id]);
    expect(await queuedWrites(d)).toEqual([]);
    const rows = await recorded(d);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      table_name: "timeline_entry",
      row_id: NOTES[1]!.id,
      op: "PUT",
      code: "sync:invalid",
      outcome: "refused",
      label: MALFORMED,
    });
    expect(JSON.parse(rows[0]?.data ?? "null")).toMatchObject({ kind: "note", title: MALFORMED });
    // The issue's path is the op's own, without the request's `ops.<n>`.
    expect(JSON.parse(rows[0]?.issues ?? "null")).toEqual([{ path: "data.title", message: "Too long" }]);
  });

  test("a single-op batch refused with a 400 is recorded without sending it again", async () => {
    const d = await open();
    await d.powersync.execute(
      `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
       VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', ?)`,
      [ENTRY, TEST_GROUP.id, TEST_RECIPIENT.id, MALFORMED],
    );
    const { call, sent } = strictServer();
    await uploadQueued(d.powersync, call);
    expect(sent).toHaveLength(1);
    expect(await queuedWrites(d)).toEqual([]);
    expect(await recorded(d)).toMatchObject([{ row_id: ENTRY, code: "sync:invalid", outcome: "refused" }]);
  });

  test("a 500 on the second single-op resend leaves the first acknowledged and the rest queued, records nothing, and throws", async () => {
    const d = await open();
    await queueNotes(d, ["One", MALFORMED, "Three"]);
    const outage = new ORPCError("INTERNAL_SERVER_ERROR");
    const { call, sent } = strictServer((n) => (n === 2 ? Promise.reject(outage) : null));
    await expect(uploadQueued(d.powersync, call)).rejects.toBe(outage);
    expect(sent).toHaveLength(3);
    expect(await queuedIds(d)).toEqual([NOTES[1]!.id, NOTES[2]!.id]);
    expect(await recorded(d)).toEqual([]);
  });

  test("a failed op on a single-op resend stops the resend there, as in a whole batch", async () => {
    const d = await open();
    await queueNotes(d, ["One", MALFORMED, "Three"]);
    const { call } = strictServer((n) =>
      n === 1 ? Promise.resolve([{ id: NOTES[0]!.id, status: "failed", code: "sync:failed" }]) : null,
    );
    let value: string | null = null;
    const tries = tryCounter({ read: () => value, write: (v) => void (value = v) });
    await expect(uploadQueued(d.powersync, call, { tries })).rejects.toBeInstanceOf(UploadFailedError);
    expect(await queuedIds(d)).toEqual(NOTES.map((n) => n.id));
    expect(await recorded(d)).toEqual([]);
    expect(value).not.toBeNull();
  });

  test.each([
    ["a 500", () => new ORPCError("INTERNAL_SERVER_ERROR")],
    ["a 401", () => new ORPCError("UNAUTHORIZED")],
    ["a network failure", () => new TypeError("Failed to fetch")],
  ])("%s for the whole request acknowledges nothing and records nothing", async (_, error) => {
    const d = await open();
    await queueNotes(d);
    const thrown = error();
    const sent: UploadInput[] = [];
    const call: UploadCall = (input) => {
      sent.push(input);
      return Promise.reject(thrown);
    };
    await expect(uploadQueued(d.powersync, call)).rejects.toBe(thrown);
    expect(sent).toHaveLength(1);
    expect(await queuedIds(d)).toEqual(NOTES.map((n) => n.id));
    expect(await recorded(d)).toEqual([]);
  });
});

describe("uploadQueued: whole writes (B-294)", () => {
  /** The `i`th note of write `w`. */
  const noteId = (w: number, i: number) =>
    `0b6f3c1e-5d1a-4c2e-9a77-${(w * 10_000 + i).toString(16).padStart(12, "0")}`;

  /** Write `w`: `count` new notes in one local transaction (one save). */
  const queueWrite = async (d: SyncDb, w: number, count: number, title = (i: number) => `Note ${i}`) => {
    await d.powersync.writeTransaction(async (tx) => {
      for (let i = 0; i < count; i++)
        await tx.execute(
          `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
           VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', ?)`,
          [noteId(w, i), TEST_GROUP.id, TEST_RECIPIENT.id, title(i)],
        );
    });
  };

  type Op = UploadInput["ops"][number];

  /** The request's writes as the server reads them: consecutive ops sharing `write`; none, its own. */
  const writesIn = (ops: Op[]) => {
    const writes: Op[][] = [];
    for (const [i, op] of ops.entries()) {
      const last = writes.at(-1);
      if (last && op.write != null && op.write === ops[i - 1]?.write) last.push(op);
      else writes.push([op]);
    }
    return writes;
  };

  /**
   * A server that applies a write whole, as sync.upload does: `refuse(op)`
   * names an op's refusal code (its write answers `sync:writeRefused`), and
   * `fail(op)` a write it can't process (`failed` at its first op, then stop).
   */
  const writeServer = ({
    refuse = () => null,
    fail = () => false,
  }: { refuse?: (op: Op) => string | null; fail?: (op: Op) => boolean } = {}) => {
    const sent: UploadInput[] = [];
    const call: UploadCall = (input) => {
      sent.push(input);
      const results: UploadResult[] = [];
      for (const write of writesIn(input.ops)) {
        if (write.some(fail)) {
          results.push({ id: write[0]!.id, status: "failed", code: "sync:failed" });
          break;
        }
        const refused = write.find((op) => refuse(op));
        for (const op of write)
          results.push(
            !refused
              ? { id: op.id, status: "applied" }
              : op === refused
                ? { id: op.id, status: "rejected", code: refuse(op)! }
                : { id: op.id, status: "rejected", code: "sync:writeRefused", refusedId: refused.id },
          );
      }
      return Promise.resolve({ results });
    };
    return { call, sent };
  };

  const recordedWrites = (d: SyncDb) =>
    d.powersync.getAll<{
      row_id: string;
      code: string;
      outcome: string;
      line_key: string;
      write_id: number | null;
    }>("SELECT row_id, code, outcome, line_key, write_id FROM unsaved_change ORDER BY row_id");

  const queuedIds = async (d: SyncDb) => (await queuedWrites(d)).map((w) => w.id);

  /** The write every op of a request carries; fails when they differ or one has none. */
  const oneWrite = (input: UploadInput | undefined) => {
    const writes = new Set(input?.ops.map((op) => op.write));
    expect(writes.size).toBe(1);
    const [write] = writes;
    expect(write).toEqual(expect.any(Number));
    return write!;
  };

  test("a 60-op write then a 60-op write go as two requests, each whole, every op with its write", async () => {
    const d = await open();
    await queueWrite(d, 1, 60);
    await queueWrite(d, 2, 60);
    const { call, sent } = writeServer();
    await uploadQueued(d.powersync, call);
    expect(await queuedWrites(d)).toHaveLength(60);
    await uploadQueued(d.powersync, call);

    expect(sent.map((input) => input.ops.map((op) => op.id))).toEqual([
      Array.from({ length: 60 }, (_, i) => noteId(1, i)),
      Array.from({ length: 60 }, (_, i) => noteId(2, i)),
    ]);
    expect(oneWrite(sent[0])).not.toBe(oneWrite(sent[1]));
    expect(await queuedWrites(d)).toEqual([]);
  });

  test("a refused write records every op with its write id on one line, and acknowledges the batch", async () => {
    const d = await open();
    await queueWrite(d, 1, 3);
    await queueWrite(d, 2, 1);
    const { call, sent } = writeServer({
      refuse: (op) => (op.id === noteId(1, 1) ? "permissions:unauthorized" : null),
    });
    await uploadQueued(d.powersync, call);

    expect(sent).toHaveLength(1);
    const write = sent[0]!.ops[0]!.write;
    expect(write).toEqual(expect.any(Number));
    expect(await queuedWrites(d)).toEqual([]);
    expect(await recordedWrites(d)).toEqual([
      {
        row_id: noteId(1, 0),
        code: "sync:writeRefused",
        outcome: "refused",
        line_key: `write:${write}`,
        write_id: write,
      },
      {
        row_id: noteId(1, 1),
        code: "permissions:unauthorized",
        outcome: "refused",
        line_key: `write:${write}`,
        write_id: write,
      },
      {
        row_id: noteId(1, 2),
        code: "sync:writeRefused",
        outcome: "refused",
        line_key: `write:${write}`,
        write_id: write,
      },
    ]);
  });

  test("a failed write acknowledges what came before it, counts one try, then is set aside whole", async () => {
    const d = await open();
    await queueWrite(d, 1, 1);
    await queueWrite(d, 2, 3);
    await queueWrite(d, 3, 1);
    const { call, sent } = writeServer({ fail: (op) => op.id === noteId(2, 2) });
    let value: string | null = null;
    const tries = tryCounter({ read: () => value, write: (v) => void (value = v) });
    let clock = Date.UTC(2027, 5, 9, 12);
    const now = () => clock;

    await expect(uploadQueued(d.powersync, call, { tries, now })).rejects.toBeInstanceOf(UploadFailedError);
    const failing = [0, 1, 2].map((i) => noteId(2, i));
    expect(await queuedIds(d)).toEqual([...failing, noteId(3, 0)]);
    // One try, on the write's first entry.
    const record = JSON.parse(value ?? "null") as { count: number; key: string } | null;
    expect(record?.count).toBe(1);
    expect(record?.key).toContain(failing[0]);
    expect(await recordedWrites(d)).toEqual([]);

    for (let i = 0; i < 4; i++) {
      clock += SET_ASIDE_SPAN_MS / 2;
      if (i < 3)
        await expect(uploadQueued(d.powersync, call, { tries, now })).rejects.toBeInstanceOf(
          UploadFailedError,
        );
      else await uploadQueued(d.powersync, call, { tries, now });
    }
    // The fifth try set the whole write aside; the next write waits for the next upload.
    expect(await queuedIds(d)).toEqual([noteId(3, 0)]);
    const write = sent.at(-1)!.ops[0]!.write;
    expect(await recordedWrites(d)).toEqual(
      failing.map((id) => ({
        row_id: id,
        code: "sync:failed",
        outcome: "set_aside",
        line_key: `write:${write}`,
        write_id: write,
      })),
    );
    expect(value).toBeNull();
  });

  test("a 400 for the whole request resends write by write; a write refused alone is recorded whole", async () => {
    const d = await open();
    const MALFORMED = "x".repeat(600);
    await queueWrite(d, 1, 2);
    await queueWrite(d, 2, 2, (i) => (i === 1 ? MALFORMED : `Note ${i}`));
    await queueWrite(d, 3, 1);
    const sent: UploadInput[] = [];
    const applied: string[] = [];
    // An input schema that refuses a request holding a malformed op with a 400, as oRPC does.
    const call: UploadCall = (input) => {
      sent.push(input);
      const malformed = input.ops.findIndex((op) => op.data?.title === MALFORMED);
      if (malformed >= 0)
        return Promise.reject(
          new ORPCError("BAD_REQUEST", {
            message: "Input validation failed",
            data: { issues: [{ path: ["ops", malformed, "data", "title"], message: "Too long" }] },
          }),
        );
      applied.push(...input.ops.map((op) => op.id));
      return Promise.resolve({ results: input.ops.map((op) => ({ id: op.id, status: "applied" as const })) });
    };
    await uploadQueued(d.powersync, call);

    expect(sent.map((input) => input.ops.map((op) => op.id))).toEqual([
      [noteId(1, 0), noteId(1, 1), noteId(2, 0), noteId(2, 1), noteId(3, 0)],
      [noteId(1, 0), noteId(1, 1)],
      [noteId(2, 0), noteId(2, 1)],
      [noteId(3, 0)],
    ]);
    oneWrite(sent[2]);
    expect(applied).toEqual([noteId(1, 0), noteId(1, 1), noteId(3, 0)]);
    expect(await queuedWrites(d)).toEqual([]);
    const write = sent[2]!.ops[0]!.write;
    expect(await recordedWrites(d)).toEqual([
      {
        row_id: noteId(2, 0),
        code: "sync:writeRefused",
        outcome: "refused",
        line_key: `write:${write}`,
        write_id: write,
      },
      {
        row_id: noteId(2, 1),
        code: "sync:invalid",
        outcome: "refused",
        line_key: `write:${write}`,
        write_id: write,
      },
    ]);
    const issues = await d.powersync.get<{ issues: string }>(
      "SELECT issues FROM unsaved_change WHERE row_id = ?",
      [noteId(2, 1)],
    );
    expect(JSON.parse(issues.issues)).toEqual([{ path: "data.title", message: "Too long" }]);
  });

  test("a write over the limit is sent with no write id, a batch at a time", async () => {
    const d = await open();
    await queueWrite(d, 1, SYNC_WRITE_LIMIT + 1);
    const { call, sent } = writeServer();
    await uploadQueued(d.powersync, call);

    expect(sent).toHaveLength(1);
    const ops = sent[0]?.ops ?? [];
    expect(ops.map((op) => op.id)).toEqual(Array.from({ length: 100 }, (_, i) => noteId(1, i)));
    expect(ops.every((op) => op.write === undefined)).toBe(true);
    expect(await queuedWrites(d)).toHaveLength(SYNC_WRITE_LIMIT + 1 - 100);
  });

  test("a write over the batch but within the limit goes whole in one request", async () => {
    const d = await open();
    await queueWrite(d, 1, 1);
    await queueWrite(d, 2, 250);
    const { call, sent } = writeServer();
    await uploadQueued(d.powersync, call);
    await uploadQueued(d.powersync, call);

    expect(sent.map((input) => input.ops.length)).toEqual([1, 250]);
    oneWrite(sent[1]);
    expect(await queuedWrites(d)).toEqual([]);
  });
});
