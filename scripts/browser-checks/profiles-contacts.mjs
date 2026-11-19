import { execFileSync } from "node:child_process";
import { launch, openPage, sleep, step } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

// Members' contact details (profiles slice 4): caretaker@ enters phones and
// an address on their account (Contact details), then chooses on Dev
// Family's Members page what the group sees. member@ on a second device sees
// the shared phone (call and text) and relationship, never the address or a
// sign-in email; a changed number follows; offline it still reads, with no
// sharing form; unsharing removes it; and leaving the group removes it from
// member@'s device.
//
// It starts caretaker@ from nothing shared (as a new member), and puts back
// what it found: their contact details, their Dev Family membership and its
// share row.

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const MEMBERS_PATH = `/app/groups/${DEV_FAMILY}/settings/members`;
const CONTACT_PATH = "/app/settings/contact";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execFileSync("docker", ["exec", PG_CONTAINER, "psql", "-U", "caretook", "-d", "caretook", "-tAc", sql])
    .toString()
    .trim();
const lit = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;

const CT = psql(`SELECT id FROM "user" WHERE email = 'caretaker@example.com'`);
const run = Date.now().toString(36).slice(-5);
const n = String(10 + (Date.now() % 90));
const PHONE_1 = `(555) 010-19${n}`;
const PHONE_2 = `(555) 010-18${n}`;
const ADDRESS = `${run} Check Lane`;
const RELATIONSHIP = `Aide ${run}`;
const digits = (phone) => phone.replace(/\D/g, "");

// What caretaker@ had, to put back at the end.
const found = {
  contact: JSON.parse(
    psql(
      `SELECT coalesce((SELECT json_build_object('phones', phones, 'email', contact_email, 'address', address) FROM user_contact WHERE user_id = '${CT}'), 'null')`,
    ),
  ),
  member: JSON.parse(
    psql(
      `SELECT json_build_object('role', role, 'relationship', relationship, 'shared', shared_fields, 'rank', emergency_rank, 'primary', is_primary_contact) FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`,
    ) || "null",
  ),
  share: JSON.parse(
    psql(
      `SELECT coalesce((SELECT json_build_object('phones', phones, 'email', email, 'address', address) FROM member_contact_share WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'), 'null')`,
    ),
  ),
};

function restore() {
  const m = found.member ?? { role: "caretaker", relationship: null, shared: [], rank: null, primary: false };
  psql(
    `INSERT INTO care_group_member (group_id, user_id, role, created_by, updated_by) VALUES ('${DEV_FAMILY}', '${CT}', ${lit(m.role)}, '${CT}', '${CT}') ON CONFLICT (group_id, user_id) DO NOTHING`,
  );
  psql(
    `UPDATE care_group_member SET role = ${lit(m.role)}, relationship = ${lit(m.relationship)}, shared_fields = ${json(m.shared)}, emergency_rank = ${m.rank ?? "NULL"}, is_primary_contact = ${m.primary ? "true" : "false"}, emergency_dropped_at = NULL WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`,
  );
  if (found.contact)
    psql(
      `INSERT INTO user_contact (user_id, phones, contact_email, address, created_by, updated_by) VALUES ('${CT}', ${json(found.contact.phones)}, ${lit(found.contact.email)}, ${lit(found.contact.address)}, '${CT}', '${CT}') ON CONFLICT (user_id) DO UPDATE SET phones = EXCLUDED.phones, contact_email = EXCLUDED.contact_email, address = EXCLUDED.address`,
    );
  else psql(`DELETE FROM user_contact WHERE user_id = '${CT}'`);
  psql(`DELETE FROM member_contact_share WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`);
  if (found.share)
    psql(
      `INSERT INTO member_contact_share (id, group_id, user_id, phones, email, address, created_by, updated_by) SELECT id, group_id, user_id, ${found.share.phones ? json(found.share.phones) : "NULL"}, ${lit(found.share.email)}, ${lit(found.share.address)}, '${CT}', '${CT}' FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`,
    );
}

/** caretaker@ as a member who has shared nothing and entered nothing. */
function startFresh() {
  restore(); // the membership, should an earlier run have left without it
  psql(`DELETE FROM member_contact_share WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`);
  psql(`DELETE FROM user_contact WHERE user_id = '${CT}'`);
  psql(
    `UPDATE care_group_member SET relationship = NULL, shared_fields = '[]'::jsonb, emergency_rank = NULL, is_primary_contact = false WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`,
  );
}

const MEMBERS = `document.querySelector('main [data-section="members"]')`;
const ROW = (userId) => `${MEMBERS}?.querySelector('li[data-member="${userId}"]')`;
const SHARING = `${MEMBERS}?.querySelector("[data-sharing-form]")`;
const CONTACT_FORM = `document.querySelector("main [data-contact-form]")`;
const status = (form) => `(${form}?.querySelector('[role="status"]')?.textContent.trim() ?? "")`;
const rowText = (userId) => `(${ROW(userId)}?.textContent ?? "")`;

async function signedIn(browser, label, email) {
  const p = await openPage(browser, label);
  await p.signIn(email, PW).catch(async () => {
    await sleep(4000);
    await p.signIn(email, PW);
  });
  await p.waitFor(`location.pathname.endsWith("/timeline")`, 45000);
  return p;
}
async function openMembers(p, { form = true } = {}) {
  await p.goto(MEMBERS_PATH);
  await p.waitFor(`${MEMBERS}?.querySelector("li[data-member]")`, 40000);
  if (form) await p.waitFor(SHARING, 20000);
}
async function saveContact(p, { number, email = "", address = ADDRESS }) {
  await p.waitFor(`${CONTACT_FORM}?.querySelector('input[name="phoneNumber"]')`, 30000);
  await p.type(`${CONTACT_FORM}.querySelector('input[name="phoneLabel"]')`, "Mobile");
  await p.type(`${CONTACT_FORM}.querySelector('input[name="phoneNumber"]')`, number);
  await p.type(`${CONTACT_FORM}.querySelector('input[name="contactEmail"]')`, email);
  await p.type(`${CONTACT_FORM}.querySelector('textarea[name="address"]')`, address);
  await p.press(`${CONTACT_FORM}.querySelector('button[type="submit"]')`);
}
async function saveSharing(p, { phones, address = false, relationship }) {
  for (const [field, want] of [
    ["phones", phones],
    ["address", address],
  ]) {
    const box = `${SHARING}.querySelector('[data-share-field="${field}"]')`;
    if (await p.evaluate(`!!${box} && ${box}.checked !== ${want}`)) await p.evaluate(`${box}.click()`);
  }
  if (relationship !== undefined)
    await p.type(`${SHARING}.querySelector('input[name="relationship"]')`, relationship);
  await p.press(`${SHARING}.querySelector('button[type="submit"]')`);
  await p.waitFor(`${status(SHARING)} === "Saved."`, 20000);
}
const sharedOnServer = () =>
  psql(`SELECT shared_fields FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`);

const browsers = [];
const pages = [];
const proxy = startProxy(9811);
try {
  startFresh();
  browsers.push(await launch(9801));
  const C = await signedIn(browsers[0], "caretaker", "caretaker@example.com");
  pages.push(C);
  let M = null;

  await step("caretaker@: contact details, then what Dev Family sees", { smoke: true }, async () => {
    // Nothing entered: the own row says so and links to Contact details.
    await openMembers(C);
    const fresh = await C.evaluate(`({
      none: !!${SHARING}.querySelector("[data-no-contact]"),
      boxes: ${SHARING}.querySelectorAll('input[type="checkbox"]').length,
      link: ${SHARING}.querySelector('a[href="${CONTACT_PATH}"]')?.textContent.trim() ?? "",
      shown: !!${ROW(CT)}.querySelector("[data-member-contact]"),
    })`);
    check(
      "own row: with nothing entered, no choices and a link to Contact details",
      fresh.none && fresh.boxes === 0 && fresh.link === "Add contact details" && !fresh.shown,
      JSON.stringify(fresh),
    );
    await C.screenshot("profiles-contacts-members-empty");

    await C.evaluate(`${SHARING}.querySelector('a[href="${CONTACT_PATH}"]').click()`);
    await C.waitFor(`location.pathname === "${CONTACT_PATH}" && ${CONTACT_FORM}`, 30000);
    const page = await C.evaluate(`({
      h1: document.querySelector("main h1")?.textContent.trim(),
      help: ${CONTACT_FORM}.querySelector('input[name="contactEmail"]').getAttribute("aria-describedby")?.split(" ").map((id) => document.getElementById(id)?.textContent.trim()).join(" ") ?? "",
      current: document.querySelector('nav[data-settings-nav] [aria-current]')?.dataset.settingsItem ?? "",
    })`);
    check(
      "Contact details: its own subpage, saying the sign-in email stays private",
      page.h1 === "Contact details" && /caretaker@example\.com\) stays private/.test(page.help),
      JSON.stringify(page),
    );

    // A bad email is refused on its field.
    await saveContact(C, { number: PHONE_1, email: "not-an-email" });
    const EMAIL = `${CONTACT_FORM}.querySelector('input[name="contactEmail"]')`;
    await C.waitFor(`${EMAIL}.getAttribute("aria-invalid") === "true"`, 20000).catch(() => {});
    const bad = await C.evaluate(`({
      invalid: ${EMAIL}.getAttribute("aria-invalid"),
      message: ${EMAIL}.getAttribute("aria-describedby")?.split(" ").map((id) => document.getElementById(id)?.textContent.trim()).join(" ") ?? "",
    })`);
    check(
      "Contact details: a bad email shows its error on the field",
      bad.invalid === "true" && bad.message.includes("Enter an email address"),
      JSON.stringify(bad),
    );
    check(
      "Contact details: nothing saved while it's refused",
      psql(`SELECT count(*) FROM user_contact WHERE user_id = '${CT}'`) === "0",
    );

    await saveContact(C, { number: PHONE_1, email: "" });
    await C.waitFor(`${status(CONTACT_FORM)} === "Saved."`, 20000).catch(() => {});
    check(
      "Contact details: a phone and an address save",
      (await C.evaluate(status(CONTACT_FORM))) === "Saved." &&
        psql(`SELECT phones->0->>'number' || '|' || address FROM user_contact WHERE user_id = '${CT}'`) ===
          `${PHONE_1}|${ADDRESS}`,
    );
    check(
      "nothing is shared until chosen",
      psql(
        `SELECT count(*) FROM member_contact_share WHERE group_id = '${DEV_FAMILY}' AND user_id = '${CT}'`,
      ) === "0" && sharedOnServer() === "[]",
      sharedOnServer(),
    );
    await C.screenshot("profiles-contacts-contact-page");

    // The Members page offers only what's filled in (no email), nothing ticked.
    await openMembers(C);
    await C.waitFor(`${SHARING}.querySelectorAll('input[type="checkbox"]').length > 0`, 20000);
    const offered = await C.evaluate(
      `[...${SHARING}.querySelectorAll('input[type="checkbox"]')].map((b) => b.value + ":" + b.checked + ":" + (b.closest("label").textContent.includes(${JSON.stringify(PHONE_1)}) || b.closest("label").textContent.includes(${JSON.stringify(ADDRESS)}))).join(",")`,
    );
    check(
      "own row: offers phone numbers and address (not the empty email), nothing ticked",
      offered === "phones:false:true,address:false:true",
      offered,
    );
    const named = await C.evaluate(
      `(() => { const i = ${SHARING}.querySelector('input[name="relationship"]'); return document.querySelector('label[for="' + i.id + '"]')?.textContent.trim(); })()`,
    );
    check(
      "own row: the relationship field is named for the recipient",
      /^How you're related to /.test(named ?? ""),
      named,
    );

    await saveSharing(C, { phones: true, relationship: RELATIONSHIP });
    check("sharing phones saves", sharedOnServer() === '["phones"]', sharedOnServer());
    await C.screenshot("profiles-contacts-sharing");
  });

  await step("member@ on a second device sees what's shared", { smoke: true }, async () => {
    browsers.push(await launch(9802, proxy.args));
    M = await signedIn(browsers[1], "member", "member@example.com");
    pages.push(M);
    await openMembers(M);
    await M.waitFor(
      `${rowText(CT)}.includes(${JSON.stringify(PHONE_1)}) && ${rowText(CT)}.includes(${JSON.stringify(RELATIONSHIP)})`,
      30000,
    ).catch(() => {});
    const seen = await M.evaluate(`({
      text: ${rowText(CT)},
      relationship: ${ROW(CT)}?.querySelector("[data-member-relationship]")?.textContent.trim() ?? "",
      call: ${ROW(CT)}?.querySelector('a[data-action="call"]')?.getAttribute("href") ?? "",
      callName: ${ROW(CT)}?.querySelector('a[data-action="call"]')?.textContent.trim() ?? "",
      text2: ${ROW(CT)}?.querySelector('a[data-action="text"]')?.getAttribute("href") ?? "",
      textName: ${ROW(CT)}?.querySelector('a[data-action="text"]')?.getAttribute("aria-label") ?? "",
      fields: [...(${ROW(CT)}?.querySelectorAll("[data-shared]") ?? [])].map((li) => li.dataset.shared).join(","),
      list: ${MEMBERS}.textContent,
    })`);
    check(
      "co-member: sees the shared phone (call and text) and the relationship",
      seen.relationship === RELATIONSHIP &&
        seen.call === `tel:${digits(PHONE_1)}` &&
        seen.text2 === `sms:${digits(PHONE_1)}` &&
        seen.callName.startsWith("Call Dev Caretaker, mobile:") &&
        seen.textName === "Text Dev Caretaker, mobile" &&
        seen.fields === "phones",
      JSON.stringify({ ...seen, text: undefined, list: undefined }),
    );
    check(
      "co-member: never the unshared address, nor anyone's sign-in email",
      !seen.text.includes(ADDRESS) && !/\b(member|caretaker|viewer)@example\.com/.test(seen.list),
    );
    await M.evaluate(`${ROW(CT)}.scrollIntoView({ block: "center" })`);
    await M.screenshot("profiles-contacts-co-member");
  });

  await step("a changed number follows to the group", async () => {
    await C.goto(CONTACT_PATH);
    await saveContact(C, { number: PHONE_2 });
    await C.waitFor(`${status(CONTACT_FORM)} === "Saved."`, 20000);
    const followed = await M.waitFor(
      `${rowText(CT)}.includes(${JSON.stringify(PHONE_2)}) && !${rowText(CT)}.includes(${JSON.stringify(PHONE_1)})`,
      30000,
    )
      .then(() => true)
      .catch(() => false);
    check(
      "co-member: sees the new number after sync, without a reload",
      followed,
      await M.evaluate(rowText(CT)),
    );
  });

  await step("offline, shared details still read, with no sharing form", async () => {
    // In-app navigation while the proxy cuts member@'s browser (a full load needs a connection).
    const nav = (id) => `document.querySelector('main nav[data-settings-nav] a[data-settings-item="${id}"]')`;
    // Once online first, so both routes' modules are loaded (a module can't load offline).
    await M.evaluate(`${nav("details")}.click()`);
    await M.waitFor(`location.pathname.endsWith("/settings/details")`, 20000);
    await M.evaluate(`${nav("members")}.click()`);
    await M.waitFor(`location.pathname === ${JSON.stringify(MEMBERS_PATH)} && ${SHARING}`, 20000);
    proxy.setOnline(false);
    await sleep(500);
    await M.evaluate(`${nav("details")}.click()`);
    await M.waitFor(`location.pathname.endsWith("/settings/details")`, 20000);
    await M.evaluate(`${nav("members")}.click()`);
    const loaded = await M.waitFor(
      `location.pathname === ${JSON.stringify(MEMBERS_PATH)} && !!document.querySelector("[data-needs-connection]") && ${ROW(CT)}`,
      30000,
    )
      .then(() => true)
      .catch(() => false);
    const off = await M.evaluate(`({
      phone: ${rowText(CT)}.includes(${JSON.stringify(PHONE_2)}),
      relationship: ${rowText(CT)}.includes(${JSON.stringify(RELATIONSHIP)}),
      form: !!${SHARING},
      summary: ${MEMBERS}.querySelector("[data-sharing-summary]")?.textContent.trim() ?? "",
    })`);
    check(
      "offline: co-members' shared details read; your own row says what you share, with no form",
      loaded && off.phone && off.relationship && !off.form && /^You share /.test(off.summary),
      JSON.stringify(off),
    );
    await M.screenshot("profiles-contacts-offline");
    proxy.setOnline(true);
    await sleep(1000);
  });

  await step("unsharing removes it from the group", async () => {
    await openMembers(C);
    await saveSharing(C, { phones: false });
    check("unsharing saves", sharedOnServer() === "[]", sharedOnServer());
    const gone = await M.waitFor(`${ROW(CT)} && !${ROW(CT)}.querySelector("[data-member-contact]")`, 30000)
      .then(() => true)
      .catch(() => false);
    check(
      "co-member: the phone goes after sync; the relationship stays",
      gone && (await M.evaluate(`${rowText(CT)}.includes(${JSON.stringify(RELATIONSHIP)})`)),
      await M.evaluate(rowText(CT)),
    );
  });

  await step("leaving the group removes the shared details from others' devices", async () => {
    await openMembers(C);
    await saveSharing(C, { phones: true });
    await M.waitFor(`${rowText(CT)}.includes(${JSON.stringify(PHONE_2)})`, 30000);
    const local = () =>
      M.evaluate(
        `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM member_contact_share WHERE user_id = ?", ["${CT}"]).then((r) => r[0].n)`,
      );
    check("co-member's device has the share before", (await local()) === 1);
    const leave = `${ROW(CT)}.querySelector('button[aria-label="Leave this care group"]')`;
    await C.evaluate(`${leave}.click()`);
    await C.waitFor(`document.querySelector("dialog[open]")`, 5000);
    await C.evaluate(
      `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Leave").click()`,
    );
    await C.waitFor(`!location.pathname.includes("${DEV_FAMILY}")`, 30000).catch(() => {});
    const gone = await M.waitFor(`${MEMBERS} && !${ROW(CT)}`, 30000)
      .then(() => true)
      .catch(() => false);
    check(
      "co-member: the member and their shared details leave the device",
      gone && (await local()) === 0,
      `${gone} / ${await local()}`,
    );
  });

  const errors = pages
    .flatMap((p) => p.errors)
    .filter((e) => !/vite|PowerSync|WebSocket|Failed to fetch|ERR_PROXY|ERR_TUNNEL|net::/i.test(e));
  check("no unexpected console errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 500));
} catch (e) {
  console.log("ERROR", e.message);
  results.push(false);
} finally {
  try {
    restore();
  } catch (e) {
    console.log("restore failed:", e.message);
    results.push(false);
  }
  for (const b of browsers) b.proc.kill();
  proxy.close?.();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
