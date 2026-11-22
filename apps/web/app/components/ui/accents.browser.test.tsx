import type { Rgba } from "../../../test/contrast";

import { Heart } from "lucide-react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { ratio, rgba, surfaceOf, textContrast, textOf } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";
import { ACCENTS, accentClass, IconChip } from "./index";

const THEMES = ["light", "dark"] as const;
const STATUSES = ["bg-warning", "bg-error", "bg-success", "bg-info"] as const;

/** The OKLCH hue, in degrees, of a painted sRGB colour. */
const hueOf = ([r, g, b]: Rgba) => {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122 * lr + 0.5363 * lg + 0.0514 * lb);
  const m = Math.cbrt(0.2119 * lr + 0.6807 * lg + 0.1074 * lb);
  const s = Math.cbrt(0.0883 * lr + 0.2817 * lg + 0.63 * lb);
  const a = 1.9779985 * l - 2.428592 * m + 0.4505937 * s;
  const bb = 0.025904 * l + 0.7827717 * m - 0.808675 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
};

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const round = (n: number) => Math.round(n * 100) / 100;

describe("accent contrast", () => {
  test.each(THEMES)("text and icons stay readable in %s", async (theme) => {
    await renderInRouter(
      <>
        {ACCENTS.map((accent) => (
          <div key={accent} data-accent={accent}>
            <p data-on="tint" className={accentClass(accent, "soft")}>
              Tint
            </p>
            <div className="bg-base-100">
              <p data-on="card" className={accentClass(accent, "text")}>
                Card
              </p>
            </div>
            <div className="bg-base-200">
              <p data-on="page" className={accentClass(accent, "text")}>
                Page
              </p>
            </div>
            <span data-chip="solid">
              <IconChip icon={Heart} accent={accent} look="solid" />
            </span>
            <span data-chip="soft">
              <IconChip icon={Heart} accent={accent} look="soft" />
            </span>
          </div>
        ))}
      </>,
      { theme },
    );
    const measured: Record<string, number> = {};
    for (const accent of ACCENTS) {
      const box = document.querySelector(`[data-accent="${accent}"]`)!;
      for (const on of ["tint", "card", "page"]) {
        const value = textContrast(box.querySelector(`[data-on="${on}"]`)!);
        measured[`${accent} text on ${on}`] = round(value);
        expect(value, `${accent} text on ${on}, ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const look of ["solid", "soft"]) {
        const chip = box.querySelector(`[data-chip="${look}"] [data-icon-chip]`)!;
        const value = ratio(textOf(chip), surfaceOf(chip));
        measured[`${accent} icon on ${look}`] = round(value);
        expect(value, `${accent} icon on ${look}, ${theme}`).toBeGreaterThanOrEqual(3);
      }
    }
    console.info(theme, JSON.stringify(measured));
  });
});

describe("accents stay apart from the status colours", () => {
  test.each(THEMES)("every solid is another colour, 20 degrees of hue away, in %s", async (theme) => {
    await renderInRouter(
      <>
        {ACCENTS.map((accent) => (
          <span key={accent} data-solid={accent} className={accentClass(accent, "solid")} />
        ))}
        {STATUSES.map((status) => (
          <span key={status} data-status={status} className={status} />
        ))}
      </>,
      { theme },
    );
    const paint = (el: Element) => rgba(getComputedStyle(el).backgroundColor);
    const gaps: Record<string, number> = {};
    for (const accent of ACCENTS) {
      const solid = paint(document.querySelector(`[data-solid="${accent}"]`)!);
      for (const status of STATUSES) {
        const other = paint(document.querySelector(`[data-status="${status}"]`)!);
        expect(solid, `${accent} against ${status}`).not.toEqual(other);
        const gap = hueGap(hueOf(solid), hueOf(other));
        gaps[`${accent}/${status}`] = Math.round(gap);
        expect(gap, `${accent} against ${status}, ${theme}`).toBeGreaterThanOrEqual(20);
      }
    }
    console.info(theme, JSON.stringify(gaps));
  });
});

describe("IconChip", () => {
  test("is decorative by default and named when given a label", async () => {
    await renderInRouter(
      <>
        <IconChip icon={Heart} accent="pink" />
        <IconChip icon={Heart} accent="pink" label="Symptom" />
      </>,
    );
    await expect.element(page.getByRole("img", { name: "Symptom" })).toBeVisible();
    expect(page.getByRole("img").all()).toHaveLength(1);
    expect(document.querySelector("[data-icon-chip]")?.getAttribute("aria-hidden")).toBe("true");
  });

  test.each([
    ["sm", 24],
    ["md", 32],
    ["lg", 48],
  ] as const)("size %s is %ipx in both shapes", async (size, px) => {
    await renderInRouter(
      <>
        <IconChip icon={Heart} size={size} shape="round" />
        <IconChip icon={Heart} size={size} shape="rounded" />
      </>,
    );
    const [round, rounded] = [...document.querySelectorAll<HTMLElement>("[data-icon-chip]")];
    for (const chip of [round!, rounded!]) {
      expect(chip.getBoundingClientRect().width).toBe(px);
      expect(chip.querySelector("svg")).not.toBeNull();
    }
    expect(getComputedStyle(round!).borderTopLeftRadius).not.toBe(
      getComputedStyle(rounded!).borderTopLeftRadius,
    );
  });
});
