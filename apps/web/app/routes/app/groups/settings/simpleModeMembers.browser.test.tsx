import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "./layout/route";
import * as members from "./members/route";
import { apiCalls, refusal } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";

// The Simple mode switch on each member's row (assistant slice 5): owners and
// admins, online, on the members they manage; a read-only badge otherwise.
// The server's own rules (owners' rows, your own lock) are integration tests;
// the switch reaching the member's real device is app-shell.mjs's.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/members`, module: members }] },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f6a02";
const SAM_MEMBERSHIP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f6b02";
const samMembership = (simpleMode: number, simpleModeLocked = 0) =>
  fx.member({ id: SAM_MEMBERSHIP, userId: SAM_ID, role: "caretaker", simpleMode, simpleModeLocked });
const SAM = [fx.user({ id: SAM_ID, name: "Sam Okafor" }), samMembership(0)];
const OLGA = fx.person({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f6a03", name: "Olga Moreno", role: "owner" });

const ONLINE = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
  "invite.listForGroup": () => [],
  "invite.listLinks": () => [],
  "joinRequest.list": () => [],
  "me.contact": () => null,
};

const open = (role: GroupRole, api?: Record<string, (input: unknown) => unknown>) =>
  renderWithDevice({
    route: ROUTES,
    url: MEMBERS,
    role,
    fixtures: [SAM, OLGA],
    api: api && { ...ONLINE, ...api },
  });

const ready = () => expect.poll(() => document.querySelectorAll("main li[data-member]").length).toBe(3);
const samSwitch = () => page.getByRole("checkbox", { name: "Simple mode for Sam Okafor" });
const switches = () => [...document.querySelectorAll<HTMLInputElement>("[data-simple-mode-switch]")];
const samLock = () => page.getByRole("checkbox", { name: "Lock Sam Okafor in simple mode" });
const locks = () => [...document.querySelectorAll<HTMLInputElement>("[data-simple-lock-switch]")];

describe("the Simple mode switch on Members", () => {
  test("an owner turns it on for a caretaker: it's sent, shows at once, and the synced change stays", async () => {
    const calls = apiCalls();
    const device = await open("owner", calls.record({ "careGroup.setMemberMode": () => null }));
    await ready();
    // Every row they manage, theirs and the other owner's included.
    expect(switches()).toHaveLength(3);
    await expect.element(samSwitch()).not.toBeChecked();

    await userEvent.click(samSwitch());
    await expect
      .poll(() => calls.of("careGroup.setMemberMode"))
      .toEqual([{ groupId: TEST_GROUP.id, userId: SAM_ID, simpleMode: true }]);
    await expect.element(samSwitch()).toBeChecked();
    await device.sync(samMembership(1));
    await expect.element(samSwitch()).toBeChecked();
  });

  test("a refusal shows the server's reason and the switch goes back", async () => {
    await open("owner", { "careGroup.setMemberMode": () => refusal("careGroupMemberService:ownerOnly") });
    await ready();
    await userEvent.click(samSwitch());
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Only an owner can add, change or remove owners");
    await expect.element(samSwitch()).not.toBeChecked();
  });

  test("an admin gets no switch on an owner's row", async () => {
    await open("admin", {});
    await ready();
    expect(switches()).toHaveLength(2);
    expect(page.getByRole("checkbox", { name: "Simple mode for Olga Moreno" }).elements()).toHaveLength(0);
  });

  test("caretakers, and anyone offline, see a badge where it's on, and no switch", async () => {
    const device = await open("caretaker", {});
    await ready();
    expect(switches()).toHaveLength(0);
    expect(document.querySelector("[data-simple-mode-badge]")).toBeNull();
    await device.sync(samMembership(1));
    await expect.poll(() => document.querySelectorAll("[data-simple-mode-badge]").length).toBe(1);
  });

  test("offline, an owner gets no switch", async () => {
    await open("owner");
    await ready();
    expect(switches()).toHaveLength(0);
  });
});

describe("the Locked switch on Members", () => {
  test("an owner locks a caretaker in: it's sent, and simple mode shows on with it; never on their own row", async () => {
    const calls = apiCalls();
    const device = await open("owner", calls.record({ "careGroup.setMemberMode": () => null }));
    await ready();
    // Sam's and the other owner's rows; not their own.
    expect(locks()).toHaveLength(2);
    expect(document.querySelector(`li[data-member="${OLGA.id}"] [data-simple-lock-switch]`)).not.toBeNull();
    await expect.element(samLock()).not.toBeChecked();

    await userEvent.click(samLock());
    await expect
      .poll(() => calls.of("careGroup.setMemberMode"))
      .toEqual([{ groupId: TEST_GROUP.id, userId: SAM_ID, locked: true }]);
    await expect.element(samLock()).toBeChecked();
    await expect.element(samSwitch()).toBeChecked();
    await device.sync(samMembership(1, 1));
    await expect.element(samLock()).toBeChecked();

    // Turning simple mode off unlocks too.
    await userEvent.click(samSwitch());
    await expect
      .poll(() => calls.of("careGroup.setMemberMode").at(-1))
      .toEqual({ groupId: TEST_GROUP.id, userId: SAM_ID, simpleMode: false });
    await expect.element(samLock()).not.toBeChecked();
  });

  test("the lock syncing back after simple mode was already turned off doesn't turn it back on", async () => {
    const calls = apiCalls();
    const device = await open("owner", calls.record({ "careGroup.setMemberMode": () => null }));
    await ready();
    await userEvent.click(samLock());
    await expect.poll(() => calls.of("careGroup.setMemberMode").length).toBe(1);
    await userEvent.click(samSwitch());
    await expect.poll(() => calls.of("careGroup.setMemberMode").length).toBe(2);
    await expect.element(samLock()).not.toBeChecked();
    // The lock's own echo arrives late, then the unlock's.
    await device.sync(samMembership(1, 1));
    await expect
      .poll(() => device.query("SELECT 1 FROM care_group_member WHERE simple_mode_locked = 1"))
      .toHaveLength(1);
    // Give the live query time to show it (an assertion that nothing changes).
    await new Promise((resolve) => setTimeout(resolve, 200));
    await expect.element(samLock()).not.toBeChecked();
    await expect.element(samSwitch()).not.toBeChecked();
    await device.sync(samMembership(0, 0));
    await expect.element(samLock()).not.toBeChecked();
  });

  test("a refusal shows the server's reason and the lock goes back", async () => {
    await open("owner", { "careGroup.setMemberMode": () => refusal("careGroupMemberService:ownLock") });
    await ready();
    await userEvent.click(samLock());
    await expect.element(page.getByRole("alert")).toBeVisible();
    await expect.element(samLock()).not.toBeChecked();
    await expect.element(samSwitch()).not.toBeChecked();
  });

  test("an admin gets none on an owner's row", async () => {
    await open("admin", {});
    await ready();
    expect(locks()).toHaveLength(1);
  });

  test("caretakers see a locked member's badge, and no switch", async () => {
    const device = await open("caretaker", {});
    await ready();
    expect(locks()).toHaveLength(0);
    await device.sync(samMembership(1, 1));
    await expect
      .poll(() => document.querySelector("[data-simple-mode-badge]")?.textContent)
      .toBe("Simple mode, locked");
  });
});
