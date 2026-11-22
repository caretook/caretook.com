import { afterEach, describe, expect, test } from "vitest";
import { cdp } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { Button, Chevron, Collapse, List, ListRow } from "./index";

// The kit's motion on what moves (ui-kit-2 slice 5): buttons and link rows
// take the fast duration; under "reduce motion" nothing has a transition or
// an animation. Reduced motion is emulated from this file (Chrome DevTools),
// reset after each test.

/** Chrome DevTools, for media emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };

afterEach(async () => {
  await devtools().send("Emulation.setEmulatedMedia", { features: [] });
});

const seconds = (list: string) => list.split(",").map((s) => parseFloat(s));

function Moving() {
  return (
    <div>
      <Button variant="primary">Save</Button>
      <Button>Cancel</Button>
      <List label="Pharmacies">
        <ListRow to="/pharmacy" data-row="">
          Corner Pharmacy
        </ListRow>
      </List>
      <Collapse open id="region">
        <p>Open until 9 pm</p>
      </Collapse>
      <Chevron open />
    </div>
  );
}

const subjects = () => ({
  save: document.querySelector("button")!,
  cancel: document.querySelectorAll("button")[1]!,
  row: document.querySelector<HTMLElement>("[data-row]")!,
  region: document.getElementById("region")!,
  chevron: document.querySelector("svg")!,
});

describe("motion", () => {
  test("buttons and link rows fade on hover with the kit's fast duration", async () => {
    await renderInRouter(<Moving />);
    const { save, cancel, row } = subjects();
    for (const el of [save, cancel, row])
      expect(seconds(getComputedStyle(el).transitionDuration)).toContain(0.12);
    expect(getComputedStyle(row).transitionProperty).toContain("background-color");
  });

  test("with reduced motion, no button, list row, Collapse or Chevron has a transition or animation", async () => {
    await devtools().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await renderInRouter(<Moving />);
    for (const [name, el] of Object.entries(subjects())) {
      const style = getComputedStyle(el);
      const longest = Math.max(...seconds(style.transitionDuration), ...seconds(style.animationDuration));
      expect({ name, longest }).toEqual({ name, longest: 0 });
    }
  });
});
