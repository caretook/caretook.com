import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVATAR_COLORS } from "../../../../../packages/data/src/db/schema/app-shell/avatar";

// The avatar color tokens, read from the stylesheet: readable in both themes,
// and never close to a status or section color.

const css = readFileSync(new URL("../../app.css", import.meta.url), "utf8");

type Oklch = { l: number; c: number; h: number };

const OKLCH = String.raw`oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)`;

const token = (name: string): { light: Oklch; dark: Oklch } => {
  const match = new RegExp(String.raw`--color-${name}: light-dark\(${OKLCH}, ${OKLCH}\);`).exec(css);
  if (!match) throw new Error(`no token --color-${name}`);
  const [, l1, c1, h1, l2, c2, h2] = match.map(Number);
  return {
    light: { l: l1! / 100, c: c1!, h: h1! },
    dark: { l: l2! / 100, c: c2!, h: h2! },
  };
};

/** Relative luminance, with out-of-gamut channels clipped as a browser shows them. */
const luminance = ({ l, c, h }: Oklch) => {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  const r = clip(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S);
  const g = clip(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S);
  const blue = clip(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S);
  return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
};

const contrast = (x: Oklch, y: Oklch) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi! + 0.05) / (lo! + 0.05);
};

const hueDistance = (x: number, y: number) => {
  const d = Math.abs(x - y) % 360;
  return Math.min(d, 360 - d);
};

/** error, warning, success and info (app.css's accents comment). */
const STATUS_HUES = [13, 84, 163, 233];
const SECTION_HUES = ["indigo", "teal", "orange", "lime", "plum", "pink"].map(
  (hue) => token(`hue-${hue}`).light.h,
);
/** The narrowest gap (pink 345 to error 13) halves to 14. */
const MIN_HUE_DISTANCE = 14;

describe.each(AVATAR_COLORS)("the avatar color %s", (color) => {
  const { light, dark } = token(`avatar-${color}`);
  const content = token("avatar-content");

  it("reaches 4.5:1 against its content color in both themes", () => {
    expect(contrast(light, content.light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark, content.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps its distance from every status and section hue", () => {
    expect(dark.h).toBe(light.h);
    for (const hue of [...STATUS_HUES, ...SECTION_HUES])
      expect(hueDistance(light.h, hue)).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE);
  });
});
