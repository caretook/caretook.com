import type { SyncDb } from "./index";
import type { UploadCall, UploadInput, UploadResult } from "./uploader";

import { afterEach, describe, expect, test } from "vitest";
import { closeSync, installTestDatabase } from "./index";
import { uploadQueued } from "./uploader";
import { openTestDatabase, queuedWrites, syncDown } from "../../../test/database";
import { flattenFixtures, fx, TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../test/fixtures";

// The uploader (sync-safety slice 2, B-285) on the test device's local
// database, with the server stubbed: a refused op is recorded in the
// local-only `unsaved_change` table (data, code, issues, label) before the
// whole batch is acknowledged; the wipe at sign-out clears the records.

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
