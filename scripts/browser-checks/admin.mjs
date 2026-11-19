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
//   5. Users (slice 2): support@ finds a tagged account by part of its email,
//      sees its group and the session a second browser signed in with, signs
//      that session out (the second browser's next request goes to sign-in),
//      sends a password reset (in /dev/mail.json and the page's recent mail),
//      and the audit log shows the view and both actions; member@ gets the
//      404 and the users API refuses them.
//   9. Settings (slice 5): admin@ turns access-code sign-up off with a
//      reason, /join/CARE-DEMO-0001 (signed out) says it isn't available,
//      the audit log has the change, and admin@ turns it back on; support@
//      sees the settings read-only.
//  10. The announcement (slice 6): admin@ posts a banner from the settings
//      form (its preview follows the text and tone); member@ sees it in
//      /app, dismisses it, and doesn't see it after a reload; a new banner
//      shows; with the announcement request blocked, and offline, the cached
//      one still shows; offline it goes at its end time, and stays gone
//      online. The announcement is put back as it was, even on failure.
//
//   Care groups (slice 4; smoke runs step 6):
//   6. admin@ finds a tagged ownerless group (viewer@ its only member) with
//      the No owner filter and makes viewer@ an owner, with a reason; viewer@'s
//      own Members page shows Owner after sync, without a reload.
//   7. admin@ invites an owner by email: the ownerInvite email appears in
//      /dev/mail.json.
//   8. support@ sees the group's page without controls, and its actions are a 404.
//
// Order-independent and self-cleaning: it makes ADM<run> access codes, an
// adm<run>-… account and an ADM<run> group, and deletes them, their mail and
// their audit entries, at the end.
import { execFileSync } from "node:child_process";
import { BASE, launch, openPage, sleep, step } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

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

// Set when step 9 turned access-code sign-up off, so cleanup can turn it back on.
let accessCodesTurnedOff = false;

// Step 10's stored announcement before it started (JSON text, "" for no row),
// set while it may have changed it, so cleanup can put it back.
let announcementBefore = null;
const restoreAnnouncement = () => {
  if (announcementBefore === null) return "";
  return announcementBefore === ""
    ? `DELETE FROM app_setting WHERE key = 'announcement';`
    : `UPDATE app_setting SET value = '${announcementBefore.replaceAll("'", "''")}'::jsonb WHERE key = 'announcement';`;
};

const cleanUp = () =>
  psql(`
    DELETE FROM admin_audit_log WHERE changes::text LIKE '%${TAG}%';
    DELETE FROM access_code WHERE label LIKE '${TAG}%';
    DELETE FROM admin_audit_log WHERE target_user_id IN (SELECT id FROM "user" WHERE email LIKE '${RUN}-%');
    DELETE FROM notification_outbox WHERE recipient LIKE '${RUN}-%';
    DELETE FROM dev_mail WHERE recipient LIKE '${RUN}-%';
    DELETE FROM care_group WHERE name LIKE '${TAG}%';
    DELETE FROM "user" WHERE email LIKE '${RUN}-%';
    DELETE FROM admin_audit_log WHERE action = 'setting.set' AND reason LIKE '${TAG}%';
    ${accessCodesTurnedOff ? `UPDATE app_setting SET value = 'true'::jsonb WHERE key = 'signup.accessCodes';` : ""}
    ${restoreAnnouncement()}`);

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

const STAFF_NAV = ["Users", "Groups", "Access codes", "New group", "Waitlist", "Audit", "Settings"];

// --- Care groups (slice 4) ------------------------------------------------------------

const SYSTEM_ID = "00000000-0000-0000-0000-000000000000";
const GROUP_NAME = `${TAG} Family`;
const OWNER_INVITE = `${RUN}-owner@example.com`;

/** A tagged group whose only member is viewer@ (a viewer): it has no owner. Returns its id. */
const makeOwnerlessGroup = () =>
  psql(`
    WITH g AS (
      INSERT INTO care_group (name, created_by, updated_by)
      VALUES ('${GROUP_NAME}', '${SYSTEM_ID}', '${SYSTEM_ID}') RETURNING id
    ), r AS (
      INSERT INTO care_recipient (group_id, name, time_zone, created_by, updated_by)
      SELECT id, '${TAG} Recipient', 'America/Los_Angeles', '${SYSTEM_ID}', '${SYSTEM_ID}' FROM g
    ), m AS (
      INSERT INTO care_group_member (group_id, user_id, role, created_by, updated_by)
      SELECT g.id, u.id, 'viewer', '${SYSTEM_ID}', '${SYSTEM_ID}' FROM g, "user" u
      WHERE u.email = 'viewer@example.com'
    )
    SELECT id FROM g;`);

const cleanUpGroups = () =>
  psql(`
    DELETE FROM admin_audit_log WHERE target_group_id IN (SELECT id FROM care_group WHERE name LIKE '${TAG}%');
    DELETE FROM care_group WHERE name LIKE '${TAG}%';
    DELETE FROM dev_mail WHERE recipient LIKE '${RUN}-%@example.com';
    DELETE FROM notification_outbox WHERE recipient LIKE '${RUN}-%@example.com';`);

const memberRow = (email) => `document.querySelector('[data-admin-member="${email}"]')`;
const buttonIn = (scope, text) =>
  `[...(${scope}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim().startsWith(${JSON.stringify(text)}))`;
const openDialog = `document.querySelector("dialog[open]")`;
let groupId = null;

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
      await p.waitFor(`location.pathname === "/admin/users" && ${q("[data-admin-nav]")}`, 20000);
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
  // 5. Users (slice 2) ----------------------------------------------------------------
  await step("5. support@ finds an account, signs a session out and sends a reset", async () => {
    // A tagged, confirmed account with the seeds' password, owning a tagged group.
    const email = `${RUN}-target@example.com`;
    const SYS = "00000000-0000-0000-0000-000000000000";
    const userId = psql(`
      INSERT INTO "user" (email, email_verified, name, created_by, updated_by)
        VALUES ('${email}', true, '${TAG} Target', '${SYS}', '${SYS}') RETURNING id`);
    psql(`
      INSERT INTO account (user_id, provider_id, account_id, password)
        SELECT '${userId}', 'credential', '${userId}', password FROM account
        WHERE provider_id = 'credential' AND user_id = (SELECT id FROM "user" WHERE email = 'caretaker@example.com');
      WITH g AS (INSERT INTO care_group (name, created_by, updated_by)
        VALUES ('${TAG} group', '${SYS}', '${SYS}') RETURNING id),
      r AS (INSERT INTO care_recipient (group_id, name, time_zone, created_by, updated_by)
        SELECT id, 'Lou ${TAG}', 'America/Los_Angeles', '${SYS}', '${SYS}' FROM g)
      INSERT INTO care_group_member (group_id, user_id, role, created_by, updated_by)
        SELECT id, '${userId}', 'owner', '${SYS}', '${SYS}' FROM g;`);

    const target = await open(9826, "users-target");
    await target.signIn(email, PASSWORD, { home: true });
    await target.waitFor(`location.pathname.startsWith("/app")`, 20000);

    const p = await open(9827, "users-support");
    await p.signIn("support@example.com", PASSWORD, { home: true });
    await p.goto(`/admin/users?q=${encodeURIComponent(RUN.slice(3).toUpperCase())}`);
    const row = `${q(`[data-users] li[data-user="${email}"]`)}`;
    await p.waitFor(row, 20000);
    const badges = await p.evaluate(
      `[...${row}.querySelectorAll("[data-badge]")].map((b) => b.dataset.badge)`,
    );
    check(badges.join() === "verified", "part of the email finds it, with its badges", badges.join(", "));
    await p.press(`${row}.querySelector("a")`);
    await p.waitFor(
      `location.pathname === "/admin/users/${userId}" && ${q('[data-user-section="sessions"]')}`,
      20000,
    );

    const groups = await p.evaluate(
      `[...document.querySelectorAll("[data-groups] li")].map((li) => ({ text: li.textContent, href: li.querySelector("a")?.getAttribute("href") }))`,
    );
    check(
      groups.length === 1 &&
        groups[0].text.includes(`Lou ${TAG}`) &&
        groups[0].text.includes("Owner") &&
        /^\/admin\/groups\/[0-9a-f-]{36}$/.test(groups[0].href),
      "the page shows its group, linking to the group's staff page",
      JSON.stringify(groups),
    );
    const sessions = await p.evaluate(
      `[...document.querySelectorAll("[data-sessions] li")].map((li) => ({ id: li.dataset.session, text: li.textContent }))`,
    );
    check(
      sessions.length === 1 && sessions[0].text.includes("Chrome on"),
      "and the second browser's session, by device",
      JSON.stringify(sessions),
    );

    // Sign that session out, with a reason.
    const dialog = (intent) => `${q(`[data-help-action="${intent}"]`)}.querySelector("dialog")`;
    const help = async (intent, within, reason) => {
      await p.press(`${within}.querySelector('[data-help-action="${intent}"] button')`);
      await p.waitFor(`${within}.querySelector('[data-help-action="${intent}"] dialog')?.open`, 5000);
      const confirm = `[...${within}.querySelector('[data-help-action="${intent}"] dialog').querySelectorAll("button")].at(-1)`;
      check(await p.evaluate(`${confirm}.disabled`), `${intent}: confirm waits for a reason`);
      await p.type(`${within}.querySelector('[data-help-action="${intent}"] textarea')`, reason);
      await p.waitFor(`!${confirm}.disabled`, 5000);
      await p.press(confirm);
    };
    await help("revokeSession", q(`[data-session="${sessions[0].id}"]`), `${TAG} lost phone`);
    await p.waitFor(`!${q(`[data-session="${sessions[0].id}"]`)}`, 15000);
    check(true, "signing the session out removes it from the page");
    await target.goto("/app");
    await target.waitFor(`location.pathname === "/sign-in"`, 20000);
    check(true, "the second browser's next request goes to sign-in");

    // A password reset: queued, delivered to the dev mailbox, listed on the page.
    await help("sendReset", "document", `${TAG} locked out`);
    await p.waitFor(`${q('[data-help-action="sendReset"] [role="status"]')}`, 15000);
    check(!(await p.evaluate(`${dialog("sendReset")}.open`)), "the reset's dialog closes with a status");
    let mail = [];
    for (let i = 0; i < 30 && !mail.some((m) => m.name === "resetPassword"); i++) {
      mail = await p.evaluate(
        `fetch("/dev/mail.json?to=${encodeURIComponent(email)}").then((r) => r.json()).then((j) => j.messages)`,
      );
      if (!mail.some((m) => m.name === "resetPassword")) await sleep(500);
    }
    check(mail.filter((m) => m.name === "resetPassword").length === 1, "the reset is in /dev/mail.json");
    await p.goto(`/admin/users/${userId}`);
    await p.waitFor(`${q('[data-mail] tr[data-mail-row="resetPassword"]')}`, 20000);
    check(true, "and in the page's recent mail");

    // The audit log: the view and both actions, by support@.
    await p.goto(`/admin/audit?target=${userId}`);
    await p.waitFor(`${q("[data-audit-count]")}`, 20000);
    const entries = await p.evaluate(
      `[...document.querySelectorAll("[data-audit-entry]")].map((li) => ({ action: li.dataset.action, actor: li.dataset.actor, text: li.textContent }))`,
    );
    const by = (action) => entries.filter((e) => e.action === action && e.actor === "support@example.com");
    check(
      by("user.view").length >= 1,
      "the audit log shows the view",
      JSON.stringify(entries.map((e) => e.action)),
    );
    check(
      by("user.revokeSession").length === 1 && by("user.revokeSession")[0].text.includes(`${TAG} lost phone`),
      "the sign-out, with its reason",
    );
    check(by("user.sendReset").length === 1, "and the reset");

    // Not for members.
    const member = await open(9828, "users-member");
    await member.signIn("member@example.com", PASSWORD, { home: true });
    const status = await member.evaluate(
      `Promise.all(["/admin/users", "/admin/users/${userId}"].map((u) => fetch(u, { credentials: "include" }).then((r) => r.status)))`,
    );
    check(
      status.every((s) => s === 404),
      "member@ gets the 404 for users",
      JSON.stringify(status),
    );
    const api = await member.evaluate(
      `fetch("/rpc/admin/users/search", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: "{}" }).then((r) => r.status)`,
    );
    check(api === 403, "and the users API refuses them", String(api));
  });

  // 6. Owner recovery: the No owner filter and Make owner --------------------------------
  await step("6. admin@ finds an ownerless group and makes viewer@ its owner", { smoke: true }, async () => {
    groupId = makeOwnerlessGroup();
    const viewerId = psql(`SELECT id FROM "user" WHERE email = 'viewer@example.com'`);

    // viewer@ sees themself as a viewer on the group's Members page.
    const v = await open(9861, "viewer-members");
    await v.signIn("viewer@example.com", PASSWORD, { home: true });
    await v.goto(`/app/groups/${groupId}/settings/members`);
    const ownRole = `(() => { const li = document.querySelector('li[data-member="${viewerId}"]'); return li ? (li.querySelector("select")?.value ?? li.querySelector("[data-role]")?.textContent.trim()) : null; })()`;
    await v.waitFor(`${ownRole} === "Viewer"`, 45000);
    check(true, "viewer@'s Members page shows them as a viewer");

    const p = await open(9862, "admin-groups");
    await p.signIn("admin@example.com", PASSWORD, { home: true });
    await p.goto("/admin/groups");
    await p.waitFor(q("[data-group-filters]"), 20000);
    await fill(p, "q", TAG);
    await p.evaluate(`${q('[name="noOwner"]')}.checked = true`);
    await p.press(q("[data-group-filters] button[type='submit']"));
    await p.waitFor(`new URLSearchParams(location.search).get("noOwner") === "1"`, 10000);
    const row = `document.querySelector('[data-group="${groupId}"]')`;
    await p.waitFor(row, 10000);
    const listed = await p.evaluate(
      `({ ids: [...document.querySelectorAll("[data-group]")].map((li) => li.dataset.group), owners: ${row}.querySelector("[data-owners]").dataset.owners, text: ${row}.textContent })`,
    );
    check(
      listed.ids.length === 1 && listed.owners === "0" && listed.text.includes(`${TAG} Recipient`),
      "the No owner filter finds the tagged group, with no owner",
      JSON.stringify(listed),
    );
    await p.goto(`/admin/groups?q=${encodeURIComponent("Dev Family")}&noOwner=1`);
    await p.waitFor(q("[data-group-count]"), 10000);
    const devFamily = await p.evaluate(`${q("[data-group-count]")}.dataset.groupCount`);
    check(devFamily === "0", "and leaves out groups with an owner", devFamily);

    await p.goto(`/admin/groups/${groupId}`);
    await p.waitFor(`${q("[data-admin-group]")} && ${memberRow("viewer@example.com")}`, 20000);
    const page = await p.evaluate(
      `({ noOwner: Boolean(${q("[data-no-owner]")}), counts: ${q("[data-counts]")}.textContent, userLink: ${memberRow("viewer@example.com")}.querySelector("a").getAttribute("href") })`,
    );
    check(page.noOwner, "the group's page says it has no owner");
    check(page.counts.includes("0 entries"), "and shows counts, not content", page.counts);
    check(page.userLink === `/admin/users/${viewerId}`, "each member links to their account", page.userLink);

    await p.press(buttonIn(memberRow("viewer@example.com"), "Make owner"));
    await p.waitFor(`${openDialog}?.querySelector('[data-member-dialog="promoteOwner"]')`, 5000);
    const confirm = `[...${openDialog}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Make owner")`;
    check(await p.evaluate(`${confirm}.disabled`), "Make owner waits for a reason");
    await p.type(`${openDialog}.querySelector("textarea")`, `${TAG} the family asked by phone`);
    await p.waitFor(`!${confirm}.disabled`, 3000);
    await p.press(confirm);
    await p.waitFor(`${memberRow("viewer@example.com")}?.dataset.role === "owner"`, 15000);
    const after = await p.evaluate(
      `({ result: ${q("[data-admin-result]")}?.textContent, noOwner: Boolean(${q("[data-no-owner]")}), audit: [...document.querySelectorAll("[data-audit-entry]")].map((li) => li.dataset.action) })`,
    );
    check(!after.noOwner && /now an owner/.test(after.result ?? ""), "viewer@ is an owner", after.result);
    check(
      after.audit.includes("group.promoteOwner"),
      "and the page's staff activity lists it",
      after.audit.join(),
    );
    const recorded = psql(
      `SELECT reason FROM admin_audit_log WHERE action = 'group.promoteOwner' AND target_group_id = '${groupId}'`,
    );
    check(recorded === `${TAG} the family asked by phone`, "with its reason in the audit log", recorded);

    // viewer@'s Members page follows, live.
    await v.waitFor(`["Owner", "owner"].includes(${ownRole})`, 45000);
    check(true, "viewer@'s Members page shows them as an owner after sync");
  });

  // 7. Invite an owner -------------------------------------------------------------------
  await step("7. admin@ sends an owner invite", async () => {
    if (!groupId) groupId = makeOwnerlessGroup();
    const p = await open(9863, "admin-invite");
    await p.signIn("admin@example.com", PASSWORD, { home: true });
    await p.goto(`/admin/groups/${groupId}`);
    await p.waitFor(q('[data-admin-form="inviteOwner"]'), 20000);
    await fill(p, "email", OWNER_INVITE);
    await fill(p, "reason", `${TAG} nobody suitable to promote`);
    await p.press(q('[data-admin-form="inviteOwner"] button[type="submit"]'));
    await p.waitFor(q("[data-admin-result]"), 15000);
    const result = await p.evaluate(`${q("[data-admin-result]")}.textContent`);
    check(result.includes(OWNER_INVITE), "the invite is sent", result);
    const end = Date.now() + 15000;
    let mail = [];
    while (Date.now() < end && !mail.length) {
      const res = await fetch(`${BASE}/dev/mail.json?to=${encodeURIComponent(OWNER_INVITE)}`);
      mail = res.ok ? (await res.json()).messages.filter((m) => m.name === "ownerInvite") : [];
      if (!mail.length) await sleep(300);
    }
    check(mail.length === 1, "the ownerInvite email is in /dev/mail.json", String(mail.length));
  });

  // 8. Support reads, without controls ---------------------------------------------------
  await step("8. support@ sees the group's page without controls", async () => {
    if (!groupId) groupId = makeOwnerlessGroup();
    const p = await open(9864, "support-group");
    await p.signIn("support@example.com", PASSWORD, { home: true });
    await p.goto(`/admin/groups/${groupId}`);
    await p.waitFor(`${q("[data-admin-group]")} && ${q("[data-admin-members]")}`, 20000);
    const controls = await p.evaluate(
      `({ buttons: document.querySelectorAll("[data-admin-members] button").length, invite: Boolean(${q('[data-admin-form="inviteOwner"]')}) })`,
    );
    check(
      controls.buttons === 0 && !controls.invite,
      "no member actions and no invite form",
      JSON.stringify(controls),
    );
    const status = await p.evaluate(
      `fetch(location.pathname, { method: "POST", credentials: "include", body: new URLSearchParams({ intent: "removeMember", userId: "00000000-0000-0000-0000-000000000001", reason: "x" }) }).then((r) => r.status)`,
    );
    check(status === 404, "and its actions are refused", String(status));
  });

  // 9. Settings (slice 5) -----------------------------------------------------------------
  await step(
    "9. admin@ switches access-code sign-up off and on; support@ reads",
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
  // 10. The announcement banner (slice 6) -------------------------------------------------
  await step("10. admin@ posts a banner; member@ sees, dismisses and keeps it offline", async () => {
    const KEY = "announcement";
    const card = q(`[data-setting="${KEY}"]`);
    const form = (sel) => q(`[data-setting-form="${KEY}"] ${sel}`);
    const banner = q('[data-region="announcement"] [data-announcement]');
    const bannerState = `(() => { const b = ${banner}; return b ? { tone: b.dataset.tone, text: b.textContent.trim() } : null; })()`;
    const FIRST = `${TAG} Maintenance tonight from 22:00`;
    const SECOND = `${TAG} Sync is slow this morning`;

    announcementBefore = psql(`SELECT value::text FROM app_setting WHERE key = '${KEY}'`);
    const admin = await open(9871, "admin-announcement");
    /** Sets the announcement through the API (seconds-precise end times), as admin@. */
    const setAnnouncement = (value, reason) =>
      admin.evaluate(
        `fetch("/rpc/admin/settings/set", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: ${JSON.stringify({ key: KEY, value, reason })} }) }).then((r) => r.status)`,
      );
    const proxy = startProxy(9875);
    const memberBrowser = await launch(9872, proxy.args);
    browsers.push(memberBrowser);
    const m = await openPage(memberBrowser, "member-announcement");
    /** Whether this page's announcement request has finished since it loaded. */
    const asked = `performance.getEntriesByType("resource").some((e) => e.name.includes("/rpc/public/announcement") && e.responseEnd > 0)`;
    const reloadMember = async () => {
      await m.send("Page.reload");
      await m.waitFor(`document.readyState === "complete" && location.pathname.startsWith("/app")`, 30000);
      await m.waitFor(`document.querySelector('header [data-region="user"] button')`, 30000);
    };

    try {
      await admin.signIn("admin@example.com", PASSWORD, { home: true });
      await admin.goto("/admin/settings");
      await admin.waitFor(`${card} && ${form('[name="text"]')}`, 20000);
      await admin.type(form('[name="text"]'), FIRST);
      await admin.evaluate(`${form('input[name="tone"][value="warning"]')}.click()`);
      const preview = await admin.evaluate(
        `(() => { const b = ${q("[data-announcement-preview] [data-tone]")}; return b ? { tone: b.dataset.tone, text: b.textContent.trim() } : null; })()`,
      );
      check(
        preview?.tone === "warning" && preview.text === FIRST,
        "the settings form previews the banner as typed",
        JSON.stringify(preview),
      );
      await admin.type(form('[name="reason"]'), `${TAG} maintenance notice`);
      await admin.press(form('button[type="submit"]'));
      await admin.waitFor(`${card}?.dataset.value.includes(${JSON.stringify(FIRST)})`, 15000);
      check(true, "admin@ posts it with a reason");

      await m.signIn("member@example.com", PASSWORD, { home: true });
      await m.waitFor(banner, 20000);
      const first = await m.evaluate(bannerState);
      check(
        first?.tone === "warning" && first.text === FIRST,
        "member@ sees it at the top of /app",
        JSON.stringify(first),
      );
      const ui = await m.evaluate(`({
        above: !!document.querySelector('header + [data-region="announcement"]'),
        dismiss: !!${banner}?.querySelector('button[aria-label="Dismiss announcement"]'),
      })`);
      check(ui.above && ui.dismiss, "under the header, with a Dismiss button", JSON.stringify(ui));

      await m.press(`${banner}.querySelector('button[aria-label="Dismiss announcement"]')`);
      await m.waitFor(`!${banner}`, 5000);
      await reloadMember();
      await m.waitFor(asked, 20000);
      await sleep(500);
      check(!(await m.evaluate(`!!${banner}`)), "dismissed, it stays gone after a reload");

      check(
        (await setAnnouncement({ text: SECOND, tone: "info" }, `${TAG} new notice`)) === 200,
        "admin@ posts a new one",
      );
      await reloadMember();
      const second = await m
        .waitFor(`${banner}?.textContent.includes(${JSON.stringify(SECOND)})`, 20000)
        .then(() => m.evaluate(bannerState))
        .catch(() => null);
      check(second?.tone === "info", "a new banner shows again", JSON.stringify(second));

      // The request fails: the banner comes from this device's copy.
      await m.send("Network.setBlockedURLs", { urls: ["*/rpc/public/announcement*"] });
      await reloadMember();
      await sleep(1500);
      const cached = await m.evaluate(bannerState);
      check(
        cached?.text === SECOND,
        "with the request failing, the cached banner shows",
        JSON.stringify(cached),
      );
      await m.send("Network.setBlockedURLs", { urls: [] });

      // It gets an end 20 s away while member@ is online, then member@ goes offline.
      const endsAt = new Date(Date.now() + 20_000).toISOString();
      check(
        (await setAnnouncement({ text: SECOND, tone: "info", endsAt }, `${TAG} ending soon`)) === 200,
        "admin@ gives it an end time",
      );
      await m.evaluate(`window.dispatchEvent(new Event("online"))`);
      await m.waitFor(
        `JSON.parse(localStorage.getItem("caretook:announcement") ?? "null")?.endsAt === ${JSON.stringify(endsAt)}`,
        15000,
      );
      proxy.setOnline(false);
      await m.evaluate(`window.dispatchEvent(new Event("online"))`);
      await sleep(1000);
      check(!!(await m.evaluate(`!!${banner}`)), "offline, the cached banner still shows");
      const wait = Math.max(0, Date.parse(endsAt) - Date.now()) + 10_000;
      const gone = await m.waitFor(`!${banner}`, wait, { quiet: true }).then(
        () => true,
        () => false,
      );
      check(gone && Date.now() >= Date.parse(endsAt), "offline, it goes at its end time");
      proxy.setOnline(true);
      await sleep(1000);
      await reloadMember();
      await m.waitFor(asked, 20000);
      await sleep(500);
      check(!(await m.evaluate(`!!${banner}`)), "and online after a reload it stays gone");
      // Failed loads while blocked or offline are expected; anything uncaught isn't.
      const thrown = m.uncaught.filter((e) => e.startsWith("uncaught:"));
      check(thrown.length === 0, "nothing thrown on member@'s page", JSON.stringify(thrown.slice(0, 3)));
    } finally {
      proxy.setOnline(true);
      const before = announcementBefore ? JSON.parse(announcementBefore) : null;
      const status = await setAnnouncement(before, `${TAG} put the announcement back`).catch(() => 0);
      if (status === 200) announcementBefore = null;
      check(status === 200, "the announcement is put back as it was", String(status));
      proxy.close?.();
    }
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
  try {
    cleanUpGroups();
  } catch (error) {
    console.log(`group cleanup failed: ${String(error)}`);
  }
}

console.log(`${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
