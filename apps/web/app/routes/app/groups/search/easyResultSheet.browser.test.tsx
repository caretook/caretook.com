import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, condition, fx, TEST_GROUP } from "../../../../../test/fixtures";
import { waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import * as search from "./route";

// The easy roles' read-only sheet over search (EasyResultSheet) reads the
// opened row live (B-469): another member's edit synced in while it's open
// shows the new values, and a synced delete (or the row leaving the device)
// says it's gone. Opening the sheets at all is easyRolePages.browser.test.tsx's.

const url = `/app/groups/${TEST_GROUP.id}/search?q=lark`;
const LARK_VALUES = { name: "Dr. Mira Lark", phones: [{ label: "Office", number: "555-0100" }] };
const LARK = fx.provider(LARK_VALUES);
const DROPS_VALUES = { name: "Larkspur drops", dose: "2 drops" };
const DROPS = fx.medication(DROPS_VALUES);
const KNEE_VALUES = { name: "Lark knee", note: "Worse on stairs" };
const KNEE = condition(KNEE_VALUES);

const open = () =>
  renderWithDevice({
    route: { path: "/app/groups/:groupId/search", module: search },
    url,
    role: "easy_helper",
    search: true,
    fixtures: [LARK, DROPS, KNEE],
  });

const sheet = () => document.querySelector<HTMLElement>("[role=dialog] [data-easy-sheet]");
const dialogText = () => document.querySelector<HTMLElement>("[role=dialog]")?.textContent ?? "";
const openSheet = async (type: string) => {
  await userEvent.click(getByCss(`[data-result="${type}"] button[data-opens-sheet]`));
  await waitUntil(() => sheet()?.dataset.easySheet === type, `the ${type}'s sheet`);
};
const fact = (line: string) => sheet()?.querySelector(`[data-easy-fact="${line}"]`)?.textContent ?? "";

describe("an open easy sheet", () => {
  test("shows a provider's synced edit, then says it's gone when it's deleted", async () => {
    const device = await open();
    await openSheet("provider");
    expect(dialogText()).toContain("555-0100");

    // Renamed so it no longer matches "lark": the open sheet still follows it.
    await device.sync([
      fx.provider({ id: LARK.id, name: "Dr. Mira Wren", phones: [{ label: "Office", number: "555-0199" }] }),
    ]);
    await device.settle();
    await expect.poll(dialogText).toContain("555-0199");
    expect(dialogText()).toContain("Dr. Mira Wren");
    expect(sheet()?.hasAttribute("data-gone")).toBe(false);

    await device.sync([fx.provider({ ...LARK_VALUES, id: LARK.id, deletedAt: at() })]);
    await device.settle();
    await expect.poll(() => sheet()?.hasAttribute("data-gone")).toBe(true);
    expect(dialogText()).toContain("Provider removed");
    expect(dialogText()).not.toContain("555-0100");
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await waitUntil(() => !sheet(), "the sheet closing");
  });

  test("shows a medication's synced dose change, then gone when it leaves the device", async () => {
    const device = await open();
    await openSheet("medication");
    expect(fact("schedule")).toContain("2 drops");

    await device.sync([fx.medication({ ...DROPS_VALUES, id: DROPS.id, dose: "3 drops" })]);
    await device.settle();
    await expect.poll(() => fact("schedule")).toContain("3 drops");

    await device.unsync([DROPS]);
    await device.settle();
    await expect.poll(() => sheet()?.hasAttribute("data-gone")).toBe(true);
    expect(dialogText()).toContain("Medication removed");
  });

  test("shows a condition's synced note, then gone when it's deleted", async () => {
    const device = await open();
    await openSheet("condition");
    expect(fact("note")).toContain("Worse on stairs");

    await device.sync([condition({ ...KNEE_VALUES, id: KNEE.id, note: "Better since the brace" })]);
    await device.settle();
    await expect.poll(() => fact("note")).toContain("Better since the brace");

    await device.sync([condition({ ...KNEE_VALUES, id: KNEE.id, deletedAt: at() })]);
    await device.settle();
    await expect.poll(() => sheet()?.hasAttribute("data-gone")).toBe(true);
    expect(dialogText()).toContain("Condition removed");
  });
});
