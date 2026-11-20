// The UI primitives on a real check build: the production CSS (Tailwind and
// daisyUI as built), React Aria's styles under the CSP, and real mouse clicks
// and keys. One pass at a phone's width in dark and one at a desktop's in
// light: the user menu (a click opens it named, on a dark or light surface;
// Escape closes it and focus returns), the add sheet (full screen at 420,
// centred at 1280; Escape returns focus to the + button) and the calendar
// inside it (Escape closes only the calendar).
//
// Everything else is in component tests, which run the same screens in
// Chromium against the test device: every menu, sheet, popover, confirm, chip
// group, field, tooltip and the date field's fit
// (components/ui/inScreens.browser.test.tsx, components/ui/primitives.browser.test.tsx),
// and account and group settings (routes/app/settings/settings.browser.test.tsx,
// routes/app/groups/settings/groupSettings.browser.test.tsx).
import { DEV_FAMILY_TIMELINE, addButton, addToTimeline, expect, signIn, test, waitFor } from "./fixtures.mjs";

/** Lightness (0–1) of the first opaque background at or above `el`: oklch from daisyUI 5, or rgb. */
const lightness = (el) => {
  for (; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (!bg || bg === "transparent" || /rgba\(.*, 0\)$/.test(bg)) continue;
    const ok = bg.match(/oklch\(([\d.]+)(%?)/);
    if (ok) return ok[2] ? Number(ok[1]) / 100 : Number(ok[1]);
    const rgb = bg.match(/rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)/);
    if (rgb) return (0.2126 * rgb[1] + 0.7152 * rgb[2] + 0.0722 * rgb[3]) / 255;
    return null;
  }
  return null;
};
const themed = (l, scheme) => l !== null && (scheme === "dark" ? l < 0.45 : l > 0.75);

for (const [width, scheme, tag] of [
  [420, "dark", "@smoke"],
  [1280, "light", undefined],
]) {
  test(`${width} ${scheme}`, tag ? { tag } : {}, async ({ device }) => {
    const { page, errors } = await device("ui", { viewport: { width, height: 900 }, colorScheme: scheme });
    await signIn(page, "member@example.com");
    await page.goto(DEV_FAMILY_TIMELINE);
    const user = page.locator('header [data-region="user"] button[aria-label^="Account menu for"]');
    const add = addButton(page);
    await expect(page.locator("main ol > li").first()).toBeVisible({ timeout: 45_000 });
    await expect(user).toBeVisible();
    await expect(add).toBeVisible();

    const menu = page.getByRole("menu");
    await test.step(`user menu: a click opens it, named, on a ${scheme} surface`, async () => {
      await user.click();
      await expect(menu).toHaveAttribute("aria-label", "Account");
      expect.soft(themed(await menu.evaluate(lightness), scheme), "the menu's surface").toBe(true);
    });
    await test.step("user menu: Escape closes it, and focus returns", async () => {
      // Escape goes to the focused element: wait until the open menu has it.
      await waitFor(page, () => document.activeElement?.closest('[role="menu"]'), { timeout: 5000 });
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(user).toBeFocused();
    });

    const dialogs = page.locator('[role="dialog"], dialog[open]');
    const pick = page.locator('[role="dialog"] [aria-label="Pick a date"]');
    await test.step(`add sheet: ${width < 640 ? "the full screen" : "a centred dialog"}, on a ${scheme} surface`, async () => {
      await addToTimeline(page, "Symptom");
      await expect(dialogs).toHaveCount(1, { timeout: 15_000 });
      await expect(pick).toBeVisible();
      const g = await dialogs.first().evaluate(async (start) => {
        let el = start;
        while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
        await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
        const r = el.getBoundingClientRect();
        const o = el.parentElement.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          left: Math.round(r.left - o.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
          bottom: r.bottom,
          vw: Math.round(o.width),
          vh: innerHeight,
        };
      });
      expect
        .soft(themed(await dialogs.first().evaluate(lightness), scheme), "the sheet's surface")
        .toBe(true);
      if (width < 640) expect.soft(g).toMatchObject({ top: 0, left: 0, width: g.vw, height: g.vh });
      else {
        expect.soft(g.bottom, JSON.stringify(g)).toBeLessThan(g.vh);
        expect.soft(Math.abs(g.left * 2 + g.width - g.vw), JSON.stringify(g)).toBeLessThanOrEqual(2);
      }
    });
    await test.step("sheet calendar: opens, and Escape closes only it", async () => {
      await pick.click();
      const grid = page.getByRole("grid");
      await expect(grid).toBeVisible({ timeout: 5000 });
      await waitFor(page, () => document.activeElement?.closest('[role="dialog"]'), { timeout: 5000 });
      await page.keyboard.press("Escape");
      await expect(grid).toHaveCount(0);
      await expect(dialogs).toHaveCount(1);
    });
    await test.step("add sheet: Escape closes it, and focus returns to the + button", async () => {
      await waitFor(page, () => document.activeElement?.closest('[role="dialog"]'), { timeout: 5000 });
      await page.keyboard.press("Escape");
      await expect(dialogs).toHaveCount(0);
      await expect(add).toBeFocused();
    });

    expect(errors.filter((e) => e.includes("exception]"))).toEqual([]);
  });
}
