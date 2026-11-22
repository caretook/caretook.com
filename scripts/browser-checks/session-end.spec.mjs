// The device copy ends with the session (quick-fixes slice 28, S-2):
// - offline, the cached user carries on only within 3 days of the last
//   confirmed session check; past that, sign-in with a message, and the
//   local copy stays (unsynced writes still upload after signing back in);
// - online, every check restarts the 3 days;
// - when the server says the session has ended, the device's copy is wiped
//   (the sign-out path) and the app goes to sign-in.
//
// The session ends as the Devices page ends one (B-124): another device of
// the same account, here a client of Better Auth's API with a bearer token,
// finds this browser's session in list-sessions and revokes it by its token.
// Then that device's "Sign out everywhere else" ends a third session and keeps
// its own. The page itself is component tests (settings/devices/devices.browser.test.tsx).
//
// A full reload can't load while offline (no service worker yet), so the
// offline step is an in-app navigation: a kind filter link on the timeline,
// whose route module is already loaded, runs the /app session check again.
//
// A fresh session (confirmed within 15 minutes, B-136) doesn't hold up
// navigation: the session ended elsewhere is found by the background
// recheck (due once the confirmation is a minute old), which wipes the
// device and goes to sign-in from wherever the navigation had got to.
//
// The wipe takes what search keeps on the device too (the old signout-wipe
// check): the user's recent searches (localStorage) and the search index,
// whose tables live outside PowerSync's, so `dropSearchTables` must run
// before the database is cleared.
import {
  BASE,
  assetsSettled,
  PASSWORD,
  expect,
  localCopyHolds,
  psql,
  randomIp,
  signIn,
  test,
} from "./fixtures.mjs";

const EMAIL = "caretaker@example.com";
const DAY = 24 * 60 * 60 * 1000;
const OFFLINE_MESSAGE = "You've been offline for 3 days. Sign in to keep going.";

// functions are serialised into the page one by one, so the helpers are inlined there
const readConfirmed = () => {
  const k = Object.keys(localStorage)
    .filter((x) => x.startsWith("caretook:"))
    .find((x) => x.startsWith("caretook:session-confirmed:"));
  return Number(localStorage.getItem(k));
};
const setConfirmed = (ago) => {
  const k = Object.keys(localStorage)
    .filter((x) => x.startsWith("caretook:"))
    .find((x) => x.startsWith("caretook:session-confirmed:"));
  localStorage.setItem(k, String(Date.now() - ago));
};
const caretookKeys = (page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("caretook:")));
const recentSearchKeys = () =>
  Object.keys(localStorage).filter((k) => k.startsWith("caretook:recentSearches:"));
const statusText = (page) =>
  page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? "");

/** Another device of the account: Better Auth's API with a bearer token (its own address, for the rate limits). */
async function otherDevice() {
  const ip = randomIp();
  const call = async (path, { token, body } = {}) => {
    const r = await fetch(`${BASE}/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
        origin: BASE,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const signedIn = await call("sign-in/email", { body: { email: EMAIL, password: PASSWORD } });
  const token = signedIn.json?.token;
  if (!token) throw new Error(`the other device couldn't sign in: ${signedIn.status}`);
  return {
    call: (path, body) => call(path, { token, body }),
    alive: async () => !!(await call("get-session", { token })).json?.session,
  };
}

test("the device copy ends with the session", { tag: "@smoke" }, async ({ device }) => {
  const d = await device("caretaker", { offlineable: true });
  const { page } = d;
  await signIn(page, EMAIL);
  await expect(page.locator("ol > li").first()).toBeVisible({ timeout: 30_000 });
  const timeline = new URL(page.url()).pathname;
  const symptomChip = page.locator('main a[href*="kind=symptom"]').first();

  await test.step("an online check records when it was confirmed", async () => {
    await expect.poll(async () => Date.now() - (await page.evaluate(readConfirmed)) < 60_000).toBe(true);
  });

  // Offline, 4 days since the last confirmed check: sign-in, data kept.
  await page.evaluate(setConfirmed, 4 * DAY);
  await assetsSettled(page);
  d.offline(true);
  await expect(symptomChip).toBeVisible({ timeout: 5000 });
  await symptomChip.evaluate((a) => a.click());
  await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 15_000 });
  await test.step("offline past 3 days: sign-in says why", async () => {
    await expect.poll(() => statusText(page), { timeout: 10_000 }).toContain(OFFLINE_MESSAGE);
  });
  await test.step("offline past 3 days: comes back to the timeline after", async () => {
    const redirectTo = new URL(page.url()).searchParams.get("redirectTo");
    expect(redirectTo?.startsWith(timeline)).toBe(true);
  });
  await test.step("offline past 3 days: the cached user and local copy stay", async () => {
    const locked = (await caretookKeys(page)).join(",");
    expect(locked).toContain("caretook:session-user");
    expect(locked).toContain("caretook:sync-owner");
  });
  await test.step("offline past 3 days: the database still holds the care data", async () => {
    expect(await localCopyHolds(page, "Grandma Pat")).toBe("holds it");
  });
  await test.step("offline past 3 days: its rows are still there", async () => {
    const n = await page.evaluate(() =>
      window.caretookSync.powersync.get("SELECT count(*) n FROM timeline_entry").then((r) => r.n),
    );
    expect(n).toBeGreaterThan(0);
  });

  // Back online, still signed in: the app opens and the 3 days restart.
  d.offline(false);
  await page.goto(timeline);
  await expect(page.locator("ol > li").first()).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe(timeline);
  await test.step("online again: the timeline opens, the 3 days restart", async () => {
    await expect.poll(async () => Date.now() - (await page.evaluate(readConfirmed)) < 60_000).toBe(true);
  });

  // A search used on the search page (submitted) is saved, and the index is built.
  await page.goto(timeline.replace(/\/timeline$/, "/search"));
  const field = page.locator("[data-search-page] [data-search-field]");
  await field.fill("Grandma");
  await field.evaluate((el) => el.form.requestSubmit());
  await test.step("search: a used search is saved for its user", async () => {
    await expect.poll(() => page.evaluate(recentSearchKeys)).not.toEqual([]);
  });
  await test.step("search: the index is in the local copy while signed in", async () => {
    await page.evaluate(async () => {
      const { search } = await window.caretookModules();
      await search.searchIndexSettled();
    });
    expect(await localCopyHolds(page, "search_fts")).toBe("holds it");
  });
  await page.goto(timeline);
  await expect(page.locator("ol > li").first()).toBeVisible({ timeout: 30_000 });

  // Another device signs this one out, as the Devices page does: the next online check wipes it.
  const pId = await page.evaluate(() =>
    fetch("/api/auth/get-session", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => j?.session?.id ?? null),
  );
  const other = await otherDevice();
  let mine;
  await test.step("the other device lists this browser's session", async () => {
    const listed = (await other.call("list-sessions")).json ?? [];
    mine = listed.find((s) => s.id === pId);
    expect(mine?.token, `${pId} in ${listed.length}`).toBeTruthy();
  });
  await test.step("signed out from the other device: the session is gone on the server", async () => {
    const revoked = await other.call("revoke-session", { token: mine?.token });
    expect(revoked.status).toBe(200);
    expect(psql(`SELECT count(*) FROM session WHERE id = '${pId}'`)).toBe("0");
  });
  await test.step("sign out everywhere else: the other sessions end, the asking device stays", async () => {
    const third = await otherDevice();
    await other.call("revoke-other-sessions", {});
    expect(await third.alive()).toBe(false);
    expect(await other.alive()).toBe(true);
  });
  await other.call("sign-out", {});

  // Quick entry's recent lines go with the rest.
  await page.evaluate(() => localStorage.setItem("caretook:recentLines:x:y", JSON.stringify(["bp 120/80"])));
  // Fresh, but due a recheck (confirmed 5 minutes ago): an in-app navigation
  // goes ahead at once, and the background recheck finds the session gone.
  // A tab-lived flag records whether the filtered timeline was ever shown.
  await page.evaluate(setConfirmed, 5 * 60 * 1000);
  await page.evaluate(() => {
    sessionStorage.removeItem("caretook-check:went-ahead");
    setInterval(() => {
      if (location.search.includes("kind=symptom") && document.querySelector("main ol > li"))
        sessionStorage.setItem("caretook-check:went-ahead", "1");
    }, 5);
  });
  await expect(symptomChip).toBeVisible({ timeout: 5000 });
  await symptomChip.click();
  await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 20_000 });
  await test.step("fresh session: the navigation went ahead without waiting for the server", async () => {
    expect(await page.evaluate(() => sessionStorage.getItem("caretook-check:went-ahead"))).toBe("1");
  });
  await test.step("fresh session ended elsewhere: the background recheck goes to sign-in, back to where it was", () => {
    expect(new URL(page.url()).searchParams.get("redirectTo")).toContain("kind=symptom");
  });
  await test.step("signed out: the cached user, owner, confirmation, last group, recent searches and recent lines are gone", async () => {
    await expect
      .poll(async () => (await caretookKeys(page)).join(","), { timeout: 10_000 })
      .not.toMatch(/session-user|sync-owner|session-confirmed|lastGroup|settings|recentSearches|recentLines/);
  });
  await test.step("signed out: no message about being offline", async () => {
    expect(await statusText(page)).not.toContain("offline");
  });
  // The file stays, vacuumed: none of the care data is left in its bytes.
  await test.step("signed out: the database holds none of the care data", async () => {
    await expect
      .poll(async () => ["clean", "no file"].includes(await localCopyHolds(page, "Grandma Pat")), {
        timeout: 10_000,
      })
      .toBe(true);
  });
  await test.step("signed out: the search index is dropped (no search table left in the file)", async () => {
    await expect
      .poll(async () => ["clean", "no file"].includes(await localCopyHolds(page, "search_fts")), {
        timeout: 10_000,
      })
      .toBe(true);
  });
  // Offline, PowerSync logs its failed connection attempts: expected here.
  await test.step("no page errors", () => {
    expect(d.errors.filter((e) => !e.includes("[PowerSync]: Sync error"))).toEqual([]);
  });
});
