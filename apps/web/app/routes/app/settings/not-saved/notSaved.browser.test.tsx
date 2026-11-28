import type { SyncDb } from "~/lib/sync";
import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "../layout/route";
import * as notSaved from "./route";
import { apiCalls } from "../../../../../test/api";
import { setUploadFailed } from "../../../../../test/database";
import { renderWithDevice } from "../../../../../test/device";
import { TEST_GROUP, TEST_RECIPIENT } from "../../../../../test/fixtures";
import { getByCss } from "../../../../../test/locators";
import { PROBE } from "../../../../../test/probe";

// Settings → Changes not saved (sync-safety slice 2, B-285): the records the
// uploader keeps for refused changes (`unsaved_change`), one line per row,
// newest first, Dismiss and Dismiss all. Then the header's indicator: "N not
// saved" linking here, "Offline · N waiting" and "Can't sync, retrying · N
// waiting" (slice 3, B-286), and a set-aside change's Try again. The
// uploader writing the records is lib/sync/uploader.browser.test.tsx's.

const URL = "/app/settings/not-saved";

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: URL, module: notSaved }],
  },
];

type Record = {
  table?: string;
  rowId?: string;
  op?: string;
  data?: object | null;
  code?: string;
  issues?: object[] | null;
  label?: string | null;
  lineKey?: string;
  outcome?: "refused" | "set_aside";
  writeId?: number | null;
  writeSeq?: number | null;
  at: string;
};

/** A refused change, as the uploader records it. */
const record = async (db: SyncDb, r: Record) => {
  const table = r.table ?? "medication";
  const rowId = r.rowId ?? "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0a01";
  await db.powersync.execute(
    `INSERT INTO unsaved_change (id, recorded_at, table_name, row_id, op, data, code, issues, outcome, label, line_key, write_id, write_seq)
     VALUES (uuid(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.at,
      table,
      rowId,
      r.op ?? "PATCH",
      r.data === undefined ? null : JSON.stringify(r.data),
      r.code ?? "permissions:unauthorized",
      r.issues ? JSON.stringify(r.issues) : null,
      r.outcome ?? "refused",
      r.label ?? null,
      r.lineKey ?? `${table}:${rowId}`,
      r.writeId ?? null,
      r.writeSeq ?? null,
    ],
  );
};

const lines = () => [...document.querySelectorAll<HTMLElement>("main [data-not-saved]")];
const texts = () => lines().map((l) => l.querySelector("[data-not-saved-text]")?.textContent?.trim());

describe("Changes not saved", () => {
  test("lists lines newest first; a row's three records are one line; a note and its updates are one", async () => {
    const device = await renderWithDevice({ route: ROUTES, url: URL });
    const { db } = device;
    await record(db, { at: "2027-06-09T09:00:00.000Z", label: "Lisinopril" });
    await record(db, { at: "2027-06-09T09:05:00.000Z" });
    await record(db, { at: "2027-06-09T09:10:00.000Z" });
    await record(db, {
      at: "2027-06-09T10:00:00.000Z",
      table: "provider",
      rowId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0b01",
      code: "providerService:notFound",
      label: "Dr. Example",
    });
    const doc = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0c01";
    await record(db, {
      at: "2027-06-09T11:00:00.000Z",
      table: "note_document",
      rowId: doc,
      op: "PUT",
      label: "Walk in the park",
      lineKey: `note_document:${doc}`,
    });
    for (const [i, at] of ["2027-06-09T11:01:00.000Z", "2027-06-09T11:02:00.000Z"].entries())
      await record(db, {
        at,
        table: "note_update",
        rowId: `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0d0${i}`,
        op: "PUT",
        data: { document_id: doc },
        lineKey: `note_document:${doc}`,
      });
    await device.settle();

    await expect
      .poll(texts)
      .toEqual([
        "Your change to the note “Walk in the park” wasn't saved: you can't edit in this group any more · 3 changes",
        "Your change to the provider “Dr. Example” wasn't saved: it isn't there any more",
        "Your change to the medication “Lisinopril” wasn't saved: you can't edit in this group any more · 3 changes",
      ]);
  });

  test("Dismiss removes a line's records; Dismiss all empties the list; then the empty state", async () => {
    const device = await renderWithDevice({ route: ROUTES, url: URL });
    const { db } = device;
    await expect.element(getByCss("main [data-not-saved-empty]")).toBeVisible();
    await record(db, { at: "2027-06-09T09:00:00.000Z", label: "Lisinopril" });
    await record(db, { at: "2027-06-09T09:01:00.000Z" });
    await record(db, {
      at: "2027-06-09T10:00:00.000Z",
      table: "todo",
      rowId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0e01",
      code: "todoService:completionOnly",
      label: "Pick up groceries",
    });
    await record(db, {
      at: "2027-06-09T11:00:00.000Z",
      table: "provider",
      rowId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0b01",
      label: "Dr. Example",
    });
    await device.settle();
    await expect.poll(() => lines().length).toBe(3);

    const medication = page.getByRole("listitem").filter({ hasText: "Lisinopril" });
    await userEvent.click(medication.getByRole("button", { name: "Dismiss" }));
    await expect.poll(() => lines().length).toBe(2);
    expect(texts().some((t) => t?.includes("Lisinopril"))).toBe(false);
    expect(await device.query("SELECT id FROM unsaved_change WHERE table_name = 'medication'")).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "Dismiss all" }));
    await expect.element(getByCss("main [data-not-saved-empty]")).toBeVisible();
    expect(await device.query("SELECT id FROM unsaved_change")).toEqual([]);
    expect(page.getByRole("button", { name: "Dismiss all" }).elements()).toHaveLength(0);
  });
});

describe("a set-aside change (B-286)", () => {
  const MEDICATION = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0a01";
  const setAside = (db: SyncDb) =>
    record(db, {
      at: "2027-06-09T09:00:00.000Z",
      rowId: MEDICATION,
      data: { dose: "20 mg" },
      code: "sync:failed",
      outcome: "set_aside",
      label: "Lisinopril",
    });
  const SET_ASIDE = "Your change to the medication “Lisinopril” wasn't saved: the server couldn't save this";

  /** The page, with `sync.upload` answering `answer`. */
  const openPage = async (answer: (input: unknown) => unknown) => {
    const calls = apiCalls();
    const device = await renderWithDevice({
      route: ROUTES,
      url: URL,
      connected: true,
      api: calls.record({ "sync.upload": answer }),
    });
    await setAside(device.db);
    await record(device.db, { at: "2027-06-09T08:00:00.000Z", table: "provider", label: "Dr. Example" });
    await device.settle();
    return { device, calls };
  };

  test("reads that the server couldn't save it, with Try again; a refused line has none", async () => {
    await openPage(() => ({ results: [] }));
    await expect
      .poll(texts)
      .toEqual([
        SET_ASIDE,
        "Your change to the provider “Dr. Example” wasn't saved: you can't edit in this group any more",
      ]);
    const tryAgain = page.getByRole("button", { name: "Try again" });
    expect(tryAgain.elements()).toHaveLength(1);
    const line = page.getByRole("listitem").filter({ hasText: "Lisinopril" });
    await expect.element(line.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("Try again sends the kept op; applied removes the line", async () => {
    const { device, calls } = await openPage(() => ({
      results: [{ id: MEDICATION, status: "applied" }],
    }));
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    await expect.poll(() => lines().length).toBe(1);
    expect(texts()[0]).toContain("Dr. Example");
    expect(calls.of("sync.upload")).toEqual([
      { ops: [{ op: "PATCH", table: "medication", id: MEDICATION, data: { dose: "20 mg" } }] },
    ]);
    expect(await device.query("SELECT id FROM unsaved_change WHERE table_name = 'medication'")).toEqual([]);
  });

  test("Try again keeps the line, with the new reason, when the server refuses it", async () => {
    await openPage(() => ({
      results: [{ id: MEDICATION, status: "rejected", code: "medicationService:notFound" }],
    }));
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    await expect
      .poll(texts)
      .toContain("Your change to the medication “Lisinopril” wasn't saved: it isn't there any more");
    expect(page.getByRole("button", { name: "Try again" }).elements()).toHaveLength(0);
  });

  test("Try again keeps the line set aside when the server fails again", async () => {
    const { device, calls } = await openPage(() => ({
      results: [{ id: MEDICATION, status: "failed", code: "sync:failed" }],
    }));
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    await expect.poll(() => calls.of("sync.upload").length).toBe(1);
    // Kept, set aside, at the new try's time.
    await expect
      .poll(() =>
        device.query("SELECT outcome, recorded_at FROM unsaved_change WHERE table_name = 'medication'"),
      )
      .toEqual([
        { outcome: "set_aside", recorded_at: expect.not.stringMatching(/^2027-06-09T09:00/) as string },
      ]);
    await expect.element(page.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(texts()).toContain(SET_ASIDE);
  });
});

describe("a write's records (B-294)", () => {
  const AT = "2027-06-09T09:00:00.000Z";
  const ENTRY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0f01";
  const TAG = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0f02";
  const RECORD_TAG = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0f03";
  const WRITE = 41;

  /** `sync.upload` applying every op it gets. */
  const applyAll = (input: unknown) => ({
    results: (input as { ops: { id: string }[] }).ops.map((op) => ({ id: op.id, status: "applied" })),
  });

  /** An entry saved with a new tag: three ops, one write, recorded in one go (stored out of order). */
  const tagged = async (db: SyncDb, over: Partial<Record>) => {
    const one = { at: AT, lineKey: `write:${WRITE}`, writeId: WRITE, op: "PUT", ...over };
    await record(db, { ...one, table: "record_tag", rowId: RECORD_TAG, writeSeq: 2, data: { tag_id: TAG } });
    await record(db, { ...one, table: "timeline_entry", rowId: ENTRY, writeSeq: 0, label: "Walk" });
    await record(db, {
      ...one,
      table: "tag",
      rowId: TAG,
      writeSeq: 1,
      label: "Knee",
      data: { name: "Knee" },
    });
  };

  test("a refused three-op write is one line: its first op, with the refusing op's reason", async () => {
    const device = await renderWithDevice({ route: ROUTES, url: URL });
    await tagged(device.db, { code: "sync:writeRefused" });
    await device.db.powersync.execute(
      "UPDATE unsaved_change SET code = 'tagService:invalid', issues = ? WHERE row_id = ?",
      [JSON.stringify([{ path: "name", message: "Name is taken." }]), TAG],
    );
    await device.settle();
    await expect
      .poll(texts)
      .toEqual(["Your new entry “Walk” wasn't saved: it wasn't valid (Name is taken) · 3 changes"]);
    expect(page.getByRole("button", { name: "Try again" }).elements()).toHaveLength(0);
    await userEvent.click(page.getByRole("button", { name: "Dismiss" }));
    await expect.element(getByCss("main [data-not-saved-empty]")).toBeVisible();
    expect(await device.query("SELECT id FROM unsaved_change")).toEqual([]);
  });

  test("Try again on a set-aside write sends one request with every op and the write id", async () => {
    const calls = apiCalls();
    const device = await renderWithDevice({
      route: ROUTES,
      url: URL,
      connected: true,
      api: calls.record({
        "sync.upload": applyAll,
      }),
    });
    await tagged(device.db, { code: "sync:failed", outcome: "set_aside" });
    await device.settle();
    await expect.poll(() => lines().length).toBe(1);
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    await expect.element(getByCss("main [data-not-saved-empty]")).toBeVisible();
    expect(calls.of("sync.upload")).toEqual([
      {
        ops: [
          { op: "PUT", table: "timeline_entry", id: ENTRY, data: null, write: WRITE },
          { op: "PUT", table: "tag", id: TAG, data: { name: "Knee" }, write: WRITE },
          { op: "PUT", table: "record_tag", id: RECORD_TAG, data: { tag_id: TAG }, write: WRITE },
        ],
      },
    ]);
    expect(await device.query("SELECT id FROM unsaved_change")).toEqual([]);
  });

  test("Try again sends a write past the batch limit whole, in one request", async () => {
    const calls = apiCalls();
    const device = await renderWithDevice({
      route: ROUTES,
      url: URL,
      connected: true,
      api: calls.record({
        "sync.upload": applyAll,
      }),
    });
    const rows = Array.from(
      { length: 120 },
      (_, i) => `0b6f3c1e-5d1a-4c2e-9a77-${String(i).padStart(12, "0")}`,
    );
    await device.db.powersync.writeTransaction(async (tx) => {
      for (const [i, rowId] of rows.entries())
        await tx.execute(
          `INSERT INTO unsaved_change (id, recorded_at, table_name, row_id, op, code, outcome, line_key, write_id, write_seq)
           VALUES (uuid(), ?, 'medication_pass', ?, 'PUT', 'sync:failed', 'set_aside', ?, ?, ?)`,
          [AT, rowId, `write:${WRITE}`, WRITE, i],
        );
    });
    await device.settle();
    await expect
      .poll(texts)
      .toEqual(["Your new medication time wasn't saved: the server couldn't save this · 120 changes"]);
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    await expect.element(getByCss("main [data-not-saved-empty]")).toBeVisible();
    const sent = calls.of("sync.upload") as { ops: { id: string; write: number }[] }[];
    expect(sent).toHaveLength(1);
    expect(sent[0]?.ops.map((op) => op.id)).toEqual(rows);
    expect(new Set(sent[0]?.ops.map((op) => op.write))).toEqual(new Set([WRITE]));
  });

  test("records without a write id, and a row's single-op writes, show by row as before", async () => {
    const device = await renderWithDevice({ route: ROUTES, url: URL });
    await record(device.db, { at: "2027-06-09T09:00:00.000Z", label: "Lisinopril", writeId: 5, writeSeq: 0 });
    await record(device.db, { at: "2027-06-09T09:01:00.000Z", writeId: 6, writeSeq: 0 });
    await record(device.db, { at: "2027-06-09T09:02:00.000Z" });
    await device.settle();
    await expect
      .poll(texts)
      .toEqual([
        "Your change to the medication “Lisinopril” wasn't saved: you can't edit in this group any more · 3 changes",
      ]);
  });
});

describe("the header's sync indicator", () => {
  const timeline = `/app/groups/${TEST_GROUP.id}/timeline`;
  const openFrame = (connected: boolean) =>
    renderWithDevice({ route: [PROBE, ...ROUTES], url: timeline, frame: true, connected });
  const status = () => document.querySelector('header [data-region="status"]');

  test("shows nothing new when all is well", async () => {
    await openFrame(true);
    await expect
      .poll(() => status()?.querySelector('[role="status"]')?.textContent)
      .toBe("All changes synced");
    expect(status()?.querySelector("[data-not-saved-link]")).toBeNull();
    expect(status()?.textContent).not.toContain("waiting");
  });

  test("“2 not saved” links to the page", async () => {
    const device = await openFrame(true);
    await record(device.db, { at: "2027-06-09T09:00:00.000Z" });
    await record(device.db, { at: "2027-06-09T09:01:00.000Z" });
    await record(device.db, {
      at: "2027-06-09T09:02:00.000Z",
      table: "provider",
      rowId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0b01",
    });
    await device.settle();
    const link = page.getByRole("link", { name: "2 not saved" });
    await expect.element(link).toHaveAttribute("href", URL);
    await userEvent.click(link);
    await expect.poll(() => device.location()).toBe(URL);
    await expect.element(page.getByRole("heading", { name: "Changes not saved", level: 1 })).toBeVisible();
  });

  test("“Can't sync, retrying · 2 waiting” when the last upload failed", async () => {
    const device = await openFrame(true);
    for (const title of ["One", "Two"])
      await device.db.powersync.execute(
        `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
         VALUES (uuid(), ?, ?, 'note', ?, ?)`,
        [TEST_GROUP.id, TEST_RECIPIENT.id, "2027-06-09T12:00:00.000000Z", title],
      );
    setUploadFailed(device.db, true);
    await device.settle();
    await expect.poll(() => status()?.textContent?.trim()).toBe("Can't sync, retrying · 2 waiting");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    setUploadFailed(device.db, false);
    await expect
      .poll(() => status()?.querySelector('[role="status"]')?.textContent)
      .toBe("All changes synced");
  });

  test("“Offline · 3 waiting” when offline with changes queued", async () => {
    const device = await openFrame(false);
    await expect.poll(() => status()?.textContent?.trim()).toBe("Offline");
    for (const title of ["One", "Two", "Three"])
      await device.db.powersync.execute(
        `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
         VALUES (uuid(), ?, ?, 'note', ?, ?)`,
        [TEST_GROUP.id, TEST_RECIPIENT.id, "2027-06-09T12:00:00.000000Z", title],
      );
    await device.settle();
    await expect.poll(() => status()?.textContent?.trim()).toBe("Offline · 3 waiting");
    // Both at once still fit the phone's header.
    await record(device.db, { at: "2027-06-09T09:00:00.000Z" });
    await device.settle();
    await expect.element(page.getByRole("link", { name: "1 not saved" })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });
});
