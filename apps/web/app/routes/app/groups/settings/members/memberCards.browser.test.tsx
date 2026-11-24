import type { DeviceRoute } from "../../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as groupSettingsLayout from "../layout/route";
import * as members from "./route";
import { apiCalls } from "../../../../../../test/api";
import { renderWithDevice } from "../../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../../test/fixtures";
import { found } from "../../../../../../test/found";

// The member cards on the Members page (B-678): a long name and history line
// wrap at phone and desktop widths rather than cut, the role and actions sit
// below the identity on a phone and beside it where there's room, and the
// controls still work on the new card.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: groupSettingsLayout, children: [{ path: `${BASE}/members`, module: members }] },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const LONG_NAME = "Maximiliana Josephine Featherstonehaugh-Abernathy";
const INVITER = fx.user({
  id: "3b6f0d2a-9c41-4e7a-b5d8-1f2e3a4b5c01",
  name: "Bartholomew Montgomery Fitzwilliam",
});
const LONG = fx.user({ id: "3b6f0d2a-9c41-4e7a-b5d8-1f2e3a4b5c02", name: LONG_NAME });
const LONG_MEMBERSHIP = "3b6f0d2a-9c41-4e7a-b5d8-1f2e3a4b5c12";
const longMember = fx.member({
  id: LONG_MEMBERSHIP,
  userId: LONG.id,
  role: "caretaker",
  invitedBy: INVITER.id,
  relationship: "Grand-niece, visits on weekends from out of town",
});
const SAM = fx.person({ id: "3b6f0d2a-9c41-4e7a-b5d8-1f2e3a4b5c03", name: "Sam Okafor", role: "viewer" });

const ONLINE = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
  "invite.listForGroup": () => [],
  "invite.listLinks": () => [],
  "joinRequest.list": () => [],
  "me.contact": () => ({
    phones: [{ label: "Mobile", number: "(555) 010-1942" }],
    contactEmail: null,
    address: null,
  }),
};

const open = (width: number, api: Record<string, (input: unknown) => unknown> = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: MEMBERS,
    role: "owner",
    width,
    fixtures: [INVITER, LONG, longMember, SAM],
    api: { ...ONLINE, ...api },
  });

const card = (userId: string) =>
  found(() => document.querySelector<HTMLElement>(`main li[data-member="${userId}"]`));
const ready = () => expect.poll(() => document.querySelectorAll("main li[data-member]").length).toBe(3);
/** Laid out whole: nothing hidden past its edge. */
const whole = (el: Element) => el.scrollWidth <= el.clientWidth;

describe.each([
  ["a phone", 360],
  ["a desktop", 1280],
])("on %s", (_, width) => {
  test("a long name, relationship and history line show in full", async () => {
    await open(width);
    await ready();
    const row = await card(LONG.id);
    const name = await found(() => row.querySelector("p"));
    const history = await found(() => row.querySelector("[data-member-history]"));
    const relationship = await found(() => row.querySelector("[data-member-relationship]"));
    expect(name.textContent).toBe(LONG_NAME);
    expect(history.textContent).toMatch(/^Invited by Bartholomew Montgomery Fitzwilliam · Joined /);
    for (const el of [name, history, relationship]) {
      expect(whole(el)).toBe(true);
      expect(getComputedStyle(el).textOverflow).not.toBe("ellipsis");
    }
    expect(whole(row)).toBe(true);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});

const below = (row: HTMLElement) =>
  row.querySelector("[data-member-controls]")!.getBoundingClientRect().top >=
  row.querySelector("[data-member-history]")!.getBoundingClientRect().bottom;

test("on a phone the role and Remove sit below the identity", async () => {
  await open(360);
  await ready();
  expect(below(await card(LONG.id))).toBe(true);
});

test("on a desktop they sit to the identity's right", async () => {
  await open(1280);
  await ready();
  const row = await card(LONG.id);
  expect(below(row)).toBe(false);
  const controls = row.querySelector("[data-member-controls]")!.getBoundingClientRect();
  expect(controls.left).toBeGreaterThan(row.querySelector("p")!.getBoundingClientRect().right - 1);
});

test("on the new card: role change, Remove, your own sharing form opens and saves, and Leave", async () => {
  const calls = apiCalls();
  await open(
    360,
    calls.record({
      "careGroup.changeRole": () => null,
      "careGroup.removeMember": () => null,
      "careGroup.updateMySharing": () => ({}),
    }),
  );
  await ready();

  await userEvent.selectOptions(page.getByRole("combobox", { name: `Role for ${LONG_NAME}` }), "admin");
  await expect
    .poll(() => calls.of("careGroup.changeRole"))
    .toEqual([{ groupId: TEST_GROUP.id, userId: LONG.id, role: "admin" }]);

  await userEvent.click(page.getByRole("button", { name: "Remove Sam Okafor" }));
  await userEvent.click(page.getByRole("button", { name: "Remove", exact: true }));
  await expect
    .poll(() => calls.of("careGroup.removeMember"))
    .toEqual([{ groupId: TEST_GROUP.id, userId: SAM.id }]);

  const toggle = page.getByRole("button", { name: "What this group sees" });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(toggle);
  await userEvent.click(page.getByRole("checkbox", { name: /Phone numbers/ }));
  await userEvent.click(page.getByRole("button", { name: "Save" }));
  await expect.element(page.getByRole("status")).toHaveTextContent("Saved.");
  expect(calls.of("careGroup.updateMySharing")).toEqual([
    { groupId: TEST_GROUP.id, sharedFields: ["phones"], relationship: "" },
  ]);

  // Leaving waits for the membership to sync away, which it doesn't here: the request is enough.
  await userEvent.click(page.getByRole("button", { name: "Leave this care group" }));
  await userEvent.click(page.getByRole("button", { name: "Leave", exact: true }));
  await expect
    .poll(() => calls.of("careGroup.removeMember"))
    .toEqual([
      { groupId: TEST_GROUP.id, userId: SAM.id },
      { groupId: TEST_GROUP.id, userId: TEST_USER.id },
    ]);
});
