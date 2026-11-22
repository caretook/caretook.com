// A timeline layout change made offline isn't lost (quick-fixes slice 2):
// it's kept pending on the device and reaches the server on the next online
// load. Online it saves at once, and sign-out clears pending changes. The
// layout also follows the account: a change made in another browser shows on
// this one's next load, over its own cached copy.
//
// Units save the same way (quick-fixes slice 30): °F → °C chosen offline in
// Settings is pending, and the next online load sends it.
//
// What one device decides is settings.browser.test.tsx's: the Settings <->
// timeline toggle, and offline the pending change applying at once (still
// cards when the timeline opens again; "Saved on this device" and the vitals
// sheet in °C).
//
// The device's proxy cuts the whole browser's network (the rpc call is what
// matters). A real reload offline has its own steps: the service worker (B-144)
// serves the shell, and the timeline and a provider's page open from local data.
//
// The sheets open offline too, once a full load has their route modules (a
// row's edit sheet).
import { assetsSettled, DEV_FAMILY, expect, psql, signIn, signOut, test, waitFor } from "./fixtures.mjs";

const EMAIL = "member@example.com";

const serverView = () =>
  psql(`SELECT coalesce(preferences->>'timelineView', 'rows') FROM "user" WHERE email = '${EMAIL}'`);
const serverTemp = () =>
  psql(`SELECT coalesce(preferences->'units'->>'temperature', 'f') FROM "user" WHERE email = '${EMAIL}'`);
const setServerView = (view) =>
  psql(
    `UPDATE "user" SET preferences = coalesce(preferences, '{}'::jsonb) || '{"timelineView":"${view}"}'::jsonb WHERE email = '${EMAIL}'`,
  );
const resetPrefs = () =>
  psql(`UPDATE "user" SET preferences = preferences - 'timelineView' - 'units' WHERE email = '${EMAIL}'`);

const pendingCount = (page) =>
  page.evaluate(
    () => Object.keys(localStorage).filter((k) => k.startsWith("caretook:settings-pending:")).length,
  );
const pendingOf = (page, field) =>
  page.evaluate((f) => {
    const k = Object.keys(localStorage).filter((x) => x.startsWith("caretook:settings-pending:"))[0];
    if (!k) return null;
    const v = JSON.parse(localStorage.getItem(k));
    return f === "temperature" ? (v.units?.temperature ?? null) : (v.timelineView ?? null);
  }, field);
const isCards = (page) => page.evaluate(() => document.querySelector("ol")?.dataset.view === "cards");

const rows = (page) => page.locator("ol > li");
const rowsShown = (page, timeline) =>
  waitFor(page, (path) => location.pathname === path && document.querySelectorAll("ol > li").length > 0, {
    arg: timeline,
    timeout: 20_000,
  });

async function setView(page, view) {
  await page.getByRole("button", { name: "View options" }).click();
  await page.getByRole("menuitemradio", { name: view, exact: true }).click();
  await waitFor(page, (cards) => (document.querySelector("ol")?.dataset.view === "cards") === cards, {
    arg: view === "Cards",
    timeout: 5000,
  });
}

test("a layout change made offline reaches the server; units too", { tag: "@smoke" }, async ({ device }) => {
  resetPrefs();
  try {
    const d = await device("member", { offlineable: true });
    const { page } = d;
    await signIn(page, EMAIL);
    await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });
    const timeline = new URL(page.url()).pathname;
    const dialog = page.locator("[role=dialog]");

    await test.step("starts in rows", async () => {
      expect(await isCards(page)).toBe(false);
      expect(serverView()).toBe("rows");
    });

    // Online: saved straight away, nothing pending.
    await setView(page, "Cards");
    await test.step("online: the server has cards at once", async () => {
      await expect.poll(serverView).toBe("cards");
    });
    await test.step("online: nothing left pending", async () => {
      expect(await pendingCount(page)).toBe(0);
    });
    await setView(page, "Rows");
    await test.step("online: switching back saves too", async () => {
      await expect.poll(serverView).toBe("rows");
    });

    // Offline: switch to cards.
    await assetsSettled(page);
    d.offline(true);
    await setView(page, "Cards");
    await test.step("offline: the change is pending", async () => {
      await expect.poll(() => pendingOf(page, "timelineView")).toBe("cards");
    });
    await test.step("offline: the server still has rows", () => {
      expect(serverView()).toBe("rows");
    });

    // Back online: a real reload sends the pending change first.
    d.offline(false);
    await page.goto(timeline);
    await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });
    await test.step("online again: still cards after a reload", async () => {
      await expect.poll(() => isCards(page)).toBe(true);
    });
    await test.step("online again: the server has cards", async () => {
      await expect.poll(serverView).toBe("cards");
    });
    await test.step("online again: nothing left pending", async () => {
      await expect.poll(() => pendingCount(page)).toBe(0);
    });
    // The sheets' route modules, loaded after a full load (prefetched by the +
    // menu and the rows); offline below, they must open without the server.
    await waitFor(
      page,
      () =>
        ["new", "edit"].every(
          (r) => window.__reactRouterRouteModules?.["routes/app/groups/timeline/" + r + "/route"],
        ),
      { timeout: 20_000 },
    ).catch(() => {});

    // Units: open Settings → Units inside the app while online (so the
    // timeline's code stays loaded), then go offline and choose °C.
    await test.step("units: the server starts in °F", () => {
      expect(serverTemp()).toBe("f");
    });
    await page.locator('header [data-region="user"] button[aria-label^="Account menu for"]').click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await page.locator('nav[data-settings-nav] a[href="/app/settings/units"]').click({ timeout: 30_000 });
    const tempRadio = (unit) => page.locator(`input[name="temperature"][value="${unit}"]`);
    await expect(tempRadio("c")).toBeVisible({ timeout: 30_000 });
    await test.step("units: °F is chosen", async () => {
      await expect(tempRadio("f")).toBeChecked();
    });

    await assetsSettled(page);
    d.offline(true);
    await tempRadio("c").click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // Kept on the device (what the page says about it is a component test).
    await expect.poll(() => pendingOf(page, "temperature"), { timeout: 10_000 }).toBe("c");
    await test.step("units offline: the server still has °F", () => {
      expect(serverTemp()).toBe("f");
    });

    // Back to the timeline (still offline).
    await page.evaluate(() => history.go(-2));
    await rowsShown(page, timeline);

    // Still offline: a row's edit link opens its edit sheet.
    await test.step("offline: a row's edit link opens its edit sheet", async () => {
      await page.locator('main ol a[aria-label^="Edit "]').first().click({ timeout: 10_000 });
      await expect(dialog.locator("form")).toBeVisible({ timeout: 10_000 });
      await expect(dialog).toHaveText(/Edit (symptom|vital|dose)/i);
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 5000 });

    // Back online: the next load sends it. Meanwhile the account's layout is
    // changed elsewhere (another signed-in browser; here straight on the
    // server): the load shows the account's choice over this device's copy.
    d.offline(false);
    setServerView("rows");
    await page.goto(timeline);
    await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });
    await test.step("units online again: the server has °C", async () => {
      await expect.poll(serverTemp).toBe("c");
    });
    await test.step("units online again: nothing left pending", async () => {
      await expect.poll(() => pendingCount(page)).toBe(0);
    });
    await test.step("the layout follows the account: another browser's Rows shows on the next load", async () => {
      await expect.poll(() => isCards(page)).toBe(false);
      expect(serverView()).toBe("rows");
    });

    // A real reload offline (B-144): the full loads above installed the service
    // worker, so an /app page load gets its cached shell and the screen opens
    // from the local database: a provider's page (a route the shell's own
    // document never loads), then the timeline.
    await test.step("service worker: installed and controlling the page", async () => {
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller),
            ),
          {
            timeout: 20_000,
          },
        )
        .toBe(true);
    });
    const providerId = psql(
      `SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND deleted_at IS NULL ORDER BY name LIMIT 1`,
    );
    const providerName = psql(`SELECT name FROM provider WHERE id = '${providerId}'`);
    const providerPage = timeline.replace(/\/timeline$/, `/providers/${providerId}`);

    // Sign-out clears pending changes (one left by an offline switch).
    await assetsSettled(page);
    d.offline(true);
    // The provider's page first, so the timeline is where the steps below go on.
    await test.step("offline reload: a provider's page opens from local data", async () => {
      await page.goto(providerPage);
      await expect(page.locator("main h1")).toContainText(providerName, { timeout: 30_000 });
      expect(await page.evaluate(() => performance.getEntriesByType("navigation")[0].workerStart > 0)).toBe(
        true,
      );
    });
    await test.step("offline reload: the timeline opens from local data", async () => {
      await page.goto(timeline);
      await expect(rows(page).first()).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => performance.getEntriesByType("navigation")[0].workerStart > 0)).toBe(
        true,
      );
    });
    await setView(page, "Cards");
    await expect.poll(() => pendingCount(page)).toBe(1);
    d.offline(false);
    await signOut(page);
    await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 15_000 });
    await test.step("sign-out clears pending changes", async () => {
      await expect.poll(() => pendingCount(page)).toBe(0);
    });

    // Errors from requests cut on purpose (and PowerSync's dropped stream) are expected.
    const noise =
      /Failed to fetch|ERR_|net::|NetworkError|WebSocket|PowerSync|sync|error closing database connection|vite/i;
    await test.step("no unexpected console errors", () => {
      expect(d.errors.filter((e) => !noise.test(e)).slice(0, 3)).toEqual([]);
    });
  } finally {
    resetPrefs();
  }
});
