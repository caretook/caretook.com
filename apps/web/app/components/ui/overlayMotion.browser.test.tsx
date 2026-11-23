import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { ChoiceDialog, ConfirmDialog, Menu, Popover, Toast } from "./index";

// Overlay motion (ui-kit-3 slice 5): menus and popovers fade in and out on
// `--motion-fast`, toasts and the native modal dialogs on `--motion`, with no
// scale; under "reduce motion" nothing animates and each is gone at once.
// Reduced motion is emulated from this file (Chrome DevTools), reset after
// each test.

/** Chrome DevTools, for media emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
const reduceMotion = () =>
  devtools().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

afterEach(async () => {
  await devtools().send("Emulation.setEmulatedMedia", { features: [] });
});

const MOTIONS = [
  { motion: "on", setup: async () => {} },
  { motion: "reduced", setup: reduceMotion },
] as const;

const seconds = (list: string) => list.split(",").map((s) => parseFloat(s));
/** The longest transition or animation computed on an element (or its pseudo-element). */
const longest = (el: Element, pseudo?: string) => {
  const style = getComputedStyle(el, pseudo);
  return Math.max(...seconds(style.transitionDuration), ...seconds(style.animationDuration));
};
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const active = () => document.activeElement;

/**
 * Watch `el` as it closes: the animation or opacity transition computed on it
 * when its exit starts (`data-exiting`), and how long it stayed in the DOM
 * after that.
 */
function watchExit(el: Element) {
  const seen: {
    animation?: string;
    duration?: string;
    transition?: string;
    exitAt?: number;
    removedAt?: number;
  } = {};
  const observer = new MutationObserver(() => {
    if (seen.exitAt === undefined && el.hasAttribute("data-exiting")) {
      const style = getComputedStyle(el);
      seen.exitAt = performance.now();
      seen.animation = style.animationName;
      seen.duration = style.animationDuration;
      seen.transition = `${style.transitionProperty} ${style.transitionDuration}`;
    }
    if (seen.removedAt === undefined && !el.isConnected) {
      seen.removedAt = performance.now();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  return seen;
}

/** How long an element stayed in the DOM after its exit started (NaN if either wasn't seen). */
const stayed = (seen: { exitAt?: number; removedAt?: number }) =>
  (seen.removedAt ?? NaN) - (seen.exitAt ?? NaN);
/** The overlay's own box around its content (React Aria's popover, the toast). */
const parentOf = (el: Element) => {
  const parent = el.parentElement;
  if (!parent) throw new Error("no parent");
  return parent;
};

const ITEMS = [{ id: "edit", label: "Edit", onAction: () => undefined }];

describe("Menu and Popover fade", () => {
  test("a menu fades in, and on close stays for its fast fade-out, then leaves the DOM", async () => {
    const { screen } = await renderInRouter(
      <Menu label="Note actions" className="btn" items={ITEMS}>
        ⋯
      </Menu>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Note actions" }));
    const menu = page.getByRole("menu");
    await expect.element(menu).toBeVisible();
    const popover = menu.element().parentElement!;
    // It fades in on the fast duration.
    expect(getComputedStyle(popover).transitionDuration).toBe("0.12s");
    await expect.poll(() => getComputedStyle(popover).opacity).toBe("1");
    const exit = watchExit(popover);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
    expect(exit).toMatchObject({ transition: "opacity 0.12s" });
    expect(stayed(exit)).toBeGreaterThanOrEqual(100);
  });

  test("a popover fades out on the fast duration, then leaves the DOM; focus returns to its button", async () => {
    const { screen } = await renderInRouter(
      <Popover label="Change the time" dialogLabel="When" trigger="4:40 PM">
        <p>Pick a time</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Change the time" });
    await userEvent.click(trigger);
    const dialog = page.getByRole("dialog", { name: "When" });
    await expect.element(dialog).toBeVisible();
    const panel = dialog.element().parentElement!;
    await expect.poll(() => getComputedStyle(panel).opacity).toBe("1");
    const exit = watchExit(panel);
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    expect(exit).toMatchObject({ transition: "opacity 0.12s" });
    expect(stayed(exit)).toBeGreaterThanOrEqual(100);
    await expect.poll(active).toBe(trigger.element());
  });

  test("held hidden before its reveal, a panel starts no fade (an exit waiting on one would never finish)", () => {
    // React Aria hides a popover with inline styles until it is placed (on a
    // touch device, for two frames or more), then cancels any transition on
    // it. A close in that window would wait on the cancelled fade forever,
    // leaving an invisible panel that takes taps (B-547).
    const panel = document.createElement("div");
    panel.className = "motion-overlay";
    document.body.append(panel);
    expect(getComputedStyle(panel).opacity).toBe("1");
    panel.style.setProperty("opacity", "0");
    panel.style.setProperty("clip-path", "inset(50%)");
    expect(panel.getAnimations()).toEqual([]);
    panel.remove();
  });

  test("with reduced motion, a menu and a popover have no transition or animation and are gone in the next frame", async () => {
    await reduceMotion();
    const { screen } = await renderInRouter(
      <>
        <Menu label="Note actions" className="btn" items={ITEMS}>
          ⋯
        </Menu>
        <Popover label="Change the time" dialogLabel="When" trigger="4:40 PM">
          <p>Pick a time</p>
        </Popover>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Note actions" }));
    const menu = page.getByRole("menu");
    await expect.element(menu).toBeVisible();
    expect(longest(parentOf(menu.element()))).toBe(0);
    await userEvent.keyboard("{Escape}");
    await nextFrame();
    expect(document.querySelector('[role="menu"]')).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Change the time" }));
    const dialog = page.getByRole("dialog", { name: "When" });
    await expect.element(dialog).toBeVisible();
    expect(longest(parentOf(dialog.element()))).toBe(0);
    await userEvent.keyboard("{Escape}");
    await nextFrame();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

function ConfirmFromMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Menu
        label="Actions for Slept well"
        className="btn"
        items={[{ id: "delete", label: "Delete", onAction: () => setOpen(true) }]}
      >
        ⋯
      </Menu>
      <ConfirmDialog
        open={open}
        title="Delete this note?"
        confirmLabel="Delete"
        onConfirm={() => setOpen(false)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

describe.each(MOTIONS)("a confirm opened from a menu item (motion $motion)", ({ setup }) => {
  test("opens after the menu has gone; on Cancel focus is back on the menu's button", async () => {
    await setup();
    const { screen } = await renderInRouter(<ConfirmFromMenu />);
    const trigger = screen.getByRole("button", { name: "Actions for Slept well" });
    await userEvent.click(trigger);
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    const native = () => document.querySelector("dialog")!;
    await expect.poll(() => native().open).toBe(true);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => native().open).toBe(false);
    await expect.poll(active).toBe(trigger.element());
  });
});

function Dialogs({ onClose }: { onClose: (which: string) => void }) {
  const [open, setOpen] = useState<"confirm" | "choice" | null>(null);
  const close = (which: "confirm" | "choice") => {
    onClose(which);
    setOpen(null);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen("confirm")}>
        Delete note
      </button>
      <button type="button" onClick={() => setOpen("choice")}>
        Delete todo
      </button>
      <ConfirmDialog
        open={open === "confirm"}
        title="Delete this note?"
        confirmLabel="Delete"
        onConfirm={() => close("confirm")}
        onClose={() => close("confirm")}
      />
      <ChoiceDialog
        open={open === "choice"}
        title="Delete this repeating todo?"
        message="Skip this one, or delete it and stop repeating."
        cancelLabel="Cancel"
        choices={[{ id: "skip", label: "Skip this one", tone: "primary" }]}
        onChoose={() => setOpen(null)}
        onClose={() => close("choice")}
      />
    </>
  );
}

const DIALOGS = [
  { name: "ConfirmDialog", opener: "Delete note", title: "Delete this note?", which: "confirm" },
  { name: "ChoiceDialog", opener: "Delete todo", title: "Delete this repeating todo?", which: "choice" },
] as const;

describe.each(DIALOGS)("$name's fade", ({ opener, title, which }) => {
  const openIt = async (onClose: (which: string) => void) => {
    const { screen } = await renderInRouter(<Dialogs onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: opener }));
    const dialog = page.getByRole("dialog", { name: title });
    await expect.element(dialog).toBeVisible();
    const native = dialog.element() as HTMLDialogElement;
    await expect.poll(() => native.open).toBe(true);
    return { native, box: native.querySelector(".modal-box")! };
  };

  test("with motion on: a plain fade on the kit's duration, no scale; Escape closes only it, onClose once", async () => {
    const onClose = vi.fn();
    const parentKeys: string[] = [];
    const listen = (e: KeyboardEvent) => void parentKeys.push(e.key);
    document.body.addEventListener("keydown", listen);
    try {
      const { native, box } = await openIt(onClose);
      for (const el of [native, box]) {
        const style = getComputedStyle(el);
        expect(seconds(style.transitionDuration)).toContain(0.18);
        expect(Math.max(...seconds(style.transitionDuration))).toBeLessThanOrEqual(0.18);
        expect(style.transitionProperty).not.toMatch(/scale|translate|transform/);
      }
      expect(getComputedStyle(native).transitionProperty).toContain("background-color");
      expect(getComputedStyle(box).transitionProperty).toContain("opacity");
      expect(["none", "1"]).toContain(getComputedStyle(box).scale);

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => native.open).toBe(false);
      expect(parentKeys).not.toContain("Escape");
      await expect.poll(() => onClose.mock.calls.length).toBe(1);
      expect(onClose).toHaveBeenCalledWith(which);
      // It has faded out: hidden, and out of the accessibility tree.
      await expect.poll(() => getComputedStyle(native).visibility).toBe("hidden");
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      document.body.removeEventListener("keydown", listen);
    }
  });

  test("with reduced motion: no transition on the dialog, its box or its backdrop; it closes at once", async () => {
    await reduceMotion();
    const onClose = vi.fn();
    const { native, box } = await openIt(onClose);
    expect(longest(native)).toBe(0);
    expect(longest(native, "::backdrop")).toBe(0);
    expect(longest(box)).toBe(0);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => native.open).toBe(false);
    await nextFrame();
    expect(getComputedStyle(native).visibility).toBe("hidden");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

function ToastHarness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        Toggle
      </button>
      <Toast
        open={open}
        message="A new version is ready"
        actionLabel="Reload"
        onAction={() => setOpen(false)}
      />
    </>
  );
}

describe("Toast", () => {
  test("open shows a status; turning it false fades it out on --motion, then unmounts it", async () => {
    await renderInRouter(<ToastHarness />);
    const status = page.getByRole("status").filter({ hasText: "A new version is ready" });
    await expect.element(status).toBeVisible();
    const toast = status.element().parentElement!;
    const exit = watchExit(toast);
    await userEvent.click(page.getByRole("button", { name: "Reload" }));
    await expect.element(status).not.toBeInTheDocument();
    expect(exit).toMatchObject({ animation: "fade-out", duration: "0.18s" });
    expect(stayed(exit)).toBeGreaterThanOrEqual(150);

    // Open again: it comes back.
    await userEvent.click(page.getByRole("button", { name: "Toggle" }));
    await expect.element(status).toBeVisible();
  });

  test("with reduced motion it has no animation and is gone in the next frame", async () => {
    await reduceMotion();
    await renderInRouter(<ToastHarness />);
    const status = page.getByRole("status").filter({ hasText: "A new version is ready" });
    await expect.element(status).toBeVisible();
    expect(longest(parentOf(status.element()))).toBe(0);
    await userEvent.click(page.getByRole("button", { name: "Toggle" }));
    await nextFrame();
    expect(status.query()).toBeNull();
  });
});
