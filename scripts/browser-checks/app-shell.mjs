import { ADD_BUTTON, launch, openPage, sleep, step } from "./cdp.mjs";
// The /app frame end to end (app-shell PRD): only what needs the server, sync
// or a real page load. The frame's screen behaviour (the header at 420, the
// user and group menus, the theme choice, the last group, the tab bar and the
// section links, group settings by role and offline, members' controls and the
// refusals shown) is in component tests: routes/app/layout/frame.browser.test.tsx,
// routes/app/settings/settings.browser.test.tsx and
// routes/app/groups/settings/groupSettings.browser.test.tsx.
//
// What stays:
// 1. The theme: Dark is set before first paint after a real reload (the inline
//    THEME_SCRIPT under the CSP), and System puts it back.
// 2. Sign out from the menu: to /sign-in, the last group forgotten, /app needs
//    signing in again.
// 3. Group settings: the owner's rename reaches the server and comes back to
//    the timeline through sync; the seeds' name is put back through the page.
// 4. Members across two devices: the owner makes caretaker@ an admin (their
//    device gets the controls without a reload), then a viewer (their next
//    timeline has no writer controls, and the details stream's own rule takes
//    the recipient's writers-only details row off their device: profiles.mjs's
//    fold), then removes them (their rows go on the next sync, and /app says
//    they're in no care group). The seeds' memberships are put back in SQL,
//    and the details row comes back with the caretaker role. Also the
//    member-share stream (profiles-contacts.mjs's fold): a share row the
//    server holds for caretaker@ reaches the owner's device, and goes from it
//    with the membership when they're removed.
// 5. Simple mode across two devices (assistant slice 5): the owner turns on
//    simple mode for caretaker@ from Members; caretaker@'s open timeline
//    switches to the simple view without a reload. Put back in SQL.
// 6. Staff (admin.mjs's folds; its screens are component tests under
//    routes/admin/ and routes/app/layout/staff.browser.test.tsx): every /admin
//    page is a 404 for member@ (a group's owner, not staff); admin@ posts an
//    announcement through admin.settings.set, a real staff action, which
//    writes one audit row that the server-loaded /admin/audit lists; and the
//    banner reaches member@'s /app. Put back through the API.
//
// Every sign-in is on a fresh page: Better Auth limits sign-ins and session
// checks per client IP, and cdp.mjs gives each page its own. Signing in again
// on a page that just signed out could get a 429 on the first session check,
// which sends the page back to /sign-in with no message (B-113).
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const TIMELINE = `/app/groups/${DEV_FAMILY}/timeline`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const passes = (promise) =>
  promise.then(
    () => true,
    () => false,
  );

const TRIGGER = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
const MENU = `document.querySelector('[role="menu"]')`;
const rows = `document.querySelectorAll("main ol > li:not([data-marker])").length`;
const radio = (text) =>
  `[...document.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;
const BAR = `document.querySelector('nav.dock[aria-label="Group sections"]')`;

/** A fresh page signed in as `email` (on Dev Family's timeline unless `home`). */
async function signedIn(browser, label, email, opts = {}) {
  const p = await openPage(browser, label);
  pages.push(p);
  await p.signIn(email, PW, opts);
  return p;
}

const chooseTheme = async (p, label) => {
  await p.press(TRIGGER);
  await p.waitFor(radio(label), 5000);
  await p.press(radio(label));
  await p.waitFor(`!${MENU}`, 5000).catch(() => undefined);
};

const { execSync } = await import("node:child_process");
const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();
const SEED_GROUP = "Dev Family";
const SEEDED = [
  ["member@example.com", "owner"],
  ["caretaker@example.com", "caretaker"],
  ["viewer@example.com", "viewer"],
];
const restoreSeeds = () => {
  psql(
    `DELETE FROM member_contact_share WHERE group_id = '${DEV_FAMILY}' AND phones->0->>'number' = '(555) 010-1999'`,
  );
  psql(`UPDATE care_group SET name = '${SEED_GROUP}' WHERE id = '${DEV_FAMILY}'`);
  psql(
    `UPDATE care_group_member SET simple_mode = false, simple_mode_locked = false WHERE group_id = '${DEV_FAMILY}' AND (simple_mode OR simple_mode_locked)`,
  );
  for (const [email, role] of SEEDED)
    psql(
      `INSERT INTO care_group_member (group_id, user_id, role, created_by, updated_by) SELECT '${DEV_FAMILY}', id, '${role}', id, id FROM "user" WHERE email = '${email}' ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role WHERE care_group_member.role <> EXCLUDED.role`,
    );
};
const serverGroup = () => psql(`SELECT name FROM care_group WHERE id = '${DEV_FAMILY}'`);
const serverMembers = () =>
  psql(
    `SELECT coalesce(string_agg(u.name || ':' || m.role, ',' ORDER BY array_position(ARRAY['owner','admin','caretaker','viewer'], m.role), u.name), '') FROM care_group_member m JOIN "user" u ON u.id = m.user_id WHERE m.group_id = '${DEV_FAMILY}'`,
  );
const serverBecomes = async (expected) => {
  let last = serverMembers();
  for (let i = 0; i < 40 && last !== expected; i++) {
    await sleep(500);
    last = serverMembers();
  }
  return last;
};

const pages = [];
const browsers = [];
/** member@, signed in for group settings and kept for members (one browser shares one session). */
let M;
try {
  restoreSeeds();
  const b = await launch(9471);
  browsers.push(b);

  // ── 1. The theme before first paint, and 2. Sign out ──────────────────────
  await step("theme after a reload, and sign out", { smoke: true }, async () => {
    const A = await signedIn(b, "member", "member@example.com");
    await A.waitFor(`${rows} > 0 && ${TRIGGER}`, 40000);
    await A.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "light" }],
    });
    await chooseTheme(A, "Dark");
    const { identifier } = await A.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => { const probe = (window.__themeProbe = {});
        new MutationObserver((_, obs) => { if (document.body) { probe.body = document.documentElement.dataset.theme ?? null; obs.disconnect(); } })
          .observe(document, { childList: true, subtree: true });
        requestAnimationFrame(() => { probe.frame = document.documentElement.dataset.theme ?? null; }); })()`,
    });
    await A.send("Page.reload", { ignoreCache: false });
    await sleep(300);
    await A.waitFor(`document.readyState === "complete" && ${TRIGGER}`, 30000);
    const probe = await A.evaluate(`window.__themeProbe`);
    check(
      "theme: after a reload, Dark is set before first paint (no light flash)",
      probe?.body === "dark" && probe?.frame === "dark",
      JSON.stringify(probe),
    );
    await A.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
    await chooseTheme(A, "System");
    const system = await A.evaluate(
      `({ attr: document.documentElement.dataset.theme ?? null, saved: localStorage.getItem("caretook:theme") })`,
    );
    check(
      "theme: System puts it back",
      system.attr === null && system.saved === null,
      JSON.stringify(system),
    );
    await A.send("Emulation.setEmulatedMedia", { features: [] });

    await A.waitFor(`Object.keys(localStorage).some((k) => k.startsWith("caretook:lastGroup:"))`, 10000, {
      quiet: true,
    }).catch(() => undefined);
    const remembered = await A.evaluate(
      `Object.keys(localStorage).filter((k) => k.startsWith("caretook:lastGroup:")).length`,
    );
    await A.signOut();
    const out = await passes(A.waitFor(`location.pathname === "/sign-in"`, 15000));
    const keys = await A.evaluate(
      `JSON.stringify(Object.keys(localStorage).filter((k) => k.startsWith("caretook:lastGroup:")))`,
    );
    check(
      "sign out: to /sign-in, and the last group is forgotten",
      out && remembered === 1 && keys === "[]",
      `${remembered} → ${keys}`,
    );
    await A.goto("/app");
    check(
      "sign out: /app needs signing in again",
      await passes(A.waitFor(`location.pathname === "/sign-in"`, 15000)),
    );
  });

  // ── 3. Group settings: a rename through the server and back ───────────────
  await step("group settings: a rename reaches the server and syncs back", async () => {
    M = await signedIn(b, "settings-owner", "member@example.com");
    const DETAILS = `/app/groups/${DEV_FAMILY}/settings/details`;
    const GROUP = `document.querySelector('main [data-section="group-details"]')`;
    const NAME = `${GROUP}?.querySelector('input[name="name"]')`;
    const save = async () => {
      await M.evaluate(`${GROUP}.querySelector('button[type="submit"]').click()`);
      await sleep(150);
      await M.waitFor(
        `!${GROUP}.querySelector('button[type="submit"]').disabled && ${GROUP}.querySelector('[role="status"], [role="alert"]')`,
        20000,
      );
      return M.evaluate(`${GROUP}.querySelector('[role="status"], [role="alert"]').textContent.trim()`);
    };
    const renamed = `Dev Family ${Date.now().toString(36)}`;
    await M.goto(DETAILS);
    await M.waitFor(NAME, 40000);
    await M.type(NAME, `  ${renamed} `);
    const saved = await save();
    check(
      "owner: renames the group through the API",
      saved === "Saved." && serverGroup() === renamed,
      `${saved} / ${serverGroup()}`,
    );
    await M.evaluate(`window.__stay = 1`);
    await M.evaluate(`${BAR}.querySelector("a").click()`);
    const synced = await passes(
      M.waitFor(
        `location.pathname === ${JSON.stringify(TIMELINE)} && document.querySelector("main header p")?.textContent.includes(${JSON.stringify(renamed)})`,
        20000,
      ),
    );
    check(
      "the timeline shows the new name without a reload (through sync)",
      synced && (await M.evaluate(`window.__stay`)) === 1,
      await M.evaluate(`document.querySelector("main header")?.textContent ?? ""`),
    );
    await M.goto(DETAILS);
    await M.waitFor(`${NAME}?.value === ${JSON.stringify(renamed)}`, 20000).catch(() => undefined);
    await M.type(NAME, SEED_GROUP);
    const back = await save();
    check(
      "the seeds' name is put back through the page",
      back === "Saved." && serverGroup() === SEED_GROUP,
      `${back} / ${serverGroup()}`,
    );
  });

  // ── 4. Members: role changes and a removal reaching a second device ────────
  await step("members: changes reach another device", async () => {
    const bO = await launch(9477);
    browsers.push(bO);
    const SETTINGS = `/app/groups/${DEV_FAMILY}/settings/members`;
    const MEMBERS = `document.querySelector('main [data-section="members"]')`;
    const memberRow = (name) =>
      `[...(${MEMBERS}?.querySelectorAll("li[data-member]") ?? [])].find((li) => li.querySelector("p").textContent.includes(${JSON.stringify(name)}))`;
    const roleSelect = (name) => `${memberRow(name)}?.querySelector("select")`;
    const choose = (p, name, role) =>
      p.evaluate(`(() => { const el = ${roleSelect(name)}; if (!el) throw new Error("no role menu for ${name}");
        el.value = ${JSON.stringify(role)}; el.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    const listed = (p) =>
      p.evaluate(`[...(${MEMBERS}?.querySelectorAll("li[data-member]") ?? [])].map((li) => {
        const select = li.querySelector("select");
        const role = select ? select.selectedOptions[0].textContent.trim() + "*" : li.querySelector("[data-role]").textContent.trim();
        const button = li.querySelector("button")?.textContent.trim();
        return li.querySelector("p").textContent.trim() + ":" + role + (button ? ":" + button : "");
      }).join(",")`);
    const onMembers = async (p) => {
      await p.goto(SETTINGS);
      await p.waitFor(
        `${MEMBERS}?.querySelector("li[data-member]") && ${MEMBERS}.querySelector("button")`,
        40000,
      );
    };

    await onMembers(M);
    const O = await signedIn(bO, "members-other", "caretaker@example.com", { home: true });
    await onMembers(O);
    await O.evaluate(`window.__stay = 1`);
    const before = await listed(O);
    check(
      "caretaker: a plain list, Leave on their own row only",
      before === "Dev Member:Owner,Dev Caretaker (you):Caretaker:Leave,Dev Viewer:Viewer",
      before,
    );

    await choose(M, "Dev Caretaker", "admin");
    const admin = await serverBecomes("Dev Member:owner,Dev Caretaker:admin,Dev Viewer:viewer");
    const adminSeen = await passes(O.waitFor(`${roleSelect("Dev Caretaker")}?.value === "admin"`, 20000));
    const adminList = await listed(O);
    check(
      "made an admin: on the server, and their device gets role menus and Remove without a reload",
      admin === "Dev Member:owner,Dev Caretaker:admin,Dev Viewer:viewer" &&
        adminSeen &&
        adminList === "Dev Member:Owner,Dev Caretaker (you):Admin*:Leave,Dev Viewer:Viewer*:Remove" &&
        (await O.evaluate(`window.__stay`)) === 1,
      `${admin} / ${adminList}`,
    );

    // The recipient's writers-only details (care_recipient_details) are on a writer's device only.
    const detailsRows = `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM care_recipient_details WHERE group_id = ?", [${JSON.stringify(DEV_FAMILY)}]).then((r) => r[0].n)`;
    const detailsBefore = await O.evaluate(detailsRows);

    await choose(M, "Dev Caretaker", "viewer");
    const viewer = await serverBecomes("Dev Member:owner,Dev Caretaker:viewer,Dev Viewer:viewer");
    const demoted = await passes(
      O.waitFor(
        `!${roleSelect("Dev Viewer")} && ${memberRow("Dev Caretaker")}?.querySelector("[data-role]")?.textContent.trim() === "Viewer"`,
        20000,
      ),
    );
    await O.evaluate(`${BAR}.querySelector("a").click()`);
    await O.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)} && ${rows} > 0`, 20000);
    // A viewer keeps a ⋯ on notes and events, holding Print alone; anything else is a writer control.
    const PRINT_ONLY = `button[aria-label^="Actions for note"], button[aria-label^="Actions for event"]`;
    const noWriter = await O.evaluate(`({
      addBar: !!${ADD_BUTTON},
      quickEntry: !!document.querySelector("[data-quick-entry]"),
      menus: document.querySelectorAll('main ol button[aria-label^="Actions"]:not(:is(${PRINT_ONLY})), main ol [aria-label^="Edit "]').length,
      stay: window.__stay,
    })`);
    // One of those menus, opened: Print, with no Edit or Delete.
    noWriter.items = await O.evaluate(`(async () => {
      const button = document.querySelector('main ol :is(${PRINT_ONLY})');
      if (!button) return null;
      button.click();
      for (let i = 0; i < 100 && !document.querySelector("[role=menuitem]"); i++) await new Promise((r) => setTimeout(r, 50));
      const items = [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent.trim());
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return items;
    })()`);
    check(
      "made a viewer: their list follows, and their next timeline has no writer controls (no reload)",
      viewer === "Dev Member:owner,Dev Caretaker:viewer,Dev Viewer:viewer" &&
        demoted &&
        !noWriter.addBar &&
        !noWriter.quickEntry &&
        noWriter.menus === 0 &&
        (noWriter.items === null || noWriter.items.join(",") === "Print") &&
        noWriter.stay === 1,
      `${viewer} / ${JSON.stringify(noWriter)}`,
    );

    const detailsGone = await passes(O.waitFor(`${detailsRows}.then((n) => n === 0)`, 30000));
    check(
      "made a viewer: the details stream takes the recipient's writers-only details off their device",
      detailsBefore === 1 && detailsGone,
      `rows ${detailsBefore} → ${await O.evaluate(detailsRows)}`,
    );

    // What caretaker@ shares with the group (member_contact_share) reaches the owner's device.
    // An upsert: the seeds give caretaker@ a share row (010-1002) until a run's removal
    // cascades it away, and DO NOTHING on that row would never write the marker (B-173).
    const shareRows = `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM member_contact_share WHERE group_id = ? AND phones LIKE '%010-1999%'", [${JSON.stringify(DEV_FAMILY)}]).then((r) => r[0].n)`;
    psql(
      `INSERT INTO member_contact_share (id, group_id, user_id, phones, created_by, updated_by) SELECT id, group_id, user_id, '[{"label":"Mobile","number":"(555) 010-1999"}]'::jsonb, user_id, user_id FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = (SELECT id FROM "user" WHERE email = 'caretaker@example.com') ON CONFLICT (group_id, user_id) DO UPDATE SET phones = EXCLUDED.phones, email = NULL, address = NULL, updated_at = now()`,
    );
    // Polls the count from node, reporting the last value it saw.
    const shareRowsBecome = async (want) => {
      for (let i = 0; i < 60; i++) {
        if ((await M.evaluate(shareRows)) === want) return;
        await sleep(500);
      }
      throw new Error(`member_contact_share rows never became ${want}`);
    };
    const shareArrived = await passes(shareRowsBecome(1));
    check("a member's shared details reach the owner's device (the member-share stream)", shareArrived);

    const removeButton = `${memberRow("Dev Caretaker")}?.querySelector("button")`;
    await M.waitFor(`${removeButton} && !${removeButton}.disabled`, 20000);
    await M.evaluate(`${removeButton}.click()`);
    await M.waitFor(`document.querySelector("dialog[open]")`, 5000);
    await M.evaluate(
      `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Remove").click()`,
    );
    const removed = await serverBecomes("Dev Member:owner,Dev Viewer:viewer");
    const emptied = await passes(O.waitFor(`${rows} === 0`, 30000));
    await O.goto("/app");
    const lost = await passes(
      O.waitFor(
        `location.pathname === "/app" && document.querySelector("main")?.textContent.includes("You're not in a care group yet")`,
        30000,
      ),
    );
    check(
      "removed: their device loses the group's entries on the next sync, and /app says they're in no care group",
      removed === "Dev Member:owner,Dev Viewer:viewer" && emptied && lost,
      `${removed} / emptied ${emptied} / ${await O.evaluate(`location.pathname`)}`,
    );

    const shareGone = await passes(shareRowsBecome(0));
    check(
      "removed: their shared details leave the owner's device with them",
      shareGone,
      `${await M.evaluate(shareRows)} rows`,
    );

    restoreSeeds();
    const back = await passes(
      M.waitFor(`${memberRow("Dev Caretaker")}?.querySelector("select")?.value === "caretaker"`, 30000),
    );
    check(
      "the seeds' memberships are back (in SQL), and the owner's list follows",
      back && serverMembers() === "Dev Member:owner,Dev Caretaker:caretaker,Dev Viewer:viewer",
      await listed(M),
    );
    const detailsBack = await passes(O.waitFor(`${detailsRows}.then((n) => n === 1)`, 30000));
    check("a caretaker again: the details row comes back on the next sync", detailsBack);
  });

  // ── 5. Simple mode: the owner's switch reaching the member's device ───────
  await step("simple mode: the owner's switch reaches the member's device", async () => {
    const bS = await launch(9479);
    browsers.push(bS);
    const S = await signedIn(bS, "simple-member", "caretaker@example.com");
    await S.goto(TIMELINE);
    await S.waitFor(`document.querySelector('[data-simple-toggle="simple"]') && ${rows} > 0`, 40000);
    await S.evaluate(`window.__stay = 1`);

    const MEMBERS = `document.querySelector('main [data-section="members"]')`;
    const toggle = `[...(${MEMBERS}?.querySelectorAll("li[data-member]") ?? [])].find((li) => li.querySelector("p").textContent.includes("Dev Caretaker"))?.querySelector("[data-simple-mode-switch]")`;
    await M.goto(`/app/groups/${DEV_FAMILY}/settings/members`);
    await M.waitFor(`${toggle} && !${toggle}.disabled`, 40000);
    await M.evaluate(`${toggle}.click()`);
    const serverSimple = () =>
      psql(
        `SELECT m.simple_mode FROM care_group_member m JOIN "user" u ON u.id = m.user_id WHERE m.group_id = '${DEV_FAMILY}' AND u.email = 'caretaker@example.com'`,
      );
    let saved = serverSimple();
    for (let i = 0; i < 40 && saved !== "t"; i++) {
      await sleep(500);
      saved = serverSimple();
    }
    const switched = await passes(
      S.waitFor(
        `document.querySelector("[data-simple-timeline]") && !document.querySelector('header [data-region="search"]')`,
        30000,
      ),
    );
    check(
      "the owner turns on simple mode for caretaker@: saved on the server, and their timeline switches without a reload",
      saved === "t" && switched && (await S.evaluate(`window.__stay`)) === 1,
      `server ${saved} / switched ${switched}`,
    );
    restoreSeeds();
  });

  // ── 6. Staff: /admin only for staff, a real audit row, the banner in /app ─
  await step("staff: /admin is staff only, an action is audited, the banner reaches /app", async () => {
    const TAG = `ASH${Date.now().toString(36)}`;
    const TEXT = `${TAG} Maintenance tonight from 22:00`;
    const before = psql(`SELECT value::text FROM app_setting WHERE key = 'announcement'`);
    const bA = await launch(9483);
    browsers.push(bA);
    const A = await signedIn(bA, "staff-admin", "admin@example.com", { home: true });
    const setAnnouncement = (value, reason) =>
      A.evaluate(
        `fetch("/rpc/admin/settings/set", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: ${JSON.stringify(JSON.stringify({ json: { key: "announcement", value, reason } }))} }).then((r) => r.status)`,
      );
    try {
      const member = M ?? (await signedIn(b, "staff-member", "member@example.com", { home: true }));
      const status = await member.evaluate(
        `Promise.all(["/admin", "/admin/audit", "/admin/users", "/admin/settings"].map((u) => fetch(u, { credentials: "include" }).then((r) => r.status)))`,
      );
      check(
        "member@ (not staff): every /admin page is a 404",
        status.every((s) => s === 404),
        JSON.stringify(status),
      );

      const posted = await setAnnouncement({ text: TEXT, tone: "warning" }, `${TAG} maintenance notice`);
      const rows = psql(
        `SELECT count(*) FROM admin_audit_log a JOIN "user" u ON u.id = a.actor_id WHERE a.action = 'setting.set' AND a.reason = '${TAG} maintenance notice' AND u.email = 'admin@example.com'`,
      );
      const page = await A.evaluate(
        `fetch("/admin/audit?action=setting.set", { credentials: "include" }).then(async (r) => ({ status: r.status, listed: (await r.text()).includes(${JSON.stringify(`${TAG} maintenance notice`)}) }))`,
      );
      check(
        "admin@ posts a banner: one audit row by admin@, listed on /admin/audit",
        posted === 200 && rows === "1" && page.status === 200 && page.listed,
        `${posted} / rows ${rows} / ${JSON.stringify(page)}`,
      );

      const BANNER = `document.querySelector('[data-region="announcement"] [data-announcement]')`;
      await member.goto("/app");
      const shown = await passes(
        member.waitFor(`${BANNER}?.textContent.includes(${JSON.stringify(TEXT)})`, 20000),
      );
      check(
        "member@'s /app shows the banner",
        shown,
        await member.evaluate(`${BANNER}?.textContent ?? "none"`),
      );
    } finally {
      const restored = await setAnnouncement(before ? JSON.parse(before) : null, `${TAG} put back`).catch(
        () => 0,
      );
      if (!before) psql(`DELETE FROM app_setting WHERE key = 'announcement'`);
      psql(`DELETE FROM admin_audit_log WHERE reason LIKE '${TAG}%'`);
      check("the announcement is put back as it was", restored === 200, String(restored));
    }
  });

  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | "));
} catch (e) {
  console.log("FAIL ", e.message);
  results.push(false);
} finally {
  restoreSeeds();
  for (const br of browsers) br.proc.kill();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
