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

const cleanUp = () =>
  psql(`
    DELETE FROM admin_audit_log WHERE changes::text LIKE '%${TAG}%';
    DELETE FROM access_code WHERE label LIKE '${TAG}%';`);

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

const STAFF_NAV = ["Access codes", "New group", "Waitlist", "Audit"];

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
