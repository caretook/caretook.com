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
    const [closed, open, downClosed, downOpen] = [...document.querySelectorAll("svg")];
    expect(turn(closed!)).toBe("none");
    expect(turn(open!)).toBe("90deg");
    expect(turn(downClosed!)).toBe("none");
    expect(turn(downOpen!)).toBe("180deg");
    for (const svg of [closed, open, downClosed, downOpen])
      expect(svg!.getAttribute("aria-hidden")).toBe("true");
    await expect.element(screen.getByRole("img")).not.toBeInTheDocument();
  });

  test("it turns with the kit's duration", async () => {
    await renderInRouter(<Chevron open={false} />);
    const style = getComputedStyle(document.querySelector("svg")!);
    expect(style.transitionProperty).toContain("rotate");
    expect(style.transitionDuration.split(",").map((s) => parseFloat(s))).toContain(0.18);
  });
});
