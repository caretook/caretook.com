import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { fx, TEST_GROUP } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";
import { OFFLINE_TEXT } from "./OfflineBanner";

// The offline banner (B-804) in the real /app frame around the probe: shown
// under the header while PowerSync isn't connected, gone when it is, and in
// the page's flow, clear of the header and the phone tab bar.

const url = `/app/groups/${TEST_GROUP.id}/timeline`;
const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({
    route: PROBE,
    url,
    frame: true,
    fixtures: [fx.note({ text: "Slept well" })],
    ...options,
  });

const live = () => document.querySelector<HTMLElement>("[data-offline-banner]");
const strip = () => live()?.querySelector("p") ?? null;

describe("the offline banner", () => {
  test("offline: the banner in a status region; back online it goes, offline again it's back", async () => {
    const device = await open();
    const banner = await found(strip);
    expect(banner.textContent).toBe(OFFLINE_TEXT);
    expect(live()?.getAttribute("role")).toBe("status");
    await expect.element(page.getByRole("status").filter({ hasText: OFFLINE_TEXT })).toBeVisible();
    // Not dismissable: no button in it.
    expect(live()?.querySelector("button")).toBeNull();

    device.connect(true);
    await expect.poll(strip).toBeNull();
    // The live region stays, empty, so the next change is announced once.
    expect(live()).not.toBeNull();
    expect(live()?.textContent).toBe("");

    device.connect(false);
    await found(strip);
  });

  test("online from the start: no banner", async () => {
    await open({ connected: true });
    await expect.poll(() => document.querySelector('[data-region="status"] [role="status"]')).not.toBeNull();
    expect(strip()).toBeNull();
  });

  test("at 420: under the header, above the tab bar, in the page's flow", async () => {
    await open();
    const banner = await found(strip);
    const region = await found(live);
    const header = document.querySelector("body header")!.getBoundingClientRect();
    const bar = await found(() => document.querySelector<HTMLElement>("nav[data-tab-bar]"));
    const box = banner.getBoundingClientRect();
    expect(document.documentElement.clientWidth).toBe(420);
    expect(box.top).toBeGreaterThanOrEqual(header.bottom - 0.5);
    expect(box.bottom).toBeLessThanOrEqual(bar.getBoundingClientRect().top);
    expect(box.height).toBeGreaterThan(0);
    // In flow, with no layer of its own: sheets (z-50) and the bar (z-40) stay above it.
    expect(getComputedStyle(region).position).toBe("static");
    expect(getComputedStyle(banner).position).toBe("static");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  test("easy mode keeps it", async () => {
    await open({ role: "easy_helper" });
    const banner = await found(strip);
    expect(banner.textContent).toBe(OFFLINE_TEXT);
  });
});
