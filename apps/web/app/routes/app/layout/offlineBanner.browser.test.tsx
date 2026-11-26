import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { fx, TEST_GROUP } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";
import {
  DEV_UNREACHABLE_GRACE_MS,
  OFFLINE_GRACE_MS,
  OFFLINE_TEXT,
  offlineGraceMs,
  UNREACHABLE_GRACE_MS,
} from "./OfflineBanner";

// The offline banner (B-804) in the real /app frame around the probe: shown
// under the header once PowerSync has been not connected for the grace
// period, gone at once when it connects, a kit Notice overlaid under the
// header (B-905): it never moves the page, never covers the header, and stays
// under the phone tab bar. The grace is timed with fake timers, from a
// drop and from a cold load. A drop as long as PowerSync's retry cycle (it
// drops `connected` for its 5 s retry delay while the network is up, B-840)
// never shows it. With the browser still online (B-904: the sync service
// restarting, a closed stream, a token refresh, a reconnect slowed by a busy
// machine), only a drop past the longer unreachable grace shows it.

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
const strip = () => live()?.querySelector<HTMLElement>("[data-offline-strip]") ?? null;

type Device = Awaited<ReturnType<typeof open>>;

/** The browser's `navigator.onLine`, and its `online`/`offline` event, as a real network change sets them. */
const browserOnline = (online: boolean) => {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
};

/** The clock the grace runs on: its timers and `Date` (the drop's start). */
const fakeTimers = (options: { shouldAdvanceTime?: boolean } = {}) =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"], ...options });

/**
 * Online, then the connection drops with the grace on fake timers: a real
 * drop (the browser offline too) unless `browser: "online"`.
 */
const openThenDrop = async (
  options: Parameters<typeof renderWithDevice>[0] & { browser?: "online" | "offline" } = {},
) => {
  const { browser = "offline", ...rest } = options;
  const device = await open({ connected: true, ...rest });
  fakeTimers();
  if (browser === "offline") browserOnline(false);
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
  // Back to the browser's own `navigator.onLine`.
  delete (navigator as { onLine?: boolean }).onLine;
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

  test("the grace: 10 s with the browser offline, 30 s while it says online, 90 s on the dev server", () => {
    expect(offlineGraceMs(false, false)).toBe(OFFLINE_GRACE_MS);
    expect(offlineGraceMs(false, true)).toBe(OFFLINE_GRACE_MS);
    expect(offlineGraceMs(true, false)).toBe(UNREACHABLE_GRACE_MS);
    expect(offlineGraceMs(true, true)).toBe(DEV_UNREACHABLE_GRACE_MS);
    expect(UNREACHABLE_GRACE_MS).toBeGreaterThan(OFFLINE_GRACE_MS);
  });

  test("online, a sync-service drop (a restart, a closed stream, a token refresh) past the offline grace never shows it", async () => {
    const device = await openThenDrop({ browser: "online" });
    // A token refresh: dropped for a moment, then back.
    device.connect(true);
    await device.settle();
    device.connect(false);
    await device.settle();
    // The service restarting, its retries slowed by a busy machine: past the offline grace and more.
    vi.advanceTimersByTime(offlineGraceMs(true) - 100);
    await device.settle();
    expect(strip()).toBeNull();
    device.connect(true);
    vi.advanceTimersByTime(offlineGraceMs(true) * 2);
    await device.settle();
    expect(strip()).toBeNull();
  });

  test("online, a drop that holds past the unreachable grace (the network gone unseen) still shows it", async () => {
    const device = await openThenDrop({ browser: "online" });
    vi.advanceTimersByTime(offlineGraceMs(true) - 100);
    await device.settle();
    expect(strip()).toBeNull();
    vi.advanceTimersByTime(100);
    await expect.poll(() => strip()?.textContent).toBe(OFFLINE_TEXT);
  });

  test("the browser going offline mid-drop: the banner at the offline grace from the drop, not from then", async () => {
    const device = await openThenDrop({ browser: "online" });
    vi.advanceTimersByTime(4000);
    browserOnline(false);
    await device.settle();
    vi.advanceTimersByTime(OFFLINE_GRACE_MS - 4000 - 100);
    await device.settle();
    expect(strip()).toBeNull();
    vi.advanceTimersByTime(100);
    await expect.poll(() => strip()?.textContent).toBe(OFFLINE_TEXT);
    // The browser back online: the strip stays until PowerSync connects.
    browserOnline(true);
    await device.settle();
    expect(strip()).not.toBeNull();
    device.connect(true);
    await expect.poll(strip).toBeNull();
  });

  test("a cold load offline: nothing at first, the banner once the grace has passed", async () => {
    // Real time still moves (the render needs it); the grace moves by hand.
    fakeTimers({ shouldAdvanceTime: true });
    browserOnline(false);
    const device = await open();
    expect(strip()).toBeNull();
    expect(live()).not.toBeNull();
    vi.advanceTimersByTime(OFFLINE_GRACE_MS);
    await device.settle();
    await found(strip);
  });

  test("online from the start: no banner", async () => {
    const device = await open({ connected: true });
    fakeTimers();
    vi.advanceTimersByTime(OFFLINE_GRACE_MS * 2);
    await device.settle();
    expect(strip()).toBeNull();
  });

  test("at 420: a kit Notice under the header, above the tab bar, and the page doesn't move", async () => {
    const device = await openThenDrop();
    const main = document.querySelector("main");
    const mainTop = main?.getBoundingClientRect().top;
    expect(mainTop).toBeDefined();
    const banner = await passGrace(device);
    const region = live();
    expect(banner).not.toBeNull();
    expect(region).not.toBeNull();
    if (!banner || !region) return;
    // The kit's notice: a soft warning alert, with no live region of its own inside the banner's.
    expect(banner.classList.contains("alert")).toBe(true);
    expect(banner.classList.contains("alert-warning")).toBe(true);
    expect(banner.hasAttribute("role")).toBe(false);
    expect(region.getAttribute("role")).toBe("status");
    // Showing it doesn't shift the page.
    expect(main?.getBoundingClientRect().top).toBe(mainTop);
    const header = document.querySelector("body header")?.getBoundingClientRect();
    const bar = document.querySelector<HTMLElement>("nav[data-tab-bar]")?.getBoundingClientRect();
    const box = banner.getBoundingClientRect();
    expect(document.documentElement.clientWidth).toBe(420);
    expect(box.top).toBeGreaterThanOrEqual((header?.bottom ?? Infinity) - 0.5);
    expect(box.bottom).toBeLessThanOrEqual(bar?.top ?? -Infinity);
    expect(box.height).toBeGreaterThan(0);
    // Overlaid, on a layer under the tab bar (z-40) and sheets (z-50).
    expect(getComputedStyle(region).position).toBe("absolute");
    expect(Number(getComputedStyle(region).zIndex)).toBeLessThan(40);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  test("scrolled: it moves with the page, never over the header", async () => {
    const device = await openThenDrop();
    const banner = await passGrace(device);
    const header = document.querySelector("body header");
    expect(banner).not.toBeNull();
    expect(header).not.toBeNull();
    if (!banner || !header) return;
    // Enough page to scroll: the header and the banner go up together.
    document.body.style.minHeight = "3000px";
    window.scrollTo(0, 20);
    await expect.poll(() => window.scrollY).toBe(20);
    expect(banner.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      header.getBoundingClientRect().bottom - 0.5,
    );
    document.body.style.minHeight = "";
    window.scrollTo(0, 0);
  });

  test("easy mode keeps it", async () => {
    const device = await openThenDrop({ role: "easy_helper" });
    const banner = await passGrace(device);
    expect(banner?.textContent).toBe(OFFLINE_TEXT);
  });
});
