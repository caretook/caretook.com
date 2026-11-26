import type { DeviceRoute } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { legalLinks } from "~/lib/auth/legalLinks";
import * as home from "~/routes/app/home/route";
import * as account from "./account/route";
import * as settingsIndex from "./index/route";
import * as settingsLayout from "./layout/route";
import * as timelineLayout from "./timeline/route";
import * as units from "./units/route";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { TEST_USER } from "../../../../test/fixtures";
import { getByCss } from "../../../../test/locators";
import { setView, TIMELINE_ROUTES, TIMELINE_URL, view, world } from "../groups/timeline/timelineWorld";

// Account settings (ui.mjs's settings steps): Units and Timeline layout as
// named radiogroups that the arrow keys move, and Account (the frame by width
// is settingsFrame.browser.test.tsx's).
// Then the layout choice in Settings and the timeline's toggle as one
// preference (settings-layout.mjs's steps), against a stand-in for the
// account's server copy. Offline, a change kept pending on the device and
// applying at once is at the end; it reaching the server, and a real load
// reading the server's copy, are layout-offline.mjs's.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [
      { path: "/app/settings", id: "settings-index", module: settingsIndex },
      { path: "/app/settings/units", module: units },
      { path: "/app/settings/timeline", module: timelineLayout },
      { path: "/app/settings/account", module: account },
    ],
  },
];

const open = (url: string, width?: number) => renderWithDevice({ route: ROUTES, url, width });

describe.each([420, 1280])("at %i", (width) => {
  test("Units: four named choices, one unit chosen in each; an arrow key moves the choice", async () => {
    await open("/app/settings/units", width);
    await expect.element(page.getByRole("heading", { name: "Units", level: 1 })).toBeVisible();
    const names = ["Temperature", "Weight", "Blood sugar", "Fluid volume"];
    expect(page.getByRole("radiogroup").elements()).toHaveLength(names.length);
    for (const name of names)
      expect(
        page.getByRole("radiogroup", { name }).getByRole("radio", { checked: true }).elements(),
      ).toHaveLength(1);

    const temperature = page.getByRole("radiogroup", { name: "Temperature" }).getByRole("radio");
    const radios = temperature.elements() as HTMLInputElement[];
    const before = radios.findIndex((r) => r.checked);
    radios[before]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    const after = radios.findIndex((r) => r.checked);
    expect(after).not.toBe(before);
    expect(after).toBeGreaterThanOrEqual(0);
  });

  test("Timeline layout: the layout, named by the page's heading (Condensed or Full), then easy mode", async () => {
    await open("/app/settings/timeline", width);
    const group = page.getByRole("radiogroup", { name: "Timeline layout" });
    await expect.element(group).toBeVisible();
    expect(
      group
        .getByRole("radio")
        .elements()
        .map((r) => r.getAttribute("aria-label")),
    ).toEqual(["Condensed", "Full"]);
    expect(page.getByRole("radiogroup").elements()).toHaveLength(2);
    expect(
      page
        .getByRole("radiogroup", { name: "Easy mode" })
        .getByRole("radio")
        .elements()
        .map((r) => r.getAttribute("aria-label")),
    ).toEqual(["Always", "Never"]);
  });

  test("Account: the name and email, read-only, and Sign out (a POST to /sign-out)", async () => {
    await open("/app/settings/account", width);
    await expect.element(page.getByText(TEST_USER.email)).toBeVisible();
    expect(document.querySelector('main [data-field="name"]')?.textContent?.trim()).toBe(TEST_USER.name);
    expect(document.querySelector('main [data-field="email"]')?.textContent?.trim()).toBe(TEST_USER.email);
    // The Avatar card's radios are the page's only inputs.
    expect(document.querySelectorAll('main input:not([type="radio"])')).toHaveLength(0);
    const signOut = page.getByRole("button", { name: "Sign out" }).element();
    const form = signOut.closest("form")!;
    expect(form.getAttribute("action")).toBe("/sign-out");
    expect(form.getAttribute("method")).toBe("post");
  });

  test("Account: the three legal pages, each opening in a new tab", async () => {
    await open("/app/settings/account", width);
    for (const { label, href } of legalLinks(import.meta.env.VITE_API_ORIGIN)) {
      const link = page.getByRole("link", { name: label, exact: true });
      await expect.element(link).toHaveAttribute("href", href);
      await expect.element(link).toHaveAttribute("target", "_blank");
      await expect.element(link).toHaveAttribute("rel", "noreferrer");
    }
  });
});

describe("the timeline layout: Settings and the timeline's toggle change one preference", () => {
  /**
   * The account's preferences on the server, as `me.get` and
   * `me.updatePreferences` read and write them. `hold()` keeps the next saves
   * in flight until `release()`.
   */
  const account = (timelineView: "rows" | "cards" = "rows") => {
    const prefs = { units: {}, timelineView, easyMode: "group" };
    let held: Promise<void> | null = null;
    let release = () => {};
    const api = {
      "me.get": () => ({ ...prefs }),
      "me.updatePreferences": async (input: unknown) => {
        await held;
        Object.assign(prefs, input);
        return { preferences: { ...prefs }, ...prefs };
      },
    };
    const hold = () => {
      held = new Promise((r) => (release = r));
    };
    return { prefs, api, hold, release: () => release() };
  };

  const ROUTES_WITH_TIMELINE: DeviceRoute[] = [
    { path: "/app", id: "home", module: home },
    ...TIMELINE_ROUTES,
    ...ROUTES,
  ];
  /** A device signed in to the account, on the timeline, with the /app frame. */
  const openOn = (api: ReturnType<typeof account>["api"]) =>
    renderWithDevice({ route: ROUTES_WITH_TIMELINE, url: TIMELINE_URL, frame: true, fixtures: world(), api });

  const layout = () => page.getByRole("radiogroup", { name: "Timeline layout" });
  const chosen = () =>
    (layout().getByRole("radio").elements() as HTMLInputElement[])
      .filter((r) => r.checked)
      .map((r) => r.getAttribute("aria-label"))
      .join(",");
  /** Settings through the account menu, then its Timeline layout subpage (the list at 420). */
  const openSettings = async (device: Awaited<ReturnType<typeof openOn>>) => {
    await userEvent.click(page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` }));
    await userEvent.click(page.getByRole("menuitem", { name: "Settings" }));
    await expect.poll(device.location).toBe("/app/settings");
    await userEvent.click(page.getByRole("link", { name: /^Timeline layout/ }));
    await expect.element(layout()).toBeVisible();
    expect(device.location()).toBe("/app/settings/timeline");
  };
  /** The timeline through the header's Caretook link (one group, so /app opens it). */
  const openTimelineFromHeader = async (device: Awaited<ReturnType<typeof openOn>>) => {
    await userEvent.click(getByCss('header [data-region="group"] a[href="/app"]'));
    await expect.poll(device.location).toBe(TIMELINE_URL);
    await expect.poll(view).toBeDefined();
  };
  /** This browser's storage (the settings cache), to put back for "the same browser" later. */
  const storage = () =>
    Object.keys(localStorage).map((k): [string, string] => [k, localStorage.getItem(k) ?? ""]);
  const restore = (entries: [string, string][]) => {
    localStorage.clear();
    for (const [k, v] of entries) localStorage.setItem(k, v);
  };

  test("Full in Settings saves at once, and the timeline then shows the full layout", async () => {
    const server = account("rows");
    const device = await openOn(server.api);
    await expect.poll(view).toBe("rows");

    await openSettings(device);
    expect(chosen()).toBe("Condensed");
    await userEvent.click(layout().getByRole("radio", { name: "Full" }));
    await expect.element(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    expect(chosen()).toBe("Full");
    expect(server.prefs.timelineView).toBe("cards");

    await openTimelineFromHeader(device);
    await expect.poll(view).toBe("cards");
  });

  test("the timeline's toggle back to Condensed, then Settings at once (the save still in flight), shows Condensed", async () => {
    const server = account("cards");
    const device = await openOn(server.api);
    await expect.poll(view).toBe("cards");

    server.hold();
    await setView("Condensed");
    // Settings opens while the toggle's save is still on its way.
    const opening = openSettings(device);
    await expect.poll(device.location).toBe("/app/settings/timeline");
    expect(server.prefs.timelineView).toBe("cards");
    server.release();
    await opening;
    expect(chosen()).toBe("Condensed");
    expect(server.prefs.timelineView).toBe("rows");
  });

  test("the choice follows the account to a second browser, both ways", async () => {
    const server = account("rows");
    // The first browser chooses Full in Settings.
    const first = await openOn(server.api);
    await openSettings(first);
    await userEvent.click(layout().getByRole("radio", { name: "Full" }));
    await expect.element(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await first.screen.unmount();
    const firstBrowser = storage();

    // A second browser (nothing stored yet) shows the account's Full, then chooses Condensed.
    localStorage.clear();
    const second = await openOn(server.api);
    await expect.poll(view).toBe("cards");
    await openSettings(second);
    expect(chosen()).toBe("Full");
    await userEvent.click(layout().getByRole("radio", { name: "Condensed" }));
    await expect.element(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    expect(server.prefs.timelineView).toBe("rows");
    await second.screen.unmount();

    // The first browser's next visit follows the second's choice over its own cached Full.
    restore(firstBrowser);
    const again = await openOn(server.api);
    await expect.poll(view).toBe("rows");
    await openSettings(again);
    expect(chosen()).toBe("Condensed");
  });
});

// Offline (the test device has no server: every call fails as a lost
// connection does), a settings change is kept pending on the device and
// applies at once (layout-offline.mjs's one-device steps). The pending
// change reaching the server on the next online load is that check's.
describe("offline: a change is pending on the device and applies at once", () => {
  const PENDING_KEY = `caretook:settings-pending:${TEST_USER.id}`;
  const pending = () =>
    JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as Record<string, unknown> | null;

  test("Units: °C is saved on this device, pending, with no error; the vitals sheet then shows °C", async () => {
    const settings = await open("/app/settings/units");
    const celsius = await found(() =>
      document.querySelector<HTMLInputElement>('input[name="temperature"][value="c"]'),
    );
    expect(document.querySelector<HTMLInputElement>('input[name="temperature"][value="f"]')?.checked).toBe(
      true,
    );
    await userEvent.click(celsius);
    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Saved on this device. It'll sync when you're back online.");
    expect(page.getByRole("alert").elements()).toHaveLength(0);
    expect(pending()).toMatchObject({ units: { temperature: "c" } });
    await settings.screen.unmount();

    await renderWithDevice({
      route: TIMELINE_ROUTES,
      url: `${TIMELINE_URL}/new/vital?type=temperature`,
      fixtures: world(),
    });
    const dialog = await found(() => document.querySelector('[role="dialog"]'));
    await expect
      .poll(
        () => document.querySelector<HTMLInputElement>('[role="dialog"] input[name="vital.0.type"]')?.value,
      )
      .toBe("temperature");
    const labels = [...dialog.querySelectorAll(".label")].map((l) => l.textContent?.trim()).join(",");
    expect(labels).toContain("°C");
    expect(labels).not.toContain("°F");
  });

  test("the timeline's Full is pending, and still shown when the timeline opens again", async () => {
    const first = await renderWithDevice({ route: TIMELINE_ROUTES, url: TIMELINE_URL, fixtures: world() });
    await expect.poll(view).toBe("rows");
    await setView("Full");
    await expect.poll(() => pending()?.timelineView).toBe("cards");
    await first.screen.unmount();

    await renderWithDevice({ route: TIMELINE_ROUTES, url: TIMELINE_URL, fixtures: world() });
    await expect.poll(view).toBe("cards");
    expect(pending()?.timelineView).toBe("cards");
  });
});
