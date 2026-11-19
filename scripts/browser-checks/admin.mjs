// Admin PRD (slice 1: the staff foundation). Smoke mode runs steps 1 and 2:
//   1. admin@ and support@ (staff, in no group) see Admin in the account
//      menu, after Settings; it opens /admin, whose nav lists the sections
//      their role allows.
//   2. support@ creates an access code; the Audit page lists it with
//      support@ as the actor, and its filters (staff member, action, day)
//      narrow the list; the filters live in the URL.
//   3. support@ reaches access codes, new group and the waitlist.
//   4. member@ (a group's owner, not staff) has no Admin item, and every
//      /admin page, the audit page included, is a 404; the audit API refuses them.
//   5. Settings (slice 5): admin@ turns access-code sign-up off with a
//      reason, /join/CARE-DEMO-0001 (signed out) says it isn't available,
//      the audit log has the change, and admin@ turns it back on; support@
//      sees the settings read-only.
//
// Order-independent and self-cleaning: it makes ADM<run> access codes and
// deletes them, and their audit entries, at the end.
import { execFileSync } from "node:child_process";
import { launch, openPage, sleep, step } from "./cdp.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const RUN = `adm${Date.now().toString(36)}`;
const TAG = `ADM${RUN.slice(3)}`;

const psql = (sql) =>
  execFileSync("docker", [
    "exec",
    "-i",
    PG_CONTAINER,
    "psql",
    "-U",
    "caretook",
    "-d",
    "caretook",
    "-tAq",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ])
    .toString()
    .trim();

let failed = 0;
let passed = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
  if (ok) passed++;
  else failed++;
};

// Set when step 5 turned access-code sign-up off, so cleanup can turn it back on.
let accessCodesTurnedOff = false;

const cleanUp = () =>
  psql(`
    DELETE FROM admin_audit_log WHERE changes::text LIKE '%${TAG}%';
    DELETE FROM access_code WHERE label LIKE '${TAG}%';
    DELETE FROM admin_audit_log WHERE action = 'setting.set' AND reason LIKE '${TAG}%';
    ${accessCodesTurnedOff ? `UPDATE app_setting SET value = 'true'::jsonb WHERE key = 'signup.accessCodes';` : ""}`);

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const TRIGGER = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
const menuItems = `[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((el) => el.textContent.trim())`;
const menuItem = (text) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;
const navLabels = `[...document.querySelectorAll("[data-admin-nav] a")].map((a) => a.textContent.trim())`;
const fill = (p, name, value) => p.type(q(`[name="${name}"]`), value);

const browsers = [];
const open = async (port, label) => {
  const b = await launch(port);
  browsers.push(b);
  return openPage(b, label);
};

/** Signs in, opens the account menu and returns its items (the menu is left open). */
const accountMenu = async (p, email) => {
  await p.signIn(email, PASSWORD, { home: true });
  await p.waitFor(TRIGGER, 30000);
  await p.press(TRIGGER);
  await p.waitFor(menuItem("Settings"), 5000);
  return p.evaluate(menuItems);
};

const STAFF_NAV = ["Access codes", "New group", "Waitlist", "Audit", "Settings"];

try {
  // 1. Staff reach /admin from the account menu -------------------------------------
  await step("1. admin@ and support@ open Admin from the account menu", { smoke: true }, async () => {
    for (const [email, port] of [
      ["admin@example.com", 9821],
      ["support@example.com", 9822],
    ]) {
      const p = await open(port, email.split("@")[0]);
      const items = await accountMenu(p, email);
      check(
        items.indexOf("Admin") === items.indexOf("Settings") + 1,
        `${email}: Admin follows Settings in the account menu`,
        items.join(", "),
      );
      await p.press(menuItem("Admin"));
      await p.waitFor(`location.pathname === "/admin/access-codes" && ${q("[data-admin-nav]")}`, 20000);
      const nav = await p.evaluate(navLabels);
      check(JSON.stringify(nav) === JSON.stringify(STAFF_NAV), `${email}: the admin nav`, nav.join(", "));
    }
  });

  // 2. Support creates a code; the audit log shows it ---------------------------------
  await step("2. support@ creates a code and finds it in the audit log", { smoke: true }, async () => {
    const p = await open(9823, "support-audit");
    await p.signIn("support@example.com", PASSWORD, { home: true });
    await p.goto("/admin/access-codes");
    await p.waitFor(`${q('[data-admin-form="newCode"]')}`, 20000);
    const label = `${TAG} support flyer`;
    await fill(p, "label", label);
    await p.press(`${q('[data-admin-form="newCode"] button[type="submit"]')}`);
    const row = `[...document.querySelectorAll("[data-access-codes] tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(label)}))`;
    await p.waitFor(row, 15000);
    const code = await p.evaluate(`${row}.dataset.code`);
    check(/^CARE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), "support can create an access code", code);

    const supportId = psql(`SELECT id FROM "user" WHERE email = 'support@example.com'`);
    const entry = `[...document.querySelectorAll("[data-audit-entry]")].find((li) => li.textContent.includes(${JSON.stringify(code)}))`;
    await p.goto("/admin/audit");
    await p.waitFor(`${q("[data-audit-filters]")}`, 20000);
    await p.waitFor(entry, 10000);
    const seen = await p.evaluate(
      `({ action: ${entry}.dataset.action, actor: ${entry}.dataset.actor, text: ${entry}.textContent })`,
    );
    check(
      seen.action === "accessCode.create" && seen.actor === "support@example.com",
      "the audit log lists it with support@ as the actor",
      JSON.stringify({ action: seen.action, actor: seen.actor }),
    );
    check(seen.text.includes(label), "with what was created", seen.text);

    // Filters: a GET form, so they live in the URL.
    await p.evaluate(`${q('select[name="actor"]')}.value = ${JSON.stringify(supportId)}`);
    await p.evaluate(`${q('select[name="action"]')}.value = "accessCode.create"`);
    await p.press(`${q('[data-audit-filters] button[type="submit"]')}`);
    await p.waitFor(`new URLSearchParams(location.search).get("action") === "accessCode.create"`, 10000);
    await p.waitFor(entry, 10000);
    const narrowed = await p.evaluate(
      `({ actors: [...new Set([...document.querySelectorAll("[data-audit-entry]")].map((li) => li.dataset.actor))], actions: [...new Set([...document.querySelectorAll("[data-audit-entry]")].map((li) => li.dataset.action))], search: location.search })`,
    );
    check(
      narrowed.actors.join() === "support@example.com" && narrowed.actions.join() === "accessCode.create",
      "filtering by staff member and action narrows it",
      JSON.stringify(narrowed),
    );

    await p.goto(`/admin/audit?actor=${supportId}&action=accessCode.revoke`);
    await p.waitFor(`${q("[data-audit-count]")}`, 10000);
    check(!(await p.evaluate(`Boolean(${entry})`)), "another action leaves it out");
    await p.goto(`/admin/audit?actor=${supportId}&from=2001-01-01&to=2001-01-02`);
    await p.waitFor(`${q("[data-audit-count]")}`, 10000);
    const empty = await p.evaluate(`${q("[data-audit-count]")}.dataset.auditCount`);
    check(empty === "0", "and a day range before it shows nothing", empty);
  });

  // 3. Support's other sections --------------------------------------------------------
  await step("3. support@ reaches access codes, new group and the waitlist", async () => {
    const p = await open(9824, "support-pages");
    await p.signIn("support@example.com", PASSWORD, { home: true });
    const status = await p.evaluate(
      `Promise.all(["/admin/access-codes", "/admin/new-group", "/admin/waitlist", "/admin/waitlist/export", "/admin/audit"].map((u) => fetch(u, { credentials: "include" }).then((r) => r.status)))`,
    );
    check(
      status.every((s) => s === 200),
      "every section opens",
      JSON.stringify(status),
    );
  });

  // 4. Not for members -----------------------------------------------------------------
  await step("4. member@ gets no Admin item and the 404", async () => {
    const p = await open(9825, "member");
    const items = await accountMenu(p, "member@example.com");
    check(!items.includes("Admin"), "no Admin item for a member", items.join(", "));
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
    await sleep(200);
    const status = await p.evaluate(
      `Promise.all(["/admin", "/admin/audit", "/admin/access-codes"].map((u) => fetch(u, { credentials: "include" }).then((r) => r.status)))`,
    );
    check(
      status.every((s) => s === 404),
      "every admin page is a 404",
      JSON.stringify(status),
    );
    const api = await p.evaluate(
      `fetch("/rpc/admin/audit/list", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: "{}" }).then((r) => r.status)`,
    );
    check(api === 403, "and the audit API refuses them", String(api));
  });

  // 5. Settings (slice 5) -----------------------------------------------------------------
  await step(
    "5. admin@ switches access-code sign-up off and on; support@ reads",
    { smoke: true },
    async () => {
      const KEY = "signup.accessCodes";
      const card = q(`[data-setting="${KEY}"]`);
      const form = (sel) => q(`[data-setting-form="${KEY}"] ${sel}`);
      const stored = (p) => p.evaluate(`${card}?.dataset.value`);
      /** Picks on or off, gives the reason and saves; waits for the card to show it. */
      const change = async (p, to, reason) => {
        await p.evaluate(`${form(`input[name="value"][value="${to}"]`)}.click()`);
        await p.type(form('[name="reason"]'), reason);
        await p.press(form('button[type="submit"]'));
        await p.waitFor(`${card}?.dataset.value === ${JSON.stringify(String(to === "on"))}`, 15000);
      };

      const admin = await open(9851, "admin-settings");
      await admin.signIn("admin@example.com", PASSWORD, { home: true });
      await admin.goto("/admin/settings");
      await admin.waitFor(`${q("[data-settings]")} && ${card}`, 20000);
      check((await stored(admin)) === "true", "access-code sign-up starts on", await stored(admin));
      accessCodesTurnedOff = true;
      await change(admin, "off", `${TAG} pause sign-up`);
      check(true, "admin@ turns it off with a reason");

      const visitor = await open(9852, "join-closed");
      await visitor.goto("/join/CARE-DEMO-0001");
      await visitor.waitFor(q("[data-code-state]"), 20000);
      const closed = await visitor.evaluate(
        `({ state: ${q("[data-code-state]")}.dataset.codeState, title: document.querySelector("h1, h2")?.textContent.trim() ?? "" })`,
      );
      check(
        closed.state === "unavailable" && /not available right now/i.test(closed.title),
        "/join/CARE-DEMO-0001 says it isn't available",
        JSON.stringify(closed),
      );

      await admin.goto(`/admin/audit?action=setting.set`);
      const entry = `[...document.querySelectorAll("[data-audit-entry]")].find((li) => li.textContent.includes(${JSON.stringify(`${TAG} pause sign-up`)}))`;
      await admin.waitFor(entry, 15000);
      check(true, "the audit log has the change with its reason");

      await admin.goto("/admin/settings");
      await admin.waitFor(card, 20000);
      await change(admin, "on", `${TAG} resume sign-up`);
      accessCodesTurnedOff = false;
      await visitor.goto("/join/CARE-DEMO-0001");
      await visitor.waitFor(q("[data-join-form]"), 20000);
      check(true, "after turning it back on, /join/CARE-DEMO-0001 shows its form again");

      const support = await open(9853, "support-settings");
      await support.signIn("support@example.com", PASSWORD, { home: true });
      await support.goto("/admin/settings");
      await support.waitFor(card, 20000);
      const view = await support.evaluate(
        `({ cards: document.querySelectorAll("[data-setting]").length, forms: document.querySelectorAll("[data-setting-form]").length })`,
      );
      check(
        view.cards > 0 && view.forms === 0,
        "support@ sees every setting, read-only",
        JSON.stringify(view),
      );
      const refused = await support.evaluate(
        `fetch("/rpc/admin/settings/set", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: { key: "${KEY}", value: false, reason: "${TAG} not allowed" } }) }).then((r) => r.status)`,
      );
      check(refused === 403, "and the API refuses support a change", String(refused));
    },
  );
} catch (error) {
  failed++;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  for (const b of browsers) b.proc.kill();
  try {
    cleanUp();
  } catch (error) {
    console.log(`cleanup failed: ${String(error)}`);
  }
}

console.log(`${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
