import type { SyncDb } from "./index";
import type { UploadCall, UploadInput, UploadResult } from "./uploader";
import type { TryStore } from "./uploadTries";

import { OWN_DOSE_COPY_METADATA } from "@caretook/data/schema";
import { afterEach, describe, expect, test } from "vitest";
import { closeSync, installTestDatabase } from "./index";
import { UploadFailedError, uploadQueued } from "./uploader";
import { SET_ASIDE_SPAN_MS, tryCounter } from "./uploadTries";
import { openTestDatabase, queuedWrites, syncDown } from "../../../test/database";
import { flattenFixtures, fx, TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../test/fixtures";

// The uploader (sync-safety slice 2, B-285) on the test device's local
// database, with the server stubbed: a refused op is recorded in the
// local-only `unsaved_change` table (data, code, issues, label) before the
// whole batch is acknowledged; the wipe at sign-out clears the records.
// Then a `failed` op (slice 3, B-286): only the ops before it are
// acknowledged until it has failed often enough, then it is set aside.

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
