import { describe, expect, test } from "vitest";
import { openMarketing, scrollsSideways } from "../marketingWorld";

// The legal pages on one device, moved down from marketing.spec.mjs: at both
// widths one h1, the DRAFT banner, a last-updated date, a contents entry per
// section and no sideways scroll. What each page's content holds is
// legal.test.ts's; a contents link and a heading's anchor landing below the
// sticky header after hydration stay in the browser check.

describe.each(["/privacy", "/terms", "/health-data-privacy"])("%s", (path) => {
  test.each([420, 1280])("at %i: one h1, DRAFT, a date, contents, no sideways scroll", async (width) => {
    const { screen } = await openMarketing(path, { width });
    await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    await expect.element(screen.getByRole("note")).toBeVisible();
    expect(screen.getByRole("note").element().textContent).toMatch(/DRAFT/);
    expect(document.querySelector("[data-last-updated] time")?.getAttribute("datetime")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    const sections = document.querySelectorAll("[data-anchor]").length;
    expect(sections).toBeGreaterThanOrEqual(4);
    expect(
      document.querySelectorAll('nav[aria-labelledby="toc-heading"] a'),
      "a contents entry per section",
    ).toHaveLength(sections);
    expect(scrollsSideways(), "no horizontal scroll").toBe(false);
  });
});
