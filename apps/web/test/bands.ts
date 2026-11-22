// A banded page (ui-kit's `Page bands` and its `Section`s) as a test reads it:
// each band's name in order, and whether their surfaces alternate.

import { rgba } from "./contrast";

/** The page's bands, in order. */
export const bandsOf = () => [...document.querySelectorAll<HTMLElement>("main[data-bands] > [data-band]")];

/** A band's accessible name (its heading or `aria-label`), or "(header)" for the first, untitled band. */
const nameOf = (band: HTMLElement, i: number) => {
  const labelledBy = band.getAttribute("aria-labelledby");
  const name = labelledBy
    ? document.getElementById(labelledBy)?.textContent?.trim()
    : band.getAttribute("aria-label");
  return name ?? (i === 0 ? "(header)" : "(band)");
};

/** Each band's name, in order: "(header)" first, the named regions after it, "(band)" for an untitled one. */
export const bandNames = () => bandsOf().map(nameOf);

/** The page's band surfaces alternate, starting with the page's own (`base-200`). */
export const bandsAlternate = () => {
  const colours = bandsOf().map((b) => rgba(getComputedStyle(b).backgroundColor).join());
  const [first, second] = colours;
  if (!first || first === second) return colours.length <= 1;
  return colours.every((c, i) => c === (i % 2 === 0 ? first : second));
};
