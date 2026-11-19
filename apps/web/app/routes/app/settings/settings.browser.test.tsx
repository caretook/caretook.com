import type { DeviceRoute } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as account from "./account/route";
import * as settingsIndex from "./index/route";
import * as settingsLayout from "./layout/route";
import * as timelineLayout from "./timeline/route";
import * as units from "./units/route";
import { renderWithDevice } from "../../../../test/device";
import { TEST_USER } from "../../../../test/fixtures";

// Account settings (ui.mjs's settings steps): the frame by width, Units and
// Timeline layout as named radiogroups that the arrow keys move, and Account.
// Saving offline and across devices is settings-layout.mjs's and
// layout-offline.mjs's.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [
      { path: "/app/settings", id: "settings-index", module: settingsIndex },
      { path: "/app/settings/units", module: units },
      { path: "/app/settings/timeline", module: timelineLayout },
      { path: "/app/settings/account", module: account },
    ],
  },
];

const open = (url: string, width?: number) => renderWithDevice({ route: ROUTES, url, width });

/** The frame: at 420 a back link and no side nav; from 768 the side nav with this page current. */
const frameAt = (width: number, page: string) => {
  const nav = document.querySelector<HTMLElement>("nav[data-settings-nav]");
  const current = nav?.querySelector('a[aria-current="page"]')?.getAttribute("href");
  const back = [...document.querySelectorAll<HTMLAnchorElement>("main a")].some(
    (a) => a.getAttribute("href") === "/app/settings" && a.offsetParent,
  );
  expect(current).toBe(`/app/settings/${page}`);
  if (width < 768) {
    expect(back).toBe(true);
    expect(nav?.offsetParent ?? null).toBeNull();
  } else {
    expect(back).toBe(false);
    expect(nav?.offsetParent).not.toBeNull();
  }
};

describe.each([420, 1280])("at %i", (width) => {
  test("Units: four named choices, one unit chosen in each; an arrow key moves the choice", async () => {
    await open("/app/settings/units", width);
    await expect.element(page.getByRole("heading", { name: "Units", level: 1 })).toBeVisible();
    const names = ["Temperature", "Weight", "Blood sugar", "Fluid volume"];
    expect(page.getByRole("radiogroup").elements()).toHaveLength(names.length);
    for (const name of names)
      expect(
        page.getByRole("radiogroup", { name }).getByRole("radio", { checked: true }).elements(),
      ).toHaveLength(1);
    frameAt(width, "units");

    const temperature = page.getByRole("radiogroup", { name: "Temperature" }).getByRole("radio");
    const radios = temperature.elements() as HTMLInputElement[];
    const before = radios.findIndex((r) => r.checked);
    radios[before]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    const after = radios.findIndex((r) => r.checked);
    expect(after).not.toBe(before);
    expect(after).toBeGreaterThanOrEqual(0);
  });

  test("Timeline layout: one choice, named by the page's heading: Rows or Cards", async () => {
    await open("/app/settings/timeline", width);
    const group = page.getByRole("radiogroup", { name: "Timeline layout" });
    await expect.element(group).toBeVisible();
    expect(
      group
        .getByRole("radio")
        .elements()
        .map((r) => r.getAttribute("aria-label")),
    ).toEqual(["Rows", "Cards"]);
    expect(page.getByRole("radiogroup").elements()).toHaveLength(1);
    frameAt(width, "timeline");
  });

  test("Account: the email, read-only, and Sign out (a POST to /sign-out)", async () => {
    await open("/app/settings/account", width);
    await expect.element(page.getByText(TEST_USER.email)).toBeVisible();
    expect(document.querySelector('main [data-field="email"]')?.textContent?.trim()).toBe(TEST_USER.email);
    const signOut = page.getByRole("button", { name: "Sign out" }).element();
    const form = signOut.closest("form")!;
    expect(form.getAttribute("action")).toBe("/sign-out");
    expect(form.getAttribute("method")).toBe("post");
    frameAt(width, "account");
  });
});

test("at 1280, /app/settings opens the first subpage (Units)", async () => {
  const device = await open("/app/settings", 1280);
  await expect.poll(device.location).toBe("/app/settings/units");
});
