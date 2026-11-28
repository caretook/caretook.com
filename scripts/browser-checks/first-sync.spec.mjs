// A fresh sign-in shows something within about a second, even when the first
// sync is slow, and a synced device never shows the syncing state (B-22).
//
// 1. Normal sign-in (fast first sync): straight to the timeline, no syncing state.
// 2. Reload a synced timeline: no syncing state. Then a sheet's URL loaded as a
//    page (a deep link after a full load) opens the sheet (closing it, filters
//    kept, is timelineSheetUrls.browser.test.tsx's). Then a new care group
//    (careGroup.create) syncs in, opens on its setup pages, and Later reaches
//    its timeline.
// 3. Slow first sync (the device's proxy holds PowerSync's traffic for HOLD_MS):
//    home shows "Syncing your care groups…" (never "not in a care group"), then
//    goes straight to the timeline once the group arrives.
// 4. Same, signing in to a deep link (the timeline): the syncing state, not a 404.
// 5. Same, deep-linking to another group route (group settings' Members): the
//    group route shows the syncing state for every screen in the group, then the page.
//
// Times are from pressing "Sign in". Each slow run is a new device (a new
// context: its own PowerSync database and shared worker).
import { readFileSync } from "node:fs";
import { PASSWORD, expect, psql, test } from "./fixtures.mjs";

// PowerSync's URL as the app sees it (apps/web/.env), so the proxy knows which traffic to hold.
const webEnv = (() => {
  try {
    return readFileSync(new URL("../../apps/web/.env", import.meta.url), "utf8");
  } catch {
    return "";
  }
})();
const PS_URL =
  process.env.VITE_POWERSYNC_URL ??
  /^VITE_POWERSYNC_URL="?([^"\n]+)/m.exec(webEnv)?.[1] ??
  "http://localhost:8080";
const PS_PORT = String(new URL(PS_URL).port || 80);
const HOLD_MS = Number(process.env.HOLD_MS ?? 4000);

// Records, from the moment it's installed, when each milestone first happens.
const RECORDER = `(() => {
  const t0 = performance.now(); const m = (window.__m = { seenPending: false, seenNoGroup: false, seen404: false });
  const tick = () => {
    const t = Math.round(performance.now() - t0);
    const text = document.body?.innerText ?? "";
    if (window.caretookSync && m.dbOpen == null) m.dbOpen = t;
    if (window.caretookSync?.powersync.currentStatus.hasSynced && m.hasSynced == null) m.hasSynced = t;
    if (location.pathname !== "/sign-in" && m.leftSignIn == null) m.leftSignIn = t;
    if (document.querySelector("[data-first-sync-pending]")) { m.seenPending = true; m.pending ??= t; }
    if (text.includes("not in a care group")) m.seenNoGroup = true;
    if (text.includes("Not found")) m.seen404 = true;
    if (document.querySelector(window.__ready || "ol > li") && m.firstRow == null) m.firstRow = t;
    requestAnimationFrame(tick);
  };
  tick(); return true; })()`;

// What shows that a page has rendered: a timeline row, or a member in group settings.
const READY = { timeline: "ol > li", "settings/members": "[data-section=members] li" };

const milestones = (page) => page.evaluate(() => ({ ...window.__m }));

/** caretaker@'s care group, for the deep link (caretaker@ has one; member@ has two). */
const caretakerGroup = () =>
  psql(
    "SELECT g.id FROM care_group g JOIN care_group_member m ON m.group_id = g.id JOIN \"user\" u ON u.id = m.user_id WHERE u.email = 'caretaker@example.com' LIMIT 1",
  );

async function signInTimed(page, { redirectTo, hold, proxy, ready = READY.timeline } = {}) {
  await page.goto(redirectTo ? `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}` : "/sign-in");
  await page.locator('input[name="email"]').fill("caretaker@example.com");
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.evaluate(`window.__ready = ${JSON.stringify(ready)}`);
  await page.evaluate(RECORDER);
  if (hold) {
    proxy.hold(PS_PORT);
    setTimeout(() => proxy.release(), HOLD_MS);
  }
  await page.locator('form button[type="submit"]').click();
  try {
    await expect
      .poll(async () => (await milestones(page)).firstRow != null, { timeout: 30_000, intervals: [100] })
      .toBe(true);
  } catch (e) {
    console.log(
      "stuck at",
      page.url(),
      await page.evaluate(() => JSON.stringify(window.caretookSync?.powersync.currentStatus.toJSON())),
      JSON.stringify(await milestones(page).catch(() => null)),
    );
    console.log(((await page.locator("body").innerText()) ?? "").slice(0, 300));
    throw e;
  }
  // The milestones up to the first row are what's measured: nothing to wait for after it.
  return milestones(page);
}

test("a normal sign-in, a reload, a sheet's URL and a new group", { tag: "@smoke" }, async ({ device }) => {
  const { page, errors } = await device("fast");
  const groupId = caretakerGroup();
  const newGroupTag = `FS${Date.now().toString(36)}`;

  const m = await signInTimed(page);
  console.log("fast sign-in:", JSON.stringify(m));
  await test.step("a normal sign-in shows no syncing state and no 'not in a care group'", () => {
    expect(m.seenPending).toBe(false);
    expect(m.seenNoGroup).toBe(false);
  });
  await test.step("a normal sign-in lands on the timeline", () => {
    expect(new URL(page.url()).pathname).toMatch(/\/timeline$/);
  });
  const path = new URL(page.url()).pathname;

  await test.step("a synced device opens the timeline with no syncing state", async () => {
    await page.context().addInitScript(RECORDER);
    await page.goto(path);
    await expect
      .poll(async () => (await milestones(page).catch(() => ({}))).firstRow != null, { timeout: 20_000 })
      .toBe(true);
    // The recorder ran from the first paint to the first row: a syncing state would have been seen.
    const r = await milestones(page);
    console.log("synced reload:", JSON.stringify(r));
    expect(r.seenPending).toBe(false);
  });

  // A sheet's URL loaded as a page opens the sheet over the timeline.
  const dialog = page.locator("[role=dialog]");
  await test.step("a sheet's URL loaded as a page opens the sheet with its vital type", async () => {
    await page.goto(`${path}/new/vital?kind=vital&type=heartRate`);
    await expect(dialog.locator('input[name="vital.0.type"]')).toHaveValue("heartRate", { timeout: 20_000 });
  });

  // A new care group: careGroup.create on the server, then the group syncs
  // into this device and opens on its setup pages (the creator's first open);
  // Later reaches its timeline. Deleted at once, so caretaker@ keeps one group
  // for the steps below.
  try {
    await test.step("a new care group syncs in and opens on its setup pages; Later reaches its timeline", async () => {
      await page.goto("/app/groups/new");
      await page.locator('[data-new-group-form] [name="recipientName"]').fill(`${newGroupTag} Lou Example`);
      await page.locator('[data-new-group-form] button[type="submit"]').click();
      await page.waitForURL(
        (url) => /\/setup\/providers$/.test(url.pathname) && !url.pathname.includes(groupId),
        {
          timeout: 20_000,
        },
      );
      await page.locator("[data-setup-later]").click();
      await page.waitForURL((url) => /\/timeline$/.test(url.pathname) && !url.pathname.includes(groupId), {
        timeout: 20_000,
      });
    });
  } finally {
    psql(
      `DELETE FROM care_group WHERE id IN (SELECT group_id FROM care_recipient WHERE name LIKE '${newGroupTag}%')`,
    );
  }
  console.log("errors:", errors);
});

for (const deepLink of [null, "timeline", "settings/members"]) {
  const name = deepLink ? `slow first sync, deep link to ${deepLink}` : "slow first sync, home";
  test(name, async ({ device }) => {
    const d = await device(deepLink ? "slow-deep" : "slow", { offlineable: true });
    const { page, errors } = d;
    const redirectTo = deepLink ? `/app/groups/${caretakerGroup()}/${deepLink}` : null;
    const m = await signInTimed(page, {
      redirectTo,
      hold: true,
      proxy: d.proxy,
      ready: READY[deepLink ?? "timeline"],
    });
    console.log(
      `slow sign-in${deepLink ? ` (deep link to ${deepLink})` : ""}, PowerSync held ${HOLD_MS} ms:`,
      JSON.stringify(m),
    );
    await test.step("a slow first sync shows the syncing state within ~1 s of the database opening", () => {
      expect(m.pending, "the syncing state was shown").not.toBeNull();
      expect(m.pending - m.dbOpen).toBeLessThan(1500);
    });
    await test.step("home never says 'not in a care group' before the first sync", () => {
      expect(m.seenNoGroup).toBe(false);
    });
    await test.step("a deep link isn't a 404 before the first sync", () => {
      expect(m.seen404).toBe(false);
    });
    const end = deepLink ?? "timeline";
    await test.step(`it still ends on the ${end === "settings/members" ? "group settings' Members" : "timeline"}`, () => {
      expect(new URL(page.url()).pathname.endsWith(`/${end}`)).toBe(true);
    });
    await test.step("the syncing state goes once synced", async () => {
      await expect(page.locator("[data-first-sync-pending]")).toHaveCount(0);
    });
    console.log("errors:", errors);
  });
}
