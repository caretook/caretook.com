import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { fx, TEST_GROUP } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";
import { OFFLINE_GRACE_MS, OFFLINE_TEXT } from "./OfflineBanner";

// The offline banner (B-804) in the real /app frame around the probe: shown
// under the header once PowerSync has been not connected for the grace
// period, gone at once when it connects, and in the page's flow, clear of the
// header and the phone tab bar. The grace is timed with fake timers, from a
// drop and from a cold load. A drop as long as PowerSync's retry cycle (it
// drops `connected` for its 5 s retry delay while the network is up, B-840)
// never shows it.

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

type Device = Awaited<ReturnType<typeof open>>;

/** Online, then the connection drops with the grace on fake timers. */
const openThenDrop = async (options: Parameters<typeof renderWithDevice>[0] = {}) => {
  const device = await open({ connected: true, ...options });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  device.connect(false);
  await device.settle();
  return device;
};

/** Past the grace: the banner shows. */
const passGrace = async (device: Device) => {
  vi.advanceTimersByTime(OFFLINE_GRACE_MS);
  await device.settle();
  await expect.poll(strip).not.toBeNull();
  return strip();
};

afterEach(() => {
  vi.useRealTimers();
});

describe("the offline banner", () => {
  test("offline: nothing within the grace, then the banner in a status region; back online it goes at once", async () => {
    const device = await openThenDrop();
    vi.advanceTimersByTime(OFFLINE_GRACE_MS - 100);
    await device.settle();
    expect(strip()).toBeNull();
    expect(live()?.getAttribute("role")).toBe("status");

    vi.advanceTimersByTime(100);
    await expect.poll(() => strip()?.textContent).toBe(OFFLINE_TEXT);
    await expect.element(page.getByRole("status").filter({ hasText: OFFLINE_TEXT })).toBeVisible();
    // Not dismissable: no button in it.
    expect(live()?.querySelector("button")).toBeNull();

    device.connect(true);
    await expect.poll(strip).toBeNull();
    // The live region stays, empty, so the next change is announced once.
    expect(live()?.textContent).toBe("");

    // A second drop waits out the grace again.
    device.connect(false);
    await device.settle();
    expect(strip()).toBeNull();
    await passGrace(device);
  });

  test("a reconnect within the grace never shows it", async () => {
    const device = await openThenDrop();
    vi.advanceTimersByTime(OFFLINE_GRACE_MS - 500);
    device.connect(true);
    vi.advanceTimersByTime(OFFLINE_GRACE_MS * 2);
    await device.settle();
    expect(strip()).toBeNull();
  });

  test("a drop as long as PowerSync's retry cycle (5.5 s, then a reconnect) never shows it", async () => {
    const device = await openThenDrop();
    vi.advanceTimersByTime(7000);
    await device.settle();
    expect(strip()).toBeNull();
    device.connect(true);
    vi.advanceTimersByTime(OFFLINE_GRACE_MS * 2);
    await device.settle();
    expect(strip()).toBeNull();
  });

  test("a cold load offline: nothing at first, the banner once the grace has passed", async () => {
    // Real time still moves (the render needs it); the grace moves by hand.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    const device = await open();
    expect(strip()).toBeNull();
    expect(live()).not.toBeNull();
    vi.advanceTimersByTime(OFFLINE_GRACE_MS);
    await device.settle();
    await found(strip);
  });

  test("online from the start: no banner", async () => {
    const device = await open({ connected: true });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.advanceTimersByTime(OFFLINE_GRACE_MS * 2);
    await device.settle();
    expect(strip()).toBeNull();
  });

  test("at 420: under the header, above the tab bar, in the page's flow", async () => {
    const device = await openThenDrop();
    const banner = await passGrace(device);
    const region = live();
    expect(banner).not.toBeNull();
    expect(region).not.toBeNull();
    if (!banner || !region) return;
    const header = document.querySelector("body header")?.getBoundingClientRect();
    const bar = document.querySelector<HTMLElement>("nav[data-tab-bar]")?.getBoundingClientRect();
    const box = banner.getBoundingClientRect();
    expect(document.documentElement.clientWidth).toBe(420);
    expect(box.top).toBeGreaterThanOrEqual((header?.bottom ?? Infinity) - 0.5);
    expect(box.bottom).toBeLessThanOrEqual(bar?.top ?? -Infinity);
    expect(box.height).toBeGreaterThan(0);
    // In flow, with no layer of its own: sheets (z-50) and the bar (z-40) stay above it.
    expect(getComputedStyle(region).position).toBe("static");
    expect(getComputedStyle(banner).position).toBe("static");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  test("easy mode keeps it", async () => {
    const device = await openThenDrop({ role: "easy_helper" });
    const banner = await passGrace(device);
    expect(banner?.textContent).toBe(OFFLINE_TEXT);
  });
});
