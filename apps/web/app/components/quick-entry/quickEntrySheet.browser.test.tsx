import type { DeviceRoute } from "../../../test/device";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { clearUndo } from "~/lib/medications/passUndo";
import * as settingsIndex from "~/routes/app/settings/index/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import { renderWithDevice } from "../../../test/device";
import { found, waitUntil } from "../../../test/found";
import { fx, TEST_GROUP } from "../../../test/fixtures";
import { PROBE } from "../../../test/probe";
import { closeQuickEntry } from "./QuickEntrySheet";
import { READER_REFUSAL } from "./quickEntryCopy";

// Quick entry from any group page (quick-entry-3, slice 1): the frame's
// header button opens the group layout's sheet, which holds the same box as
// the timeline's. The real frame around the probe (test/probe.tsx) at a
// group page that isn't the timeline; the settings pages for outside a group.

const PROVIDERS_URL = `/app/groups/${TEST_GROUP.id}/providers`;
const TIMELINE_URL = `/app/groups/${TEST_GROUP.id}/timeline`;

const ROUTES: DeviceRoute[] = [
  PROBE,
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: "/app/settings", id: "settings-index", module: settingsIndex }],
  },
];

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: PROVIDERS_URL,
    frame: true,
    fixtures: [fx.note({ text: "Slept well" })],
    ...options,
  });

const quickButton = () => page.getByRole("button", { name: "Quick entry", exact: true });
const searchLink = () => page.getByRole("link", { name: "Search this care group" });
const sheet = () => page.getByRole("dialog", { name: "Quick entry" });
const sheetOpen = () => !!document.querySelector("[role=dialog]");
const box = () => sheet().getByRole("textbox", { name: "What happened?" });
const cards = () => [...document.querySelectorAll<HTMLElement>("[role=dialog] [data-quick-card]")];
const saveButton = () => sheet().getByRole("button", { name: "Save", exact: true });
const undoLabel = () => document.querySelector("[role=dialog] [data-pass-undo-label]")?.textContent ?? "";
const vitals = (device: Awaited<ReturnType<typeof open>>) =>
  device.query<{ id: string; deleted_at: string | null }>(
    "SELECT id, deleted_at FROM timeline_entry WHERE kind = 'vital'",
  );

const openSheet = async () => {
  await userEvent.click(quickButton());
  await expect.element(sheet()).toBeVisible();
};

afterEach(() => {
  clearUndo();
  closeQuickEntry();
});

describe("the quick entry sheet", () => {
  test('the header button opens it on a group page; "bp 120/80" saves, it stays open, and its Undo removes the entry', async () => {
    const device = await open();
    await expect.element(page.getByText(PROVIDERS_URL)).toBeVisible();
    await openSheet();

    await userEvent.fill(box(), "bp 120/80");
    await waitUntil(() => cards()[0]?.dataset.quickCard === "vital", "the vital card");
    await userEvent.click(saveButton());
    await expect.poll(undoLabel).toBe("Saved 1 entry");
    expect((await vitals(device)).map((v) => v.deleted_at)).toEqual([null]);
    // Still open, on the same page, ready for the next line.
    await expect.element(sheet()).toBeVisible();
    expect(device.location()).toBe(PROVIDERS_URL);

    await userEvent.click(
      await found(() => document.querySelector<HTMLElement>("[role=dialog] [data-pass-undo-button]")),
    );
    await expect.poll(async () => (await vitals(device))[0]?.deleted_at ?? null).not.toBeNull();
  });

  test("Escape closes it", async () => {
    await open();
    await openSheet();
    await userEvent.click(box());
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !sheetOpen(), "the sheet to close");
    await expect.element(quickButton()).toBeVisible();
  });

  test('a reader gets the button, and "bp 120/80" shows no Save, only why', async () => {
    const device = await open({ role: "viewer" });
    await expect.element(page.getByText(/· reader/)).toBeVisible();
    await openSheet();
    await userEvent.fill(box(), "bp 120/80");
    await expect.element(sheet().getByText(READER_REFUSAL)).toBeVisible();
    expect(cards()).toEqual([]);
    expect(saveButton().query()).toBeNull();
    expect(await vitals(device)).toEqual([]);
  });

  test("the easy frame has no button", async () => {
    await open({ role: "easy_viewer", url: TIMELINE_URL });
    await expect.element(searchLink()).toBeVisible();
    await expect.poll(() => page.getByRole("button", { name: /switch care group$/ }).query()).toBeNull();
    expect(quickButton().query()).toBeNull();
  });

  test("there is no button outside a group", async () => {
    await open({ url: "/app/settings" });
    await expect.element(page.getByRole("button", { name: /^Account menu/ })).toBeVisible();
    expect(searchLink().query()).toBeNull();
    expect(quickButton().query()).toBeNull();
  });
});
