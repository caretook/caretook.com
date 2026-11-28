import type { DeviceOptions, DeviceRoute } from "../../../../../test/device";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { appUrls } from "~/lib/app-shell/appUrls";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as layout from "../setup/layout/route";
import * as providers from "../setup/providers/route";
import * as setupProfile from "../setup/profile/route";
import * as step from "../setup/step/route";
import { forgetSetupRedirects } from "./setupRedirect";

// The first-open redirect (the group layout's middleware, `setupRedirect`),
// on the offline test device: the person who sets the group up opening any
// group page goes to the first unfinished setup step once; Later then opens
// the Timeline, and so does every later open (`opened` is stored, pending
// offline), even when storage refuses writes. An account that opened or
// dismissed the group's setup, an invited member, and a device that doesn't
// know the account's settings open the page as asked. The rules are
// groupSetup.test.ts's; the setup pages are setup.browser.test.tsx's. All
// names are fictional.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/setup",
    module: layout,
    children: [
      { path: "/app/groups/:groupId/setup/providers", module: providers },
      { path: "/app/groups/:groupId/setup/profile", module: setupProfile },
      { path: "/app/groups/:groupId/setup/:step?", module: step },
    ],
  },
  { path: "/app/groups/:groupId/timeline", module: { default: () => <p>Timeline page</p> } },
  { path: "/app/groups/:groupId/planner", module: { default: () => <p>Planner page</p> } },
];
const TIMELINE = appUrls.timeline(TEST_GROUP.id);
const OTHER_ID = "5d3e2f1a-7b6c-4d8e-9f0a-000000000051";
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** This device knows the account's settings (the server answered before), as given. */
const knownSettings = (settings: object = {}) => {
  localStorage.setItem(`caretook:settings:${TEST_USER.id}`, JSON.stringify(settings));
  localStorage.setItem(`caretook:settings:${TEST_USER.id}:known`, "true");
};

const open = (url: string, options: Partial<DeviceOptions> = {}) =>
  renderWithDevice({ route: ROUTES, url, noSetupRecord: true, ...options });

const setupPage = () => document.querySelector("[data-setup-page]")?.getAttribute("data-setup-page");
const later = () => userEvent.click(page.getByRole("link", { name: "Later, take me to Caretook!" }));

beforeEach(() => {
  localStorage.clear();
  forgetSetupRedirects();
});
afterEach(() => vi.restoreAllMocks());

describe("a creator's first open", () => {
  test("goes to the providers step, offline; Later opens the Timeline, and the next open stays there", async () => {
    knownSettings();
    const device = await open(TIMELINE);
    await expect.poll(device.location).toBe(appUrls.setup(TEST_GROUP.id, "providers"));
    await expect.poll(setupPage).toBe("providers");

    // This page's own guard forgotten: the stored `opened` is what keeps the Timeline.
    forgetSetupRedirects();
    await later();
    await expect.poll(device.location).toBe(TIMELINE);
    await expect.element(page.getByText("Timeline page")).toBeVisible();
    await device.settle();
    expect(device.location()).toBe(TIMELINE);
  });

  test("from any group page, to the first step not done", async () => {
    knownSettings();
    const device = await open(appUrls.planner(TEST_GROUP.id), {
      fixtures: [fx.provider({ name: "Dr. Imani Castellanos" })],
    });
    await expect.poll(device.location).toBe(appUrls.setup(TEST_GROUP.id, "profile"));
    await expect.poll(setupPage).toBe("profile");
  });

  test("with storage refusing writes, Later still opens the Timeline", async () => {
    knownSettings();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const device = await open(TIMELINE);
    await expect.poll(setupPage).toBe("providers");
    await later();
    await expect.poll(device.location).toBe(TIMELINE);
    await device.settle();
    expect(device.location()).toBe(TIMELINE);
  });
});

describe("opens on the Timeline", () => {
  test("once the account has opened the group's setup (on any device)", async () => {
    knownSettings({ groupSetup: { [TEST_GROUP.id]: { opened: true } } });
    const device = await open(TIMELINE);
    await expect.element(page.getByText("Timeline page")).toBeVisible();
    expect(device.location()).toBe(TIMELINE);
  });

  test("for a group in setupDismissed (the old setup card)", async () => {
    knownSettings({ setupDismissed: [TEST_GROUP.id] });
    const device = await open(TIMELINE);
    await expect.element(page.getByText("Timeline page")).toBeVisible();
    expect(device.location()).toBe(TIMELINE);
  });

  test.each([
    ["an invited owner", "owner"],
    ["an invited caretaker", "caretaker"],
  ] as const)("for %s (someone else joined first)", async (_, role) => {
    knownSettings();
    const device = await open(TIMELINE, {
      role: null,
      fixtures: [
        fx.user({ id: OTHER_ID, name: "Rosa Lindqvist" }),
        fx.member({ userId: OTHER_ID, role: "owner", createdAt: hoursAgo(24) }),
        fx.member({ userId: TEST_USER.id, role, createdAt: hoursAgo(1) }),
      ],
    });
    await expect.element(page.getByText("Timeline page")).toBeVisible();
    expect(device.location()).toBe(TIMELINE);
  });

  test("when this device has no cached settings (offline, so they can't be known)", async () => {
    const device = await open(TIMELINE);
    await expect.element(page.getByText("Timeline page")).toBeVisible();
    expect(device.location()).toBe(TIMELINE);
    expect(setupPage()).toBeUndefined();
  });
});
