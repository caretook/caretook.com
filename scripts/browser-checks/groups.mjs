// Invites slices 5 and 6: starting care groups. Smoke mode runs steps 1, 2, 4 and 7:
//   1. An access code's link (/join/CARE-DEMO-0001), signed out: a two-step
//      form (account, then who you care for); the confirmation email opens
//      the new group's empty timeline as its owner, with the Invite someone
//      card; the redemption is recorded.
//   2. That user starts a second group from /app/groups/new (the sheet) and
//      lands on its empty timeline; the group menu lists both.
//   3. Expired, revoked, used-up and unknown codes say so plainly, with no form.
//   4. admin@ (staff, in no group): creates a code, prints it (the QR is an
//      SVG that decodes to /join/<code> on APP_URL; screenshot), revokes it,
//      and creates a group whose owner invite email arrives.
//   5. /admin is a 404 for a group's owner, and the admin API refuses them.
//   6. A group with other members shows no Invite someone card.
//   7. caretaker@ (one group): the group menu's "New care group" opens the
//      sheet, and closing it goes back to the timeline.
//   8. admin@ filters the waitlist (marketing slice 5): the count matches,
//      newest first, and the CSV export holds exactly the filtered rows,
//      escaped. (Step 5 checks a group's owner gets the 404 there too.)
//
// Order-independent and self-cleaning: it makes grp<run>-…@example.com
// accounts and GR<run> groups and codes, and grp<run>-… waitlist entries, and
// deletes them, their mail, outbox and verification rows at the end.
import { execFileSync } from "node:child_process";
import { BASE, launch, openPage, sleep, step } from "./cdp.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const SYSTEM = "00000000-0000-0000-0000-000000000000";
const RUN = `grp${Date.now().toString(36)}`;
const TAG = `GR${RUN.slice(3)}`;
const email = (who) => `${RUN}-${who}@example.com`;
const NEW_PASSWORD = `a ${RUN} passphrase`;

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

const cleanUp = () => {
  const like = `'${RUN}-%@example.com'`;
  psql(`
    DELETE FROM care_group WHERE id IN (
      SELECT group_id FROM care_recipient WHERE name LIKE '${TAG}%'
      UNION SELECT id FROM care_group WHERE name LIKE '${TAG}%');
    DELETE FROM care_group_invite WHERE email LIKE ${like};
    DELETE FROM "user" WHERE email LIKE ${like};
    DELETE FROM access_code WHERE label LIKE '${TAG}%';
    DELETE FROM verification WHERE identifier LIKE '%${RUN}-%' OR value LIKE '%${RUN}-%';
    DELETE FROM dev_mail WHERE recipient LIKE ${like};
    DELETE FROM notification_outbox WHERE recipient LIKE ${like};
    DELETE FROM waitlist_entry WHERE email LIKE ${like};`);
};

// --- Mail ---------------------------------------------------------------------

const mailTo = async (address) => {
  const res = await fetch(`${BASE}/dev/mail.json?to=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`/dev/mail.json answered ${res.status}`);
  return (await res.json()).messages;
};

const waitForMail = async (address, name, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const mine = (await mailTo(address)).filter((m) => m.name === name);
    if (mine.length) return mine[0];
    await sleep(300);
  }
  throw new Error(`No ${name} mail for ${address} within ${ms} ms`);
};

// --- Page helpers ---------------------------------------------------------------

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const button = (label) =>
  `[...document.querySelectorAll('main button, [role="dialog"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const h1 = `(document.querySelector("main h1")?.textContent.trim() ?? "")`;
const onTimeline = `/^\\/app\\/groups\\/[0-9a-f-]+\\/timeline$/.test(location.pathname)`;
const groupIdOf = (path) => /\/app\/groups\/([0-9a-f-]+)\//.exec(path)?.[1];

const fill = async (p, name, value) => p.type(q(`[name="${name}"]`), value);

const browsers = [];
const open = async (port, label) => {
  const b = await launch(port);
  browsers.push(b);
  return openPage(b, label);
};

try {
  const owner = email("owner");
  let firstGroup;

  // 1. An access code: sign up and start a group ------------------------------------
  await step("1. sign up with an access code and start a group", { smoke: true }, async () => {
    const p = await open(9601, "join");
    await p.goto("/join/care-demo-0001");
    await p.waitFor(`${h1} === "Start a care group" && ${q('[data-join-form="account"]')}`, 20000);
    await fill(p, "name", "Grp Owner Tester");
    await fill(p, "email", owner);
    await fill(p, "password", NEW_PASSWORD);
    await fill(p, "confirm", NEW_PASSWORD);
    await p.press(button("Continue"));
    await p.waitFor(`${h1} === "Who do you care for?"`);
    await fill(p, "recipientName", `${TAG} Rose Example`);
    await fill(p, "preferredName", `${TAG} Nana`);
    const placeholder = await p.evaluate(`${q('[name="groupName"]')}.placeholder`);
    check(placeholder === `${TAG} Nana's care`, "the group name defaults to the preferred name", placeholder);
    await p.press(button("Create care group"));
    await p.waitFor(`location.pathname === "/verify-email"`, 20000);
    const next = await p.evaluate(`new URLSearchParams(location.search).get("next") ?? ""`);
    firstGroup = groupIdOf(next);
    check(Boolean(firstGroup), "sign-up asks to confirm the email, then the new group", next);

    const row = psql(`
      SELECT m.role || '|' || u.email_verified || '|' || g.name || '|' || (SELECT count(*) FROM access_code_redemption r WHERE r.user_id = u.id AND r.group_id = g.id)
      FROM "user" u JOIN care_group_member m ON m.user_id = u.id JOIN care_group g ON g.id = m.group_id
      WHERE u.email = '${owner}'`);
    check(
      row === `owner|false|${TAG} Nana's care|1`,
      "the account owns the group and the redemption is recorded",
      row,
    );

    const mail = await waitForMail(owner, "verifyEmail");
    const link = mail.links.find((l) => l.includes("/verify-email?token="));
    check(
      Boolean(link) && link.includes(encodeURIComponent(next)),
      "the confirmation link goes on to the group",
      link,
    );
    await p.goto(new URL(link).pathname + new URL(link).search);
    await p.waitFor(`${h1} === "Email confirmed"`, 20000);
    await p.press(
      `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Continue to Caretook")`,
    );
    await p.waitFor(`${onTimeline} && ${q("[data-invite-card]")}`, 45000);
    check(true, "the new group's timeline opens with the Invite someone card");
    await p.screenshot("groups-new-owner-timeline");
    const cardLink = await p.evaluate(`${q("[data-invite-card] a")}.getAttribute("href")`);
    check(cardLink === `/app/groups/${firstGroup}/settings/members`, "the card opens Members", cardLink);
    globalThis.joinPage = p;
  });

  // 2. A second group from the New care group sheet -------------------------------
  await step("2. start a second group from the sheet", { smoke: true }, async () => {
    const p = globalThis.joinPage;
    if (!p) throw new Error("step 1 didn't leave a signed-in page");
    await p.goto("/app/groups/new");
    await p.waitFor(`${q("[data-new-group-form]")}`, 20000);
    const title = await p.evaluate(
      `document.querySelector('[role="dialog"] h2, [role="dialog"] [slot="title"]')?.textContent ?? ""`,
    );
    check(title.includes("New care group"), "the sheet is named New care group", title);
    await fill(p, "recipientName", `${TAG} Lou Example`);
    await fill(p, "groupName", `${TAG} Second group`);
    await p.press(button("Create care group"));
    await p.waitFor(
      `${onTimeline} && !location.pathname.includes(${JSON.stringify(firstGroup)}) && ${q("[data-invite-card]")}`,
      30000,
    );
    check(true, "it lands on the second group's empty timeline, with the card");
    const groupMenu = `document.querySelector('header button[aria-label$="switch care group"]')`;
    await p.waitFor(groupMenu, 10000);
    await p.press(groupMenu);
    await p.waitFor(`document.querySelectorAll('[role="menuitemradio"]').length >= 2`, 10000);
    const names = await p.evaluate(
      `[...document.querySelectorAll('[role="menuitemradio"]')].map((el) => el.textContent.trim())`,
    );
    check(
      names.some((n) => n.includes(`${TAG} Nana`)) && names.some((n) => n.includes(`${TAG} Lou`)),
      "the group menu lists both groups",
      JSON.stringify(names),
    );
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
  });

  // 3. Codes that can't be used ----------------------------------------------------
  await step("3. expired, revoked, used-up and unknown codes", async () => {
    const codes = { expired: "GRXP-0000-0001", revoked: "GRXP-0000-0002", usedUp: "GRXP-0000-0003" };
    psql(`
      DELETE FROM access_code WHERE code IN ('${Object.values(codes).join("','")}');
      INSERT INTO access_code (code, label, expires_at, max_uses, use_count, revoked_at, created_by, updated_by) VALUES
        ('${codes.expired}', '${TAG} expired', now() - interval '1 day', NULL, 0, NULL, '${SYSTEM}', '${SYSTEM}'),
        ('${codes.revoked}', '${TAG} revoked', now() + interval '1 day', NULL, 0, now(), '${SYSTEM}', '${SYSTEM}'),
        ('${codes.usedUp}', '${TAG} used up', now() + interval '1 day', 2, 2, NULL, '${SYSTEM}', '${SYSTEM}');`);
    const p = await open(9602, "closed-codes");
    const expect = {
      expired: "This code has expired",
      revoked: "This code no longer works",
      usedUp: "This code has been used up",
      notFound: "This code isn't valid",
    };
    for (const [state, code] of [...Object.entries(codes), ["notFound", "CARE-ZZZZ-ZZZZ"]]) {
      await p.goto(`/join/${code}`);
      await p.waitFor(`${q("[data-code-state]")}`, 20000);
      const seen = await p.evaluate(
        `({ h: ${h1}, state: ${q("[data-code-state]")}.dataset.codeState, form: !!${q("[data-join-form]")} })`,
      );
      check(
        seen.h === expect[state] && seen.state === state && !seen.form,
        `a ${state} code says so plainly, with no form`,
        JSON.stringify(seen),
      );
    }
  });

  // 4. Staff: codes, printing and a group with an owner invite ---------------------
  await step(
    "4. admin@ creates, prints and revokes a code, and sets up a group",
    { smoke: true },
    async () => {
      const p = await open(9603, "admin");
      await p.signIn("admin@example.com", PASSWORD, { home: true });
      await p.goto("/admin");
      await p.waitFor(
        `location.pathname === "/admin/access-codes" && ${q('[data-admin-form="newCode"]')}`,
        20000,
      );
      const label = `${TAG} flyer`;
      await fill(p, "label", label);
      await fill(p, "maxUses", "25");
      await p.press(`${q('[data-admin-form="newCode"] button[type="submit"]')}`);
      await p.waitFor(
        `[...document.querySelectorAll("[data-access-codes] tr")].some((tr) => tr.textContent.includes(${JSON.stringify(label)}))`,
        15000,
      );
      const row = `[...document.querySelectorAll("[data-access-codes] tbody tr")].find((tr) => tr.textContent.includes(${JSON.stringify(label)}))`;
      const code = await p.evaluate(`${row}.dataset.code`);
      check(/^CARE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), "the new code is listed", code);
      check((await p.evaluate(`${row}.textContent`)).includes("0 of 25"), "with its uses");

      // Print: an SVG QR for /join/<code> on APP_URL.
      await p.press(`[...${row}.querySelectorAll("a")].find((a) => a.textContent.startsWith("Print"))`);
      await p.waitFor(`${q("[data-access-code-qr] svg")}`, 15000);
      const print = await p.evaluate(
        `({ url: ${q("[data-access-code-qr]")}.dataset.accessCodeQr, shown: ${q("[data-access-code-url]")}.textContent, code: ${q("[data-access-code]")}.textContent })`,
      );
      const expected = `${BASE}/join/${code}`;
      check(
        print.url === expected && print.shown === expected && print.code === code,
        "the print page shows the link and code",
        JSON.stringify(print),
      );
      await p.send("Emulation.setDeviceMetricsOverride", {
        width: 900,
        height: 1200,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await p.screenshot("groups-access-code-print");
      const decoded = await p.evaluate(`(async () => {
      if (!("BarcodeDetector" in window)) return { unsupported: true };
      const svg = document.querySelector("[data-access-code-qr] svg").outerHTML;
      const img = new Image();
      img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 600;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 600, 600); ctx.drawImage(img, 0, 0, 600, 600);
      const found = await new BarcodeDetector({ formats: ["qr_code"] }).detect(canvas);
      return { value: found[0]?.rawValue ?? null };
    })()`);
      if (decoded.unsupported)
        console.log("NOTE  BarcodeDetector isn't available here: read groups-access-code-print.png");
      else check(decoded.value === expected, "the QR decodes to the code's link", decoded.value);

      // Revoke.
      await p.goto("/admin/access-codes");
      await p.waitFor(row, 15000);
      await p.press(`[...${row}.querySelectorAll("button")].find((b) => b.textContent.startsWith("Revoke"))`);
      await p.waitFor(`${row}?.dataset.state === "revoked"`, 15000);
      check(true, "Revoke stops the code");
      const preview = await p.evaluate(
        `fetch("/rpc/accessCode/preview", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: { code: ${JSON.stringify(code)} } }) }).then((r) => r.json())`,
      );
      check(preview?.json?.state === "revoked", "and the code's page says so", JSON.stringify(preview));

      // A group with an owner invite.
      const groupOwner = email("staffowner");
      await p.goto("/admin/new-group");
      await p.waitFor(`${q('[data-admin-form="newGroup"]')}`, 15000);
      await fill(p, "groupName", `${TAG} Staff family`);
      await fill(p, "recipientName", `${TAG} Ann Example`);
      await fill(p, "ownerEmail", groupOwner);
      await p.evaluate(`${q('[name="attested"]')}.click()`);
      await p.press(`${q('[data-admin-form="newGroup"] button[type="submit"]')}`);
      await p.waitFor(`${q('[role="status"]')}?.textContent.includes(${JSON.stringify(groupOwner)})`, 15000);
      const mail = await waitForMail(groupOwner, "ownerInvite");
      const invite = mail.links.find((l) => l.includes("/invite/"));
      check(
        Boolean(invite) && invite.startsWith(`${BASE}/invite/`),
        "the owner invite email arrives with its link",
        invite,
      );
      check(
        !mail.text.includes("Ann Example") || !/vital|symptom|medication/i.test(mail.text),
        "with no health details",
      );
      const members = psql(
        `SELECT count(*) FROM care_group_member m JOIN care_group g ON g.id = m.group_id WHERE g.name = '${TAG} Staff family'`,
      );
      check(members === "0", "staff don't join the group", members);
    },
  );

  // 5. /admin is for staff only ----------------------------------------------------
  await step("5. /admin is a 404 for a group's owner", async () => {
    const p = await open(9604, "owner-not-staff");
    await p.signIn("member@example.com", PASSWORD, { home: true });
    const status = await p.evaluate(
      `Promise.all(["/admin", "/admin/access-codes", "/admin/new-group", "/admin/waitlist", "/admin/waitlist/export"].map((u) => fetch(u, { credentials: "include" }).then((r) => r.status)))`,
    );
    check(
      status.every((s) => s === 404),
      "every admin page is a 404",
      JSON.stringify(status),
    );
    const api = await p.evaluate(
      `fetch("/rpc/admin/accessCode/list", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: "{}" }).then((r) => r.status)`,
    );
    check(api === 403, "and the admin API refuses them", String(api));
    const waitlistApi = await p.evaluate(
      `fetch("/rpc/admin/waitlist/list", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: "{}" }).then((r) => r.status)`,
    );
    check(waitlistApi === 403, "the waitlist API too", String(waitlistApi));
    const anon = await fetch(`${BASE}/admin/access-codes`, { redirect: "manual" });
    check(
      anon.status === 302 && (anon.headers.get("location") ?? "").startsWith("/sign-in"),
      "signed out, it asks to sign in",
      String(anon.status),
    );

    // 6. A group with other members has no card.
    await p.goto("/app/groups/0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001/timeline");
    await p.waitFor(`${onTimeline} && ${q("main section, main ul, main ol")}`, 30000);
    await sleep(1000);
    check(
      !(await p.evaluate(`!!${q("[data-invite-card]")}`)),
      "Dev Family (other members) shows no Invite someone card",
    );
  });

  // 7. "New care group" in the group menu -------------------------------------------
  await step("7. the group menu opens the New care group sheet", { smoke: true }, async () => {
    const p = await open(9605, "group-menu-new");
    await p.signIn("caretaker@example.com", PASSWORD, { home: true });
    await p.waitFor(onTimeline, 45000);
    const timeline = await p.evaluate("location.pathname");
    const groupMenu = `document.querySelector('header button[aria-label$="switch care group"]')`;
    const newGroup = `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === "New care group")`;
    await p.waitFor(groupMenu, 20000);
    await p.press(groupMenu);
    await p.waitFor(newGroup, 10000);
    await p.press(newGroup);
    await p.waitFor(`location.pathname === "/app/groups/new" && ${q("[data-new-group-form]")}`, 20000);
    check(true, "New care group opens the sheet");
    await p.press(`document.querySelector('[role="dialog"] button[aria-label="Close"]')`);
    await p.waitFor(
      `location.pathname === ${JSON.stringify(timeline)} && !${q("[data-new-group-form]")}`,
      10000,
    );
    check(true, "closing it goes back to the timeline", timeline);
  });

  // 8. The waitlist (marketing slice 5) ------------------------------------------------
  await step("8. admin@ filters the waitlist and exports exactly those rows", async () => {
    const src = `${TAG}src`;
    const row = (who, caringFor, heardFrom, page, at) =>
      `('${email(who)}', '${who}', ${caringFor ? `'${caringFor}'` : "NULL"}, ${heardFrom ?? "NULL"}, '{"page":"${page}","utmSource":"${src}"}', '${at}', '${SYSTEM}', '${SYSTEM}')`;
    psql(`INSERT INTO waitlist_entry (email, first_name, caring_for, heard_from, source, created_at, created_by, updated_by) VALUES
      ${row("wl1", "parent", `E'A friend, "Jo"\\nat church'`, "/", "2026-10-01T12:00:00Z")},
      ${row("wl2", "spouse", null, "/features", "2026-10-20T12:00:00Z")},
      ${row("wl3", "parent", `'=1+1'`, "/", "2026-11-05T12:00:00Z")}`);

    const p = await open(9606, "admin-waitlist");
    await p.signIn("admin@example.com", PASSWORD, { home: true });
    await p.goto("/admin/access-codes");
    const navLink = `[...document.querySelectorAll('nav[aria-label="Admin sections"] a')].find((a) => a.textContent.trim() === "Waitlist")`;
    await p.waitFor(navLink, 20000);
    await p.press(navLink);
    await p.waitFor(`location.pathname === "/admin/waitlist" && ${q("[data-waitlist-filters]")}`, 15000);
    check(true, "the admin nav opens the waitlist");

    // Filter by source through the form.
    await fill(p, "source", src.toLowerCase());
    await p.press(`${q('[data-waitlist-filters] button[type="submit"]')}`);
    const shown = `[...document.querySelectorAll("[data-waitlist] tbody tr")].map((tr) => tr.dataset.entry)`;
    await p.waitFor(`${q("[data-waitlist-count]")}?.dataset.waitlistCount === "3"`, 15000);
    const order = await p.evaluate(shown);
    check(
      JSON.stringify(order) === JSON.stringify(["wl3", "wl2", "wl1"].map(email)),
      "a source filter finds the three, newest first",
      JSON.stringify(order),
    );

    // Then by who they care for and a date range.
    await p.evaluate(
      `(() => { const s = ${q('[name="caringFor"]')}; s.value = "parent"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
    );
    await p.evaluate(`${q('[name="from"]')}.value = "2026-10-01"`);
    await p.evaluate(`${q('[name="to"]')}.value = "2026-10-31"`);
    await p.press(`${q('[data-waitlist-filters] button[type="submit"]')}`);
    await p.waitFor(
      `new URLSearchParams(location.search).get("caringFor") === "parent" && ${q("[data-waitlist-count]")}?.dataset.waitlistCount === "1"`,
      15000,
    );
    const one = await p.evaluate(shown);
    check(
      JSON.stringify(one) === JSON.stringify([email("wl1")]),
      "cares for and dates narrow it to one",
      JSON.stringify(one),
    );
    const status = await p.evaluate(`${q("[data-waitlist-count]")}.textContent`);
    check(status.startsWith("1 person match"), "with a matching count", status);

    // Export: the same filters, exactly that row, escaped.
    const csv = await p.evaluate(`(async () => {
      const a = ${q("[data-waitlist-export]")};
      const res = await fetch(a.getAttribute("href"), { credentials: "include" });
      return { href: a.getAttribute("href"), type: res.headers.get("content-type"), disposition: res.headers.get("content-disposition"), text: await res.text() };
    })()`);
    const lines = csv.text.replace(/^\uFEFF/, "").split("\r\n");
    check(
      csv.type === "text/csv; charset=utf-8" &&
        /^attachment; filename="caretook-waitlist-\d{4}-\d{2}-\d{2}\.csv"$/.test(csv.disposition ?? ""),
      "the export downloads a CSV",
      `${csv.type} ${csv.disposition}`,
    );
    check(
      lines.length === 3 &&
        lines[2] === "" &&
        lines[1].startsWith(
          `2026-10-01T12:00:00.000Z,${email("wl1")},wl1,A parent,"A friend, ""Jo""\nat church",/,${src}`,
        ),
      "with exactly the filtered row, its comma, quotes and newline escaped",
      JSON.stringify(lines.slice(0, 2)),
    );
    const formula = await p.evaluate(
      `fetch(${JSON.stringify(`/admin/waitlist/export?source=${src}&from=2026-11-01`)}, { credentials: "include" }).then((r) => r.text())`,
    );
    check(
      formula.includes(`,'=1+1,`),
      "and a formula-looking answer is defused",
      JSON.stringify(formula.split("\r\n")[1]),
    );
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
