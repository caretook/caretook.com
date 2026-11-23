import type { DialogChoice } from "./index";

import { useState } from "react";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { ChoiceDialog, Menu } from "./index";

// ChoiceDialog (ui-kit-2, slice 6): a question with two or three answers, on
// useShowModal like ConfirmDialog. Its callers (the series question, the
// repeating todo's delete) are tested through their screens.

const CHOICES: DialogChoice<"skip" | "stop">[] = [
  { id: "skip", label: "Skip this one", tone: "primary", "data-skip": true },
  { id: "stop", label: "Delete and stop repeating", tone: "dangerQuiet" },
];

const active = () => document.activeElement;

function Harness({
  onChoose,
  onClose,
  viaMenu = false,
}: {
  onChoose: (id: string) => void;
  onClose: () => void;
  viaMenu?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {viaMenu ? (
        <Menu
          label="Actions for Water the plants"
          items={[{ id: "delete", label: "Delete", onAction: () => setOpen(true) }]}
          variant="secondary"
        >
          ⋯
        </Menu>
      ) : (
        <button type="button" onClick={() => setOpen(true)}>
          Delete todo
        </button>
      )}
      <ChoiceDialog
        open={open}
        title="Delete this repeating todo?"
        message="Skip this one, or delete it and stop repeating."
        choices={CHOICES}
        cancelLabel="Cancel"
        onChoose={(id) => {
          onChoose(id);
          setOpen(false);
        }}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        data-test-choice
      />
    </div>
  );
}

const dialog = () => page.getByRole("dialog", { name: "Delete this repeating todo?" });
const native = () => document.querySelector<HTMLDialogElement>("dialog[data-test-choice]")!;

describe("ChoiceDialog", () => {
  test("a modal dialog named by its title and described by its message; the choices in order, then Cancel", async () => {
    const { screen } = await renderInRouter(<Harness onChoose={() => {}} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete todo" }));
    await expect.element(dialog()).toBeVisible();
    await expect
      .element(dialog())
      .toHaveAccessibleDescription("Skip this one, or delete it and stop repeating.");
    expect(native().matches(":modal")).toBe(true);
    expect([...native().querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual([
      "Skip this one",
      "Delete and stop repeating",
      "Cancel",
    ]);
    // A choice's data-* reach its button.
    expect(native().querySelector("button[data-skip]")?.textContent).toBe("Skip this one");
  });

  test("each choice calls onChoose with its id", async () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    const { screen } = await renderInRouter(<Harness onChoose={onChoose} onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Delete todo" });

    await userEvent.click(opener);
    await userEvent.click(dialog().getByRole("button", { name: "Skip this one" }));
    expect(onChoose).toHaveBeenLastCalledWith("skip");
    await expect.poll(() => native().open).toBe(false);

    await userEvent.click(opener);
    await userEvent.click(dialog().getByRole("button", { name: "Delete and stop repeating" }));
    expect(onChoose).toHaveBeenLastCalledWith("stop");
    expect(onChoose).toHaveBeenCalledTimes(2);
  });

  test("Cancel and Escape call onClose and close only the dialog", async () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    const parentKeys: string[] = [];
    const { screen } = await renderInRouter(<Harness onChoose={onChoose} onClose={onClose} />);
    // What the dialog sits in (a sheet) listens for Escape too.
    const listen = (e: KeyboardEvent) => void parentKeys.push(e.key);
    document.body.addEventListener("keydown", listen);
    onTestFinished(() => document.body.removeEventListener("keydown", listen));
    const opener = screen.getByRole("button", { name: "Delete todo" });

    await userEvent.click(opener);
    await expect.element(dialog()).toBeVisible();
    // showModal() runs a frame or more after `open`.
    await expect.poll(() => native().open).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => native().open).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
    // The Escape never reached what the dialog sits in (a sheet would close).
    expect(parentKeys).not.toContain("Escape");

    await userEvent.click(opener);
    await userEvent.click(dialog().getByRole("button", { name: "Cancel" }));
    await expect.poll(() => native().open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onChoose).not.toHaveBeenCalled();
  });

  test("opened from a menu item it shows after the menu has closed, and focus returns to the menu's button", async () => {
    const { screen } = await renderInRouter(<Harness viaMenu onChoose={() => {}} onClose={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Actions for Water the plants" });
    await userEvent.click(trigger);
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    await expect.element(dialog()).toBeVisible();
    expect(document.querySelector('[role="menu"]')).toBeNull();

    // showModal() runs a frame or more after `open`.
    await expect.poll(() => native().open).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => native().open).toBe(false);
    await expect.poll(active).toBe(trigger.element());
  });
});
