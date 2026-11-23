import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { found } from "../../../test/found";
import { pickTime } from "../../../test/timeSelect";
import { ConfirmDialog, Sheet, TimeSelect } from "./index";

// A sheet that edits data asks before it throws changes away (B-316): any way
// out but a save or the form's own Cancel, once the form differs from its start.

const overlay = () => document.querySelector<HTMLElement>('[data-sheet="overlay"]');
const panel = () => document.querySelector<HTMLElement>('[data-sheet="panel"]');
const nameField = () => page.getByRole("textbox", { name: "Name" });
const asked = () => document.querySelector("dialog[open]") !== null;
const keep = () => userEvent.click(page.getByRole("button", { name: "Keep editing" }));
const discard = () => userEvent.click(page.getByRole("button", { name: "Discard" }));

function Harness() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // What a sync would do: a new value arriving with no one touching the form.
  const [synced, setSynced] = useState("Fictional start");
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Link to="/sheet">Open the sheet</Link>
      <p data-where>{pathname}</p>
      <button type="button" hidden data-back onClick={() => void navigate(-1)} />
      <button type="button" hidden data-sync onClick={() => setSynced("From another device")} />
      {pathname === "/sheet" && (
        <Sheet guardChanges isOpen onOpenChange={(open) => !open && void navigate("/")} title="Edit">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void navigate("/");
            }}
          >
            <label>
              Name <input name="name" defaultValue="Fictional name" />
            </label>
            <input type="hidden" name="synced" value={synced} />
            <TimeSelect name="at" label="Time" defaultValue="09:00" />
            <button type="button" data-form-cancel="" onClick={() => void navigate("/")}>
              Cancel
            </button>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </form>
          <ConfirmDialog
            open={deleting}
            title="Delete this?"
            confirmLabel="Yes, delete"
            onConfirm={() => {
              setDeleting(false);
              void navigate("/");
            }}
            onClose={() => setDeleting(false)}
          />
        </Sheet>
      )}
    </>
  );
}

const pressBack = () => document.querySelector<HTMLElement>("[data-back]")?.click();

async function openSheet() {
  const view = await renderInRouter(<Harness />, { width: 800 });
  const opener = view.screen.getByRole("link", { name: "Open the sheet" });
  await userEvent.click(opener);
  await expect.element(page.getByRole("dialog", { name: "Edit" })).toBeVisible();
  await expect.poll(() => getComputedStyle(overlay()!).opacity).toBe("1");
  return { ...view, opener };
}

const WAYS = [
  { way: "Close", act: () => userEvent.click(page.getByRole("button", { name: "Close" })) },
  { way: "Escape", act: () => userEvent.keyboard("{Escape}") },
  {
    way: "a tap outside",
    act: async () =>
      userEvent.click(page.elementLocator(await found(() => overlay())), { position: { x: 4, y: 4 } }),
  },
  { way: "Back", act: () => Promise.resolve(pressBack()) },
] as const;

describe.each(WAYS)("$way", ({ act }) => {
  test("a changed form asks; Keep editing keeps the values, Discard closes", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await act();
    await expect.poll(asked).toBe(true);
    await expect.element(page.getByRole("heading", { name: "Discard changes?" })).toBeVisible();
    expect(location()).toBe("/sheet");

    await keep();
    await expect.poll(asked).toBe(false);
    await expect.element(nameField()).toHaveValue("Changed");
    expect(location()).toBe("/sheet");

    await act();
    await expect.poll(asked).toBe(true);
    await discard();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
  });

  test("an unchanged form closes without asking", async () => {
    const { location } = await openSheet();
    await act();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
  });
});

describe("what counts as a change", () => {
  test("a change through TimeSelect asks", async () => {
    await openSheet();
    await pickTime(() => panel()?.querySelector<HTMLInputElement>("[name=at]"), "10:00");
    await userEvent.keyboard("{Escape}");
    await expect.poll(asked).toBe(true);
  });

  test("typing a value back to its start is no change", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.fill(nameField(), "Fictional name");
    await userEvent.keyboard("{Escape}");
    await expect.poll(location).toBe("/");
  });

  test("a value a sync put there before the first touch is no change", async () => {
    const { location } = await openSheet();
    document.querySelector<HTMLElement>("[data-sync]")?.click();
    await expect
      .poll(() => panel()?.querySelector<HTMLInputElement>("[name=synced]")?.value)
      .toBe("From another device");
    await userEvent.keyboard("{Escape}");
    await expect.poll(location).toBe("/");
  });
});

describe("leaving on purpose", () => {
  test("saving a changed form closes without asking", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(asked()).toBe(false);
  });

  test("a confirmed delete closes a changed form without asking again", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "Delete" }));
    await userEvent.click(page.getByRole("button", { name: "Yes, delete" }));
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(asked()).toBe(false);
  });

  test("the form's own Cancel closes without asking", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(location).toBe("/");
    expect(asked()).toBe(false);
  });
});

test("after Discard the exit still plays and focus returns to the opener", async () => {
  const { opener } = await openSheet();
  await userEvent.fill(nameField(), "Changed");
  await userEvent.keyboard("{Escape}");
  await expect.poll(asked).toBe(true);
  let exited = false;
  const observer = new MutationObserver(() => {
    if (overlay()?.hasAttribute("data-closing")) exited = true;
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-closing"] });
  await discard();
  await expect.poll(overlay).toBeNull();
  observer.disconnect();
  expect(exited).toBe(true);
  await expect.poll(() => document.activeElement).toBe(opener.element());
});
