import type { SyncDb } from "~/lib/sync";
import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "../layout/route";
import * as notSaved from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { TEST_GROUP, TEST_RECIPIENT } from "../../../../../test/fixtures";
import { getByCss } from "../../../../../test/locators";
import { PROBE } from "../../../../../test/probe";

// Settings → Changes not saved (sync-safety slice 2, B-285): the records the
// uploader keeps for refused changes (`unsaved_change`), one line per row,
// newest first, Dismiss and Dismiss all. Then the header's indicator: "N not
// saved" linking here, and "Offline · N waiting". The uploader writing the
// records is lib/sync/uploader.browser.test.tsx's.

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
  at: string;
};

/** A refused change, as the uploader records it. */
const record = async (db: SyncDb, r: Record) => {
  const table = r.table ?? "medication";
  const rowId = r.rowId ?? "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0a01";
  await db.powersync.execute(
    `INSERT INTO unsaved_change (id, recorded_at, table_name, row_id, op, data, code, issues, outcome, label, line_key)
     VALUES (uuid(), ?, ?, ?, ?, ?, ?, ?, 'refused', ?, ?)`,
    [
      r.at,
      table,
      rowId,
      r.op ?? "PATCH",
      r.data === undefined ? null : JSON.stringify(r.data),
      r.code ?? "permissions:unauthorized",
      r.issues ? JSON.stringify(r.issues) : null,
      r.label ?? null,
      r.lineKey ?? `${table}:${rowId}`,
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
