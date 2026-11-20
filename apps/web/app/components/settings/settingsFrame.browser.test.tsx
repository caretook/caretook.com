import type { DeviceRoute } from "../../../test/device";

import { useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as account from "~/routes/app/settings/account/route";
import * as settingsIndex from "~/routes/app/settings/index/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import * as timelineLayout from "~/routes/app/settings/timeline/route";
import * as units from "~/routes/app/settings/units/route";
import * as groupDetails from "~/routes/app/groups/settings/details/route";
import * as groupIndex from "~/routes/app/groups/settings/index/route";
import * as groupLayout from "~/routes/app/groups/settings/layout/route";
import * as groupMembers from "~/routes/app/groups/settings/members/route";
import { renderWithDevice } from "../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../test/fixtures";

// The settings frame's navigation, for the account's and a group's subpages
// (routing.mjs's settings steps): on phones the list is its own page and each
// subpage stands alone under a back link to it; wide, the side nav switches
// subpages with aria-current following, and a window widening on the list
// opens the first subpage in its place. Each subpage's content is
// settings.browser.test.tsx's and groupSettings.browser.test.tsx's (both open
// subpages directly, as a link or a reload does); aria-current's rule is
// settingsNav.test.ts's.

/** Back (history −1), as the browser's button does. */
let back = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => void navigate(-1);
  }, [navigate]);
  return null;
}
function LayoutWithBack() {
  const Layout = settingsLayout.default;
  return (
    <>
      <BackProbe />
      <Layout />
    </>
  );
}
function StartPage() {
  return (
    <main>
      <BackProbe />
      <h1>Start</h1>
      <Link to="/app/settings">Open settings</Link>
    </main>
  );
}

const ACCOUNT_ROUTES: DeviceRoute[] = [
  { path: "/app/start", module: { default: StartPage } },
  {
    path: "/app/settings",
    module: { ...settingsLayout, default: LayoutWithBack },
    children: [
      { path: "/app/settings", id: "settings-index", module: settingsIndex },
      { path: "/app/settings/units", module: units },
      { path: "/app/settings/timeline", module: timelineLayout },
      { path: "/app/settings/account", module: account },
    ],
  },
];
const GS = "/app/groups/:groupId/settings";
const GROUP_ROUTES: DeviceRoute[] = [
  {
    path: GS,
    module: groupLayout,
    children: [
      { path: GS, id: "group-settings-index", module: groupIndex },
      { path: `${GS}/details`, module: groupDetails },
      { path: `${GS}/members`, module: groupMembers },
    ],
  },
];

const nav = () => document.querySelector<HTMLElement>("nav[data-settings-nav]")!;
const shown = (el: Element | null | undefined) => !!el && el.getClientRects().length > 0;
const items = () =>
  [...nav().querySelectorAll("[data-settings-item]")].map((a) =>
    a.querySelector("span span")?.textContent?.trim(),
  );
const current = () =>
  [...nav().querySelectorAll("[aria-current]")].map(
    (a) => `${(a as HTMLElement).dataset.settingsItem}=${a.getAttribute("aria-current")}`,
  );
const headings = () =>
  [...document.querySelectorAll("main h1")].filter((h) => shown(h)).map((h) => h.textContent?.trim());
const backLink = (to: string, label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>("main a")].find(
    (a) => a.getAttribute("href") === to && a.textContent?.trim() === label,
  );

describe("account settings", () => {
  test("at 420: /app/settings is the list of every subpage; Units opens alone under a back link, which returns to the list", async () => {
    const device = await renderWithDevice({ route: ACCOUNT_ROUTES, url: "/app/settings" });
    expect(headings()).toEqual(["Settings"]);
    expect(items()).toEqual(["Units", "Timeline layout", "Account", "Contact details", "Devices"]);
    expect(shown(nav())).toBe(true);
    expect(shown(backLink("/app/settings", "Settings"))).toBe(false);

    await userEvent.click(nav().querySelector('[data-settings-item="units"]')!);
    await expect.poll(device.location).toBe("/app/settings/units");
    await expect.poll(headings).toEqual(["Units"]);
    expect(shown(nav())).toBe(false);
    expect(shown(backLink("/app/settings", "Settings"))).toBe(true);

    await userEvent.click(backLink("/app/settings", "Settings")!);
    await expect.poll(device.location).toBe("/app/settings");
    await expect.poll(() => shown(nav())).toBe(true);
  });

  test("at 1280: the side nav beside Units switches subpages in one click, and aria-current follows", async () => {
    const device = await renderWithDevice({ route: ACCOUNT_ROUTES, url: "/app/settings", width: 1280 });
    await expect.poll(device.location).toBe("/app/settings/units");
    await expect.poll(headings).toEqual(["Units"]);
    expect(current()).toEqual(["units=page"]);
    expect(shown(backLink("/app/settings", "Settings"))).toBe(false);

    await userEvent.click(nav().querySelector('[data-settings-item="timeline"]')!);
    await expect.poll(device.location).toBe("/app/settings/timeline");
    await expect.element(page.getByRole("radiogroup", { name: "Timeline layout" })).toBeVisible();
    expect(current()).toEqual(["timeline=page"]);
    expect(shown(nav())).toBe(true);
  });

  test("widening the window on the list opens Units in its place: Back goes to the page before the list", async () => {
    const device = await renderWithDevice({ route: ACCOUNT_ROUTES, url: "/app/start" });
    await userEvent.click(page.getByRole("link", { name: "Open settings" }));
    await expect.poll(device.location).toBe("/app/settings");
    await page.viewport(1280, 900);
    await expect.poll(device.location).toBe("/app/settings/units");
    back();
    await expect.poll(device.location).toBe("/app/start");
  });

  test("Account: the name and email, read-only", async () => {
    await renderWithDevice({ route: ACCOUNT_ROUTES, url: "/app/settings/account" });
    await expect.element(page.getByText(TEST_USER.email)).toBeVisible();
    expect(document.querySelector('main [data-field="name"]')?.textContent?.trim()).toBe(TEST_USER.name);
    expect(document.querySelector('main [data-field="email"]')?.textContent?.trim()).toBe(TEST_USER.email);
    expect(document.querySelectorAll("main input")).toHaveLength(0);
  });
});

describe("group settings", () => {
  const SETTINGS = `/app/groups/${TEST_GROUP.id}/settings`;

  test("at 420: the list of Details and Members, named Group settings; Members opens alone under a back link, which returns to the list", async () => {
    const device = await renderWithDevice({
      route: GROUP_ROUTES,
      url: SETTINGS,
      fixtures: [fx.person({ name: "Sam Okafor" })],
    });
    expect(headings()).toEqual(["Group settings"]);
    expect(nav().getAttribute("aria-label")).toBe("Group settings");
    expect(items()).toEqual(["Details", "Members"]);
    expect(shown(backLink(SETTINGS, "Group settings"))).toBe(false);

    await userEvent.click(nav().querySelector('[data-settings-item="members"]')!);
    await expect.poll(device.location).toBe(`${SETTINGS}/members`);
    await expect.poll(headings).toEqual(["Members"]);
    await expect
      .poll(() => !!document.querySelector('main [data-section="members"] li[data-member]'))
      .toBe(true);
    expect(shown(nav())).toBe(false);

    await userEvent.click(backLink(SETTINGS, "Group settings")!);
    await expect.poll(device.location).toBe(SETTINGS);
    await expect.poll(() => shown(nav())).toBe(true);
  });
});
