import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { Chevron } from "./index";

const turn = (el: Element) => getComputedStyle(el).rotate;

describe("Chevron", () => {
  test("open turns it a quarter (right to down), or a half when it points down closed; it is hidden from the accessibility tree", async () => {
    const { screen } = await renderInRouter(
      <div>
        <Chevron open={false} />
        <Chevron open />
        <Chevron open={false} closed="down" />
        <Chevron open closed="down" />
      </div>,
    );
    const svgs = [...document.querySelectorAll("svg")];
    expect(svgs.map(turn)).toEqual(["none", "90deg", "none", "180deg"]);
    expect(svgs.map((svg) => svg.getAttribute("aria-hidden"))).toEqual(["true", "true", "true", "true"]);
    await expect.element(screen.getByRole("img")).not.toBeInTheDocument();
  });

  test("it turns with the kit's duration (--motion, 240 ms)", async () => {
    await renderInRouter(<Chevron open={false} />);
    const style = getComputedStyle(document.querySelector("svg")!);
    expect(style.transitionProperty).toContain("rotate");
    expect(style.transitionDuration.split(",").map((s) => parseFloat(s))).toContain(0.24);
  });
});
