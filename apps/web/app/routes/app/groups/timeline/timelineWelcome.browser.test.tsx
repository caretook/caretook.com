import type { DeviceOptions } from "../../../../../test/device";
import type { Fixtures, GroupRole } from "../../../../../test/fixtures";

import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as timeline from "./route";
import { chooseEasyMode } from "./timelineWorld";

// The card under the Timeline's header (onboarding-2): no setup steps for
// anyone; the welcome for every member who didn't set the group up, by role,
// dismissed for good; and the invite card for a lone setter in the full view.

const ROUTE = { path: "/app/groups/:groupId/timeline", module: timeline };
const URL = `/app/groups/${TEST_GROUP.id}/timeline`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const joined = (role: GroupRole = "owner", createdAt = hoursAgo(1)) =>
  fx.member({ userId: TEST_USER.id, role, createdAt });
/** An owner who joined a month ago, so they set the group up and you didn't. */
const SETTER = fx.person({ name: "Robin Vale", role: "owner" });
const invited = (role: GroupRole, createdAt = hoursAgo(1)) => [SETTER, joined(role, createdAt)];
const open = (fixtures: Fixtures, options: Partial<DeviceOptions> = {}) =>
  renderWithDevice({ route: ROUTE, url: URL, role: null, fixtures, ...options });
const setupCard = () => document.querySelector("[data-setup-card], [data-setup-step]");
const inviteCard = () => document.querySelector("[data-invite-card]");
const welcome = () => document.querySelector("[data-welcome-card]");
const heading = () => page.getByRole("heading", { name: "Timeline", level: 1 });
const easyView = () => document.querySelector("[data-easy-timeline]");
const easyToday = () => document.querySelector("[data-easy-today]");

beforeEach(() => localStorage.clear());

describe("the setter", () => {
  test("a lone owner's full timeline has no setup card, and the invite card", async () => {
    await open([joined()]);
    await expect.element(heading()).toBeVisible();
    await expect.poll(inviteCard).not.toBeNull();
    expect(setupCard()).toBeNull();
    expect(welcome()).toBeNull();
    expect(document.body.textContent).not.toContain("Get started");
  });

  test("a lone owner's easy timeline has none of them", async () => {
    chooseEasyMode();
    await open([joined()]);
    await expect.poll(easyToday).not.toBeNull();
    await expect.poll(() => document.querySelector("[data-quick-entry] textarea")).not.toBeNull();
    expect(setupCard()).toBeNull();
    expect(welcome()).toBeNull();
    expect(inviteCard()).toBeNull();
  });

  test("once someone else joins, the invite card goes and no welcome comes", async () => {
    const device = await open([joined()]);
    await expect.poll(inviteCard).not.toBeNull();
    const helper = fx.user({ name: "Jo Marsh" });
    await device.sync([helper, fx.member({ userId: helper.id, createdAt: hoursAgo(0.5) })]);
    await device.settle();
    await expect.poll(inviteCard).toBeNull();
    expect(welcome()).toBeNull();
  });
});

describe("the welcome", () => {
  test.each(["owner", "admin", "caretaker", "viewer"] as const)(
    "an invited %s gets it on the full timeline, with nothing to do in it",
    async (role) => {
      await open(invited(role));
      await expect.poll(welcome).not.toBeNull();
      expect(easyView()).toBeNull();
      expect(welcome()?.textContent).toContain("You can");
      expect(welcome()?.querySelectorAll("a")).toHaveLength(0);
      expect(welcome()?.querySelectorAll("button")).toHaveLength(1);
      expect(setupCard()).toBeNull();
      expect(inviteCard()).toBeNull();
    },
  );

  test.each(["easy_helper", "easy_viewer"] as const)("%s gets it on the easy timeline", async (role) => {
    await open(invited(role));
    await expect.poll(welcome).not.toBeNull();
    expect(easyView()?.contains(welcome())).toBe(true);
    expect(welcome()?.querySelectorAll("a")).toHaveLength(0);
    expect(setupCard()).toBeNull();
  });

  test.each(["caretaker", "viewer"] as const)("an invited %s in Easy mode gets it too", async (role) => {
    chooseEasyMode();
    await open(invited(role));
    await expect.poll(welcome).not.toBeNull();
    expect(easyView()?.contains(welcome())).toBe(true);
    expect(setupCard()).toBeNull();
  });

  test("an invited caretaker dismisses it, and it stays gone after a reload", async () => {
    const fixtures = invited("caretaker");
    const first = await open(fixtures);
    await expect.poll(welcome).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Dismiss welcome" }));
    await expect.poll(welcome).toBeNull();
    await first.screen.unmount();

    await open(fixtures);
    await expect.element(heading()).toBeVisible();
    await expect.poll(() => document.querySelector("[data-quick-entry] textarea")).not.toBeNull();
    expect(welcome()).toBeNull();
  });

  test("dismissing it on the easy timeline survives a reload", async () => {
    const fixtures = invited("easy_viewer");
    const first = await open(fixtures);
    await expect.poll(welcome).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Dismiss welcome" }));
    await expect.poll(welcome).toBeNull();
    await first.screen.unmount();

    await open(fixtures);
    await expect.poll(easyView).not.toBeNull();
    await expect.poll(easyToday).not.toBeNull();
    expect(welcome()).toBeNull();
  });

  test("past 14 days there's no welcome", async () => {
    await open(invited("easy_helper", hoursAgo(24 * 14 + 1)));
    await expect.poll(easyView).not.toBeNull();
    await expect.poll(easyToday).not.toBeNull();
    expect(welcome()).toBeNull();
  });

  test("an earliest member who's no longer an owner gets it, then the invite card once it's dismissed", async () => {
    await open([joined("admin")]);
    await expect.poll(welcome).not.toBeNull();
    expect(inviteCard()).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Dismiss welcome" }));
    await expect.poll(inviteCard).not.toBeNull();
    expect(welcome()).toBeNull();
  });
});

// B-629: the dismiss button leaves with its card, so focus moves on instead of falling to the body.
describe("focus after dismissing", () => {
  const quickField = () => document.querySelector("[data-quick-entry] textarea");
  const dismissByKeyboard = async () => {
    page.getByRole("button", { name: "Dismiss welcome" }).element().focus();
    await userEvent.keyboard("{Enter}");
  };

  test("a caretaker's goes to the quick-entry box", async () => {
    await open(invited("caretaker"));
    await expect.poll(welcome).not.toBeNull();
    await dismissByKeyboard();
    await expect.poll(welcome).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(quickField());
  });

  test("a viewer's goes to the Timeline heading", async () => {
    await open(invited("viewer"));
    await expect.poll(welcome).not.toBeNull();
    await dismissByKeyboard();
    await expect.poll(welcome).toBeNull();
    expect(document.activeElement).toBe(heading().element());
  });

  test("in the easy view, a caretaker's goes to the box", async () => {
    chooseEasyMode();
    await open(invited("caretaker"));
    await expect.poll(welcome).not.toBeNull();
    await dismissByKeyboard();
    await expect.poll(welcome).toBeNull();
    expect(document.activeElement).toBe(quickField());
  });

  test("an Easy viewer's goes to the name heading", async () => {
    await open(invited("easy_viewer"));
    await expect.poll(welcome).not.toBeNull();
    await dismissByKeyboard();
    await expect.poll(welcome).toBeNull();
    expect(document.activeElement).toBe(easyView()?.querySelector("h1"));
  });
});
