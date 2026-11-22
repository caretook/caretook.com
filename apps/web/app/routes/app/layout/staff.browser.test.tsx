import type { DeviceAnnouncement } from "~/lib/admin/announcement";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import { TEST_GROUP, TEST_USER } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";

// Staff in the /app frame (admin.mjs steps 1, 4, 10 and 11's screen parts):
// the account menu's Admin item by global role, and the announcement banner
// (fetched, dismissed, cached for offline, gone at its end). Staff-only
// access, the audit log and a posted banner reaching /app through the server
// are app-shell.mjs's.

const url = `/app/groups/${TEST_GROUP.id}/timeline`;

const open = ({
  role = null,
  announcement,
}: {
  role?: string | null;
  /** What `public.announcement` answers; undefined: the device is offline. */
  announcement?: () => DeviceAnnouncement | null;
} = {}) =>
  renderWithDevice({
    route: PROBE,
    url,
    frame: true,
    user: { ...TEST_USER, role },
    api: announcement ? { "public.announcement": announcement } : {},
  });

const menuItems = async () => {
  await userEvent.click(page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` }));
  const menu = page.getByRole("menu");
  await expect.element(menu).toBeVisible();
  return [...menu.element().querySelectorAll('[role^="menuitem"]')].map((el) => el.textContent?.trim());
};

describe("the account menu's Admin item", () => {
  test.each(["admin", "support"])("%s: Admin, right after Settings", async (role) => {
    await open({ role });
    const items = await menuItems();
    expect(items.indexOf("Admin")).toBe(items.indexOf("Settings") + 1);
  });

  test.each([null, "member"])("a member (%s): no Admin", async (role) => {
    await open({ role });
    expect(await menuItems()).not.toContain("Admin");
  });
});

const MAINTENANCE: DeviceAnnouncement = {
  id: "maint-1",
  text: "Maintenance tonight from 22:00",
  tone: "warning",
  endsAt: null,
};
const SLOW: DeviceAnnouncement = {
  id: "slow-1",
  text: "Sync is slow this morning",
  tone: "info",
  endsAt: null,
};

const banner = () => document.querySelector('[data-region="announcement"] [data-announcement]');
const bannerText = () => banner()?.textContent?.trim() ?? null;

describe("the announcement banner", () => {
  test("shows under the header in its tone, with Dismiss; dismissed, it stays gone on the next load; new text shows", async () => {
    let answer = MAINTENANCE;
    const first = await open({ announcement: () => answer });
    await expect.poll(bannerText).toBe(MAINTENANCE.text);
    await expect.poll(() => banner()?.getAttribute("data-tone")).toBe("warning");
    expect(document.querySelector('header + [data-region="announcement"]')).not.toBeNull();
    await expect.element(page.getByRole("complementary", { name: "Important announcement" })).toBeVisible();

    await userEvent.click(page.getByRole("button", { name: "Dismiss announcement" }));
    await expect.poll(banner).toBeNull();
    await first.screen.unmount();

    const again = await open({ announcement: () => answer });
    // It asked, and still shows nothing.
    await expect.poll(() => localStorage.getItem("caretook:announcement")).toContain(MAINTENANCE.id);
    expect(banner()).toBeNull();
    await again.screen.unmount();

    answer = SLOW;
    await open({ announcement: () => answer });
    await expect.poll(bannerText).toBe(SLOW.text);
    await expect.poll(() => banner()?.getAttribute("data-tone")).toBe("info");
  });

  test("offline, the cached banner shows; it goes at its end time without a reload", async () => {
    const endsAt = new Date(Date.now() + 2_000).toISOString();
    const online = await open({ announcement: () => ({ ...SLOW, endsAt }) });
    await expect.poll(bannerText).toBe(SLOW.text);
    await online.screen.unmount();

    // The server can't be reached: this device's copy.
    await open();
    await expect.poll(bannerText).toBe(SLOW.text);
    await expect.poll(banner, { timeout: 5_000 }).toBeNull();
    expect(Date.now()).toBeGreaterThanOrEqual(Date.parse(endsAt));
  });

  test("cleared on the server: the cached one goes", async () => {
    localStorage.setItem("caretook:announcement", JSON.stringify(SLOW));
    await open({ announcement: () => null });
    await expect.poll(() => localStorage.getItem("caretook:announcement")).toBeNull();
    await expect.poll(banner).toBeNull();
  });
});
