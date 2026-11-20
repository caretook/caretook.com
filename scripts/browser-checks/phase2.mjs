import { execSync } from "node:child_process";
import { launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";
// The timeline end to end: what only the real server, PowerSync and the seeds
// can show. member@ signs in and the first page of Dev Family's timeline
// arrives by sync; a provider linked on the server (as another device's
// upload would be) shows on its row without a reload and goes when it's
// unlinked; and offline (a cut proxy, since CDP's offline doesn't cut
// PowerSync's stream) the timeline still filters, then on reconnecting an
// entry written elsewhere meanwhile arrives.
//
// Everything else the timeline does (filters by kind, author and vital type,
// row taps by role, More and Less, the ⋯ menu, day headings, the wide layout,
// the author tooltip, the strips, pass logs, infinite scroll, Live now and the
// live dot) is component tests on the test device, beside the route:
// apps/web/app/routes/app/groups/timeline/timeline*.browser.test.tsx.
//
// Order-independent: it tags what it writes and deletes it at the end. SMOKE=1
// runs the sign-in, the first page and the linked provider.
const TZ = "America/Los_Angeles";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const TIMELINE = `/app/groups/${DEV_FAMILY}/timeline`;
const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: sql,
  })
    .toString()
    .trim();

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const rows = `document.querySelectorAll("ol > li:not([data-marker])").length`;
const mainHas = (text) => `document.querySelector("main")?.textContent.includes(${JSON.stringify(text)})`;
const waits = (p, expr, ms) =>
  p.waitFor(expr, ms, { quiet: true }).then(
    () => true,
    () => false,
  );

/** The "with …" line of the first entry titled `title`: the names shown and the "+N". */
const withLineOf = (p, title) =>
  p.evaluate(`(() => {
    const li = [...document.querySelectorAll("ol > li:not([data-marker])")].find((li) =>
      li.querySelector("p.font-semibold")?.textContent.trim() === ${JSON.stringify(title)});
    const line = li?.querySelector("[data-with]");
    return li ? {
      names: [...(line?.querySelectorAll("[data-with-name]") ?? [])].map((n) => n.textContent),
      more: line?.querySelector("[data-with-more]")?.textContent.trim() ?? null,
    } : null;
  })()`);

/**
 * A provider linked on the server shows on the row without a reload (+1), and
 * goes when it's unlinked. Events only: on the unfiltered timeline, upcoming
 * events, doses and changes can push the seeded event past the first page.
 */
async function linkedElsewhere(p) {
  await p.goto(`${TIMELINE}?kind=event`);
  await p.waitFor(`document.querySelector("ol > li:not([data-marker]) [data-with]")`, 20000);
  const two = await withLineOf(p, "Pharmacy pickup");
  check(
    "the seeded event's two providers arrive by sync",
    two?.names.length === 2 && two.more === null,
    JSON.stringify(two),
  );
  const [entryId, providerId] = psql(
    `SELECT (SELECT id FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND title = 'Pharmacy pickup' AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 1)
       || '|' || (SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND name = 'Dr. Alan Whitford')`,
  ).split("|");
  const linkId = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8e9007";
  const unlink = () => psql(`DELETE FROM timeline_entry_provider WHERE id = '${linkId}'`);
  unlink();
  await p.evaluate("window.__noReload = true");
  try {
    psql(
      `INSERT INTO timeline_entry_provider (id, group_id, entry_id, provider_id, created_by, updated_by)
       SELECT '${linkId}', '${DEV_FAMILY}', '${entryId}', '${providerId}', created_by, created_by
       FROM timeline_entry WHERE id = '${entryId}'`,
    );
    const shows = `([...document.querySelectorAll("ol > li:not([data-marker])")].find((li) => li.querySelector("p.font-semibold")?.textContent.trim() === "Pharmacy pickup")?.querySelector("[data-with-more]")?.textContent.trim() === "+1")`;
    check(
      "a link made elsewhere shows on the row without a reload (+1)",
      await waits(p, shows, 20000),
      JSON.stringify(await withLineOf(p, "Pharmacy pickup")),
    );
    unlink();
    check(
      "…and goes when it's unlinked",
      await waits(p, `!${shows}`, 20000),
      JSON.stringify(await withLineOf(p, "Pharmacy pickup")),
    );
    check("…with no reload", await p.evaluate("window.__noReload === true"));
  } finally {
    unlink();
  }
}

/**
 * Offline, then reconnect: with the proxy cut, a kind filter still works
 * (in-app, from the device); an entry written on the server meanwhile doesn't
 * arrive until the connection is back, then shows without a reload.
 */
async function offlineThenReconnect(p, proxy) {
  const tag = `P2-OFF-${Date.now().toString(36)}`;
  await p.goto(TIMELINE);
  await p.waitFor(`${rows} > 0 && window.caretookSync?.powersync.currentStatus.connected`, 30000);
  proxy.setOnline(false);
  let id = "";
  try {
    await waits(p, `!window.caretookSync.powersync.currentStatus.connected`, 20000);
    const caretaker = psql(`SELECT id FROM "user" WHERE email = 'caretaker@example.com'`);
    id = psql(
      `INSERT INTO timeline_entry (group_id, recipient_id, kind, occurred_at, time_zone, details, created_by, updated_by)
       SELECT group_id, id, 'symptom', now(), '${TZ}', '{"name": "${tag}", "severity": 2}'::jsonb, '${caretaker}', '${caretaker}'
       FROM care_recipient WHERE group_id = '${DEV_FAMILY}' RETURNING id`,
    );
    await p.press(
      `[...document.querySelectorAll('nav[aria-label="Show entries"] a')].find((a) => a.textContent.trim() === "Symptoms")`,
    );
    const filtered = await waits(
      p,
      `location.search === "?kind=symptom" && ${rows} > 0 && [...new Set([...document.querySelectorAll("ol > li:not([data-marker])")].map((li) => li.querySelector(".sr-only")?.textContent))].join() === "Symptom: "`,
      10000,
    );
    await sleep(2000);
    check(
      "offline: the kind filter works from the device, and the entry written elsewhere hasn't arrived",
      filtered && !(await p.evaluate(mainHas(tag))),
      await p.evaluate("location.search"),
    );
    proxy.setOnline(true);
    const t0 = Date.now();
    check(
      "reconnected: the entry written elsewhere arrives without a reload",
      await waits(p, mainHas(tag), 30000),
      `${Date.now() - t0} ms`,
    );
  } finally {
    proxy.setOnline(true);
    if (id) psql(`UPDATE timeline_entry SET deleted_at = now() WHERE id = '${id}' AND deleted_at IS NULL`);
  }
}

const proxy = startProxy(9324);
const browser = await launch(9341, proxy.args);
let p = null;
try {
  p = await openPage(browser, "member");
  await p.send("Emulation.setTimezoneOverride", { timezoneId: TZ });
  // On a fresh dev server the first load can fail while Vite optimises its deps: one retry.
  await p.signIn("member@example.com", PW).catch(async () => {
    await sleep(2000);
    await p.signIn("member@example.com", PW);
  });
  await p.waitFor(`${rows} > 0`, 30000);
  await sleep(500);
  check(
    "signed in: the first page (30 entries) arrives by sync",
    (await p.evaluate(rows)) === 30,
    `${await p.evaluate(rows)}`,
  );

  await step("a link made elsewhere", { smoke: true }, () => linkedElsewhere(p));
  if (!SMOKE) await step("offline, then reconnect", () => offlineThenReconnect(p, proxy));

  // PowerSync warns when a full page load closes the previous page's database,
  // and its shared sync worker logs "Sync aborted" for a page that closed;
  // it logs "Sync error" while the proxy is cut, and can fail its first
  // connect right after a reset (a 401 while it refetches the JWKS); a first
  // visit can make Vite reload a route module; and the cut proxy fails loads.
  const noise =
    /error closing database connection|\[PowerSync\]: Sync aborted|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|status of 401|Error loading route module|Failed to fetch dynamically imported module|Failed to load resource|\[vite\] failed to connect/;
  const errors = p.errors.filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 500));
} catch (e) {
  console.log("ERROR", e.message);
  results.push(false);
} finally {
  browser.proc.kill();
  proxy.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
}
process.exit(results.every(Boolean) ? 0 : 1);
