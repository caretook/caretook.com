import type { DeviceRoute } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found } from "../../../../test/found";
import { renderWithDevice } from "../../../../test/device";
import { at, fx, TEST_GROUP, TEST_USER } from "../../../../test/fixtures";
import {
  HOME_NOW,
  HOSPITAL,
  PERIOD_ROUTES,
  PERIODS_URL,
  periodUrl,
  track,
  waitUntil,
} from "../groups/periods/periodWorld";

// The group menu's care period (care-periods.mjs's group menu steps): the
// current period's icon after the recipient's name on the group's screens at
// 420 and 1280, its name in the button's accessible name and as the icon's
// hover hint; the open menu's "Now: … · day N" and "Care periods"; and
// switching to a group without periods, a period arriving there, and back.
// The real /app frame (`frame: true`) around the periods pages and a
// stand-in timeline. The rest of the menu is frame.browser.test.tsx's.

const timelineUrl = (groupId: string) => `/app/groups/${groupId}/timeline`;
const ROUTES: DeviceRoute[] = [
  ...PERIOD_ROUTES,
  {
    path: "/app/groups/:groupId/timeline",
    module: {
      default: () => (
        <main>
          <h1>Timeline</h1>
        </main>
      ),
    },
  },
];

/** A second group the user owns, with no periods: Grandpa Lou's. */
const LOU = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b02", recipient: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c02" };
const louGroup = [
  fx.group({ id: LOU.id, name: "Moreno Family 2" }),
  fx.recipient({ id: LOU.recipient, groupId: LOU.id, name: "Lou Moreno", preferredName: "Grandpa Lou" }),
  fx.member({ userId: TEST_USER.id, groupId: LOU.id, role: "owner" }),
];

const open = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: timelineUrl(TEST_GROUP.id),
    frame: true,
    fixtures: [...track(), louGroup],
    ...options,
  });

const groupButton = () =>
  document.querySelector<HTMLButtonElement>('header button[aria-label$="switch care group"]');
const menuState = () => {
  const b = groupButton();
  const icon = b?.querySelector<HTMLElement>("[data-period-icon]");
  return {
    label: b?.getAttribute("aria-label") ?? null,
    type: icon?.dataset.periodIcon ?? null,
    hint: icon?.getAttribute("title") ?? null,
    visible: !!icon && icon.getBoundingClientRect().width > 0,
  };
};
const HOME_STATE = {
  label: "Grandma June, Home: switch care group",
  type: "home",
  hint: "Home",
  visible: true,
};
const openMenu = async () => {
  await userEvent.click(groupButton()!);
  await expect.element(page.getByRole("menu")).toBeVisible();
};
const items = () =>
  [...document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] [role="menuitemradio"]')].map(
    (el) => el.textContent?.trim() ?? "",
  );

describe("the group menu's care period", () => {
  test.each([420, 1280])(
    "at %i: the current period's icon on the timeline, the periods page and a period's page, named in the button's label and as its hint",
    async (width) => {
      const device = await open({ width });
      await waitUntil(() => menuState().type !== null, 4000, "the icon");
      expect(menuState(), "the timeline").toEqual(HOME_STATE);

      await openMenu();
      await userEvent.click(page.getByRole("menuitem", { name: "Care periods" }));
      await expect.poll(device.location).toBe(PERIODS_URL);
      await waitUntil(() => !!document.querySelector("main [data-period-list]"), 4000, "the list");
      expect(menuState(), "the periods page").toEqual(HOME_STATE);

      await userEvent.click(
        await found(() => document.querySelector(`main [data-period="${HOSPITAL.id}"] a`)),
      );
      await waitUntil(
        () => !!document.querySelector(`main[data-period-page="${HOSPITAL.id}"]`),
        4000,
        "the page",
      );
      expect(menuState(), "a period's page").toEqual(HOME_STATE);
    },
  );

  test('the open menu has "Now: … · day N" first after the groups, then the profile, Group settings and Care periods; Now opens the current period', async () => {
    const device = await open();
    await waitUntil(() => menuState().type !== null, 4000, "the icon");
    await openMenu();
    const list = items();
    const i = list.findIndex((t) => t.startsWith("Now: "));
    expect(list[i]).toMatch(/^Now: At home · day \d+$/);
    expect(list.slice(i + 1, i + 4)).toEqual(["Grandma June's profile", "Group settings", "Care periods"]);
    // Only the groups come before it.
    expect(i).toBe(2);
    await userEvent.click(page.getByRole("menuitem", { name: /^Now: / }));
    await expect.poll(device.location).toBe(periodUrl(HOME_NOW.id));
    await waitUntil(() => !!document.querySelector("main[data-period-page]"), 4000, "the period page");
  });

  test("a group without periods has no icon and no Now item (Care periods stays); a period arriving there shows without a reload; switching back shows the first group's own", async () => {
    const device = await open();
    await waitUntil(() => menuState().type !== null, 4000, "the icon");
    await openMenu();
    await userEvent.click(page.getByRole("menuitemradio", { name: /Grandpa Lou/ }));
    await expect.poll(device.location).toBe(timelineUrl(LOU.id));
    await waitUntil(() => !!menuState().label?.startsWith("Grandpa Lou"), 4000, "Grandpa Lou's menu");
    await device.settle();
    expect(menuState()).toMatchObject({ label: "Grandpa Lou: switch care group", type: null });
    await openMenu();
    expect(items().some((t) => t.startsWith("Now: "))).toBe(false);
    expect(items()).toContain("Care periods");
    await userEvent.keyboard("{Escape}");

    // Another device adds one there.
    await device.sync(
      fx.period({
        groupId: LOU.id,
        recipientId: LOU.recipient,
        type: "rehab",
        startedAt: at(new Date(Date.now() - 60_000)),
      }),
    );
    await device.settle();
    expect(menuState()).toMatchObject({ label: "Grandpa Lou, Rehab: switch care group", type: "rehab" });
    await openMenu();
    expect(items()).toContain("Now: In rehab · day 1");

    await userEvent.click(page.getByRole("menuitemradio", { name: /Grandma June/ }));
    await expect.poll(device.location).toBe(timelineUrl(TEST_GROUP.id));
    await waitUntil(() => menuState().type === "home", 4000, "the first group's icon");
    expect(menuState()).toEqual(HOME_STATE);
  });
});
