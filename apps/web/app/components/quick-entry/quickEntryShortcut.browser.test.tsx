import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { waitUntil } from "../../../test/found";
import { TEST_GROUP } from "../../../test/fixtures";
import { PROBE } from "../../../test/probe";
import { closeQuickEntry } from "./QuickEntrySheet";

// The quick entry keys (quick-entry-3, slice 2): `/` outside a text field and
// Cmd/Ctrl+K from anywhere open the group layout's sheet with the box
// focused; nothing in the easy frame. The real frame around the probe
// (test/probe.tsx), with a plain input of the test's own for "in a field".

const PROVIDERS_URL = `/app/groups/${TEST_GROUP.id}/providers`;
const TIMELINE_URL = `/app/groups/${TEST_GROUP.id}/timeline`;

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({ route: PROBE, url: PROVIDERS_URL, frame: true, ...options });

const sheet = () => page.getByRole("dialog", { name: "Quick entry" });
const sheetOpen = () => !!document.querySelector("[role=dialog] [data-quick-entry]");
const boxEl = () => document.querySelector<HTMLTextAreaElement>("[role=dialog] [data-quick-entry] textarea");
const boxFocused = () => !!boxEl() && document.activeElement === boxEl();
const searchLink = () => page.getByRole("link", { name: "Search this care group" });

/** A plain text field on the page, focused, for keys typed in a field. */
const aField = () => {
  const input = document.createElement("input");
  input.setAttribute("aria-label", "Somewhere else");
  document.body.append(input);
  input.focus();
  return input;
};

/** Let the keys' handlers and a render run, then say whether the sheet opened. */
const settledOpen = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return sheetOpen();
};

/** A native `<dialog>` confirm, open and holding focus (B-1058). */
const aNativeDialog = () => {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", "A native confirm");
  const button = document.createElement("button");
  button.textContent = "Keep it";
  dialog.append(button);
  document.body.append(dialog);
  dialog.showModal();
  button.focus();
  return button;
};

afterEach(() => {
  closeQuickEntry();
  for (const input of document.querySelectorAll('input[aria-label="Somewhere else"]')) input.remove();
  for (const dialog of document.querySelectorAll('dialog[aria-label="A native confirm"]')) dialog.remove();
});

describe("the quick entry keys", () => {
  test("/ opens the sheet with the box focused, and / typed in the box is a slash", async () => {
    await open();
    await expect.element(page.getByText(PROVIDERS_URL)).toBeVisible();
    await userEvent.keyboard("/");
    await expect.element(sheet()).toBeVisible();
    await waitUntil(boxFocused, "the box to have focus");
    expect(boxEl()?.value).toBe("");

    await userEvent.keyboard("bp 120/80");
    await expect.poll(() => boxEl()?.value).toBe("bp 120/80");
  });

  test("/ typed in a field types a slash and opens nothing", async () => {
    await open();
    await expect.element(searchLink()).toBeVisible();
    const input = aField();
    await userEvent.keyboard("1/2");
    expect(input.value).toBe("1/2");
    expect(await settledOpen()).toBe(false);
  });

  test.each(["Meta", "Control"])("%s+K opens it from the page and from a field", async (modifier) => {
    await open();
    await expect.element(searchLink()).toBeVisible();
    await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
    await expect.element(sheet()).toBeVisible();
    await waitUntil(boxFocused, "the box to have focus");

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !sheetOpen(), "the sheet to close");
    const input = aField();
    await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
    await expect.element(sheet()).toBeVisible();
    await waitUntil(boxFocused, "the box to have focus");
    expect(input.value).toBe("");
  });

  test("nothing opens over an open native dialog holding focus", async () => {
    await open();
    await expect.element(searchLink()).toBeVisible();
    const button = aNativeDialog();
    expect(document.activeElement).toBe(button);
    await userEvent.keyboard("/");
    expect(await settledOpen()).toBe(false);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    expect(await settledOpen()).toBe(false);
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(await settledOpen()).toBe(false);
  });

  test("nothing opens in the easy frame", async () => {
    await open({ role: "easy_viewer", url: TIMELINE_URL });
    await expect.element(searchLink()).toBeVisible();
    await expect.poll(() => page.getByRole("button", { name: /switch care group$/ }).query()).toBeNull();
    await userEvent.keyboard("/");
    expect(await settledOpen()).toBe(false);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(await settledOpen()).toBe(false);
  });
});
