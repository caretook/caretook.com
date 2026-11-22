import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "./layout/route";
import * as members from "./members/route";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";

// The easy roles replaced the managers' Easy mode and Locked switches
// (simple-mode PRD, slice 3): Members has no switches for anyone, and a
// member's easy view is their role, chosen in the same menu as any other
// (the picker's groups and descriptions are groupSettings.browser.test.tsx's).

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/members`, module: members }] },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f6a02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const ROSA = fx.person({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f6a04",
  name: "Rosa Lind",
  role: "easy_helper",
});
const OLGA = fx.person({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f6a03", name: "Olga Moreno", role: "owner" });

const ONLINE = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
  "invite.listForGroup": () => [],
  "invite.listLinks": () => [],
  "joinRequest.list": () => [],
  "me.contact": () => null,
};

const open = (role: GroupRole, api: Record<string, (input: unknown) => unknown> = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: MEMBERS,
    role,
    fixtures: [SAM, ROSA, OLGA],
    api: { ...ONLINE, ...api },
  });

const ready = () => expect.poll(() => document.querySelectorAll("main li[data-member]").length).toBe(4);
const toggles = () => document.querySelectorAll("main li[data-member] input[type=checkbox]");

describe("Members without easy-mode switches", () => {
  for (const role of ["owner", "admin", "caretaker"] as const)
    test(`a ${role} sees no Easy mode or Locked switch on any row`, async () => {
      await open(role);
      await ready();
      expect(toggles()).toHaveLength(0);
      expect(document.querySelector("[data-member-switches], [data-easy-mode-badge]")).toBeNull();
      await expect.element(page.getByText("Locked", { exact: true })).not.toBeInTheDocument();
    });

  test("an owner puts a caretaker in the easy view by choosing Easy helper as their role", async () => {
    const calls = apiCalls();
    await open(
      "owner",
      calls.record({ "careGroup.changeRole": () => ({ userId: SAM_ID, role: "easy_helper" }) }),
    );
    await ready();
    await userEvent.selectOptions(page.getByRole("combobox", { name: "Role for Sam Okafor" }), "easy_helper");
    await expect
      .poll(() => calls.of("careGroup.changeRole"))
      .toEqual([{ groupId: TEST_GROUP.id, userId: SAM_ID, role: "easy_helper" }]);
  });

  test("an Easy helper's row reads as their role, with no badge beside it", async () => {
    await open("caretaker");
    await ready();
    const rosa = page.getByRole("listitem").filter({ hasText: "Rosa Lind" });
    await expect.element(rosa.getByText("Easy helper", { exact: true })).toBeVisible();
    expect(toggles()).toHaveLength(0);
  });
});
