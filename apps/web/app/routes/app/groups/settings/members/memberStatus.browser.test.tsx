import type { DeviceRoute } from "../../../../../../test/device";

import { describe, expect, test } from "vitest";
import * as groupSettingsLayout from "../layout/route";
import * as members from "./route";
import { apiCalls } from "../../../../../../test/api";
import { renderWithDevice } from "../../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../../test/fixtures";
import { found } from "../../../../../../test/found";

// Members' email confirmation on their cards (B-679): owners and admins see
// it online, from careGroup.memberStatuses; other members and an offline
// device see none.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: groupSettingsLayout, children: [{ path: `${BASE}/members`, module: members }] },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const NEW = fx.person({ id: "5c2e8a41-7d3b-4f60-9a1e-2b4c6d8e0f01", name: "Rowan Pike", role: "caretaker" });
const SEEN = fx.person({ id: "5c2e8a41-7d3b-4f60-9a1e-2b4c6d8e0f02", name: "Lee Ashby", role: "viewer" });

const STATUSES = [
  { userId: TEST_USER.id, emailVerified: true, lastSignInAt: "2027-06-08T17:00:00.000Z" },
  { userId: NEW.id, emailVerified: false, lastSignInAt: null },
  { userId: SEEN.id, emailVerified: true, lastSignInAt: "2027-06-01T16:00:00.000Z" },
];

const ONLINE = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
  "invite.listForGroup": () => [],
  "invite.listLinks": () => [],
  "joinRequest.list": () => [],
  "me.contact": () => ({ phones: [], contactEmail: null, address: null }),
  "careGroup.memberStatuses": () => STATUSES,
};

const open = (
  role: "owner" | "admin" | "caretaker" | "viewer",
  api?: Record<string, (input: unknown) => unknown>,
) => renderWithDevice({ route: ROUTES, url: MEMBERS, role, fixtures: [NEW, SEEN], api });

const card = (userId: string) =>
  found(() => document.querySelector<HTMLElement>(`main li[data-member="${userId}"]`));
const ready = () => expect.poll(() => document.querySelectorAll("main li[data-member]").length).toBe(3);
const statusOf = async (userId: string) =>
  (await card(userId)).querySelector("[data-member-status]")?.textContent ?? null;

describe("members' email confirmation", () => {
  test.each(["owner", "admin"] as const)("an %s sees it on each card, online", async (role) => {
    await open(role, ONLINE);
    await ready();
    await expect.poll(() => statusOf(NEW.id)).toBe("Email not confirmed");
    expect(await statusOf(SEEN.id)).toBe("Email confirmed · Last signed in Jun 1, 2027");
    expect(await statusOf(TEST_USER.id)).toBe("Email confirmed · Last signed in Jun 8, 2027");
  });

  test.each(["caretaker", "viewer"] as const)("a %s sees none, and the page never asks", async (role) => {
    const calls = apiCalls();
    await open(role, calls.record(ONLINE));
    await ready();
    await expect.poll(() => calls.of("me.contact").length).toBe(1);
    for (const id of [TEST_USER.id, NEW.id, SEEN.id]) expect(await statusOf(id)).toBeNull();
    expect(calls.of("careGroup.memberStatuses")).toEqual([]);
  });

  test("offline, an owner sees none", async () => {
    await open("owner");
    await ready();
    for (const id of [TEST_USER.id, NEW.id, SEEN.id]) expect(await statusOf(id)).toBeNull();
  });
});
