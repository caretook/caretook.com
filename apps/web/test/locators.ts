import { locators, page } from "vitest/browser";
import type { Locator } from "vitest/browser";

// A CSS selector as a Vitest locator: `page.getByCss(…)` and `locator.getByCss(…)` once this module
// loads (test/setup.ts imports it, so every component test has them).
locators.extend({
  getByCss(selector: string) {
    return `css=${selector}`;
  },
});

declare module "vitest/browser" {
  interface LocatorSelectors {
    /** A retrying locator for a CSS selector; prefer `getByCss` from `test/locators.ts`. */
    getByCss(selector: string): Locator;
  }
}

/**
 * A retrying locator for a CSS selector, for the `data-` hooks a role or a name can't reach:
 *
 *   await userEvent.click(getByCss("[data-add-time]", { within: device.screen.getByRole("form") }));
 *   await expect.element(getByCss("[data-day='2027-06-09']")).toBeVisible();
 *
 * Unlike `querySelector`, it reads the page when it's used, and `expect.element` and `userEvent`
 * retry it until the element is there, so it can't be read too early. Strict, as Vitest's locators
 * are: several matches are an error; narrow it with `.first()`, `.nth(i)`, or take `.all()`.
 * `within` scopes it to a locator or an element (the whole page by default).
 */
export function getByCss(selector: string, { within }: { within?: Locator | Element } = {}): Locator {
  if (within === undefined) return page.getByCss(selector);
  const scope = within instanceof Element ? page.elementLocator(within) : within;
  return scope.getByCss(selector);
}
