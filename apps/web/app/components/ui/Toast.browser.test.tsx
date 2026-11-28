import { afterEach, describe, expect, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { Link, Route, Routes } from "react-router";

import { renderInRouter } from "../../../test/device";
import { fixClock } from "../../../test/found";
import { dismissToast, toast, TOAST_TIMEOUT, ToastRegion } from "./index";

// The shared toasts (B-669): one queue, one region, one toast at a time (the
// newest; older ones wait behind it). Reduced motion is emulated from this
// file (Chrome DevTools), reset after each test.

/** Chrome DevTools, for media emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
const reduceMotion = () =>
  devtools().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

afterEach(async () => {
  await devtools().send("Emulation.setEmulatedMedia", { features: [] });
});

const shown = (name: string) => page.getByRole("alertdialog", { name });
const toasts = () => document.querySelectorAll("[data-toast]").length;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const seconds = (list: string) => list.split(",").map((s) => parseFloat(s));
const longest = (el: Element) => {
  const style = getComputedStyle(el);
  return Math.max(...seconds(style.transitionDuration), ...seconds(style.animationDuration));
};

/** A screen with a text field (the pointer rests on it, off the toasts), and the region. */
async function open() {
  const result = await renderInRouter(
    <>
      <label>
        Note <input name="note" />
      </label>
      <ToastRegion />
    </>,
  );
  await userEvent.hover(page.getByRole("textbox", { name: "Note" }));
  return result;
}

/** The most toasts on screen at once while `run` runs. */
async function mostAtOnce(run: () => Promise<void>) {
  let most = toasts();
  const observer = new MutationObserver(() => (most = Math.max(most, toasts())));
  observer.observe(document.body, { subtree: true, childList: true });
  try {
    await run();
  } finally {
    observer.disconnect();
  }
  return most;
}

describe("the toast queue", () => {
  test("two toasts never overlap: the newest shows, the older waits and comes back when it goes", async () => {
    await open();
    const most = await mostAtOnce(async () => {
      toast({ message: "Note deleted", timeout: null });
      await expect.element(shown("Note deleted")).toBeVisible();
      toast({ message: "Dose logged", timeout: null });
      await expect.element(shown("Dose logged")).toBeVisible();
      expect(shown("Note deleted").query()).toBeNull();
      await userEvent.click(shown("Dose logged").getByRole("button", { name: "Dismiss" }));
      await expect.element(shown("Note deleted")).toBeVisible();
      expect(shown("Dose logged").query()).toBeNull();
    });
    expect(most).toBe(1);
  });

  test("dismiss removes that one; dismissToast removes a waiting one without showing it", async () => {
    await open();
    const first = toast({ message: "Note deleted", timeout: null });
    toast({ message: "Dose logged", timeout: null });
    await expect.element(shown("Dose logged")).toBeVisible();
    dismissToast(first);
    await userEvent.click(shown("Dose logged").getByRole("button", { name: "Dismiss" }));
    await expect.element(shown("Dose logged")).not.toBeInTheDocument();
    await expect.poll(toasts).toBe(0);
    expect(document.querySelector("[data-toast-region]")).toBeNull();
  });

  test("an action runs once and closes the toast; Undo is an action before it", async () => {
    await open();
    const undo = vi.fn();
    const details = vi.fn();
    toast({ message: "Added Ibuprofen", undo, action: { label: "Add details", onAction: details } });
    const buttons = shown("Added Ibuprofen").getByRole("button");
    await expect.element(buttons.first()).toHaveAccessibleName("Undo");
    expect(buttons.elements().map((b) => b.textContent?.trim() || b.getAttribute("aria-label"))).toEqual([
      "Undo",
      "Add details",
      "Dismiss",
    ]);
    const button = shown("Added Ibuprofen")
      .getByRole("button", { name: "Add details" })
      .element() as HTMLButtonElement;
    button.click();
    button.click();
    await expect.element(shown("Added Ibuprofen")).not.toBeInTheDocument();
    expect(details).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });

  test("a second action shows after the first; each runs once and closes the toast", async () => {
    await open();
    const openIt = vi.fn();
    const retire = vi.fn();
    const ask = () =>
      toast({
        message: "Want help onboarding?",
        timeout: null,
        action: { label: "Open", onAction: openIt },
        secondAction: { label: "Don't ask again", onAction: retire },
      });
    const names = () =>
      shown("Want help onboarding?")
        .getByRole("button")
        .elements()
        .map((b) => b.textContent?.trim() || b.getAttribute("aria-label"));
    const press = async (name: string) => {
      const button = shown("Want help onboarding?")
        .getByRole("button", { name })
        .element() as HTMLButtonElement;
      button.click();
      button.click();
      await expect.element(shown("Want help onboarding?")).not.toBeInTheDocument();
    };

    ask();
    await expect.element(shown("Want help onboarding?")).toBeVisible();
    expect(names()).toEqual(["Open", "Don't ask again", "Dismiss"]);
    await press("Don't ask again");
    expect(retire).toHaveBeenCalledOnce();
    expect(openIt).not.toHaveBeenCalled();

    ask();
    await expect.element(shown("Want help onboarding?")).toBeVisible();
    await press("Open");
    expect(openIt).toHaveBeenCalledOnce();
    expect(retire).toHaveBeenCalledOnce();
  });

  test("a timeout closes it; a toast without one stays", async () => {
    await open();
    fixClock();
    toast({ message: "Waiting for a connection", timeout: null });
    await expect.element(shown("Waiting for a connection")).toBeVisible();
    await vi.advanceTimersByTimeAsync(10 * TOAST_TIMEOUT);
    await expect.element(shown("Waiting for a connection")).toBeVisible();

    toast({ message: "Saved" });
    await expect.element(shown("Saved")).toBeVisible();
    await vi.advanceTimersByTimeAsync(TOAST_TIMEOUT);
    await expect.element(shown("Saved")).not.toBeInTheDocument();
    // The one without a timeout is back, and still stays.
    await expect.element(shown("Waiting for a connection")).toBeVisible();
    await vi.advanceTimersByTimeAsync(10 * TOAST_TIMEOUT);
    await expect.element(shown("Waiting for a connection")).toBeVisible();
  });

  test("it fades in, and out on --motion: it stays inert for the fade, then goes", async () => {
    await open();
    toast({ message: "Note deleted", timeout: null });
    await expect.element(shown("Note deleted")).toBeVisible();
    const el = shown("Note deleted").element();
    expect(getComputedStyle(el).animationName).toBe("fade-in");
    let exit: { animation: string; duration: string; inert: boolean; at: number } | undefined;
    let removedAt = NaN;
    const observer = new MutationObserver(() => {
      if (!exit && el.hasAttribute("data-exiting")) {
        const style = getComputedStyle(el);
        exit = {
          animation: style.animationName,
          duration: style.animationDuration,
          inert: (el as HTMLElement).inert,
          at: performance.now(),
        };
      }
      if (Number.isNaN(removedAt) && !el.isConnected) removedAt = performance.now();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    await userEvent.click(shown("Note deleted").getByRole("button", { name: "Dismiss" }));
    await expect.element(shown("Note deleted")).not.toBeInTheDocument();
    observer.disconnect();
    expect(exit).toMatchObject({ animation: "fade-out", duration: "0.24s", inert: true });
    expect(removedAt - (exit?.at ?? NaN)).toBeGreaterThanOrEqual(200);
  });

  test("with reduced motion it shows and goes at once", async () => {
    await reduceMotion();
    await open();
    const id = toast({ message: "Note deleted", timeout: null });
    await expect.element(shown("Note deleted")).toBeVisible();
    expect(longest(shown("Note deleted").element())).toBe(0);
    dismissToast(id);
    await nextFrame();
    expect(shown("Note deleted").query()).toBeNull();
  });
});

describe("toasts and the screen", () => {
  test("a toast shown, then a route change: it's still shown, though its screen has gone", async () => {
    const Screen = () => (
      <>
        <button type="button" onClick={() => toast({ message: "Note deleted", timeout: null })}>
          Delete
        </button>
        <Link to="/other">Other page</Link>
      </>
    );
    const { location } = await renderInRouter(
      <>
        <Routes>
          <Route path="/" element={<Screen />} />
          <Route path="/other" element={<p>The other page</p>} />
        </Routes>
        <ToastRegion />
      </>,
    );
    await userEvent.click(page.getByRole("button", { name: "Delete" }));
    await expect.element(shown("Note deleted")).toBeVisible();
    await userEvent.click(page.getByRole("link", { name: "Other page" }));
    await expect.element(page.getByText("The other page")).toBeVisible();
    expect(location()).toBe("/other");
    await expect.element(shown("Note deleted")).toBeVisible();
  });

  test("focus stays in a text field while a toast appears; typing goes on into it", async () => {
    await open();
    const field = page.getByRole("textbox", { name: "Note" });
    await userEvent.click(field);
    await userEvent.keyboard("Slept");
    toast({
      message: "A new version is ready",
      action: { label: "Reload", onAction: () => {} },
      timeout: null,
    });
    await expect.element(shown("A new version is ready")).toBeVisible();
    expect(document.activeElement).toBe(field.element());
    await userEvent.keyboard(" well");
    await expect.element(field).toHaveValue("Slept well");
    expect(document.activeElement).toBe(field.element());
  });

  test("the region is a named landmark and the message a live alert", async () => {
    await open();
    toast({ message: "Note deleted", timeout: null });
    await expect.element(page.getByRole("region", { name: /notification/i })).toBeVisible();
    await expect.element(shown("Note deleted").getByRole("alert")).toHaveTextContent("Note deleted");
  });
});
