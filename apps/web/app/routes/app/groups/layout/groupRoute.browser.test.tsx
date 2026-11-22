import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as entry from "~/routes/app/groups/entry/route";
import * as groupIndex from "~/routes/app/groups/index/route";
import * as home from "~/routes/app/home/route";
import * as settingsIndex from "~/routes/app/groups/settings/index/route";
import * as settingsLayout from "~/routes/app/groups/settings/layout/route";
import * as members from "~/routes/app/groups/settings/members/route";
import * as timeline from "~/routes/app/groups/timeline/route";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../../../test/fixtures";

// The group route (routing.mjs's group-route steps): `/app/groups/<id>` on
// its own opens the timeline, the group context is live (a recipient renamed
// or a role changed on another device shows without a reload; removed, the
// screen goes to /app saying so), and a group that isn't yours is the /app 404 for every screen under it, naming nothing.
// Opening an entry or group settings under the group route is entry's and
// groupSettings' tests; a role change reaching a second device for real is
// app-shell.mjs's.

const G = `/app/groups/${TEST_GROUP.id}`;
const SETTINGS = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: "/app", id: "home", module: home },
  { path: "/app/groups/:groupId", id: "group-index", module: groupIndex },
  { path: "/app/groups/:groupId/timeline", module: timeline },
  { path: "/app/groups/:groupId/entries/:entryId", module: entry },
  {
    path: SETTINGS,
    module: settingsLayout,
    children: [
      { path: SETTINGS, id: "group-settings-index", module: settingsIndex },
      { path: `${SETTINGS}/members`, module: members },
    ],
  },
];

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
const NOTE = fx.note({ title: "Morning walk", text: "Walked to the corner and back." });

const heading = () => document.querySelector("h1")?.textContent?.trim();
/** The header's group menu, which names the recipient (the timeline's heading is "Timeline"). */
const groupButton = () =>
  document.querySelector<HTMLElement>('header [aria-label$="switch care group"]')?.textContent?.trim();
const TITLE = () => document.querySelector<HTMLInputElement>("main header input");
const EDITOR = () => document.querySelector(".ProseMirror");
/** Whether anything in main names the group, its recipient or its members. */
const leaks = () =>
  /June|Moreno|Sam Okafor|Morning walk|Walked/.test(document.querySelector("main")?.textContent ?? "");

const myMembership = async (device: Awaited<ReturnType<typeof renderWithDevice>>) => {
  const [mine] = await device.query<{ id: string }>("SELECT id FROM care_group_member WHERE user_id = ?", [
    TEST_USER.id,
  ]);
  return mine!.id;
};

describe("the group route", () => {
  test("/app/groups/<id> on its own opens the group's timeline", async () => {
    const device = await renderWithDevice({ route: ROUTES, url: G, fixtures: [fx.symptom()] });
    await expect.poll(device.location).toBe(`${G}/timeline`);
    await expect.poll(heading).toBe("Timeline");
  });

  test("a recipient renamed on another device shows in the group menu without a reload", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: `${G}/timeline`,
      fixtures: [fx.symptom()],
      frame: true,
    });
    await expect.poll(groupButton).toBe(TEST_RECIPIENT.preferredName);
    const list = document.querySelector("main ol");
    await device.sync(fx.recipient({ preferredName: "Nana June" }));
    await device.settle();
    await expect.poll(groupButton).toBe("Nana June");
    // The same screen, not a new one.
    expect(list?.isConnected).toBe(true);
  });

  test("a role changed to viewer on another device makes the entry read-only without a reload; caretaker again brings the controls back", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: `${G}/entries/${NOTE.id}`,
      role: "caretaker",
      fixtures: [SAM, NOTE],
    });
    await expect.poll(() => EDITOR()?.getAttribute("contenteditable"), { timeout: 10_000 }).toBe("true");
    expect(TITLE()).not.toBeNull();
    const main = document.querySelector("main");
    const id = await myMembership(device);

    await device.sync(fx.member({ id, userId: TEST_USER.id, role: "viewer" }));
    await device.settle();
    await expect.poll(() => EDITOR()?.getAttribute("contenteditable")).toBe("false");
    expect(TITLE()).toBeNull();

    await device.sync(fx.member({ id, userId: TEST_USER.id, role: "caretaker" }));
    await device.settle();
    await expect.poll(() => !!TITLE()).toBe(true);
    await expect.poll(() => EDITOR()?.getAttribute("contenteditable")).toBe("true");
    expect(main?.isConnected).toBe(true);
    expect(device.location()).toBe(`${G}/entries/${NOTE.id}`);
  });
  test("a role lowered then the membership removed never brings the first role's controls back, and lands on /app saying so", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: `${G}/entries/${NOTE.id}`,
      role: "caretaker",
      fixtures: [SAM, NOTE],
    });
    await expect.poll(() => EDITOR()?.getAttribute("contenteditable"), { timeout: 10_000 }).toBe("true");
    const id = await myMembership(device);

    await device.sync(fx.member({ id, userId: TEST_USER.id, role: "viewer" }));
    await device.settle();
    await expect.poll(() => EDITOR()?.getAttribute("contenteditable")).toBe("false");
    expect(TITLE()).toBeNull();

    // From here on, the caretaker's title field never shows again (B-315).
    let controlsBack = false;
    const watch = new MutationObserver(() => {
      if (TITLE() || EDITOR()?.getAttribute("contenteditable") === "true") controlsBack = true;
    });
    watch.observe(document.body, { childList: true, subtree: true, attributes: true });

    await device.unsync([{ table: "care_group_member", id }]);
    await device.settle();
    await expect.poll(device.location).toBe("/app?groups=1");
    watch.disconnect();
    expect(controlsBack).toBe(false);
    await expect
      .element(page.getByRole("status").filter({ hasText: "You no longer have access to that care group." }))
      .toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1, name: "Your care groups" })).toBeVisible();
    expect(leaks()).toBe(false);
  });
});

describe("a group that isn't yours", () => {
  // Not a member (the group's rows are on the device, the membership isn't),
  // and a group that was never on the device: each URL under the group route
  // is the /app 404, with nothing about the group, and a way back to /app.
  test.each([
    ["the group", ""],
    ["an entry", `/entries/${NOTE.id}`],
    ["group settings' Members", "/settings/members"],
  ])("a non-member: %s is Not found, naming nothing, with a way back", async (_, sub) => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: `${G}${sub}`,
      role: null,
      fixtures: [SAM, NOTE],
    });
    await expect.element(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    expect(device.location()).toBe(`${G}${sub}`);
    expect(leaks()).toBe(false);
    expect(page.getByRole("link", { name: "Back to Caretook" }).element().getAttribute("href")).toBe("/app");
  });

  test("another group's settings (never on this device) is Not found, naming nothing", async () => {
    const other = "/app/groups/0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001/settings/members";
    const device = await renderWithDevice({ route: ROUTES, url: other, fixtures: [SAM] });
    await expect.element(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    expect(device.location()).toBe(other);
    expect(leaks()).toBe(false);
  });
});
