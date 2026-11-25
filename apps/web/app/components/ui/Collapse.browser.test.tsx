import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { Collapse } from "./index";

/** Chrome DevTools, for media emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
const reduceMotion = () =>
  devtools().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

afterEach(async () => {
  await devtools().send("Emulation.setEmulatedMedia", { features: [] });
});

/** A toggle, the region it controls (with a button inside), and a button after it. */
function Expander({ initial = false }: { initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls="notes" onClick={() => setOpen((o) => !o)}>
        Visit notes
      </button>
      <Collapse open={open} id="notes" data-hook="x">
        <p>Bring the blood pressure log.</p>
        <button type="button">Edit notes</button>
      </Collapse>
      <button type="button">After</button>
    </div>
  );
}

const region = () => document.getElementById("notes")!;
const shown = () => region().checkVisibility({ visibilityProperty: true });
const seconds = (list: string) => list.split(",").map((s) => parseFloat(s));

describe("Collapse", () => {
  test("open, its content is visible and takes focus; closed, it's out of the accessibility tree and Tab skips it", async () => {
    const { screen } = await renderInRouter(<Expander initial />);
    const toggle = screen.getByRole("button", { name: "Visit notes" });
    await expect.element(screen.getByText("Bring the blood pressure log.")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Edit notes" })).toBeVisible();
    expect(region().dataset.hook).toBe("x");
    toggle.element().focus();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("Edit notes");

    await userEvent.click(toggle);
    expect(toggle.element().getAttribute("aria-expanded")).toBe("false");
    await expect.poll(shown).toBe(false);
    await expect.element(screen.getByRole("button", { name: "Edit notes" })).not.toBeInTheDocument();
    await expect.element(screen.getByText("Bring the blood pressure log.")).not.toBeVisible();
    toggle.element().focus();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("After");
  });

  test("closed from the start, then opened: it slides with the kit's duration", async () => {
    const { screen } = await renderInRouter(<Expander />);
    expect(shown()).toBe(false);
    const motion = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion"));
    expect(motion).toBe(240);
    expect(seconds(getComputedStyle(region()).transitionDuration)).toContain(motion / 1000);
    await userEvent.click(screen.getByRole("button", { name: "Visit notes" }));
    await expect.element(screen.getByRole("button", { name: "Edit notes" })).toBeVisible();
    // Done moving, the content may show past its edges (focus rings).
    await expect.poll(() => region().hasAttribute("data-settled")).toBe(true);
  });

  test("with reduced motion, it opens and closes at once, with no transition", async () => {
    await reduceMotion();
    const { screen } = await renderInRouter(<Expander />);
    const toggle = screen.getByRole("button", { name: "Visit notes" });
    expect(seconds(getComputedStyle(region()).transitionDuration).every((s) => s === 0)).toBe(true);
    await userEvent.click(toggle);
    expect(shown()).toBe(true);
    expect(region().firstElementChild?.getBoundingClientRect().height).toBeGreaterThan(0);
    await userEvent.click(toggle);
    expect(shown()).toBe(false);
    expect(region().getBoundingClientRect().height).toBe(0);
  });

  test("inline, it slides its width; closed, it takes none", async () => {
    await reduceMotion();
    const { screen } = await renderInRouter(
      <div className="flex w-80">
        <Collapse open={false} axis="inline" className="min-w-0 flex-1" data-field="">
          <input aria-label="Search" className="input w-full" />
        </Collapse>
      </div>,
    );
    await expect.element(screen.getByRole("textbox", { name: "Search" })).not.toBeInTheDocument();
    const cell = document.querySelector<HTMLElement>("[data-field] > div")!;
    expect(cell.getBoundingClientRect().width).toBe(0);
  });
});
