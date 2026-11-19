// Profiles (the profiles PRD). Slice 2, the care recipient's profile
// (`…/profile`) and its Basics sheet (`…/profile/basics`):
//
// - the ways in: the timeline's recipient card and "<Name>'s profile" in the
//   group menu (before Group settings), at 420 and 1280;
// - the page for an owner: the name, full name, birthday and age, the Basics
//   card (code status, blood type, language, pronouns) and the note, with
//   Edit, and no "visible to caretakers" line;
// - editing (full): an empty name is refused on its field (focused) and
//   nothing is sent; the owner saves the basics and the note, the page shows
//   them as the sheet closes, the server has them, and a caretaker's device
//   shows them after sync; the caretaker clears a basic, and its line goes
//   from the owner's page;
// - a viewer sees the page with no Edit and the caretakers line, and the
//   sheet's URL lands on the profile;
// - offline (the owner's browser through the proxy): the page reads, and
//   Edit is disabled with "Needs a connection to edit."; back online it's a
//   link again;
// - group settings Details no longer has the recipient card, and links to
//   the profile.
//
// Slice 3, the writers' details (`…/profile/contact`, `…/profile/insurance`):
//
// - the owner's page has Contact (call, text, email, maps) and Insurance
//   (plans by rank, member ID, group number, a call action) from the device;
// - a caretaker edits them: a bad number and a plan without a member ID are
//   refused on their fields with nothing sent; phones, email, address and
//   two plans (one removed, one added) save through one call each, show as the
//   sheet closes, reach the server, and show on the owner's device after sync;
// - a viewer sees neither card, both sheets' URLs land on the profile, and
//   their device has no details row;
// - offline, the owner reads both cards, and both Edits are disabled;
// - the caretaker demoted to viewer loses the cards and the device row
//   without a reload, and gets them back when the role is restored.
//
// Slice 5, emergency contacts (`…/profile/emergency`):
//
// - the owner's page lists the seeded order (members' shared phones and the
//   outside contact, with call actions), the primary contact marked, and Edit;
// - the owner builds the list in the sheet: the member without a phone isn't
//   offered (and is named); a member removed and added back; moves by
//   keyboard, announced, with focus kept on the moved row; an outside contact
//   with no phone refused on its field with nothing sent, then saved; the
//   primary contact changed; one save, the page and the server in the new order;
// - a caretaker sees the list in order with no Edit, and the sheet's URL lands
//   on the profile; a viewer has no list, lands on the profile too, and sees
//   the badges on the Members page;
// - offline, the owner's Edit is disabled;
// - the caretaker unshares their phone on the Members page: they leave the
//   list and lose primary, and the owner's profile shows the managers' note.
//
// Later slices add their steps in their own blocks below. The rules (age,
// labels, the form's parsing) are unit-tested; the steps here check the
// wiring, one case each. Grandma Pat's seeded profile is put back at the end
// (and in `finally`), so it passes run after run without a reset. SMOKE=1
// runs the owner's core path: the ways in and the page.
import { execSync } from "node:child_process";
import { launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const TAG = `PR-${Date.now().toString(36)}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: `${sql};`,
  })
    .toString()
    .trim();

// ─────────────────────────── shared helpers ───────────────────────────

/** Grandma Pat as seeded (`seeds/profiles.ts`, and the first seeds' name and birthday). */
const SEED = {
  name: "Pat Example",
  preferred: "Grandma Pat",
  dob: "1941-03-14",
  codeStatus: "dnrPolst",
  bloodType: "O+",
  language: "English",
  pronouns: "she/her",
  notes: "Hard of hearing on the left: sit on her right. Uses a walker indoors. Likes tea, not coffee.",
};
const lit = (v) => (v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const restoreSeed = () =>
  psql(`UPDATE care_recipient SET name = ${lit(SEED.name)}, preferred_name = ${lit(SEED.preferred)},
    date_of_birth = ${lit(SEED.dob)}, code_status = ${lit(SEED.codeStatus)}, blood_type = ${lit(SEED.bloodType)},
    primary_language = ${lit(SEED.language)}, pronouns = ${lit(SEED.pronouns)}, notes = ${lit(SEED.notes)},
    updated_at = now() WHERE group_id = '${DEV_FAMILY}'`);
const serverRecipient = () =>
  psql(`SELECT concat_ws('|', name, coalesce(preferred_name, ''), coalesce(date_of_birth::text, ''),
    coalesce(code_status, ''), coalesce(blood_type, ''), coalesce(primary_language, ''), coalesce(pronouns, ''),
    coalesce(notes, '')) FROM care_recipient WHERE group_id = '${DEV_FAMILY}'`);

/** Grandma Pat's writers-only details as seeded (`seeds/profiles.ts`), and putting them back. */
const SEED_DETAILS = {
  phones: [{ label: "Home", number: "(555) 010-2231" }],
  email: "pat.example@example.com",
  address: "1428 Elm Street\nSpringfield, OR 97477",
  insurance: [
    {
      id: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc00001",
      rank: "primary",
      insurer: "Medicare",
      planName: "Part A and B",
      memberId: "1EG4-TE5-MK72",
      groupNumber: null,
      phone: "(555) 010-3300",
    },
    {
      id: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc00002",
      rank: "secondary",
      insurer: "Example Mutual Health",
      planName: "Medigap Plan G",
      memberId: "EMH-448120-07",
      groupNumber: "GRP-55021",
      phone: "(555) 010-3310",
    },
  ],
};
const restoreDetails = () =>
  psql(`UPDATE care_recipient_details SET phones = ${lit(JSON.stringify(SEED_DETAILS.phones))}::jsonb,
    email = ${lit(SEED_DETAILS.email)}, address = ${lit(SEED_DETAILS.address)},
    insurance = ${lit(JSON.stringify(SEED_DETAILS.insurance))}::jsonb, updated_at = now()
    WHERE group_id = '${DEV_FAMILY}'`);
/** The server's details: "<phones>|<email>|<address>|<insurer>:<memberId>:<rank>,…". */
const serverDetails = () =>
  psql(`SELECT concat_ws('|', (SELECT string_agg(p->>'number', ',' ORDER BY o) FROM jsonb_array_elements(phones) WITH ORDINALITY t(p, o)),
    coalesce(email, ''), replace(coalesce(address, ''), E'\n', ' / '),
    (SELECT string_agg((p->>'insurer') || ':' || (p->>'memberId') || ':' || (p->>'rank'), ',' ORDER BY o) FROM jsonb_array_elements(insurance) WITH ORDINALITY t(p, o)))
    FROM care_recipient_details WHERE group_id = '${DEV_FAMILY}'`);
const setCaretakerRole = (role) =>
  psql(`UPDATE care_group_member SET role = ${lit(role)}, updated_at = now() WHERE group_id = '${DEV_FAMILY}'
    AND user_id = (SELECT id FROM "user" WHERE email = 'caretaker@example.com') AND role <> ${lit(role)}`);

/** Grandma Pat's age today in Los Angeles (her zone), as the page says it. */
const seedAge = () => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const [y, m, d] = day.split("-").map(Number);
  return `Age ${y - 1941 - (m < 3 || (m === 3 && d < 14) ? 1 : 0)}`;
};

const PROFILE = `/app/groups/${DEV_FAMILY}/profile`;
const BASICS = `${PROFILE}/basics`;
const TIMELINE = `/app/groups/${DEV_FAMILY}/timeline`;
const DETAILS = `/app/groups/${DEV_FAMILY}/settings/details`;

const metrics = (p, width) =>
  p.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 640,
  });

const GROUP_TRIGGER = `document.querySelector('header [data-region="group"] button')`;
const menuItem = (text) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;
const CARD = `document.querySelector('main [data-recipient-card]')`;
const CARD_LINK = `document.querySelector('main [data-recipient-card] a[data-profile-link]')`;
const EDIT_LINK = `document.querySelector('main [data-profile-header] a[data-edit-basics]')`;
const EDIT_DISABLED = `document.querySelector('main [data-profile-header] button[data-edit-basics]:disabled')`;
const SHEET = `document.querySelector('[role="dialog"] [data-basics-form]')`;
const field = (name) => `${SHEET}?.querySelector('[name="${name}"]')`;
const fieldError = (name) =>
  `((document.getElementById((${field(name)}?.getAttribute("aria-describedby") ?? "").split(" ").find((id) => id.endsWith("-error")) ?? "")?.textContent.trim()) ?? "")`;
const onProfile = `location.pathname === ${JSON.stringify(PROFILE)} && document.querySelector('main [data-profile-header] h1')`;

/** What the profile page shows. */
const pageState = (p) =>
  p.evaluate(`(() => {
    const main = document.querySelector("main");
    const basics = Object.fromEntries([...main.querySelectorAll("[data-basic]")].map((el) => [el.dataset.basic, el.querySelector("dd").textContent.trim()]));
    return {
      h1: main.querySelector("[data-profile-header] h1")?.textContent.trim(),
      fullName: main.querySelector("[data-full-name]")?.textContent.trim() ?? null,
      birthday: main.querySelector("[data-birthday]")?.textContent.trim() ?? null,
      basics,
      note: main.querySelector("[data-note]")?.textContent.trim() ?? null,
      edit: !!main.querySelector("[data-edit-basics]"),
      viewerLine: main.querySelector("[data-viewer-more]")?.textContent.trim() ?? null,
      sections: [...main.querySelectorAll("[data-section]")].map((s) => s.dataset.section).join(","),
    };
  })()`);

/** Set a `<select>` the way a person would (the harness's `type` is for inputs). */
const choose = (p, selector, value) =>
  p.evaluate(
    `(() => { const el = ${selector}; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`,
  );

/** Count this page's `careGroup.updateRecipient` calls from now on, until a reload. */
const countSaves = (p) =>
  p.evaluate(`(() => { if (window.__saves !== undefined) return; window.__saves = 0; const f = window.fetch;
    window.fetch = (...a) => { if (String(a[0]?.url ?? a[0]).includes("/rpc/careGroup/updateRecipient")) window.__saves++; return f(...a); }; })()`);

// ─────────────── slice 5's helpers: the seeded emergency list ───────────────

const EMAIL_ID = (email) => psql(`SELECT id FROM "user" WHERE email = ${lit(email)}`);
const SEED_OUTSIDE = [
  {
    id: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc00003",
    name: "Rosa Example",
    phone: "(555) 010-4410",
    relationship: "Neighbour",
    emergencyRank: 3,
  },
];
/** The seeded list: member@ 1 and primary, caretaker@ 2 (sharing their phone), Rosa Example 3. */
const restoreEmergency = () => {
  psql(`UPDATE care_group_member SET is_primary_contact = false, emergency_rank = NULL, emergency_dropped_at = NULL
    WHERE group_id = '${DEV_FAMILY}' AND (is_primary_contact OR emergency_rank IS NOT NULL OR emergency_dropped_at IS NOT NULL)`);
  psql(`UPDATE care_group_member SET emergency_rank = 1, is_primary_contact = true, updated_at = now()
    WHERE group_id = '${DEV_FAMILY}' AND user_id = (SELECT id FROM "user" WHERE email = 'member@example.com')`);
  psql(`UPDATE care_group_member SET emergency_rank = 2, shared_fields = '["phones"]'::jsonb, updated_at = now()
    WHERE group_id = '${DEV_FAMILY}' AND user_id = (SELECT id FROM "user" WHERE email = 'caretaker@example.com')`);
  psql(`INSERT INTO member_contact_share (id, group_id, user_id, phones, created_by, updated_by)
    SELECT m.id, m.group_id, m.user_id, '[{"label": "Mobile", "number": "(555) 010-1002"}]'::jsonb, m.user_id, m.user_id
    FROM care_group_member m JOIN "user" u ON u.id = m.user_id
    WHERE m.group_id = '${DEV_FAMILY}' AND u.email = 'caretaker@example.com'
    ON CONFLICT (id) DO UPDATE SET phones = EXCLUDED.phones, email = NULL, address = NULL, updated_at = now()`);
  psql(`UPDATE care_recipient_details SET outside_contacts = ${lit(JSON.stringify(SEED_OUTSIDE))}::jsonb, updated_at = now()
    WHERE group_id = '${DEV_FAMILY}'`);
};
/** The server's list: "<email or outside name>:<rank>[*]" in order (* the primary contact). */
const serverEmergency = () =>
  psql(`SELECT string_agg(who || ':' || rank || CASE WHEN p THEN '*' ELSE '' END, ',' ORDER BY rank) FROM (
    SELECT u.email AS who, m.emergency_rank AS rank, m.is_primary_contact AS p FROM care_group_member m
      JOIN "user" u ON u.id = m.user_id WHERE m.group_id = '${DEV_FAMILY}' AND m.emergency_rank IS NOT NULL
    UNION ALL
    SELECT c->>'name', (c->>'emergencyRank')::int, false FROM care_recipient_details d, jsonb_array_elements(d.outside_contacts) c
      WHERE d.group_id = '${DEV_FAMILY}' AND c->>'emergencyRank' IS NOT NULL) t`);

const pages = [];
let bA, bB, bC, proxy;

try {
  restoreSeed();
  restoreDetails();
  setCaretakerRole("caretaker");
  restoreEmergency();
  proxy = startProxy(9665);
  bA = await launch(9661, proxy.args);
  const A = await openPage(bA, "owner");
  pages.push(A);
  await A.send("Emulation.setTimezoneOverride", { timezoneId: "America/Los_Angeles" });
  await A.signIn("member@example.com", PW);
  await A.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)} && ${CARD}`, 45000);

  // ───────────────── Slice 2: the profile page and basics ─────────────────

  await step("the ways in, and the owner's page", { smoke: true }, async () => {
    const age = seedAge();
    // The timeline's recipient card, at 420.
    await A.waitFor(`${CARD}?.textContent.includes(${JSON.stringify(age)})`, 20000).catch(() => undefined);
    const card = await A.evaluate(`({
      name: ${CARD_LINK}?.getAttribute("aria-label"),
      h1: document.querySelector("main h1")?.textContent.trim(),
      text: ${CARD}?.querySelector("p")?.textContent.trim(),
      href: ${CARD_LINK}?.getAttribute("href"),
    })`);
    check(
      "timeline: the recipient card is the heading, with the group, age and code status, linking to the profile",
      card.name === "Grandma Pat's profile" &&
        card.h1 === "Grandma Pat" &&
        card.text === `Dev Family · ${age} · DNR/POLST` &&
        card.href === PROFILE,
      JSON.stringify(card),
    );
    await A.tap(CARD);
    const viaCard = await A.waitFor(onProfile, 20000)
      .then(() => true)
      .catch(() => false);
    check("timeline card (420): a tap on the card opens the profile", viaCard);

    const page = await pageState(A);
    check(
      "owner: the name, full name, birthday and age",
      page.h1 === "Grandma Pat" &&
        page.fullName === "Pat Example" &&
        page.birthday === `Born March 14, 1941 · ${age}`,
      JSON.stringify(page),
    );
    check(
      "owner: the Basics card (code status, blood type, language, pronouns) and the note",
      page.basics.codeStatus === "DNR/POLST" &&
        page.basics.bloodType?.startsWith("O+") &&
        page.basics.primaryLanguage === "English" &&
        page.basics.pronouns === "she/her" &&
        page.note === SEED.notes &&
        // Slice 3 adds the writers' Contact and Insurance after the note, slice 5 the emergency list.
        page.sections === "basics,note,contact,insurance,emergency",
      JSON.stringify(page),
    );
    const editShown = await A.waitFor(EDIT_LINK, 15000)
      .then(() => true)
      .catch(() => false);
    check(
      "owner: Edit is there, and no caretakers line",
      editShown && page.viewerLine === null,
      JSON.stringify(page),
    );
    await A.screenshot("profiles-owner-420");

    // The group menu, at 420 and 1280: "<Name>'s profile" just before Group settings.
    for (const width of [420, 1280]) {
      await metrics(A, width);
      await A.goto(TIMELINE);
      await A.waitFor(GROUP_TRIGGER, 30000);
      await A.press(GROUP_TRIGGER);
      await A.waitFor(menuItem("Grandma Pat's profile"), 5000).catch(() => undefined);
      const order = await A.evaluate(
        `[...document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] [role="separator"]')].slice(-4).map((el) => el.getAttribute("role") + ":" + el.textContent.trim()).join(" > ")`,
      );
      check(
        `group menu (${width}): a separator, then the profile, Group settings and New care group`,
        order ===
          "separator: > menuitem:Grandma Pat's profile > menuitem:Group settings > menuitem:New care group",
        order,
      );
      await A.press(menuItem("Grandma Pat's profile"));
      const viaMenu = await A.waitFor(onProfile, 20000)
        .then(() => true)
        .catch(() => false);
      check(`group menu (${width}): "Grandma Pat's profile" opens the profile`, viaMenu);
      if (width === 1280) {
        // The card at 1280 too.
        await A.goto(TIMELINE);
        await A.waitFor(CARD, 30000);
        await A.tap(CARD);
        const wide = await A.waitFor(onProfile, 20000)
          .then(() => true)
          .catch(() => false);
        check("timeline card (1280): a tap on the card opens the profile", wide);
        await A.screenshot("profiles-owner-1280");
      }
    }
    await metrics(A, 420);
  });

  await step("editing the basics, on two devices", async () => {
    bB = await launch(9662);
    const B = await openPage(bB, "caretaker");
    pages.push(B);
    await B.signIn("caretaker@example.com", PW);
    await B.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)} && ${CARD}`, 45000);
    await B.tap(CARD);
    await B.waitFor(onProfile, 20000);
    const caretakerEdit = await B.waitFor(EDIT_LINK, 15000)
      .then(() => true)
      .catch(() => false);
    const bPage = await pageState(B);
    check(
      "caretaker: the page, with Edit and no caretakers line",
      caretakerEdit && bPage.h1 === "Grandma Pat" && bPage.viewerLine === null && bPage.note === SEED.notes,
      JSON.stringify(bPage),
    );

    // The owner opens the sheet from the page.
    await A.goto(PROFILE);
    await A.waitFor(EDIT_LINK, 30000);
    await countSaves(A);
    await A.tap(EDIT_LINK);
    await A.waitFor(`location.pathname === ${JSON.stringify(BASICS)} && ${field("name")}`, 20000);
    const start = await A.evaluate(`({
      title: document.querySelector('[role="dialog"] :is(h1, h2, h3, h4)')?.textContent.trim(),
      name: ${field("name")}.value, preferred: ${field("preferredName")}.value, dob: ${field("dateOfBirth")}.value,
      code: ${SHEET}.querySelector('[name="codeStatus"]:checked')?.value, blood: ${field("bloodType")}.value,
      language: ${field("primaryLanguage")}.value, pronouns: ${field("pronouns")}.value, notes: ${field("notes")}.value,
      help: (${field("preferredName")}.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent.trim()).join("|"),
      labelled: [...${SHEET}.querySelectorAll("input:not([type=radio]), select, textarea")].every((el) => document.querySelector('label[for="' + el.id + '"]')),
    })`);
    check(
      "the sheet starts from the saved profile, every field labelled, the preferred name described by its help",
      start.title === "Edit profile" &&
        start.name === SEED.name &&
        start.preferred === SEED.preferred &&
        start.dob === SEED.dob &&
        start.code === SEED.codeStatus &&
        start.blood === SEED.bloodType &&
        start.language === SEED.language &&
        start.pronouns === SEED.pronouns &&
        start.notes === SEED.notes &&
        start.help.startsWith("What everyone calls them") &&
        start.labelled,
      JSON.stringify(start),
    );

    // An empty name: the field's error, focused; nothing sent or saved.
    await A.type(field("name"), "  ");
    await A.evaluate(`${SHEET}.querySelector('button[type="submit"]').click()`);
    await A.waitFor(`${fieldError("name")}`, 10000).catch(() => undefined);
    const refused = await A.evaluate(`({
      error: ${fieldError("name")}, invalid: ${field("name")}.getAttribute("aria-invalid"),
      focused: document.activeElement === ${field("name")}, saves: window.__saves,
    })`);
    check(
      "an empty name: the field's error, on the focused field, and nothing sent",
      refused.error === "Enter a name." &&
        refused.invalid === "true" &&
        refused.focused &&
        refused.saves === 0 &&
        serverRecipient().startsWith(`${SEED.name}|`),
      JSON.stringify(refused),
    );

    // The owner saves new basics and a new note.
    const NEW = {
      preferred: `Pat ${TAG}`,
      language: "Spanish",
      pronouns: "they/them",
      notes: `Note ${TAG}: uses a cane outdoors.`,
    };
    await A.type(field("name"), SEED.name);
    await A.type(field("preferredName"), NEW.preferred);
    await A.evaluate(`${SHEET}.querySelector('[name="codeStatus"][value="fullCode"]').click()`);
    await choose(A, field("bloodType"), "A-");
    await A.type(field("primaryLanguage"), NEW.language);
    await A.type(field("pronouns"), NEW.pronouns);
    await A.type(field("notes"), NEW.notes);
    await A.evaluate(`${SHEET}.querySelector('button[type="submit"]').click()`);
    const closed = await A.waitFor(`${onProfile} && !document.querySelector('[role="dialog"]')`, 20000)
      .then(() => true)
      .catch(() => false);
    const saved = await pageState(A);
    check(
      "owner: Save closes the sheet, and the page shows the change",
      closed &&
        saved.h1 === NEW.preferred &&
        saved.basics.codeStatus === "Full code" &&
        saved.basics.bloodType?.startsWith("A−") &&
        saved.basics.primaryLanguage === NEW.language &&
        saved.basics.pronouns === NEW.pronouns &&
        saved.note === NEW.notes,
      JSON.stringify(saved),
    );
    check(
      "the server has it, through one careGroup.updateRecipient",
      serverRecipient() ===
        [SEED.name, NEW.preferred, SEED.dob, "fullCode", "A-", NEW.language, NEW.pronouns, NEW.notes].join(
          "|",
        ) && (await A.evaluate(`window.__saves`)) === 1,
      `${serverRecipient()} · saves ${await A.evaluate(`window.__saves`)}`,
    );

    // The caretaker's device shows it after sync, without a reload.
    const synced = await B.waitFor(
      `document.querySelector('main [data-note]')?.textContent.trim() === ${JSON.stringify(NEW.notes)} && document.querySelector('main [data-profile-header] h1')?.textContent.trim() === ${JSON.stringify(NEW.preferred)}`,
      20000,
    )
      .then(() => true)
      .catch(() => false);
    check(
      "caretaker: the change shows on a second device after sync",
      synced,
      JSON.stringify(await pageState(B)),
    );

    // The caretaker clears the pronouns (a deep link: closing replaces it with the profile).
    await B.goto(BASICS);
    // Save is enabled once the device knows it's online (a full load connects first).
    await B.waitFor(
      `${field("pronouns")} && !${SHEET}.querySelector('button[type="submit"]').disabled`,
      30000,
    );
    await B.type(field("pronouns"), "");
    await B.evaluate(`${SHEET}.querySelector('button[type="submit"]').click()`);
    await B.waitFor(`${onProfile} && !document.querySelector('[role="dialog"]')`, 20000).catch(
      () => undefined,
    );
    const gone = await A.waitFor(`!document.querySelector('main [data-basic="pronouns"]')`, 20000)
      .then(() => true)
      .catch(() => false);
    check(
      "caretaker: clearing a basic removes its line from the owner's page",
      gone && serverRecipient().split("|")[6] === "",
      serverRecipient(),
    );
    await B.screenshot("profiles-caretaker");
  });

  await step("a viewer", async () => {
    bC = await launch(9663);
    const C = await openPage(bC, "viewer");
    pages.push(C);
    await C.signIn("viewer@example.com", PW);
    await C.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)} && ${CARD}`, 45000);
    await C.tap(CARD);
    await C.waitFor(onProfile, 20000);
    await sleep(500);
    const page = await pageState(C);
    check(
      "viewer: the page and basics, no Edit, and the caretakers line",
      !page.edit &&
        page.viewerLine === "More details are visible to caretakers." &&
        page.basics.codeStatus === "Full code" &&
        page.note?.startsWith(`Note ${TAG}`),
      JSON.stringify(page),
    );
    await C.goto(BASICS);
    const redirected = await C.waitFor(`${onProfile} && !document.querySelector('[role="dialog"]')`, 30000)
      .then(() => true)
      .catch(() => false);
    check(
      "viewer: the Basics sheet's URL lands on the profile",
      redirected,
      await C.evaluate(`location.pathname`),
    );
    await C.screenshot("profiles-viewer");
  });

  await step("offline", async () => {
    await A.goto(TIMELINE);
    await A.waitFor(CARD, 30000);
    proxy.setOnline(false);
    await sleep(500);
    await A.tap(CARD);
    const read = await A.waitFor(`${onProfile} && document.querySelector('main [data-note]')`, 20000)
      .then(() => true)
      .catch(() => false);
    const disabled = await A.waitFor(EDIT_DISABLED, 20000)
      .then(() => true)
      .catch(() => false);
    const state = await A.evaluate(`({
      notice: document.querySelector('main [data-profile-header] [data-needs-connection]')?.textContent.trim(),
      described: ${EDIT_DISABLED} ? document.getElementById(${EDIT_DISABLED}.getAttribute("aria-describedby"))?.textContent.trim() : null,
      link: !!${EDIT_LINK},
    })`);
    check("offline: the profile reads from the device", read, JSON.stringify(await pageState(A)));
    check(
      "offline: Edit is disabled, and says it needs a connection",
      disabled &&
        !state.link &&
        state.notice === "Needs a connection to edit." &&
        state.described === state.notice,
      JSON.stringify(state),
    );
    await A.screenshot("profiles-offline");
    proxy.setOnline(true);
    const again = await A.waitFor(EDIT_LINK, 30000)
      .then(() => true)
      .catch(() => false);
    check("online again: Edit is a link again", again);
  });

  await step("group settings Details links to the profile", async () => {
    await A.goto(DETAILS);
    await A.waitFor(`document.querySelector('main [data-section="group-details"]')`, 30000);
    const details = await A.evaluate(`({
      sections: [...document.querySelectorAll("main [data-section]")].map((s) => s.dataset.section).join(","),
      link: document.querySelector('main [data-profile-note] a')?.getAttribute("href"),
    })`);
    check(
      "Details: only the group's card, and a link to the profile",
      details.sections === "group-details" && details.link === PROFILE,
      JSON.stringify(details),
    );
    await A.tap(`document.querySelector('main [data-profile-note] a')`);
    const opened = await A.waitFor(onProfile, 20000)
      .then(() => true)
      .catch(() => false);
    check("Details: the link opens the profile", opened);
  });

  // ─────────────── end of slice 2: the profile page and basics ───────────────

  // ─────────────── Slice 3: writers' details (contact and insurance) ───────────────

  const CONTACT = `${PROFILE}/contact`;
  const INSURANCE = `${PROFILE}/insurance`;
  const section = (id) => `document.querySelector('main [data-section="${id}"]')`;
  const editSheet = (id) => `${section(id)}?.querySelector('a[data-edit-sheet="${id}"]')`;
  const editDisabled = (id) => `${section(id)}?.querySelector('button[data-edit-sheet="${id}"]:disabled')`;
  const CONTACT_FORM = `document.querySelector('[role="dialog"] [data-contact-form]')`;
  const INSURANCE_FORM = `document.querySelector('[role="dialog"] [data-insurance-form]')`;
  const SUBMIT = (form) => `${form}.querySelector('button[type="submit"]')`;
  const describedError = (el) =>
    `((document.getElementById((${el}?.getAttribute("aria-describedby") ?? "").split(" ").find((id) => id.endsWith("-error")) ?? "")?.textContent.trim()) ?? "")`;
  const sheetClosed = `${onProfile} && !document.querySelector('[role="dialog"]')`;
  const deviceDetailsRows = (p) =>
    p.evaluate(
      `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM care_recipient_details").then((r) => r[0].n)`,
    );

  /** What the writers' cards show. */
  const detailsState = (p) =>
    p.evaluate(`(() => {
      const contact = document.querySelector('main [data-section="contact"]');
      const insurance = document.querySelector('main [data-section="insurance"]');
      return {
        sections: [...document.querySelectorAll("main [data-section]")].map((s) => s.dataset.section).join(","),
        contact: contact ? [...contact.querySelectorAll("[data-recipient-contact] a[data-action]")].map((a) => a.dataset.action + "=" + a.getAttribute("href")) : null,
        contactText: contact ? [...contact.querySelectorAll("[data-recipient-contact] li")].map((li) => li.textContent.trim()).join(" / ") : null,
        plans: insurance ? [...insurance.querySelectorAll("li[data-plan]")].map((li) => ({
          rank: li.dataset.plan,
          title: li.querySelector("[data-plan-title]")?.textContent.trim(),
          memberId: li.querySelector("[data-member-id]")?.textContent.trim(),
          group: li.querySelector("[data-group-number]")?.textContent.trim() ?? null,
          call: li.querySelector('a[data-action="call"]')?.getAttribute("href") ?? null,
          callName: li.querySelector('a[data-action="call"] .sr-only')?.textContent.trim() ?? null,
        })) : null,
        viewerLine: document.querySelector("main [data-viewer-more]")?.textContent.trim() ?? null,
      };
    })()`);

  /** Count this page's `careGroup.updateRecipientDetails` calls from now on, until a reload. */
  const countDetailsSaves = (p) =>
    p.evaluate(`(() => { if (window.__detailSaves !== undefined) return; window.__detailSaves = 0; const f = window.fetch;
      window.fetch = (...a) => { if (String(a[0]?.url ?? a[0]).includes("/rpc/careGroup/updateRecipientDetails")) window.__detailSaves++; return f(...a); }; })()`);

  await step("writers' details: the owner's Contact and Insurance", { smoke: true }, async () => {
    await A.goto(PROFILE);
    await A.waitFor(`${section("insurance")}?.querySelector("li[data-plan]")`, 30000).catch(() => undefined);
    const state = await detailsState(A);
    check(
      "owner: Contact and Insurance after the note (then slice 5's emergency list)",
      state.sections === "basics,note,contact,insurance,emergency" && state.viewerLine === null,
      state.sections,
    );
    check(
      "owner: Contact calls, texts, emails and maps from the device's copy",
      JSON.stringify(state.contact) ===
        JSON.stringify([
          "call=tel:5550102231",
          "text=sms:5550102231",
          "email=mailto:pat.example@example.com",
          "map=https://www.google.com/maps/search/?api=1&query=1428%20Elm%20Street%2C%20Springfield%2C%20OR%2097477",
        ]),
      JSON.stringify(state.contact),
    );
    const [first, second] = state.plans ?? [];
    check(
      "owner: Insurance shows each plan by rank, with its member ID, group number and a call action",
      state.plans?.length === 2 &&
        first.rank === "primary" &&
        first.title?.endsWith("Medicare · Part A and B") &&
        first.memberId === "1EG4-TE5-MK72" &&
        first.group === null &&
        first.call === "tel:5550103300" &&
        first.callName?.startsWith("Call Medicare") &&
        second.rank === "secondary" &&
        second.memberId === "EMH-448120-07" &&
        second.group === "GRP-55021" &&
        second.call === "tel:5550103310",
      JSON.stringify(state.plans),
    );
    const edits = await A.waitFor(`${editSheet("contact")} && ${editSheet("insurance")}`, 15000)
      .then(() => true)
      .catch(() => false);
    check("owner: each card has Edit", edits);
    await A.screenshot("profiles-details-owner");
  });

  if (!SMOKE) {
    await step("writers' details: a caretaker edits contact and insurance", async () => {
      const B = pages[1]; // the caretaker (slice 2's editing step)
      await B.goto(PROFILE);
      await B.waitFor(editSheet("contact"), 30000);
      await countDetailsSaves(B);

      // Contact: a bad number is refused on its field, focused, with nothing sent.
      await B.tap(editSheet("contact"));
      await B.waitFor(`location.pathname === ${JSON.stringify(CONTACT)} && ${CONTACT_FORM}`, 20000);
      await B.waitFor(`!${SUBMIT(CONTACT_FORM)}.disabled`, 30000);
      const start = await B.evaluate(`({
        title: document.querySelector('[role="dialog"] :is(h1, h2, h3, h4)')?.textContent.trim(),
        numbers: [...${CONTACT_FORM}.querySelectorAll('[name="phoneNumber"]')].map((el) => el.value),
        email: ${CONTACT_FORM}.querySelector('[name="email"]').value,
        address: ${CONTACT_FORM}.querySelector('[name="address"]').value,
      })`);
      check(
        "contact sheet: starts from the device's copy",
        start.title === "Edit contact" &&
          JSON.stringify(start.numbers) === JSON.stringify(["(555) 010-2231"]) &&
          start.email === SEED_DETAILS.email &&
          start.address === SEED_DETAILS.address,
        JSON.stringify(start),
      );
      await B.evaluate(
        `[...${CONTACT_FORM}.querySelectorAll("button")].find((b) => b.textContent.includes("Add a phone number")).click()`,
      );
      await B.waitFor(`${CONTACT_FORM}.querySelectorAll('[name="phoneNumber"]').length === 2`, 5000);
      const NUMBER2 = `${CONTACT_FORM}.querySelectorAll('[name="phoneNumber"]')[1]`;
      await B.type(`${CONTACT_FORM}.querySelectorAll('[name="phoneLabel"]')[1]`, "Mobile");
      await B.type(NUMBER2, "call her");
      await B.evaluate(`${SUBMIT(CONTACT_FORM)}.click()`);
      await B.waitFor(describedError(NUMBER2), 10000).catch(() => undefined);
      const refused = await B.evaluate(`({
        error: ${describedError(NUMBER2)}, focused: document.activeElement === ${NUMBER2}, saves: window.__detailSaves,
      })`);
      check(
        "contact sheet: a bad number gets its field's error, focused, and nothing is sent",
        refused.error.startsWith("Use digits") && refused.focused && refused.saves === 0,
        JSON.stringify(refused),
      );

      const EMAIL = `pat.${TAG.toLowerCase()}@example.com`;
      await B.type(NUMBER2, "(555) 010-2299");
      await B.type(`${CONTACT_FORM}.querySelector('[name="email"]')`, EMAIL);
      await B.type(
        `${CONTACT_FORM}.querySelector('[name="address"]')`,
        `${TAG} Oak Lane\nSpringfield, OR 97477`,
      );
      await B.evaluate(`${SUBMIT(CONTACT_FORM)}.click()`);
      const contactClosed = await B.waitFor(sheetClosed, 20000)
        .then(() => true)
        .catch(() => false);
      const bContact = await detailsState(B);
      check(
        "caretaker: Save closes the contact sheet, and the card shows both numbers, the email and address",
        contactClosed &&
          bContact.contact?.includes("call=tel:5550102299") &&
          bContact.contact?.includes("text=sms:5550102299") &&
          bContact.contact?.includes(`email=mailto:${EMAIL}`) &&
          bContact.contactText?.includes(`${TAG} Oak Lane, Springfield, OR 97477`),
        JSON.stringify(bContact.contact),
      );
      const afterContact = serverDetails();
      check(
        "the server has the contact, through one careGroup.updateRecipientDetails",
        afterContact.startsWith(
          `(555) 010-2231,(555) 010-2299|${EMAIL}|${TAG} Oak Lane / Springfield, OR 97477|`,
        ) && (await B.evaluate(`window.__detailSaves`)) === 1,
        afterContact,
      );

      // Insurance: remove the secondary plan, change the primary's member ID, add a new secondary plan.
      await B.tap(editSheet("insurance"));
      await B.waitFor(`location.pathname === ${JSON.stringify(INSURANCE)} && ${INSURANCE_FORM}`, 20000);
      await B.waitFor(`!${SUBMIT(INSURANCE_FORM)}.disabled`, 30000);
      const ROWS = `${INSURANCE_FORM}.querySelectorAll("li[data-plan-row]")`;
      const inRow = (i, field) => `${ROWS}[${i}]?.querySelector('[name$=".${field}"]')`;
      const sheetStart = await B.evaluate(`({
        insurers: [...${ROWS}].map((li) => li.querySelector('[name$=".insurer"]').value),
        ranks: [...${ROWS}].map((li) => li.querySelector('[name$=".rank"]:checked')?.value),
        legend: ${ROWS}[0]?.querySelector("legend")?.textContent.trim(),
        labelled: [...${INSURANCE_FORM}.querySelectorAll("input:not([type=radio]):not([type=hidden])")].every((el) => document.querySelector('label[for="' + el.id + '"]')),
      })`);
      check(
        "insurance sheet: starts from the device's plans, primary first, every field labelled",
        JSON.stringify(sheetStart.insurers) === JSON.stringify(["Medicare", "Example Mutual Health"]) &&
          JSON.stringify(sheetStart.ranks) === JSON.stringify(["primary", "secondary"]) &&
          sheetStart.legend === "Plan 1" &&
          sheetStart.labelled,
        JSON.stringify(sheetStart),
      );
      await B.press(`${INSURANCE_FORM}.querySelector('[aria-label="Remove plan 2"]')`);
      await B.waitFor(`${ROWS}.length === 1`, 5000);
      await B.evaluate(`${INSURANCE_FORM}.querySelector("[data-add-plan]").click()`);
      await B.waitFor(`${ROWS}.length === 2`, 5000);
      const newRank = await B.evaluate(
        `${inRow(1, "rank")} && ${ROWS}[1].querySelector('[name$=".rank"]:checked')?.value`,
      );
      await B.type(inRow(0, "memberId"), `MC-${TAG}`);
      await B.type(inRow(1, "insurer"), `Insurer ${TAG}`);
      await B.type(inRow(1, "groupNumber"), "GRP-1");
      await B.type(inRow(1, "phone"), "(555) 010-3399");
      await B.evaluate(`${SUBMIT(INSURANCE_FORM)}.click()`);
      await B.waitFor(describedError(inRow(1, "memberId")), 10000).catch(() => undefined);
      const planRefused = await B.evaluate(`({
        error: ${describedError(inRow(1, "memberId"))}, focused: document.activeElement === ${inRow(1, "memberId")}, saves: window.__detailSaves,
      })`);
      check(
        "insurance sheet: a new plan starts as secondary; without a member ID it's refused on that field, focused, nothing sent",
        newRank === "secondary" &&
          planRefused.error === "Enter the member ID" &&
          planRefused.focused &&
          planRefused.saves === 1,
        JSON.stringify({ newRank, ...planRefused }),
      );
      await B.type(inRow(1, "memberId"), `NEW-${TAG}`);
      await B.evaluate(`${SUBMIT(INSURANCE_FORM)}.click()`);
      const insuranceClosed = await B.waitFor(sheetClosed, 20000)
        .then(() => true)
        .catch(() => false);
      const bPlans = (await detailsState(B)).plans ?? [];
      check(
        "caretaker: Save closes the insurance sheet, and the card shows the two plans by rank",
        insuranceClosed &&
          bPlans.length === 2 &&
          bPlans[0].rank === "primary" &&
          bPlans[0].memberId === `MC-${TAG}` &&
          bPlans[1].rank === "secondary" &&
          bPlans[1].title?.endsWith(`Insurer ${TAG}`) &&
          bPlans[1].memberId === `NEW-${TAG}` &&
          bPlans[1].group === "GRP-1" &&
          bPlans[1].call === "tel:5550103399",
        JSON.stringify(bPlans),
      );
      const afterInsurance = serverDetails();
      check(
        "the server has the plans (and the contact still), through a second call",
        afterInsurance.endsWith(`|Medicare:MC-${TAG}:primary,Insurer ${TAG}:NEW-${TAG}:secondary`) &&
          afterInsurance.includes(EMAIL) &&
          (await B.evaluate(`window.__detailSaves`)) === 2,
        afterInsurance,
      );
      await B.screenshot("profiles-details-caretaker");

      // The owner's device shows both after sync, without a reload.
      const synced = await A.waitFor(
        `${section("insurance")}?.textContent.includes(${JSON.stringify(`NEW-${TAG}`)}) && ${section("contact")}?.querySelector('a[href="mailto:${EMAIL}"]')`,
        20000,
      )
        .then(() => true)
        .catch(() => false);
      check(
        "owner: the caretaker's contact and plans show after sync",
        synced,
        JSON.stringify(await detailsState(A)),
      );
    });

    await step("writers' details: a viewer", async () => {
      const C = pages[2]; // the viewer (slice 2's viewer step)
      await C.goto(PROFILE);
      await C.waitFor(`${onProfile} && document.querySelector("main [data-viewer-more]")`, 30000);
      await sleep(500);
      const state = await detailsState(C);
      check(
        "viewer: neither Contact nor Insurance, and the caretakers line",
        !state.sections.includes("contact") &&
          !state.sections.includes("insurance") &&
          state.viewerLine !== null,
        state.sections,
      );
      for (const url of [CONTACT, INSURANCE]) {
        await C.goto(url);
        const landed = await C.waitFor(sheetClosed, 30000)
          .then(() => true)
          .catch(() => false);
        check(
          `viewer: ${url.split("/").pop()} sheet's URL lands on the profile`,
          landed,
          await C.evaluate(`location.pathname`),
        );
      }
      const rows = await deviceDetailsRows(C);
      check("viewer: the device has no details row", rows === 0, `rows ${rows}`);
    });

    await step("writers' details: offline", async () => {
      await A.goto(PROFILE);
      await A.waitFor(`${editSheet("contact")} && ${editSheet("insurance")}`, 30000);
      proxy.setOnline(false);
      const disabled = await A.waitFor(`${editDisabled("contact")} && ${editDisabled("insurance")}`, 30000)
        .then(() => true)
        .catch(() => false);
      const state = await detailsState(A);
      const notes = await A.evaluate(
        `["contact", "insurance"].map((id) => document.getElementById(document.querySelector('main [data-section="' + id + '"] button[data-edit-sheet]')?.getAttribute("aria-describedby") ?? "")?.textContent.trim())`,
      );
      check(
        "offline: Contact and Insurance read from the device",
        state.contact?.length > 0 && state.plans?.length === 2,
        JSON.stringify(state),
      );
      check(
        "offline: both Edits are disabled, and say they need a connection",
        disabled && notes.every((n) => n === "Needs a connection to edit."),
        JSON.stringify(notes),
      );
      await A.screenshot("profiles-details-offline");
      proxy.setOnline(true);
      const again = await A.waitFor(`${editSheet("contact")} && ${editSheet("insurance")}`, 30000)
        .then(() => true)
        .catch(() => false);
      check("online again: both Edits are links again", again);
    });

    await step("writers' details: a caretaker demoted to viewer", async () => {
      const B = pages[1]; // the caretaker (slice 2's editing step)
      await B.goto(PROFILE);
      await B.waitFor(section("insurance"), 30000);
      const before = await deviceDetailsRows(B);
      setCaretakerRole("viewer");
      const lost = await B.waitFor(
        `!${section("contact")} && !${section("insurance")} && document.querySelector("main [data-viewer-more]")`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      await B.waitFor(
        `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM care_recipient_details").then((r) => r[0].n === 0)`,
        30000,
      ).catch(() => undefined);
      const after = await deviceDetailsRows(B);
      check(
        "demoted: the cards go without a reload, and so does the device's details row",
        before === 1 && lost && after === 0,
        `rows ${before} → ${after}`,
      );
      setCaretakerRole("caretaker");
      const back = await B.waitFor(`${section("insurance")}?.querySelector("li[data-plan]")`, 30000)
        .then(() => true)
        .catch(() => false);
      check("promoted back: the cards return after sync", back);
    });
  }

  // ─────────── end of slice 3: writers' details (contact and insurance) ───────────

  // ─────────────────── Slice 5: emergency contacts ───────────────────

  const EMERGENCY = `${PROFILE}/emergency`;
  const MEMBERS_PAGE = `/app/groups/${DEV_FAMILY}/settings/members`;
  const E_SECTION = section("emergency");
  const E_FORM = `document.querySelector('[role="dialog"] [data-emergency-form]')`;
  const E_STATUS = `(${E_FORM}?.querySelector("[data-emergency-status]")?.textContent.trim() ?? "")`;
  const byLabel = (label) => `${E_FORM}?.querySelector('button[aria-label=${JSON.stringify(label)}]')`;
  const draftOrder = (p) =>
    p.evaluate(
      `[...${E_FORM}.querySelectorAll("li[data-draft-entry]")].map((li) => li.dataset.kind === "member" ? li.querySelector("p").textContent.trim() : li.querySelector("legend").textContent.trim())`,
    );
  /** The profile's list: names in order, the primary marked "*", and its call links. */
  const emergencyState = (p) =>
    p.evaluate(`(() => {
      const section = ${E_SECTION};
      if (!section) return null;
      const rows = [...section.querySelectorAll("li[data-emergency-entry]")];
      return {
        names: rows.map((li) => li.querySelector("[data-emergency-name]").textContent.trim() + (li.hasAttribute("data-primary") ? "*" : "")),
        calls: rows.map((li) => li.querySelector('a[data-action="call"]')?.getAttribute("href") ?? null),
        edit: !!section.querySelector('a[data-edit-sheet="emergency"]'),
        notes: [...section.querySelectorAll("[data-emergency-dropped]")].map((el) => el.textContent.trim()),
      };
    })()`);
  const namesAre = (names) =>
    `JSON.stringify([...(${E_SECTION}?.querySelectorAll("li[data-emergency-entry] [data-emergency-name]") ?? [])].map((el) => el.textContent.trim())) === ${JSON.stringify(JSON.stringify(names))}`;
  /** Press Enter on the focused element, as a keyboard would. */
  const enter = async (p) => {
    for (const type of ["keyDown", "keyUp"])
      await p.send("Input.dispatchKeyEvent", {
        type,
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        ...(type === "keyDown" ? { text: "\r" } : {}),
      });
  };
  const focused = (p) =>
    p.evaluate(
      `document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.dataset.outsideField ?? ""`,
    );
  /** Count this page's emergency list calls from now on, until a reload. */
  const countEmergencySaves = (p) =>
    p.evaluate(`(() => { if (window.__emergencySaves !== undefined) return; window.__emergencySaves = 0; const f = window.fetch;
      window.fetch = (...a) => { const u = String(a[0]?.url ?? a[0]); if (["updateOutsideContacts", "setEmergencyContacts", "setPrimaryContact"].some((n) => u.includes("/rpc/careGroup/" + n))) window.__emergencySaves++; return f(...a); }; })()`);
  const SEEDED = ["Dev Member*", "Dev Caretaker", "Rosa Example"];
  const NEIGHBOUR = `${TAG} Neighbour`;

  await step("emergency contacts: the owner's list", { smoke: true }, async () => {
    await A.goto(PROFILE);
    await A.waitFor(namesAre(SEEDED.map((n) => n.replace("*", ""))), 30000).catch(() => undefined);
    // Edit is a link once the connection is known.
    await A.waitFor(`${E_SECTION}?.querySelector('a[data-edit-sheet="emergency"]')`, 15000).catch(
      () => undefined,
    );
    const state = await emergencyState(A);
    check(
      "owner: the seeded list in order, the primary contact marked, each with a call action",
      JSON.stringify(state?.names) === JSON.stringify(SEEDED) &&
        JSON.stringify(state?.calls) ===
          JSON.stringify(["tel:5550101001", "tel:5550101002", "tel:5550104410"]),
      JSON.stringify(state),
    );
    check("owner: the list has Edit, and no note", state?.edit === true && state.notes.length === 0);
    await A.screenshot("profiles-emergency-owner");
  });

  if (!SMOKE) {
    await step("emergency contacts: the owner builds the list", async () => {
      await A.send("Emulation.setFocusEmulationEnabled", { enabled: true });
      await A.goto(PROFILE);
      await A.waitFor(`${E_SECTION}?.querySelector('a[data-edit-sheet="emergency"]')`, 30000);
      await countEmergencySaves(A);
      await A.tap(`${E_SECTION}.querySelector('a[data-edit-sheet="emergency"]')`);
      await A.waitFor(`location.pathname === ${JSON.stringify(EMERGENCY)} && ${E_FORM}`, 20000);
      await A.waitFor(`!${E_FORM}.querySelector('button[type="submit"]').disabled`, 30000);
      const start = await A.evaluate(`({
        addMember: !!${E_FORM}.querySelector("[data-add-member]"),
        withoutPhone: ${E_FORM}.querySelector("[data-without-phone]")?.textContent.trim() ?? null,
      })`);
      check(
        "sheet: everyone sharing a phone is listed, and the member without one is named, not offered",
        JSON.stringify(await draftOrder(A)) ===
          JSON.stringify(["Dev Member", "Dev Caretaker", "Rosa Example"]) &&
          !start.addMember &&
          start.withoutPhone ===
            "Dev Viewer doesn't share a phone number with the group, so they can't be added.",
        JSON.stringify(start),
      );

      // Remove a member, then add them back from the menu.
      await A.press(byLabel("Remove Dev Caretaker from the list"));
      await A.waitFor(`${E_FORM}.querySelector("[data-add-member-choice]")`, 5000);
      const offered = await A.evaluate(
        `[...${E_FORM}.querySelectorAll("[data-add-member-choice] option")].map((o) => o.textContent.trim())`,
      );
      const removedSaid = await A.evaluate(E_STATUS);
      await A.press(`${E_FORM}.querySelector("[data-add-member]")`);
      await sleep(200);
      check(
        "sheet: a removed member can be added back, and both are announced",
        JSON.stringify(offered) === JSON.stringify(["Dev Caretaker"]) &&
          removedSaid === "Dev Caretaker removed from the list." &&
          (await A.evaluate(E_STATUS)) === "Dev Caretaker added, 3 of 3." &&
          JSON.stringify(await draftOrder(A)) ===
            JSON.stringify(["Dev Member", "Rosa Example", "Dev Caretaker"]),
        JSON.stringify(offered),
      );

      // Move them to the top by keyboard: Enter on Move up, twice.
      await A.evaluate(`${byLabel("Move Dev Caretaker up")}.focus()`);
      await enter(A);
      await sleep(200);
      const once = { order: await draftOrder(A), said: await A.evaluate(E_STATUS), focus: await focused(A) };
      await enter(A);
      await sleep(200);
      const twice = { order: await draftOrder(A), said: await A.evaluate(E_STATUS), focus: await focused(A) };
      check(
        "sheet: Move up by keyboard moves the row, says where, and keeps focus on it",
        JSON.stringify(once.order) === JSON.stringify(["Dev Member", "Dev Caretaker", "Rosa Example"]) &&
          once.said === "Dev Caretaker moved to 2 of 3." &&
          once.focus === "Move Dev Caretaker up",
        JSON.stringify(once),
      );
      check(
        "sheet: at the top Move up is disabled, and focus moves to Move down",
        JSON.stringify(twice.order) === JSON.stringify(["Dev Caretaker", "Dev Member", "Rosa Example"]) &&
          twice.said === "Dev Caretaker moved to 1 of 3." &&
          twice.focus === "Move Dev Caretaker down" &&
          (await A.evaluate(`${byLabel("Move Dev Caretaker up")}.disabled`)),
        JSON.stringify(twice),
      );

      // An outside contact: focus lands on its name; with no phone it's refused, with nothing sent.
      await A.press(`${E_FORM}.querySelector("[data-add-outside]")`);
      await sleep(200);
      const newFocus = await focused(A);
      const row = `${E_FORM}.querySelector('li[data-draft-entry]:last-child')`;
      await A.type(`${row}.querySelector('[data-outside-field="name"]')`, NEIGHBOUR);
      await A.type(`${row}.querySelector('[data-outside-field="relationship"]')`, "Across the street");
      await A.press(`${E_FORM}.querySelector('button[type="submit"]')`);
      const refused = await A.waitFor(
        `${row}.querySelector('[data-outside-field="phone"]').getAttribute("aria-invalid") === "true"`,
        10000,
      )
        .then(() => true)
        .catch(() => false);
      check(
        "sheet: a new outside contact takes focus, and without a phone it's refused on its field, nothing sent",
        newFocus === "name" &&
          refused &&
          (await focused(A)) === "phone" &&
          (await A.evaluate(`window.__emergencySaves`)) === 0,
        `focus ${newFocus}`,
      );
      await A.type(`${row}.querySelector('[data-outside-field="phone"]')`, "(555) 010-4499");

      // The primary contact: the caretaker.
      await A.evaluate(
        `${E_FORM}.querySelector('[role="radiogroup"] input[aria-label="Dev Caretaker"]').click()`,
      );
      await A.press(`${E_FORM}.querySelector('button[type="submit"]')`);
      const closed = await A.waitFor(
        `${sheetClosed} && ${namesAre(["Dev Caretaker", "Dev Member", "Rosa Example", NEIGHBOUR])}`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      const state = await emergencyState(A);
      check(
        "owner: the save closes the sheet and the page shows the new order and primary",
        closed &&
          JSON.stringify(state?.names) ===
            JSON.stringify(["Dev Caretaker*", "Dev Member", "Rosa Example", NEIGHBOUR]) &&
          state.calls[3] === "tel:5550104499",
        JSON.stringify(state),
      );
      const server = serverEmergency();
      check(
        "server: one order across members and outside contacts, and the primary contact",
        server === `caretaker@example.com:1*,member@example.com:2,Rosa Example:3,${NEIGHBOUR}:4` &&
          (await A.evaluate(`window.__emergencySaves`)) === 3,
        `${server}; calls ${await A.evaluate(`window.__emergencySaves`)}`,
      );
      await A.screenshot("profiles-emergency-saved");
    });

    await step("emergency contacts: a caretaker and a viewer", async () => {
      const B = pages[1]; // the caretaker
      const C = pages[2]; // the viewer
      await B.goto(PROFILE);
      const inOrder = await B.waitFor(
        namesAre(["Dev Caretaker", "Dev Member", "Rosa Example", NEIGHBOUR]),
        30000,
      )
        .then(() => true)
        .catch(() => false);
      const state = await emergencyState(B);
      check(
        "caretaker: the list in order after sync, the primary marked, and no Edit",
        inOrder && state?.names[0] === "Dev Caretaker*" && state.edit === false,
        JSON.stringify(state),
      );
      await B.goto(EMERGENCY);
      const bLanded = await B.waitFor(sheetClosed, 30000)
        .then(() => true)
        .catch(() => false);
      check(
        "caretaker: the sheet's URL lands on the profile",
        bLanded,
        await B.evaluate(`location.pathname`),
      );

      await C.goto(PROFILE);
      await C.waitFor(`${onProfile} && document.querySelector("main [data-viewer-more]")`, 30000);
      check("viewer: no emergency list on the profile", !(await C.evaluate(`!!${E_SECTION}`)));
      await C.goto(EMERGENCY);
      const cLanded = await C.waitFor(sheetClosed, 30000)
        .then(() => true)
        .catch(() => false);
      check("viewer: the sheet's URL lands on the profile", cLanded, await C.evaluate(`location.pathname`));

      await C.goto(MEMBERS_PAGE);
      const badgesOf = (email) =>
        `[...(document.querySelector('main li[data-member="${EMAIL_ID(email)}"]')?.querySelectorAll("[data-badge]") ?? [])].map((b) => b.textContent.trim()).join("+")`;
      await C.waitFor(
        `${badgesOf("caretaker@example.com")} === "Primary contact+Emergency contact"`,
        30000,
      ).catch(() => undefined);
      const badges = await C.evaluate(`({
        caretaker: ${badgesOf("caretaker@example.com")},
        member: ${badgesOf("member@example.com")},
        viewer: ${badgesOf("viewer@example.com")},
      })`);
      check(
        "viewer: the Members page badges the primary and emergency contacts",
        badges.caretaker === "Primary contact+Emergency contact" &&
          badges.member === "Emergency contact" &&
          badges.viewer === "",
        JSON.stringify(badges),
      );
      await C.screenshot("profiles-emergency-badges");
    });

    await step("emergency contacts: offline", async () => {
      await A.goto(PROFILE);
      await A.waitFor(`${E_SECTION}?.querySelector('a[data-edit-sheet="emergency"]')`, 30000);
      proxy.setOnline(false);
      const disabled = await A.waitFor(
        `${E_SECTION}?.querySelector('button[data-edit-sheet="emergency"]:disabled')`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      const reads = (await emergencyState(A))?.names.length === 4;
      check("offline: the list reads, and its Edit is disabled", disabled && reads);
      proxy.setOnline(true);
      await A.waitFor(`${E_SECTION}?.querySelector('a[data-edit-sheet="emergency"]')`, 30000).catch(
        () => undefined,
      );
    });

    await step("emergency contacts: a member who stops sharing their phone", async () => {
      const B = pages[1]; // the caretaker
      await B.goto(MEMBERS_PAGE);
      const SHARING = `document.querySelector('main [data-sharing-form]')`;
      await B.waitFor(`${SHARING}?.querySelector('[data-share-field="phones"]')`, 40000);
      await B.evaluate(
        `(() => { const box = ${SHARING}.querySelector('[data-share-field="phones"]'); if (box.checked) box.click(); })()`,
      );
      await B.press(`${SHARING}.querySelector('button[type="submit"]')`);
      await B.waitFor(
        `${SHARING}.querySelector('[role="status"]')?.textContent.trim() === "Saved."`,
        20000,
      ).catch(() => undefined);
      await A.goto(PROFILE);
      const dropped = await A.waitFor(
        `${namesAre(["Dev Member", "Rosa Example", NEIGHBOUR])} && ${E_SECTION}.querySelector("[data-emergency-dropped]")`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      const state = await emergencyState(A);
      check(
        "owner: the caretaker leaves the list and loses primary, and the managers' note says why",
        dropped &&
          !state.names.some((n) => n.endsWith("*")) &&
          state.notes[0] ===
            "Dev Caretaker stopped sharing a phone number with the group, so they're no longer on the list.",
        JSON.stringify(state),
      );
      check(
        "server: renumbered without them, and no primary contact",
        serverEmergency() === `member@example.com:1,Rosa Example:2,${NEIGHBOUR}:3`,
        serverEmergency(),
      );
      await A.screenshot("profiles-emergency-dropped");
      restoreEmergency();
      const back = await A.waitFor(
        `${namesAre(SEEDED.map((n) => n.replace("*", "")))} && !${E_SECTION}.querySelector("[data-emergency-dropped]")`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      check("restored: the seeded list is back, with no note", back);
    });
  }

  // ─────────────────── end of slice 5: emergency contacts ───────────────────

  // The offline step's cut connection: PowerSync's sync error ("network error",
  // or "Failed to fetch" when its token request is cut).
  const noise =
    /401|Failed to load resource|\[PowerSync\]: Sync aborted|network error|\[PowerSync\]: Sync error.*Failed to fetch|\[PowerSync\]: Initial connect attempt/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
  if (SMOKE) console.log("(smoke: the owner's ways in and page only)");
} catch (e) {
  check("ran to the end", false, e.message);
} finally {
  try {
    restoreSeed();
    restoreDetails();
    setCaretakerRole("caretaker");
    restoreEmergency();
  } catch (e) {
    console.log(`clean-up failed: ${e.message}`);
  }
  for (const p of pages) p.close();
  for (const b of [bA, bB, bC]) b?.proc.kill();
  proxy?.close?.();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
