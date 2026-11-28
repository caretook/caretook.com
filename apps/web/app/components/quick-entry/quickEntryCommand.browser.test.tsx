import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { clearUndo } from "~/lib/medications/passUndo";
import { renderWithDevice } from "../../../test/device";
import { waitUntil } from "../../../test/found";
import { TEST_GROUP } from "../../../test/fixtures";
import { PROBE } from "../../../test/probe";
import { closeQuickEntry } from "./QuickEntrySheet";

// Commands from the quick entry sheet (quick-entry-3, slice 5): a whole line
// that opens a page or the timeline on a day shows one command card, and Go
// runs it (`runCommand`), here or in a new tab, then closes the sheet. The
// real frame around the probe (test/probe.tsx), which shows where it is.

const GROUP = `/app/groups/${TEST_GROUP.id}`;
const PROVIDERS_URL = `${GROUP}/providers`;

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({ route: [PROBE], url: PROVIDERS_URL, frame: true, ...options });

const quickButton = () => page.getByRole("button", { name: "Quick entry", exact: true });
const sheet = () => page.getByRole("dialog", { name: "Quick entry" });
const sheetOpen = () => !!document.querySelector("[role=dialog]");
const box = () => sheet().getByRole("textbox", { name: "What happened?" });
const commandCard = () => document.querySelector<HTMLElement>("[role=dialog] [data-quick-command]");
const saveCards = () => document.querySelectorAll("[role=dialog] [data-quick-card]").length;
const goButton = () => sheet().getByRole("button", { name: "Go", exact: true });

/** Open the sheet and type a command, waiting for its card. */
const typeCommand = async (line: string, command: string) => {
  await userEvent.click(quickButton());
  await expect.element(sheet()).toBeVisible();
  await userEvent.fill(box(), line);
  await expect.poll(() => commandCard()?.dataset.quickCommand).toBe(command);
  expect(saveCards()).toBe(0);
};

afterEach(() => {
  clearUndo();
  closeQuickEntry();
  vi.restoreAllMocks();
});

describe("a command from the quick entry sheet", () => {
  test('"go to medications" shows a command card; Go opens the medications page and closes the sheet', async () => {
    const device = await open();
    await typeCommand("go to medications", "medications");
    expect(commandCard()?.textContent).toContain("Medications");
    expect(sheet().getByRole("button", { name: "Save", exact: true }).query()).toBeNull();

    await userEvent.click(goButton());
    await expect.poll(device.location).toBe(`${GROUP}/medications/schedule`);
    await waitUntil(() => !sheetOpen(), "the sheet to close");
    expect(await device.queued()).toEqual([]);
  });

  test('"open the planner in a new tab" opens the planner in a new tab and stays on the page', async () => {
    const opened = vi.spyOn(window, "open").mockReturnValue(null);
    const device = await open();
    await typeCommand("open the planner in a new tab", "planner");
    expect(commandCard()?.textContent).toContain("In a new tab");

    await userEvent.click(goButton());
    await expect.poll(() => opened.mock.calls).toEqual([[`${GROUP}/planner`, "_blank", "noopener"]]);
    await waitUntil(() => !sheetOpen(), "the sheet to close");
    expect(device.location()).toBe(PROVIDERS_URL);
  });

  test('"go to tuesday" still jumps the timeline to that day', async () => {
    const device = await open();
    // The test clock is Wednesday 2027-06-09.
    await typeCommand("go to tuesday", "day");
    expect(commandCard()?.dataset.quickGoto).toBe("2027-06-08");

    await userEvent.keyboard("{Enter}");
    await expect.poll(device.location).toBe(`${GROUP}/timeline?day=2027-06-08`);
    await waitUntil(() => !sheetOpen(), "the sheet to close");
  });

  test("a reader can go to a page", async () => {
    const device = await open({ role: "viewer" });
    await expect.element(page.getByText(/· reader/)).toBeVisible();
    await typeCommand("go to the timeline", "timeline");
    expect(document.querySelector("[role=dialog] [data-quick-status]")?.textContent ?? "").toBe("");

    await userEvent.click(goButton());
    await expect.poll(device.location).toBe(`${GROUP}/timeline`);
    await waitUntil(() => !sheetOpen(), "the sheet to close");
  });
});
