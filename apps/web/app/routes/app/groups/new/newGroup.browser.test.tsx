import type { DeviceRoute } from "../../../../../test/device";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { requiredLabels } from "../../../../../test/required";
import * as setupLayout from "../setup/layout/route";
import * as setupProviders from "../setup/providers/route";
import { InviteSomeoneCard } from "../timeline/InviteSomeoneCard";
import * as newGroup from "./route";

// The New care group sheet (groups.mjs steps 2 and 7, on the test device):
// the group menu's "New care group" opens it and closing it goes back; a
// typed URL closes to /app; the group name defaults to the preferred name;
// Create calls `careGroup.create` once and, when the new membership syncs
// in, opens the new group, on its setup pages' first step (the first-open
// redirect, `layout/setupRedirect.ts`); offline
// it says it needs a connection. The server's side (the group, recipient
// and creator as owner in one go) is packages/api/src/groups.int.test.ts's;
// the real create syncing into a signed-in device is first-sync.mjs's.

const NEW = {
  group: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b09",
  recipient: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c09",
};
const timelineUrl = (groupId: string) => `/app/groups/${groupId}/timeline`;

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/new", module: newGroup },
  {
    path: "/app",
    id: "home",
    module: {
      default: () => (
        <main>
          <h1>Your care groups</h1>
        </main>
      ),
    },
  },
  {
    path: "/app/groups/:groupId/setup",
    module: setupLayout,
    children: [{ path: "/app/groups/:groupId/setup/providers", module: setupProviders }],
  },
  {
    path: "/app/groups/:groupId/timeline",
    module: {
      default: () => (
        <main>
          <h1>Timeline</h1>
          <InviteSomeoneCard />
        </main>
      ),
    },
  },
];

const open = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: ROUTES, url: "/app/groups/new", ...options });

// By name: the group menu's popover is a dialog too, so a bare `dialog` finds the
// menu while the navigation it starts hasn't landed (B-769).
const sheet = () => page.getByRole("dialog", { name: "New care group", exact: true });
// By accessible name: a required label's `*` is aria-hidden, so it isn't part of it.
const field = (label: string) => sheet().getByRole("textbox", { name: label, exact: true });

afterEach(() => localStorage.clear());

describe("the New care group sheet", () => {
  test("the group menu's New care group opens it; closing it goes back to the timeline", async () => {
    const device = await open({ url: timelineUrl(TEST_GROUP.id), frame: true });
    await userEvent.click(page.getByRole("button", { name: /switch care group$/ }));
    await userEvent.click(page.getByRole("menuitem", { name: "New care group" }));
    await expect.element(sheet()).toBeVisible();
    expect(device.location()).toBe("/app/groups/new");
    await expect.element(sheet().getByRole("heading", { name: "New care group" })).toBeVisible();
    await userEvent.click(sheet().getByRole("button", { name: "Close" }));
    await expect.poll(device.location).toBe(timelineUrl(TEST_GROUP.id));
    expect(document.querySelector("[data-new-group-form]")).toBeNull();
  });

  test("marks only their name required; what you call them and the group name say what they're for, not Optional", async () => {
    await open();
    await expect.element(field("Their name")).toHaveAttribute("aria-required", "true");
    expect(requiredLabels(sheet().element())).toEqual(["Their name"]);
    await expect.element(field("What you call them")).not.toHaveAttribute("aria-required");
    expect(sheet().element().textContent).not.toMatch(/optional/i);
  });

  test("opened from a typed URL, closing it goes to /app", async () => {
    const device = await open();
    await userEvent.click(sheet().getByRole("button", { name: "Close" }));
    await expect.poll(device.location).toBe("/app");
  });

  test("Create makes the group once, then opens it when it syncs in, on its providers setup step", async () => {
    // This device knows the account's settings (it has opened another group before).
    localStorage.setItem(`caretook:settings:${TEST_USER.id}`, "{}");
    localStorage.setItem(`caretook:settings:${TEST_USER.id}:known`, "true");
    const calls = apiCalls();
    let arrive = (): Promise<void> => Promise.resolve();
    const device = await open({
      noSetupRecord: true,
      api: calls.record({
        "careGroup.create": () => {
          // The new group reaches the device a moment after the API answers.
          setTimeout(() => void arrive(), 50);
          return { groupId: NEW.group, name: "Lou's care" };
        },
      }),
    });
    arrive = () =>
      device.sync([
        fx.group({ id: NEW.group, name: "Lou's care" }),
        fx.recipient({ id: NEW.recipient, groupId: NEW.group, name: "Lou Moreno", preferredName: "Lou" }),
        fx.member({ userId: TEST_USER.id, groupId: NEW.group, role: "owner" }),
      ]);

    await userEvent.fill(field("Their name"), "Lou Moreno");
    await userEvent.fill(field("What you call them"), "Lou");
    await expect.element(field("Group name")).toHaveAttribute("placeholder", "Lou's care");
    await userEvent.click(sheet().getByRole("button", { name: "Create care group" }));

    await expect.poll(device.location).toBe(`/app/groups/${NEW.group}/setup/providers`);
    await expect
      .element(page.getByRole("heading", { name: "Who helps with their care?", level: 1 }))
      .toBeVisible();
    expect(document.querySelector("[data-invite-card]")).toBeNull();
    // A new group takes the zone of the device creating it, wherever the test runs.
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(calls.of("careGroup.create")).toEqual([
      { recipientName: "Lou Moreno", preferredName: "Lou", groupName: "", timeZone: deviceZone },
    ]);
  });

  test("offline, Create says it needs a connection and the sheet stays", async () => {
    const device = await open();
    await userEvent.fill(field("Their name"), "Lou Moreno");
    await userEvent.click(sheet().getByRole("button", { name: "Create care group" }));
    await expect
      .element(sheet().getByRole("alert"))
      .toHaveTextContent("Needs a connection to create a care group.");
    expect(device.location()).toBe("/app/groups/new");
  });
});

describe("the Invite someone card", () => {
  const card = () => document.querySelector("[data-invite-card]");
  const openTimeline = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
    renderWithDevice({ route: ROUTES, url: timelineUrl(TEST_GROUP.id), ...options });

  test("shows while the owner is the only one in the group, and goes when someone joins", async () => {
    const device = await openTimeline();
    expect(card()?.textContent).toContain("You're the only one in Grandma June's care group.");
    await device.sync([
      fx.user({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a07", name: "Sam Moreno" }),
      fx.member({ userId: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a07", role: "caretaker" }),
    ]);
    await device.settle();
    expect(card()).toBeNull();
  });

  test("a group with other members shows none", async () => {
    await openTimeline({
      fixtures: [
        fx.user({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a07", name: "Sam Moreno" }),
        fx.member({ userId: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a07", role: "viewer" }),
      ],
    });
    await expect.element(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    expect(card()).toBeNull();
  });

  test("a caretaker alone in a group sees none (only owners and admins invite)", async () => {
    await openTimeline({ role: "caretaker" });
    await expect.element(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    expect(card()).toBeNull();
  });
});
