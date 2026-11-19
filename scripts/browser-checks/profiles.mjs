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

const pages = [];
let bA, bB, bC, proxy;

try {
  restoreSeed();
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
        page.sections === "basics,note",
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
