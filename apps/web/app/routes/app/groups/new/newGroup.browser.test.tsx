import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { InviteSomeoneCard } from "../timeline/InviteSomeoneCard";
import * as newGroup from "./route";

// The New care group sheet (groups.mjs steps 2 and 7, on the test device):
// the group menu's "New care group" opens it and closing it goes back; a
// typed URL closes to /app; the group name defaults to the preferred name;
// Create calls `careGroup.create` once and, when the new membership syncs
// in, opens the new group's timeline with the Invite someone card; offline
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

const sheet = () => page.getByRole("dialog");
const field = (label: string) => sheet().getByLabelText(label, { exact: true });

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

  test("opened from a typed URL, closing it goes to /app", async () => {
    const device = await open();
    await userEvent.click(sheet().getByRole("button", { name: "Close" }));
    await expect.poll(device.location).toBe("/app");
  });

  test("Create makes the group once, then opens its timeline when it syncs in, with the Invite someone card", async () => {
    const calls = apiCalls();
    let arrive = (): Promise<void> => Promise.resolve();
    const device = await open({
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

    await expect.poll(device.location, { timeout: 5000 }).toBe(timelineUrl(NEW.group));
    await expect.element(page.getByRole("heading", { name: "Invite someone" })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Invite someone" }))
      .toHaveAttribute("href", `/app/groups/${NEW.group}/settings/members`);
    expect(calls.of("careGroup.create")).toEqual([
      { recipientName: "Lou Moreno", preferredName: "Lou", groupName: "", timeZone: "America/Los_Angeles" },
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
