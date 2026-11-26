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
// device and goes to sign-in from wherever the navigation had got to (the
// check holds the server's answer until the new page shows).
//
// The session ends here with a change still waiting to upload (sync-safety
// slice 4, B-290): the cache cookie is dropped so the upload is refused, as
// it would be once the cookie cache lapses. The device keeps its copy closed
// for its owner and forgets the rest; signing in again as the same person
// uploads the change. (With nothing waiting it's wiped: unit and component
// tests, lib/auth/sessionEnd.browser.test.tsx.)
//
// Then a Sign out that can't reach the server (the old signout-wipe check;
// only the sign-out request fails, so the check needn't wait for the assets
// to settle as a real offline window does): the device is wiped
// at once and lands on sign-in, and the wipe takes what search keeps on the
// device too: the user's recent searches (localStorage) and the search index,
// whose tables live outside PowerSync's, so `dropSearchTables` must run
// before the database is cleared. Back online, the pending sign-out is
// finished before any session check, so the old session no longer opens /app.
import {
  BASE,
  assetsSettled,
  PASSWORD,
  expect,
  localCopyHolds,
  psql,
  randomIp,
  signIn,
  signOut,
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

  // A change written now can't upload: without the cache cookie (B-140) the
  // server checks the revoked session and refuses the upload.
  await page.context().clearCookies({ name: /session_data/ });
  const groupId = timeline.split("/")[3];
  const unsentId = await page.evaluate(async (groupId) => {
    const { liveEntry } = await window.caretookModules();
    const id = crypto.randomUUID();
    const made = await liveEntry.materializeLiveEntry(window.caretookSync, {
      id,
      groupId,
      kind: "note",
      title: "session-end unsent note",
      occurredAt: new Date().toISOString(),
      timeZone: "America/Los_Angeles",
    });
    if (!made.ok) throw new Error(JSON.stringify(made));
    return id;
  }, groupId);

  // Quick entry's recent lines go with the rest.
  await page.evaluate(() => localStorage.setItem("caretook:recentLines:x:y", JSON.stringify(["bp 120/80"])));
  // Fresh, but due a recheck (confirmed 5 minutes ago): an in-app navigation
  // goes ahead at once, and the background recheck finds the session gone.
  // The recheck's answer is held until the filtered timeline shows, so "went
  // ahead without waiting" is what's asserted, not a race between the
  // navigation's loaders and a local round trip (B-869). An answer that does
  // come first, mid-navigation, is a unit test (lib/auth/session.test.ts).
  await page.evaluate(setConfirmed, 5 * 60 * 1000);
  const GET_SESSION = (url) => url.pathname === "/api/auth/get-session";
  let release;
  const released = new Promise((resolve) => (release = resolve));
  let held = 0;
  await page.route(GET_SESSION, async (route) => {
    held++;
    await released;
    await route.continue();
  });
  await expect(symptomChip).toBeVisible({ timeout: 5000 });
  try {
    await symptomChip.click();
    await test.step("fresh session: the navigation went ahead without waiting for the server", async () => {
      await page.waitForURL((url) => url.searchParams.get("kind") === "symptom", { timeout: 10_000 });
      await expect(page.locator("main ol > li").first()).toBeVisible({ timeout: 10_000 });
      expect(held, "the recheck asked the server, still unanswered").toBeGreaterThan(0);
    });
  } finally {
    release();
  }
  await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 20_000 });
  await page.unroute(GET_SESSION);
  await test.step("fresh session ended elsewhere: the background recheck goes to sign-in, back to where it was", () => {
    expect(new URL(page.url()).searchParams.get("redirectTo")).toContain("kind=symptom");
  });
  await test.step("ended with a change waiting: the cached user, confirmation, last group, recent searches and lines are gone; the owner stays", async () => {
    await expect
      .poll(async () => (await caretookKeys(page)).join(","), { timeout: 10_000 })
      .not.toMatch(/session-user|session-confirmed|lastGroup|settings:|recentSearches|recentLines/);
    const kept = (await caretookKeys(page)).join(",");
    expect(kept).toContain("caretook:sync-owner");
    expect(kept).toContain("caretook:sync-kept");
  });
  await test.step("signed out: no message about being offline", async () => {
    expect(await statusText(page)).not.toContain("offline");
  });
  await test.step("ended with a change waiting: the local copy still holds it", async () => {
    expect(await localCopyHolds(page, "session-end unsent note")).toBe("holds it");
  });
  await signIn(page, EMAIL);
  await test.step("signed in again as the same person: the change reaches the server", async () => {
    await expect
      .poll(() => psql(`SELECT count(*) FROM timeline_entry WHERE id = '${unsentId}'`), { timeout: 20_000 })
      .toBe("1");
  });
  psql(`UPDATE timeline_entry SET deleted_at = now() WHERE id = '${unsentId}'`);

  // Sign out offline: wiped at once, on sign-in, the server's half pending.
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.caretookSync.powersync.get("SELECT count(*) n FROM ps_crud").then((r) => r.n),
      ),
    )
    .toBe(0);
  const secondId = await page.evaluate(() =>
    fetch("/api/auth/get-session", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => j?.session?.id ?? null),
  );
  // The server can't be reached for the sign-out (as offline, without
  // waiting for the assets to settle): fetch fails, as it does offline.
  const SIGN_OUT = "**/api/auth/sign-out";
  await page.route(SIGN_OUT, (route) => route.abort("internetdisconnected"));
  await signOut(page);
  await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 15_000 });
  await test.step("offline sign-out: the server's half is pending, the session still on the server", async () => {
    expect((await caretookKeys(page)).join(",")).toContain("caretook:sign-out-pending");
    expect(psql(`SELECT count(*) FROM session WHERE id = '${secondId}'`)).toBe("1");
  });
  await test.step("offline sign-out: lands on sign-in, the cached user, owner, confirmation, last group, settings, recent searches and lines gone", async () => {
    await expect
      .poll(async () => (await caretookKeys(page)).join(","), { timeout: 10_000 })
      .not.toMatch(
        /session-user|sync-owner|sync-kept|session-confirmed|lastGroup|settings|recentSearches|recentLines/,
      );
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
  await page.unroute(SIGN_OUT);
  await page.goto("/app");
  await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 15_000 });
  await test.step("back online: the pending sign-out is finished, and the old session no longer opens the app", async () => {
    await expect.poll(() => psql(`SELECT count(*) FROM session WHERE id = '${secondId}'`)).toBe("0");
    expect((await caretookKeys(page)).join(",")).not.toContain("sign-out-pending");
  });
  // Offline, PowerSync logs its failed connection attempts: expected here.
  await test.step("no page errors", () => {
    expect(d.errors.filter((e) => !e.includes("[PowerSync]: Sync error"))).toEqual([]);
  });
});
