import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderWithDevice } from "../../../../test/device";
import { GALLERY } from "./registry";
import * as gallery from "./route";

// /dev/ui on the test device: its loader is the server gate (unit-tested in
// .server/devUi.test.ts), so the route gets its (empty) loader data.

const open = () =>
  renderWithDevice({
    route: { path: "/dev/ui", module: gallery, loaderData: null },
    url: "/dev/ui",
    role: null,
  });

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("the UI gallery", () => {
  test("shows one named section per registry entry, in order", async () => {
    const { screen } = await open();
    await expect.element(screen.getByRole("heading", { level: 1, name: "UI gallery" })).toBeVisible();
    for (const { title } of GALLERY) {
      await expect.element(screen.getByRole("region", { name: title, exact: true })).toBeInTheDocument();
    }
    const ids = [...document.querySelectorAll<HTMLElement>("[data-gallery-section]")].map(
      (s) => s.dataset.gallerySection,
    );
    expect(ids).toEqual(GALLERY.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the theme switch sets the page's theme, and leaving puts it back", async () => {
    const { screen } = await open();
    const body = () => getComputedStyle(document.body).backgroundColor;
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    const light = body();
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await expect.poll(body).not.toBe(light);
    await screen.unmount();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  test("the Motion section shows a menu, a popover, a dialog and a toast", async () => {
    const { screen } = await open();
    const motion = screen.getByRole("region", { name: "Motion", exact: true });
    await userEvent.click(motion.getByRole("button", { name: "Note actions" }));
    await expect.element(screen.getByRole("menuitem", { name: "Delete…" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(motion.getByRole("button", { name: "About doses" }));
    await expect.element(screen.getByRole("dialog", { name: "About doses" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(motion.getByRole("button", { name: "Dialog" }));
    await expect.element(screen.getByRole("dialog", { name: "Delete this note?" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(motion.getByRole("button", { name: "Toast" }));
    await expect.element(page.getByRole("alertdialog", { name: "Added Ibuprofen" })).toBeVisible();
  });
});
