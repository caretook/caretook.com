import { describe, expect, test } from "vitest";

import { textContrast } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";

// The secondary-text tokens (app.css) keep WCAG AA (4.5:1) on both surfaces in
// both themes, measured from the computed colours, the translucent text
// composited over its surface.
describe("text-muted and text-faint", () => {
  test.each(["light", "dark"] as const)("clear 4.5:1 on base-200 and base-100 in %s", async (theme) => {
    await renderInRouter(
      <>
        {(["bg-base-200", "bg-base-100"] as const).map((surface) => (
          <div key={surface} className={surface} data-surface={surface}>
            <p className="text-muted">Muted</p>
            <p className="text-faint">Faint</p>
          </div>
        ))}
      </>,
      { theme },
    );
    const measured: Record<string, number> = {};
    for (const surface of ["bg-base-200", "bg-base-100"]) {
      const box = document.querySelector<HTMLElement>(`[data-surface="${surface}"]`)!;
      const bg = getComputedStyle(box).backgroundColor;
      for (const tone of ["text-muted", "text-faint"]) {
        const ratio = textContrast(box.querySelector(`.${tone}`)!, bg);
        measured[`${tone} on ${surface}`] = Math.round(ratio * 100) / 100;
        expect(ratio, `${tone} on ${surface}, ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    console.info(theme, JSON.stringify(measured));
  });

  test("faint is quieter than muted", async () => {
    await renderInRouter(
      <div className="bg-base-200">
        <p className="text-muted">Muted</p>
        <p className="text-faint">Faint</p>
      </div>,
    );
    const alpha = (c: string) => Number(/\/ ([\d.]+)\)/.exec(c)?.[1] ?? 1);
    const [muted, faint] = ["text-muted", "text-faint"].map((t) =>
      alpha(getComputedStyle(document.querySelector(`.${t}`)!).color),
    );
    expect(faint).toBeLessThan(muted!);
  });
});
