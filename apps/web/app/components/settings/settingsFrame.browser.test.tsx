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
import { found } from "../../../test/found";
import { fx, TEST_GROUP } from "../../../test/fixtures";

// The settings frame's navigation, one table for the account's and a group's
// subpages (routing.mjs's settings steps): on phones the list is its own page
// and each subpage stands alone under a back link to it; wide, the index opens
// the first subpage, the side nav switches subpages with aria-current
// following, and a window widening on the list opens the first subpage in its
// place. Each subpage's content is its own test's (settings, groupSettings,
// contact, calendar, assistants: they open subpages directly, as a link or a
// reload does, and don't test the frame again); aria-current's rule is
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

const SETTINGS = `/app/groups/${TEST_GROUP.id}/settings`;
/** Each frame: its routes, its index and heading, its subpages, and two of them to open. */
const FRAMES = [
  {
    name: "account settings",
    routes: ACCOUNT_ROUTES,
    index: "/app/settings",
    heading: "Settings",
    items: ["Units", "Timeline layout", "Account", "Contact details", "Devices", "Changes not saved"],
    first: ["units", "Units"],
    second: ["timeline", "Timeline layout"],
  },
  {
    name: "group settings",
    routes: GROUP_ROUTES,
    index: SETTINGS,
    heading: "Group settings",
    items: ["Details", "Members", "Assistants", "Calendar & reminders"],
    first: ["details", "Details"],
    second: ["members", "Members"],
  },
] as const;

describe.each(FRAMES)("$name", ({ routes, index, heading, items: subpages, first, second }) => {
  const open = (width?: number) =>
    renderWithDevice({ route: routes, url: index, width, fixtures: [fx.person({ name: "Sam Okafor" })] });

  test("at 420: the index is the list of every subpage, named by the frame; one opens alone under a back link, which returns to the list", async () => {
    const device = await open();
    await expect.poll(headings).toEqual([heading]);
    expect(nav().getAttribute("aria-label")).toBe(heading);
    expect(items()).toEqual(subpages);
    expect(shown(nav())).toBe(true);
    expect(shown(backLink(index, heading))).toBe(false);

    await userEvent.click(await found(() => nav().querySelector(`[data-settings-item="${second[0]}"]`)));
    await expect.poll(device.location).toBe(`${index}/${second[0]}`);
    await expect.poll(headings).toEqual([second[1]]);
    expect(shown(nav())).toBe(false);
    expect(shown(backLink(index, heading))).toBe(true);

    await userEvent.click(await found(() => backLink(index, heading)));
    await expect.poll(device.location).toBe(index);
    await expect.poll(() => shown(nav())).toBe(true);
  });

  test("at 1280: the index opens the first subpage beside the side nav, current, with no back link; a click switches, and aria-current follows", async () => {
    const device = await open(1280);
    await expect.poll(device.location).toBe(`${index}/${first[0]}`);
    await expect.poll(headings).toEqual([first[1]]);
    expect(current()).toEqual([`${first[0]}=page`]);
    expect(shown(backLink(index, heading))).toBe(false);

    await userEvent.click(await found(() => nav().querySelector(`[data-settings-item="${second[0]}"]`)));
    await expect.poll(device.location).toBe(`${index}/${second[0]}`);
    await expect.poll(headings).toEqual([second[1]]);
    expect(current()).toEqual([`${second[0]}=page`]);
    expect(shown(nav())).toBe(true);
    expect(shown(backLink(index, heading))).toBe(false);
  });
});

test("account settings: widening the window on the list opens Units in its place; Back goes to the page before the list", async () => {
  const device = await renderWithDevice({ route: ACCOUNT_ROUTES, url: "/app/start" });
  await userEvent.click(page.getByRole("link", { name: "Open settings" }));
  await expect.poll(device.location).toBe("/app/settings");
  await page.viewport(1280, 900);
  await expect.poll(device.location).toBe("/app/settings/units");
  back();
  await expect.poll(device.location).toBe("/app/start");
});
