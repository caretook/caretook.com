// The /app frame end to end (app-shell PRD): only what needs the server, sync
// or a real page load. The frame's screen behaviour (the header at 420, the
// user and group menus, the theme choice, the last group, the tab bar and the
// section links, group settings by role and offline, members' controls and the
// refusals shown) is in component tests: routes/app/layout/frame.browser.test.tsx,
// routes/app/settings/settings.browser.test.tsx and
// routes/app/groups/settings/groupSettings.browser.test.tsx.
//
// What stays, one test each:
// 1. The theme: Dark is set before first paint after a real reload (the inline
//    THEME_SCRIPT under the CSP), and System puts it back; then sign out from
//    the menu: to /sign-in, the last group forgotten, /app needs signing in
//    again. (@smoke)
// 2. Group settings: the owner's rename reaches the server and comes back to
//    the timeline through sync; the seeds' name is put back through the page.
// 3. Members across two devices: the owner makes caretaker@ an admin (their
//    device gets the controls without a reload), then a viewer (their next
//    timeline has no writer controls, and the details stream's own rule takes
//    the recipient's writers-only details row off their device), then removes
//    them (their rows go on the next sync, and /app says they're in no care
//    group). The seeds' memberships are put back in SQL, and the details row
//    comes back with the caretaker role. Also the member-share stream: a share
//    row the server holds for caretaker@ reaches the owner's device, and goes
//    from it with the membership when they're removed.
// 4. Simple mode across two devices (assistant slice 5): the owner turns on
//    simple mode for caretaker@ from Members; caretaker@'s open timeline
//    switches to the simple view without a reload. Put back in SQL.
// 5. Staff (its screens are component tests under routes/admin/ and
//    routes/app/layout/staff.browser.test.tsx): every /admin page is a 404 for
//    member@ (a group's owner, not staff); admin@ posts an announcement through
//    admin.settings.set, a real staff action, which writes one audit row that
//    the server-loaded /admin/audit lists; and the banner reaches member@'s
//    /app. Put back through the API.
//
// Every device has its own client IP (fixtures.mjs): Better Auth limits
// sign-ins and session checks per IP. Each test signs its own devices in, so
// the tests are independent; the seeds are put back before and after the file
// (and by the tests that change them).
import {
  DEV_FAMILY,
  DEV_FAMILY_TIMELINE,
  PASSWORD,
  addButton,
  expect,
  psql,
  signIn,
  signOut,
  test,
} from "./fixtures.mjs";

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
/** Polls Postgres (20 s) until the members list reads `expected`. */
const serverBecomes = (expected) =>
  expect
    .poll(serverMembers, { timeout: 20_000, intervals: [500], message: "the server's members" })
    .toBe(expected);

/** What a console error is not: noise from the stack, not the page. */
const noise =
  /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted/;
const noErrors = (...devices) =>
  test.step("no console errors or warnings", () => {
    const errors = devices.flatMap((d) => d.errors).filter((e) => !noise.test(e));
    expect(errors.slice(0, 5)).toEqual([]);
  });

const rowsOf = (page) => page.locator("main ol > li:not([data-marker])");
const trigger = (page) => page.locator('header [data-region="user"] button[aria-label^="Account menu for"]');
const bar = (page) => page.locator('nav.dock[aria-label="Group sections"]');
const stay = (page) => page.evaluate(() => (window.__stay = 1));
const stayed = (page) => page.evaluate(() => window.__stay);

test.beforeAll(restoreSeeds);
test.afterAll(restoreSeeds);

// ── 1. The theme before first paint, and sign out ───────────────────────────
test("theme after a reload, and sign out", { tag: "@smoke" }, async ({ device }) => {
  const d = await device("member");
  const { page } = d;
  await signIn(page, "member@example.com");
  await expect(rowsOf(page).first()).toBeVisible({ timeout: 40_000 });
  await expect(trigger(page)).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });

  const chooseTheme = async (label) => {
    await trigger(page).click();
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  };

  await test.step("theme: after a reload, Dark is set before first paint (no light flash)", async () => {
    await chooseTheme("Dark");
    await page.addInitScript(() => {
      const probe = (window.__themeProbe = {});
      new MutationObserver((_, obs) => {
        if (document.body) {
          probe.body = document.documentElement.dataset.theme ?? null;
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
      requestAnimationFrame(() => {
        probe.frame = document.documentElement.dataset.theme ?? null;
      });
    });
    await page.reload();
    await expect(trigger(page)).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => window.__themeProbe?.frame)).not.toBeUndefined();
    expect(await page.evaluate(() => window.__themeProbe)).toEqual({ body: "dark", frame: "dark" });
  });

  await test.step("theme: System puts it back", async () => {
    await chooseTheme("System");
    expect(
      await page.evaluate(() => ({
        attr: document.documentElement.dataset.theme ?? null,
        saved: localStorage.getItem("caretook:theme"),
      })),
    ).toEqual({ attr: null, saved: null });
    await page.emulateMedia({ colorScheme: null });
  });

  const lastGroupKeys = () =>
    page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("caretook:lastGroup:")));
  await test.step("sign out: to /sign-in, and the last group is forgotten", async () => {
    await expect.poll(async () => (await lastGroupKeys()).length, { timeout: 10_000 }).toBe(1);
    await signOut(page);
    await page.waitForURL((u) => u.pathname === "/sign-in", { timeout: 15_000 });
    expect(await lastGroupKeys()).toEqual([]);
  });

  await test.step("sign out: /app needs signing in again", async () => {
    await page.goto("/app");
    await page.waitForURL((u) => u.pathname === "/sign-in", { timeout: 15_000 });
  });
  await noErrors(d);
});

// ── 2. Group settings: a rename through the server and back ─────────────────
test("group settings: a rename reaches the server and syncs back", async ({ device }) => {
  const d = await device("settings-owner");
  const { page } = d;
  await signIn(page, "member@example.com");
  const DETAILS = `/app/groups/${DEV_FAMILY}/settings/details`;
  const group = page.locator('main [data-section="group-details"]');
  const name = group.locator('input[name="name"]');
  const save = async (expected) => {
    await group.locator('button[type="submit"]').click();
    await expect(group.locator('[role="status"], [role="alert"]')).toHaveText(expected, { timeout: 20_000 });
  };
  const renamed = `Dev Family ${Date.now().toString(36)}`;

  await page.goto(DETAILS);
  await expect(name).toBeVisible({ timeout: 40_000 });
  await test.step("owner: renames the group through the API", async () => {
    await name.fill(`  ${renamed} `);
    await save("Saved.");
    expect(serverGroup()).toBe(renamed);
  });

  await test.step("the timeline shows the new name without a reload (through sync)", async () => {
    await stay(page);
    await bar(page).locator("a").first().click();
    await page.waitForURL((u) => u.pathname === DEV_FAMILY_TIMELINE, { timeout: 20_000 });
    await expect(page.locator("main header p").first()).toContainText(renamed, { timeout: 20_000 });
    expect(await stayed(page)).toBe(1);
  });

  await test.step("the seeds' name is put back through the page", async () => {
    await page.goto(DETAILS);
    await expect(name).toHaveValue(renamed, { timeout: 20_000 });
    await name.fill(SEED_GROUP);
    await save("Saved.");
    expect(serverGroup()).toBe(SEED_GROUP);
  });
  await noErrors(d);
});

// ── 3. Members: role changes and a removal reaching a second device ─────────
test("members: changes reach another device", async ({ device }) => {
  test.setTimeout(180_000);
  const dM = await device("settings-owner");
  const dO = await device("members-other");
  const M = dM.page;
  const O = dO.page;
  const SETTINGS = `/app/groups/${DEV_FAMILY}/settings/members`;
  const members = (p) => p.locator('main [data-section="members"]');
  const memberRow = (p, who) =>
    members(p)
      .locator("li[data-member]")
      .filter({ has: p.locator("p", { hasText: who }) });
  const roleSelect = (p, who) => memberRow(p, who).locator("select");
  const choose = (p, who, role) => roleSelect(p, who).selectOption(role);
  const listed = (p) =>
    p.evaluate(() =>
      [
        ...(document.querySelector('main [data-section="members"]')?.querySelectorAll("li[data-member]") ??
          []),
      ]
        .map((li) => {
          const select = li.querySelector("select");
          const role = select
            ? select.selectedOptions[0].textContent.trim() + "*"
            : li.querySelector("[data-role]").textContent.trim();
          const button = li.querySelector("button")?.textContent.trim();
          return li.querySelector("p").textContent.trim() + ":" + role + (button ? ":" + button : "");
        })
        .join(","),
    );
  const onMembers = async (p) => {
    await p.goto(SETTINGS);
    await expect(members(p).locator("li[data-member]").first()).toBeVisible({ timeout: 40_000 });
    await expect(members(p).locator("button").first()).toBeVisible();
  };

  await signIn(M, "member@example.com");
  await onMembers(M);
  await signIn(O, "caretaker@example.com", PASSWORD, { home: true });
  await onMembers(O);
  await stay(O);

  await test.step("caretaker: a plain list, Leave on their own row only", async () => {
    await expect
      .poll(() => listed(O), { timeout: 20_000 })
      .toBe("Dev Member:Owner,Dev Caretaker (you):Caretaker:Leave,Dev Viewer:Viewer");
  });

  await test.step("made an admin: on the server, and their device gets role menus and Remove without a reload", async () => {
    await choose(M, "Dev Caretaker", "admin");
    await serverBecomes("Dev Member:owner,Dev Caretaker:admin,Dev Viewer:viewer");
    await expect(roleSelect(O, "Dev Caretaker")).toHaveValue("admin", { timeout: 20_000 });
    expect(await listed(O)).toBe(
      "Dev Member:Owner,Dev Caretaker (you):Admin*:Leave,Dev Viewer:Viewer*:Remove",
    );
    expect(await stayed(O)).toBe(1);
  });

  // The recipient's writers-only details (care_recipient_details) are on a writer's device only.
  const detailsRows = (p) =>
    p
      .evaluate(
        (group) =>
          window.caretookSync.powersync
            .getAll("SELECT count(*) AS n FROM care_recipient_details WHERE group_id = ?", [group])
            .then((r) => r[0].n),
        DEV_FAMILY,
      )
      .catch(() => -1);
  const detailsBefore = await detailsRows(O);

  await test.step("made a viewer: their list follows, and their next timeline has no writer controls (no reload)", async () => {
    await choose(M, "Dev Caretaker", "viewer");
    await serverBecomes("Dev Member:owner,Dev Caretaker:viewer,Dev Viewer:viewer");
    await expect(roleSelect(O, "Dev Viewer")).toHaveCount(0, { timeout: 20_000 });
    await expect(memberRow(O, "Dev Caretaker").locator("[data-role]")).toHaveText("Viewer", {
      timeout: 20_000,
    });
    await bar(O).locator("a").first().click();
    await O.waitForURL((u) => u.pathname === DEV_FAMILY_TIMELINE, { timeout: 45_000 });
    await expect(rowsOf(O).first()).toBeVisible({ timeout: 45_000 });
    // A viewer keeps a ⋯ on notes and events, holding Print alone; anything else is a writer control.
    const printOnly = 'button[aria-label^="Actions for note"], button[aria-label^="Actions for event"]';
    await expect(addButton(O)).toHaveCount(0);
    await expect(O.locator("[data-quick-entry]")).toHaveCount(0);
    await expect(
      O.locator(
        `main ol button[aria-label^="Actions"]:not(:is(${printOnly})), main ol [aria-label^="Edit "]`,
      ),
    ).toHaveCount(0);
    // One of those menus, opened: Print, with no Edit or Delete.
    const menuButton = O.locator(`main ol :is(${printOnly})`).first();
    if (await menuButton.count()) {
      await menuButton.click();
      await expect(O.getByRole("menuitem").first()).toBeVisible();
      expect(await O.getByRole("menuitem").allTextContents()).toEqual(["Print"]);
      await O.keyboard.press("Escape");
    }
    expect(await stayed(O)).toBe(1);
  });

  await test.step("made a viewer: the details stream takes the recipient's writers-only details off their device", async () => {
    expect(detailsBefore).toBe(1);
    await expect.poll(() => detailsRows(O), { timeout: 30_000 }).toBe(0);
  });

  // What caretaker@ shares with the group (member_contact_share) reaches the owner's device.
  // An upsert: the seeds give caretaker@ a share row (010-1002) until a run's removal
  // cascades it away, and DO NOTHING on that row would never write the marker (B-173).
  const shareRows = () =>
    M.evaluate(
      (group) =>
        window.caretookSync.powersync
          .getAll(
            "SELECT count(*) AS n FROM member_contact_share WHERE group_id = ? AND phones LIKE '%010-1999%'",
            [group],
          )
          .then((r) => r[0].n),
      DEV_FAMILY,
    ).catch(() => -1);
  await test.step("a member's shared details reach the owner's device (the member-share stream)", async () => {
    psql(
      `INSERT INTO member_contact_share (id, group_id, user_id, phones, created_by, updated_by) SELECT id, group_id, user_id, '[{"label":"Mobile","number":"(555) 010-1999"}]'::jsonb, user_id, user_id FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = (SELECT id FROM "user" WHERE email = 'caretaker@example.com') ON CONFLICT (group_id, user_id) DO UPDATE SET phones = EXCLUDED.phones, email = NULL, address = NULL, updated_at = now()`,
    );
    await expect.poll(shareRows, { timeout: 30_000, intervals: [500] }).toBe(1);
  });

  await test.step("removed: their device loses the group's entries on the next sync, and /app says they're in no care group", async () => {
    const remove = memberRow(M, "Dev Caretaker").locator("button");
    await expect(remove).toBeEnabled({ timeout: 20_000 });
    await remove.click();
    const dialog = M.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
    await serverBecomes("Dev Member:owner,Dev Viewer:viewer");
    await expect(rowsOf(O)).toHaveCount(0, { timeout: 30_000 });
    await O.goto("/app");
    await expect(O.locator("main")).toContainText("You're not in a care group yet", { timeout: 30_000 });
    expect(new URL(O.url()).pathname).toBe("/app");
  });

  await test.step("removed: their shared details leave the owner's device with them", async () => {
    await expect.poll(shareRows, { timeout: 30_000, intervals: [500] }).toBe(0);
  });

  await test.step("the seeds' memberships are back (in SQL), and the owner's list follows", async () => {
    restoreSeeds();
    await expect(roleSelect(M, "Dev Caretaker")).toHaveValue("caretaker", { timeout: 30_000 });
    expect(serverMembers()).toBe("Dev Member:owner,Dev Caretaker:caretaker,Dev Viewer:viewer");
  });

  await test.step("a caretaker again: the details row comes back on the next sync", async () => {
    await expect.poll(() => detailsRows(O), { timeout: 30_000 }).toBe(1);
  });
  await noErrors(dM, dO);
});

// ── 4. Simple mode: the owner's switch reaching the member's device ─────────
test("simple mode: the owner's switch reaches the member's device", async ({ device }) => {
  test.setTimeout(150_000);
  const dM = await device("settings-owner");
  const dS = await device("simple-member");
  const M = dM.page;
  const S = dS.page;
  try {
    await signIn(S, "caretaker@example.com");
    await S.goto(DEV_FAMILY_TIMELINE);
    await expect(S.getByRole("button", { name: "View options" })).toBeVisible({ timeout: 40_000 });
    await expect(rowsOf(S).first()).toBeVisible({ timeout: 40_000 });
    await stay(S);

    await signIn(M, "member@example.com");
    await M.goto(`/app/groups/${DEV_FAMILY}/settings/members`);
    const toggle = M.locator('main [data-section="members"] li[data-member]')
      .filter({ has: M.locator("p", { hasText: "Dev Caretaker" }) })
      .locator("[data-simple-mode-switch]");
    await expect(toggle).toBeEnabled({ timeout: 40_000 });
    await toggle.click();

    await test.step("the owner turns on simple mode for caretaker@: saved on the server, and their timeline switches without a reload", async () => {
      const serverSimple = () =>
        psql(
          `SELECT m.simple_mode FROM care_group_member m JOIN "user" u ON u.id = m.user_id WHERE m.group_id = '${DEV_FAMILY}' AND u.email = 'caretaker@example.com'`,
        );
      await expect.poll(serverSimple, { timeout: 20_000, intervals: [500] }).toBe("t");
      await expect(S.locator("[data-simple-timeline]")).toBeVisible({ timeout: 30_000 });
      // Search stays in simple mode unless locked (B-208).
      await expect(S.locator('header [data-region="search"]')).toHaveCount(1);
      expect(await stayed(S)).toBe(1);
    });
    await noErrors(dM, dS);
  } finally {
    restoreSeeds();
  }
});

// ── 5. Staff: /admin only for staff, a real audit row, the banner in /app ───
test("staff: /admin is staff only, an action is audited, the banner reaches /app", async ({ device }) => {
  const TAG = `ASH${Date.now().toString(36)}`;
  const TEXT = `${TAG} Maintenance tonight from 22:00`;
  const before = psql(`SELECT value::text FROM app_setting WHERE key = 'announcement'`);
  const dA = await device("staff-admin");
  const dMember = await device("staff-member");
  const A = dA.page;
  const member = dMember.page;
  const setAnnouncement = (value, reason) =>
    A.evaluate(
      ({ value, reason }) =>
        fetch("/rpc/admin/settings/set", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
          body: JSON.stringify({ json: { key: "announcement", value, reason } }),
        }).then((r) => r.status),
      { value, reason },
    );
  await signIn(A, "admin@example.com", PASSWORD, { home: true });
  await signIn(member, "member@example.com", PASSWORD, { home: true });
  try {
    await test.step("member@ (not staff): every /admin page is a 404", async () => {
      const status = await member.evaluate(() =>
        Promise.all(
          ["/admin", "/admin/audit", "/admin/users", "/admin/settings"].map((u) =>
            fetch(u, { credentials: "include" }).then((r) => r.status),
          ),
        ),
      );
      expect(status).toEqual([404, 404, 404, 404]);
    });

    await test.step("admin@ posts a banner: one audit row by admin@, listed on /admin/audit", async () => {
      const posted = await setAnnouncement({ text: TEXT, tone: "warning" }, `${TAG} maintenance notice`);
      expect(posted).toBe(200);
      expect(
        psql(
          `SELECT count(*) FROM admin_audit_log a JOIN "user" u ON u.id = a.actor_id WHERE a.action = 'setting.set' AND a.reason = '${TAG} maintenance notice' AND u.email = 'admin@example.com'`,
        ),
      ).toBe("1");
      const page = await A.evaluate(
        (needle) =>
          fetch("/admin/audit?action=setting.set", { credentials: "include" }).then(async (r) => ({
            status: r.status,
            listed: (await r.text()).includes(needle),
          })),
        `${TAG} maintenance notice`,
      );
      expect(page).toEqual({ status: 200, listed: true });
    });

    await test.step("member@'s /app shows the banner", async () => {
      await member.goto("/app");
      await expect(member.locator('[data-region="announcement"] [data-announcement]')).toContainText(TEXT, {
        timeout: 20_000,
      });
    });
  } finally {
    await test.step("the announcement is put back as it was", async () => {
      const restored = await setAnnouncement(before ? JSON.parse(before) : null, `${TAG} put back`).catch(
        () => 0,
      );
      if (!before) psql(`DELETE FROM app_setting WHERE key = 'announcement'`);
      psql(`DELETE FROM admin_audit_log WHERE reason LIKE '${TAG}%'`);
      expect(restored).toBe(200);
    });
  }
  await noErrors(dA, dMember);
});
