import { launch, openPage, sleep, step } from "./cdp.mjs";
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
//    timeline has no writer controls), then removes them (their rows go on the
//    next sync, and /app says they're in no care group). The seeds'
//    memberships are put back in SQL.
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
  psql(`UPDATE care_group SET name = '${SEED_GROUP}' WHERE id = '${DEV_FAMILY}'`);
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
    const noWriter = await O.evaluate(`({
      addBar: !!document.querySelector('[aria-label="Add to the timeline"]'),
      menus: document.querySelectorAll('main ol button[aria-label^="Actions"], main ol [aria-label^="Edit "]').length,
      stay: window.__stay,
    })`);
    check(
      "made a viewer: their list follows, and their next timeline has no writer controls (no reload)",
      viewer === "Dev Member:owner,Dev Caretaker:viewer,Dev Viewer:viewer" &&
        demoted &&
        !noWriter.addBar &&
        noWriter.menus === 0 &&
        noWriter.stay === 1,
      `${viewer} / ${JSON.stringify(noWriter)}`,
    );

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

    restoreSeeds();
    const back = await passes(
      M.waitFor(`${memberRow("Dev Caretaker")}?.querySelector("select")?.value === "caretaker"`, 30000),
    );
    check(
      "the seeds' memberships are back (in SQL), and the owner's list follows",
      back && serverMembers() === "Dev Member:owner,Dev Caretaker:caretaker,Dev Viewer:viewer",
      await listed(M),
    );
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
