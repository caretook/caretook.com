import type { DeviceOptions } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as timeline from "../timeline/route";
import * as layout from "./layout/route";
import * as providers from "./providers/route";
import * as step from "./step/route";

// The setup pages on the test device (offline): the providers step adds and
// lists, Later lands on the Timeline with `opened` pending, an unknown step
// goes to the first, and anyone who doesn't set the group up is sent to the
// Timeline. All names are fictional.

const ROUTES = [
  {
    path: "/app/groups/:groupId/setup",
    module: layout,
    children: [
      { path: "/app/groups/:groupId/setup/providers", module: providers },
      { path: "/app/groups/:groupId/setup/:step?", module: step },
    ],
  },
  { path: "/app/groups/:groupId/timeline", module: timeline },
];
const BASE = `/app/groups/${TEST_GROUP.id}`;
const SETUP = `${BASE}/setup/providers`;
const TIMELINE = `${BASE}/timeline`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const OTHER_ID = "5d3e2f1a-7b6c-4d8e-9f0a-000000000042";

/** This user joined an hour ago with `role`; with `after`, another owner joined the day before. */
const membership = (role: GroupRole, { after = false } = {}) => [
  fx.member({ userId: TEST_USER.id, role, createdAt: hoursAgo(1) }),
  after && [
    fx.user({ id: OTHER_ID, name: "Rosa Lindqvist" }),
    fx.member({ userId: OTHER_ID, role: "owner", createdAt: hoursAgo(24) }),
  ],
];

const open = (url: string, role: GroupRole, options: Partial<DeviceOptions> & { after?: boolean } = {}) =>
  renderWithDevice({
    route: ROUTES,
    url,
    role: null,
    noSetupRecord: true,
    ...options,
    fixtures: [membership(role, { after: options.after }), options.fixtures],
  });

const pending = () =>
  JSON.parse(localStorage.getItem(`caretook:settings-pending:${TEST_USER.id}`) ?? "null") as {
    groupSetup?: Record<string, { opened?: boolean }>;
  } | null;
const setupPage = () => document.querySelector("[data-setup-page]");
const addedList = () => document.querySelector("[data-setup-added]");

beforeEach(() => localStorage.clear());

describe("the providers step", () => {
  test("the creator adds a provider on the page and sees it listed, with a fresh form", async () => {
    const device = await open(SETUP, "owner");
    await expect
      .element(page.getByRole("heading", { name: "Who helps with their care?", level: 1 }))
      .toBeVisible();
    expect(addedList()).toBeNull();
    const name = page.getByRole("textbox", { name: "Name" });
    await userEvent.fill(name, "Dr. Imani Castellanos");
    await userEvent.click(page.getByRole("button", { name: "Add provider" }));
    await expect.poll(addedList).not.toBeNull();
    await expect.element(page.getByRole("link", { name: "Dr. Imani Castellanos" })).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: "Name" })).toHaveValue("");
    const rows = await device.query<{ name: string }>("SELECT name FROM provider WHERE group_id = ?", [
      TEST_GROUP.id,
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Dr. Imani Castellanos"]);
    await expect
      .poll(() => document.querySelector('[data-setup-step="providers"]')?.hasAttribute("data-done"))
      .toBe(true);
  });

  test("has no Cancel: the form stays on its page", async () => {
    await open(SETUP, "owner");
    await expect.element(page.getByRole("button", { name: "Add provider" })).toBeVisible();
    expect(document.querySelector("[data-form-cancel]")).toBeNull();
  });

  test("Next from the last page there is finishes on the Timeline", async () => {
    const device = await open(SETUP, "owner");
    await userEvent.click(page.getByRole("link", { name: "Next" }));
    await expect.poll(device.location).toBe(TIMELINE);
  });
});

describe("Later", () => {
  test("lands on the Timeline, with opened saved pending", async () => {
    const device = await open(SETUP, "owner");
    await expect.poll(setupPage).not.toBeNull();
    await expect.poll(() => pending()?.groupSetup?.[TEST_GROUP.id]?.opened).toBe(true);
    await userEvent.click(page.getByRole("link", { name: "Later, take me to Caretook!" }));
    await expect.poll(device.location).toBe(TIMELINE);
    expect(pending()?.groupSetup?.[TEST_GROUP.id]?.opened).toBe(true);
  });
});

describe("who gets the pages", () => {
  test("an unknown step goes to the first", async () => {
    const device = await open(`${BASE}/setup/bogus`, "owner");
    await expect.poll(device.location).toBe(SETUP);
    await expect.poll(setupPage).not.toBeNull();
  });

  test.each([
    ["an invited caretaker", "caretaker"],
    ["a second owner", "owner"],
    ["a viewer", "viewer"],
  ] as const)("%s opening the URL lands on the Timeline, recording nothing", async (_, role) => {
    const device = await open(SETUP, role, { after: true });
    await expect.poll(device.location).toBe(TIMELINE);
    expect(setupPage()).toBeNull();
    expect(pending()).toBeNull();
  });

  test("a first member who can't write lands on the Timeline", async () => {
    const device = await open(SETUP, "viewer");
    await expect.poll(device.location).toBe(TIMELINE);
    expect(setupPage()).toBeNull();
  });
});
