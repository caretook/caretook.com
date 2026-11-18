// The provider directory on devices (providers slice 1, the data layer):
// seeded providers, links and provider notes reach a signed-in device; each
// group's providers reach only its members; a writer's offline create-and-link
// (and link, unlink, delete) uploads once the network is back; a viewer's
// device write is refused locally.
//
// Slice 2 (the Providers tab and list): the section in the tab bar and the
// header, the seeded list in display order with past ones behind "Show past",
// search and type filters in the URL (surviving a reload), the contact
// actions' names and hrefs, the list offline, and a non-member's 404.
//
// Slice 3 (add, edit and delete): the Add button and the sheet routes
// (`providers/new`, `providers/:providerId/edit`), validation on the fields,
// a clinician with two phones and a practice reaching a second device,
// primary and past, offline add and edit, delete after a confirm on every
// device, and a viewer's sheet URLs showing the list.
//
// Slice 4 (the provider page): a row opens the page; its details, contact
// actions and seeded notes; a clinician's practice links to the practice's
// page; two browsers' notes converge with each other's avatars; notes made
// offline merge after reconnecting; a viewer reads them; a deleted, another
// group's or a non-member's provider URL is the 404 with no names.
//
// The device steps drive the device module itself (lib/sync/providers.ts,
// imported through Vite) against `window.caretookSync`. Later slices add
// their screens' steps here. Every provider and entry it makes
// carries this run's tag and is soft-deleted at the end, so it passes run
// after run without a reset.
//
// The directory's order, search and type filters (providerDirectory.test.ts),
// the contact links and their names (contactActions.test.ts) and the section
// nav (groupSections.test.ts; app-shell.mjs) are pure rules with unit tests:
// the steps here cover one case each, on the page. SMOKE=1 runs caretaker@'s
// core path: the seeds on the device, the list and a search, one add through
// the sheet, and the provider page.
import { execSync } from "node:child_process";
import { launch, openPage, sleep, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const DEV_FAMILY_2 = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";

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
const waitForSql = async (sql, test, ms = 20000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (test(last)) return last;
    await sleep(300);
  }
  return last;
};

/** Run `body` in the page with the local database as `db` and the device modules as `providers` and `liveEntry`. */
const onDevice = (p, body) =>
  p.evaluate(`(async () => {
    const db = window.caretookSync;
    if (!db) throw new Error("window.caretookSync isn't there (dev and check builds only)");
    const { providers, liveEntry, timeline } = await window.caretookModules();
    ${body}
  })()`);

const localRows = (p, sql, params = []) =>
  onDevice(p, `return db.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)});`);

// --- The directory screen (slice 2) -----------------------------------------

const BAR = `document.querySelector('nav.dock[aria-label="Group sections"]')`;
const navState = (nav) => `(() => {
  const links = [...(${nav}?.querySelectorAll("a") ?? [])];
  return {
    labels: links.map((a) => a.textContent.trim()).join(","),
    current: links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent.trim()).join(","),
  };
})()`;
/** The names in one of the directory's lists, leaving out other runs' tagged providers. */
const listNames = (label) =>
  `[...document.querySelectorAll('main ul[aria-label="${label}"] [data-provider-name]')].map((n) => n.textContent.trim()).filter((n) => !n.startsWith("PV-"))`;
const directory = (p) =>
  p.evaluate(`({
    path: location.pathname,
    search: location.search,
    box: document.querySelector('main input[type="search"]')?.value,
    current: ${listNames("Current providers")},
    past: ${listNames("Past providers")},
    showPast: document.querySelector("main [data-show-past]")?.textContent.trim() ?? null,
  })`);
const SEEDED_CURRENT = [
  "Cornerstone Pharmacy",
  "Dr. Elena Alvarez",
  "Westside Family Medicine",
  "Dr. Samuel Patel",
  "Maria Reyes",
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const waitForList = (p, test, ms = 15000) =>
  p.waitFor(`(() => { const names = ${listNames("Current providers")}; return ${test}; })()`, ms);

async function directorySteps(p, proxy) {
  // The Providers tab (420) opens the list.
  await p.waitFor(`location.pathname.endsWith("/timeline") && !!${BAR}`, 30000).catch(() => {});
  await p.press(`[...${BAR}.querySelectorAll("a")].find((a) => a.textContent.trim() === "Providers")`);
  await p.waitFor(`location.pathname.endsWith("/providers")`, 15000);
  await waitForList(p, `names.length >= 5`);
  const tab = await p.evaluate(navState(BAR));
  check(
    "420: the Providers tab opens the directory and is marked current",
    tab.current === "Providers" &&
      (await p.evaluate(`document.querySelector("main h1")?.textContent`)) === "Providers",
    JSON.stringify(tab),
  );

  // Display order: primary first, then current by name; past only with "Show past".
  const seeded = await directory(p);
  check(
    "the seeded list: primary first, then current by name",
    same(seeded.current, SEEDED_CURRENT),
    JSON.stringify(seeded.current),
  );
  check(
    'past providers are hidden behind "Show past (1)"',
    seeded.past.length === 0 && seeded.showPast === "Show past (1)",
    JSON.stringify(seeded),
  );
  await p.screenshot("providers-list");
  if (SMOKE) {
    // One search, in the URL.
    await p.type(`document.querySelector('main input[type="search"]')`, "cardio");
    await p.waitFor(`new URLSearchParams(location.search).get("q") === "cardio"`, 10000).catch(() => {});
    await waitForList(p, `names.length === 1`).catch(() => {});
    const cardio = await directory(p);
    check(
      '"cardio" finds the cardiologist (?q=cardio)',
      same(cardio.current, ["Dr. Samuel Patel"]),
      JSON.stringify(cardio),
    );
    return;
  }
  await p.press(`document.querySelector("main [data-show-past]")`);
  await p.waitFor(`location.search.includes("past=1")`, 10000);
  const withPast = await directory(p);
  check(
    '"Show past" lists the past provider below the current ones (?past=1)',
    same(withPast.past, ["Dr. Alan Whitford"]) && same(withPast.current, SEEDED_CURRENT),
    JSON.stringify(withPast),
  );

  // Search by specialty, in the URL, surviving a reload.
  await p.type(`document.querySelector('main input[type="search"]')`, "cardio");
  await waitForList(p, `names.length === 1`);
  await p.waitFor(`new URLSearchParams(location.search).get("q") === "cardio"`, 10000);
  const cardio = await directory(p);
  check(
    '"cardio" finds the cardiologist by specialty (?q=cardio)',
    same(cardio.current, ["Dr. Samuel Patel"]) && cardio.past.length === 0,
    JSON.stringify(cardio),
  );
  await p.goto(`${cardio.path}${cardio.search}`);
  await waitForList(p, `names.length > 0`, 30000);
  const reloaded = await directory(p);
  check(
    "the search survives a reload (box and list)",
    reloaded.box === "cardio" && same(reloaded.current, ["Dr. Samuel Patel"]),
    JSON.stringify(reloaded),
  );

  // The clinic's name finds its clinicians; a type chip narrows it, also in the URL.
  await p.type(`document.querySelector('main input[type="search"]')`, "westside");
  await waitForList(p, `names.length === 2`);
  await p.waitFor(`new URLSearchParams(location.search).get("q") === "westside"`, 10000);
  await p.press(
    `[...document.querySelectorAll('main nav[aria-label="Show providers"] a')].find((a) => a.textContent.trim() === "Clinicians")`,
  );
  await p.waitFor(`new URLSearchParams(location.search).get("type") === "clinician"`, 10000);
  await waitForList(p, `names.length === 1`);
  const typed = await directory(p);
  const chip = await p.evaluate(
    `[...document.querySelectorAll('main nav[aria-label="Show providers"] a[aria-current="true"]')].map((a) => a.textContent.trim()).join(",")`,
  );
  check(
    "the Clinicians chip keeps the search: only Dr. Alvarez (?q=westside&type=clinician)",
    same(typed.current, ["Dr. Elena Alvarez"]) && chip === "Clinicians" && typed.box === "westside",
    JSON.stringify({ ...typed, chip }),
  );
  // A type chip survives a reload as the search does (both are the URL's);
  // other chips filter the same way (directoryList, providerDirectory.test.ts).

  // Contact actions: accessible names and hrefs.
  await p.goto(typed.path);
  await waitForList(p, `names.length >= 5`, 30000);
  const actions = await p.evaluate(`Object.fromEntries(
    [...document.querySelectorAll("main li[data-provider-id]")].map((li) => [
      li.querySelector("[data-provider-name]").textContent.trim(),
      [...li.querySelectorAll("[data-contact-actions] a")].map((a) => [a.getAttribute("aria-label"), a.getAttribute("href"), a.getAttribute("target")]),
    ]),
  )`);
  const alvarez = actions["Dr. Elena Alvarez"] ?? [];
  check(
    'Dr. Alvarez: "Call Dr. Elena Alvarez, office" dials the office with its extension, and Email mails her',
    same(alvarez, [
      ["Call Dr. Elena Alvarez, office", "tel:5550102200,214", null],
      ["Email Dr. Elena Alvarez", "mailto:e.alvarez@westsidefamily.example", null],
    ]),
    JSON.stringify(alvarez),
  );
  // The maps link and an international number: mapsHref and telHref, contactActions.test.ts.

  // The section nav at 1280 (Providers current): activeSection, groupSections.test.ts, and app-shell.mjs.

  // Offline: from the timeline and back, the list comes from the device.
  // (Both route modules load online first: without a service worker, a dev
  // page can't fetch a module it hasn't loaded since its last full load.)
  const tabTo = async (label, path) => {
    await p.press(`[...${BAR}.querySelectorAll("a")].find((a) => a.textContent.trim() === "${label}")`);
    await p.waitFor(`location.pathname.endsWith("${path}")`, 15000);
  };
  await tabTo("Timeline", "/timeline");
  await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 15000);
  await tabTo("Providers", "/providers");
  await waitForList(p, `names.length >= 5`);
  const errorsBefore = p.errors.length;
  proxy.setOnline(false);
  await p.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000);
  await p.press(`[...${BAR}.querySelectorAll("a")].find((a) => a.textContent.trim() === "Timeline")`);
  await p.waitFor(
    `location.pathname.endsWith("/timeline") && document.querySelectorAll("ol > li").length > 0`,
    15000,
  );
  await p.press(`[...${BAR}.querySelectorAll("a")].find((a) => a.textContent.trim() === "Providers")`);
  await p.waitFor(`location.pathname.endsWith("/providers")`, 15000);
  await waitForList(p, `names.length >= 5`).catch(() => {});
  await p.type(`document.querySelector('main input[type="search"]')`, "cardio");
  await waitForList(p, `names.length === 1`).catch(() => {});
  await p.waitFor(`location.search === "?q=cardio"`, 10000).catch(() => {});
  const offline = await directory(p);
  check(
    "offline: the directory opens and searches from the device's copy",
    same(offline.current, ["Dr. Samuel Patel"]) && offline.search === "?q=cardio",
    JSON.stringify(offline),
  );
  proxy.setOnline(true);
  await p.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  p.errors.splice(errorsBefore); // Offline fetch failures aren't the app's errors.
  await p.goto(typed.path.replace(/\/providers$/, "/timeline"));
  await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 30000);
  // The device steps import the device modules into this page: load them while online.
  await localRows(p, "SELECT 1");
}

// --- Add, edit and delete (slice 3) ------------------------------------------

const SHEET = `document.querySelector('[role="dialog"] [data-provider-form]')`;
const sheetOpen = (p) => p.evaluate(`!!${SHEET}`);
/** Fill the open sheet's fields: [selector, value] (the nth match with `[selector, value, n]`). */
const fill = (p, fields) =>
  p.evaluate(`(() => {
    const form = ${SHEET};
    for (const [sel, value, n = 0] of ${JSON.stringify(fields)}) {
      const el = form.querySelectorAll(sel)[n];
      if (!el) throw new Error("no field: " + sel + " #" + n);
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked !== value) el.click();
        continue;
      }
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  })()`);
/** Each invalid field's name and its message (through aria-describedby), plus the phones message. */
const fieldErrors = (p) =>
  p.evaluate(`(() => {
    const form = ${SHEET};
    const out = {};
    for (const el of form.querySelectorAll('[aria-invalid="true"]')) {
      const key = el.name + (el.name.startsWith("phone") ? [...form.querySelectorAll('[name="' + el.name + '"]')].indexOf(el) : "");
      out[key] = document.getElementById(el.getAttribute("aria-describedby"))?.textContent ?? "";
    }
    const set = form.querySelector("fieldset[aria-describedby]");
    if (set) out.phones = document.getElementById(set.getAttribute("aria-describedby"))?.textContent ?? "";
    return out;
  })()`);
const submitSheet = (p) => p.press(`${SHEET}.querySelector('button[type="submit"]')`);
const allNames = (label) =>
  `[...document.querySelectorAll('main ul[aria-label="${label}"] [data-provider-name]')].map((n) => n.textContent.trim())`;
const selectPractice = (p, name) =>
  p.evaluate(`(() => {
    const select = ${SHEET}.querySelector('[name="practiceId"]');
    const option = [...select.options].find((o) => o.textContent.startsWith(${JSON.stringify(name)}));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, option.value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return option.value;
  })()`);
const escape = async (p) => {
  for (const type of ["keyDown", "keyUp"])
    await p.send("Input.dispatchKeyEvent", {
      type,
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
};

/** A writer adds, edits, marks and deletes providers through the sheets; returns what to clean up. */
async function sheetSteps(p, other, proxy, tag) {
  const LIST = `/app/groups/${DEV_FAMILY}/providers`;
  await p.goto(LIST);
  await waitForList(p, `names.length >= 5`, 30000);

  // The Add button opens the sheet over the list (the list stays underneath).
  await p.press(`document.querySelector("main [data-add-provider]")`);
  await p.waitFor(SHEET, 15000);
  const opened = await p.evaluate(`({
    path: location.pathname,
    title: document.querySelector('[role="dialog"] :is(h2, h3)')?.textContent,
    list: document.querySelectorAll('main ul[aria-label="Current providers"] li').length,
    phones: ${SHEET}.querySelectorAll('[name="phoneNumber"]').length,
    type: ${SHEET}.querySelector('[name="type"]:checked')?.value,
  })`);
  check(
    'a writer\'s "Add provider" opens the add sheet over the list (…/providers/new), as a clinician',
    opened.path === `${LIST}/new` &&
      opened.title === "Add a provider" &&
      opened.list >= 5 &&
      opened.type === "clinician",
    JSON.stringify(opened),
  );

  // Validation: name, email and website shapes, and the phone count, on their fields.
  if (SMOKE) {
    await p.press(
      `[...${SHEET}.querySelectorAll("button")].find((b) => b.textContent.includes("Add a phone number"))`,
    );
  } else {
    await fill(p, [
      ['[name="email"]', "not-an-email"],
      ['[name="website"]', "not a site"],
    ]);
    // Six rows is the most the form offers…
    for (let i = 0; i < 5; i++)
      await p.press(
        `[...${SHEET}.querySelectorAll("button")].find((b) => b.textContent.includes("Add a phone number"))`,
      );
    const capped = await p.evaluate(`({
    rows: ${SHEET}.querySelectorAll('[name="phoneNumber"]').length,
    disabled: [...${SHEET}.querySelectorAll("button")].find((b) => b.textContent.includes("Add a phone number")).disabled,
  })`);
    check(
      "the form offers at most 6 phone rows (Add is disabled at 6)",
      capped.rows === 6 && capped.disabled,
      JSON.stringify(capped),
    );
    // …so a seventh is forced in, as an old or tampered form would send it.
    await p.evaluate(`(() => {
    const ul = ${SHEET}.querySelector("[data-phones]");
    const li = document.createElement("li");
    li.setAttribute("data-forced", "");
    li.innerHTML = '<input name="phoneLabel" value="x"><input name="phoneNumber" value="555 0199">';
    ul.append(li);
    for (const [i, input] of ${SHEET}.querySelectorAll('[name="phoneNumber"]').entries()) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "555 01" + (10 + i));
    }
    return true;
  })()`);
    await submitSheet(p);
    await p.waitFor(`${SHEET}.querySelector('[aria-invalid="true"]')`, 10000).catch(() => {});
    await p.screenshot("providers-sheet-errors");
    const errors = await fieldErrors(p);
    check(
      "validation shows on the fields: name required, email and website shape, at most 6 phones",
      errors.name === "Enter a name" &&
        errors.email === "Enter an email address" &&
        errors.website === "Enter a web address, like clinic.example" &&
        errors.phones === "At most 6 phone numbers" &&
        (await sheetOpen(p)),
      JSON.stringify(errors),
    );
    check("the first invalid field gets focus", await p.evaluate(`document.activeElement?.name === "name"`));

    // Fix it: a clinician with two phones and a practice.
    await p.evaluate(`${SHEET}.querySelector("[data-forced]").remove()`);
    for (let i = 0; i < 4; i++) await p.press(`${SHEET}.querySelector('[aria-label="Remove phone 3"]')`);
  }
  const name = `${tag} Dr. Sheet`;
  await fill(p, [
    ['[name="name"]', name],
    ['[name="specialty"]', "Neurology"],
    ['[name="email"]', "sheet@neuro.example"],
    ['[name="website"]', "neuro.example"],
    ['[name="address"]', "9 Sheet Lane\nSpringfield"],
    ['[name="phoneLabel"]', "Office", 0],
    ['[name="phoneNumber"]', "(555) 010-7700", 0],
    ['[name="phoneLabel"]', "After hours", 1],
    ['[name="phoneNumber"]', "(555) 010-7701", 1],
  ]);
  const westsideId = await selectPractice(p, "Westside Family Medicine");
  await submitSheet(p);
  await p.waitFor(`!${SHEET} && location.pathname === ${JSON.stringify(LIST)}`, 10000).catch(() => {});
  const added = await p.evaluate(
    `({ path: location.pathname, sheet: !!${SHEET}, names: ${allNames("Current providers")} })`,
  );
  check(
    "saving closes the sheet back to the list, where the new clinician is at once",
    added.path === LIST && !added.sheet && added.names.includes(name),
    JSON.stringify({ path: added.path, sheet: added.sheet, has: added.names.includes(name) }),
  );
  const [local] = await localRows(p, "SELECT id FROM provider WHERE name = ?", [name]);
  const id = local?.id;
  const pg = await waitForSql(
    `SELECT type || '|' || specialty || '|' || (practice_id = '${westsideId}')::text || '|' || jsonb_array_length(phones) || '|' || (phones->1->>'label') || '|' || email || '|' || website FROM provider WHERE id = '${id}'`,
    (v) => v !== "",
  );
  check(
    "…and it uploads whole: two phones and the practice",
    pg === "clinician|Neurology|true|2|After hours|sheet@neuro.example|neuro.example",
    pg,
  );
  if (SMOKE) return { ids: [id] };
  await other
    .waitFor(
      `window.caretookSync.powersync.getAll("SELECT id FROM provider WHERE id = '${id}'").then((r) => r.length === 1)`,
      20000,
    )
    .then(
      () => check("a second device gets the new provider", true),
      () => check("a second device gets the new provider", false),
    );
  // Back after a save doesn't reopen the sheet.
  await p.evaluate(`history.back()`);
  await sleep(800);
  check(
    "Back after a save doesn't reopen the sheet",
    !(await sheetOpen(p)),
    await p.evaluate(`location.pathname`),
  );
  await p.goto(LIST);
  await waitForList(p, `names.length >= 5`, 30000);

  // Edit by URL (a deep link): the form is filled in. Primary and past save
  // together; where each puts it in the list is compareProviders's rule
  // (providerDirectory.test.ts).
  await p.goto(`${LIST}/${id}/edit?q=`);
  await p.waitFor(SHEET, 30000);
  const filled = await p.evaluate(`(() => { const f = ${SHEET}; return {
    name: f.querySelector('[name="name"]').value,
    phones: [...f.querySelectorAll('[name="phoneNumber"]')].map((i) => i.value),
    practice: f.querySelector('[name="practiceId"]').value,
    address: f.querySelector('[name="address"]').value,
    title: document.querySelector('[role="dialog"] :is(h2, h3)')?.textContent,
  }; })()`);
  check(
    "the edit sheet (…/:providerId/edit) opens filled in",
    filled.name === name &&
      filled.phones.join(",") === "(555) 010-7700,(555) 010-7701" &&
      filled.practice === westsideId &&
      filled.address === "9 Sheet Lane\nSpringfield" &&
      filled.title === `Edit ${name}`,
    JSON.stringify(filled),
  );
  await fill(p, [
    ['[name="isPrimary"]', true],
    ['[name="past"]', true],
  ]);
  await submitSheet(p);
  await p.waitFor(`!${SHEET}`, 10000).catch(() => {});
  await sleep(300);
  const pastNow = await p.evaluate(`({
    current: ${allNames("Current providers")},
    showPast: document.querySelector("main [data-show-past]")?.textContent.trim() ?? null,
  })`);
  check(
    'marking past moves it behind "Show past"',
    !pastNow.current.includes(name) && /^Show past \(\d+\)$/.test(pastNow.showPast ?? ""),
    JSON.stringify(pastNow),
  );
  await p.press(`document.querySelector("main [data-show-past]")`);
  await p.waitFor(`location.search.includes("past=1")`, 10000);
  check("…and lists it under Past providers", (await p.evaluate(allNames("Past providers"))).includes(name));
  const pgPast = await waitForSql(
    `SELECT status || '|' || is_primary FROM provider WHERE id = '${id}'`,
    (v) => v === "past|true",
  );
  check("…and primary and past upload", pgPast === "past|true", pgPast);

  // Offline: an add and an edit are written on the device, and upload on reconnect.
  await p.goto(LIST);
  await waitForList(p, `names.length >= 5`, 30000);
  await p.goto(`${LIST}/${id}/edit`); // Opened online (the module loads), saved offline.
  await p.waitFor(SHEET, 30000);
  await localRows(p, "SELECT 1"); // The device modules, loaded while online.
  const errorsBefore = p.errors.length;
  proxy.setOnline(false);
  await p.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000);
  await fill(p, [
    ['[name="specialty"]', "Neurology (offline edit)"],
    ['[name="past"]', false],
  ]);
  await submitSheet(p);
  await p.waitFor(`!${SHEET}`, 10000).catch(() => {});
  await p.waitFor(`document.querySelector("main [data-add-provider]")`, 10000).catch(() => {});
  await p.press(`document.querySelector("main [data-add-provider]")`);
  const offlineSheet = await p.waitFor(SHEET, 10000).then(
    () => true,
    () => false,
  );
  check("offline: Add provider opens the sheet", offlineSheet);
  const offlineName = `${tag} Offline Pharmacy`;
  await fill(p, [
    ['[name="type"][value="pharmacy"]', true],
    ['[name="name"]', offlineName],
    ['[name="phoneNumber"]', "555-010-8800", 0],
  ]);
  await submitSheet(p);
  await p.waitFor(`!${SHEET}`, 10000).catch(() => {});
  await sleep(300);
  const offlineList = await p.evaluate(allNames("Current providers"));
  check(
    "offline: the add and the edit show in the list at once",
    offlineList.includes(offlineName) && offlineList.includes(name),
    JSON.stringify(offlineList.filter((n) => n.startsWith(tag))),
  );
  const [offlineRow] = await localRows(p, "SELECT id FROM provider WHERE name = ?", [offlineName]);
  const offlineId = offlineRow?.id;
  check(
    "offline: nothing reaches Postgres yet",
    psql(`SELECT count(*) FROM provider WHERE id = '${offlineId}'`) === "0" &&
      psql(`SELECT specialty FROM provider WHERE id = '${id}'`) === "Neurology",
  );
  proxy.setOnline(true);
  const synced = await waitForSql(
    `SELECT (SELECT type || ':' || jsonb_array_length(phones) FROM provider WHERE id = '${offlineId}') || '|' || (SELECT specialty || ':' || status FROM provider WHERE id = '${id}')`,
    (v) => v === "pharmacy:1|Neurology (offline edit):current",
    30000,
  );
  check(
    "back online: the offline add and edit upload",
    synced === "pharmacy:1|Neurology (offline edit):current",
    synced,
  );
  await p.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  p.errors.splice(errorsBefore); // Offline fetch failures aren't the app's errors.

  // Delete: after a confirm; Escape and Cancel close only the confirm.
  await p.goto(`${LIST}/${offlineId}/edit`);
  await p.waitFor(SHEET, 30000);
  const deleteButton = `[...${SHEET}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Delete provider")`;
  const confirmOpen = `document.querySelector("dialog.modal[open]")`;
  await p.press(deleteButton);
  await p.waitFor(confirmOpen, 5000);
  const confirmTitle = await p.evaluate(`${confirmOpen}.querySelector("h2").textContent`);
  await escape(p);
  await sleep(300);
  const afterEscape = await p.evaluate(`({ confirm: !!${confirmOpen}, sheet: !!${SHEET} })`);
  check(
    `Delete asks first ("${confirmTitle}"); Escape closes only the confirm`,
    confirmTitle === `Delete ${offlineName}?` && !afterEscape.confirm && afterEscape.sheet,
    JSON.stringify(afterEscape),
  );
  await p.press(deleteButton);
  await p.waitFor(confirmOpen, 5000);
  await p.press(
    `[...${confirmOpen}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancel")`,
  );
  await sleep(300);
  check(
    "Cancel keeps the provider and the sheet",
    !(await p.evaluate(`!!${confirmOpen}`)) &&
      (await sheetOpen(p)) &&
      psql(`SELECT (deleted_at IS NULL)::text FROM provider WHERE id = '${offlineId}'`) === "true",
  );
  await p.press(deleteButton);
  await p.waitFor(confirmOpen, 5000);
  await p.press(
    `[...${confirmOpen}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Delete")`,
  );
  await p.waitFor(`!${SHEET} && location.pathname === ${JSON.stringify(LIST)}`, 10000).catch(() => {});
  await sleep(300);
  check(
    "Delete closes the sheet and removes it from the list",
    !(await p.evaluate(allNames("Current providers"))).includes(offlineName) &&
      (await p.evaluate(`location.pathname`)) === LIST,
  );
  const deleted = await waitForSql(
    `SELECT (deleted_at IS NOT NULL)::text FROM provider WHERE id = '${offlineId}'`,
    (v) => v === "true",
  );
  check("…soft-deleted in Postgres", deleted === "true", deleted);
  await other
    .waitFor(
      `window.caretookSync.powersync.getAll("SELECT deleted_at FROM provider WHERE id = '${offlineId}'").then((r) => r[0]?.deleted_at)`,
      20000,
    )
    .then(
      () => check("…and on the second device", true),
      () => check("…and on the second device", false),
    );
  await p.goto(`${LIST}/${offlineId}/edit`);
  await p.waitFor(`location.pathname === ${JSON.stringify(LIST)}`, 20000).catch(() => {});
  check(
    "a deleted provider's edit URL is the list",
    (await p.evaluate(`location.pathname`)) === LIST && !(await sheetOpen(p)),
  );
  await p.screenshot("providers-after-sheets");
  // The device steps after this import the device modules into this page: load them while online.
  await localRows(p, "SELECT 1");
  return { ids: [id, offlineId] };
}

// --- The provider page (slice 4) ---------------------------------------------

const WESTSIDE = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8e1001";
const ALVAREZ = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8e1002";
const LINDQVIST = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8f1001";
const providerPath = (id, group = DEV_FAMILY) => `/app/groups/${group}/providers/${id}`;
const NOTES = `document.querySelector("main .ProseMirror")`;
const notesHave = (text) => `!!${NOTES}?.textContent.includes(${JSON.stringify(text)})`;
const PAGE_AVATARS = `[...document.querySelectorAll('main header [data-region="editors"] [data-person]')].map((el) => el.dataset.person)`;
const onProviderPage = (id) =>
  `location.pathname.endsWith("/providers/${id}") && !!${NOTES} && document.querySelector("main h1")?.textContent.length > 0`;
const providerPage = (p) =>
  p.evaluate(`({
    h1: document.querySelector("main h1")?.textContent.trim(),
    badges: [...document.querySelectorAll('main header [data-region="title"] .badge')].map((b) => b.textContent.trim()),
    details: document.querySelector('main header [data-region="details"]')?.textContent.trim(),
    practice: document.querySelector("main header a[data-practice]")?.getAttribute("href") ?? null,
    contacts: [...document.querySelectorAll("main [data-contact-list] a")].map((a) => [a.dataset.action, a.getAttribute("href"), a.textContent.trim()]),
    notes: ${NOTES}?.textContent ?? null,
    editable: ${NOTES}?.getAttribute("contenteditable"),
    readonly: ${NOTES}?.getAttribute("aria-readonly"),
    toolbar: !!document.querySelector('main [role=toolbar][aria-label="Formatting"]'),
    actions: !!document.querySelector('main header [data-region="actions"]'),
  })`);
/** Type at the end of the notes, as a person would. */
async function typeNotes(p, text) {
  await p.evaluate(`(() => { const el = ${NOTES}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await p.send("Input.insertText", { text });
}

/** A (caretaker, behind `proxy`) and B (member) on the provider page; returns the run's provider's id. */
async function providerPageSteps(A, B, proxy) {
  // A row opens the page: a tap on the row, not only the name.
  await A.goto(`/app/groups/${DEV_FAMILY}/providers`);
  await waitForList(A, `names.length >= 5`, 30000);
  await A.tap(`document.querySelector('main li[data-provider-id="${WESTSIDE}"] p.text-sm')`);
  await A.waitFor(onProviderPage(WESTSIDE), 20000).catch(() => {});
  const westside = await providerPage(A);
  check(
    "a tap on a directory row opens the provider's page",
    westside.h1 === "Westside Family Medicine",
    JSON.stringify(westside.h1),
  );
  check(
    "the page shows the type, specialty and Primary badge",
    same(westside.badges, ["Primary"]) && westside.details === "Practice · Primary care",
    JSON.stringify({ badges: westside.badges, details: westside.details }),
  );
  check(
    "every contact action: each number with its label, the address in maps, the website",
    same(
      westside.contacts.map(([kind, href]) => [kind, href]),
      [
        ["call", "tel:5550102200"],
        ["call", "tel:5550102201"],
        ["call", "tel:5550102210"],
        [
          "map",
          "https://www.google.com/maps/search/?api=1&query=1200%20Westside%20Ave%2C%20Suite%20300%2C%20Springfield%2C%20CA%2090000",
        ],
        ["website", "https://westsidefamily.example/"],
      ],
    ) &&
      westside.contacts[0][2].includes("Call Westside Family Medicine, front desk") &&
      westside.contacts[1][2].includes("Fax"),
    JSON.stringify(westside.contacts),
  );
  check(
    "the seeded notes show in the editor, writable for a caretaker",
    westside.notes?.includes("level 2") && westside.editable === "true" && westside.toolbar,
    JSON.stringify({ notes: westside.notes?.slice(0, 60), editable: westside.editable }),
  );
  await A.screenshot("provider-page");
  if (SMOKE) return null;

  // A clinician's practice links to the practice's page.
  await A.goto(providerPath(ALVAREZ));
  await A.waitFor(
    `${onProviderPage(ALVAREZ)} && !!document.querySelector("main header a[data-practice]")`,
    20000,
  ).catch(() => {});
  const alvarez = await providerPage(A);
  check(
    "a clinician's page: both numbers, email, and the practice as a link",
    alvarez.practice === providerPath(WESTSIDE) &&
      alvarez.details.startsWith("Clinician · Internal medicine · Westside Family Medicine") &&
      same(
        alvarez.contacts.map(([kind, href]) => [kind, href]),
        [
          ["call", "tel:5550102200,214"],
          ["call", "tel:5550102299"],
          ["email", "mailto:e.alvarez@westsidefamily.example"],
        ],
      ) &&
      alvarez.notes?.includes("through the portal"),
    JSON.stringify(alvarez),
  );
  await A.tap(`document.querySelector("main header a[data-practice]")`);
  await A.waitFor(onProviderPage(WESTSIDE), 20000).then(
    () => check("tapping the practice opens its page", true),
    () => check("tapping the practice opens its page", false),
  );

  // Edit (a writer): the provider sheet, filled in; closing it comes back to the page.
  await A.tap(`document.querySelector("main header a[data-edit-provider]")`);
  const editOpened = await A.waitFor(
    `${SHEET}?.querySelector('input[name="name"]')?.value === "Westside Family Medicine"`,
    20000,
  ).then(
    () => true,
    () => false,
  );
  check("Edit on the page opens the provider's sheet, filled in", editOpened);
  await A.tap(`[...${SHEET}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancel")`);
  await A.waitFor(`!${SHEET} && ${onProviderPage(WESTSIDE)}`, 20000).then(
    () => check("…and Cancel goes back to the page", true),
    () => check("…and Cancel goes back to the page", false),
  );

  // This run's provider (no notes yet), on both devices.
  const made = await onDevice(
    A,
    `return providers.createProvider(db, ${JSON.stringify(DEV_FAMILY)}, {
       type: "clinician", name: ${JSON.stringify(`${tag} Dr. Notes`)}, specialty: "Neurology",
     });`,
  );
  const id = made.id;
  await waitForSql(`SELECT count(*) FROM provider WHERE id = '${id}'`, (v) => v === "1");
  await A.goto(providerPath(id));
  await A.waitFor(onProviderPage(id), 20000).catch(() => {});
  await B.goto(providerPath(id));
  await B.waitFor(onProviderPage(id), 30000).catch(() => {});
  check(
    "a provider without notes opens with an empty editor, and no document yet",
    (await providerPage(A)).notes === "" &&
      psql(`SELECT count(*) FROM note_document WHERE id = '${id}'`) === "0",
  );

  // The first real change makes the provider's document; B sees the text.
  await typeNotes(A, `${tag} park on level 3`);
  const doc = await waitForSql(
    `SELECT subject || '|' || coalesce(provider_id::text, '') || '|' || coalesce(entry_id::text, '-') FROM note_document WHERE id = '${id}'`,
    (v) => v !== "",
  );
  check(
    "the first keystroke makes the provider's document (subject provider)",
    doc === `provider|${id}|-`,
    doc,
  );
  await B.waitFor(notesHave(`${tag} park on level 3`), 20000).then(
    () => check("a second browser sees the notes as they're written", true),
    () => check("a second browser sees the notes as they're written", false),
  );
  await typeNotes(B, ` ask for Dana`);
  await A.waitFor(notesHave("ask for Dana"), 20000).then(
    () => check("…and the first sees the second's edits (converged)", true),
    () => check("…and the first sees the second's edits (converged)", false),
  );
  const [userA, userB] = [
    await A.evaluate(`window.caretookSync.userId`),
    await B.evaluate(`window.caretookSync.userId`),
  ];
  await A.waitFor(`${PAGE_AVATARS}.includes(${JSON.stringify(userB)})`, 20000).catch(() => {});
  await B.waitFor(`${PAGE_AVATARS}.includes(${JSON.stringify(userA)})`, 20000).catch(() => {});
  const avatars = { A: await A.evaluate(PAGE_AVATARS), B: await B.evaluate(PAGE_AVATARS) };
  check(
    "each sees the other's avatar, never their own",
    same(avatars.A, [userB]) && same(avatars.B, [userA]),
    JSON.stringify(avatars),
  );

  // Offline: A writes while cut off, B writes online; both merge after reconnecting.
  const errorsBefore = A.errors.length;
  proxy.setOnline(false);
  await A.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000);
  await typeNotes(A, ` ${tag}-offline-A`);
  await typeNotes(B, ` ${tag}-online-B`);
  await sleep(1500);
  check(
    "offline: A's words stay on A while B's can't reach it",
    (await A.evaluate(notesHave(`${tag}-offline-A`))) && !(await A.evaluate(notesHave(`${tag}-online-B`))),
  );
  proxy.setOnline(true);
  await A.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  const merged = `${notesHave(`${tag}-offline-A`)} && ${notesHave(`${tag}-online-B`)}`;
  const both = await Promise.all([A.waitFor(merged, 30000), B.waitFor(merged, 30000)]).then(
    () => true,
    () => false,
  );
  const texts = [await A.evaluate(`${NOTES}.textContent`), await B.evaluate(`${NOTES}.textContent`)];
  check(
    "back online: both browsers have both edits, the same text",
    both && texts[0] === texts[1],
    JSON.stringify(texts),
  );
  A.errors.splice(errorsBefore); // Offline fetch failures aren't the app's errors.
  await A.goto(`/app/groups/${DEV_FAMILY}/timeline`);
  await A.waitFor(`document.querySelectorAll("ol > li").length > 0`, 30000);
  await localRows(A, "SELECT 1");

  // Another group's provider under this group's URL is the 404, with no names.
  await B.goto(providerPath(LINDQVIST));
  await B.waitFor(`document.querySelector("main h1")?.textContent === "Not found"`, 20000).catch(() => {});
  const crossed = await B.evaluate(`({
    h1: document.querySelector("main h1")?.textContent,
    leaks: /Lindqvist|Audiology/.test(document.querySelector("main")?.innerText ?? ""),
  })`);
  check(
    "another group's provider under this group's URL is the 404, with no names",
    crossed.h1 === "Not found" && !crossed.leaks,
    JSON.stringify(crossed),
  );
  await B.goto(providerPath(LINDQVIST, DEV_FAMILY_2));
  await B.waitFor(onProviderPage(LINDQVIST), 20000).then(
    () => check("…and opens under its own group", true),
    () => check("…and opens under its own group", false),
  );
  return id;
}

/** C (viewer): the run's provider's notes read-only; a deleted provider's URL is the 404. */
async function viewerProviderSteps(C, id, deletedId) {
  await C.goto(providerPath(id));
  await C.waitFor(`${onProviderPage(id)} && ${notesHave(`${tag}-online-B`)}`, 30000).catch(() => {});
  const page = await providerPage(C);
  check(
    "a viewer reads the notes, read-only (no toolbar, not editable)",
    page.notes?.includes(`${tag}-offline-A`) &&
      page.editable === "false" &&
      page.readonly === "true" &&
      !page.toolbar,
    JSON.stringify({ editable: page.editable, readonly: page.readonly, toolbar: page.toolbar }),
  );
  check(
    "a viewer gets no Edit on the page",
    !(await C.evaluate(`!!document.querySelector("main header a[data-edit-provider]")`)),
  );
  await C.goto(providerPath(deletedId));
  await C.waitFor(`document.querySelector("main h1")?.textContent === "Not found"`, 20000).catch(() => {});
  const gone = await C.evaluate(`({
    h1: document.querySelector("main h1")?.textContent,
    leaks: (document.querySelector("main")?.innerText ?? "").includes(${JSON.stringify(tag)}),
  })`);
  check(
    "a deleted provider's URL is the 404, with no names",
    gone.h1 === "Not found" && !gone.leaks,
    JSON.stringify(gone),
  );
}

async function signIn(p, email) {
  // On a fresh dev server the first load can fail while Vite optimises its deps: one retry.
  await p.signIn(email, PW).catch(async () => {
    await sleep(4000);
    await p.signIn(email, PW);
  });
  await p.waitFor(`window.caretookSync && window.caretookSync.powersync.currentStatus.hasSynced`, 30000);
}

const tag = `PV-${Date.now().toString(36)}`;
const proxyA = startProxy(9421);
const bA = await launch(9411, proxyA.args);
// Smoke runs one browser: the second member, the viewer and the non-member are full mode's.
const bB = SMOKE ? null : await launch(9412);
const bC = SMOKE ? null : await launch(9413);
const bD = SMOKE ? null : await launch(9414);
const pages = [];
/** This run's providers from the sheet steps, deleted at the end. */
const made = { ids: [] };
try {
  const A = await openPage(bA, "caretaker");
  const B = bB && (await openPage(bB, "member"));
  const C = bC && (await openPage(bC, "viewer"));
  pages.push(...[A, B, C].filter(Boolean));

  // --- Seeds reach a member's device -------------------------------------
  await signIn(A, "caretaker@example.com");
  const seeded = psql(
    `SELECT count(*) FROM provider WHERE group_id = '${DEV_FAMILY}' AND deleted_at IS NULL AND name NOT LIKE 'PV-%'`,
  );
  const local = await localRows(
    A,
    `SELECT * FROM provider WHERE group_id = ? AND deleted_at IS NULL AND name NOT LIKE 'PV-%' ORDER BY is_primary DESC, status = 'past', name`,
    [DEV_FAMILY],
  );
  check(
    "Dev Family's seeded providers are on the caretaker's device",
    local.length === Number(seeded) && local.length >= 6,
    `${local.length} of ${seeded}`,
  );
  const alvarez = local.find((r) => r.name === "Dr. Elena Alvarez");
  const westside = local.find((r) => r.name === "Westside Family Medicine");
  check(
    "a provider arrives whole: practice, phones (JSON), primary (1)",
    !!alvarez &&
      alvarez.practice_id === westside?.id &&
      JSON.parse(alvarez.phones).length === 2 &&
      alvarez.is_primary === 1,
    JSON.stringify(
      alvarez && {
        practice: alvarez.practice_id === westside?.id,
        phones: alvarez.phones,
        primary: alvarez.is_primary,
      },
    ),
  );
  check("past providers sort last", local.at(-1)?.status === "past", local.at(-1)?.name);

  const links = await localRows(
    A,
    `SELECT l.id FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id WHERE l.group_id = ? AND p.name NOT LIKE 'PV-%'`,
    [DEV_FAMILY],
  );
  const pgLinks = psql(
    `SELECT count(*) FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id WHERE l.group_id = '${DEV_FAMILY}' AND p.name NOT LIKE 'PV-%'`,
  );
  check(
    "seeded links are on the device",
    links.length === Number(pgLinks) && links.length >= 6,
    `${links.length} of ${pgLinks}`,
  );
  const docs = await localRows(
    A,
    `SELECT id, subject, provider_id, text FROM note_document WHERE subject = 'provider' AND group_id = ?`,
    [DEV_FAMILY],
  );
  check(
    "provider notes (live documents) are on the device",
    docs.length >= 3 &&
      docs.every((d) => d.provider_id === d.id) &&
      docs.some((d) => d.text.includes("level 2")),
    `${docs.length} documents`,
  );
  const entryDocs = await localRows(
    A,
    `SELECT count(*) AS n FROM note_document WHERE subject = 'entry' AND entry_id = id`,
  );
  check("entry documents say they're an entry's", entryDocs[0]?.n > 0, `${entryDocs[0]?.n}`);

  const notMine = await localRows(A, `SELECT count(*) AS n FROM provider WHERE group_id = ?`, [DEV_FAMILY_2]);
  check(
    "another group's providers never reach the device",
    notMine[0]?.n === 0,
    `${notMine[0]?.n} from Dev Family 2`,
  );

  // --- The Providers tab and list (slice 2) --------------------------------
  await directorySteps(A, proxyA);

  // --- A member of both groups gets both, each in its own group ------------
  if (!SMOKE) {
    await signIn(B, "member@example.com");
    const both = await localRows(
      B,
      `SELECT group_id, count(*) AS n FROM provider WHERE deleted_at IS NULL GROUP BY group_id`,
    );
    const byGroup = Object.fromEntries(both.map((r) => [r.group_id, r.n]));
    const lou = await localRows(B, `SELECT group_id FROM provider WHERE name = 'Dr. Grace Lindqvist'`);
    check(
      "member@ (two groups) gets each group's providers, kept apart",
      byGroup[DEV_FAMILY] >= 6 && byGroup[DEV_FAMILY_2] === 1 && lou[0]?.group_id === DEV_FAMILY_2,
      JSON.stringify(byGroup),
    );
  }

  // --- Add, edit and delete through the sheets (slice 3) --------------------
  made.ids = (await sheetSteps(A, B, proxyA, tag)).ids;

  // --- The provider page and its live notes (slice 4) -----------------------
  const notesProvider = await providerPageSteps(A, B, proxyA);

  // Smoke stops here: offline, a second member, the viewer and a non-member are full mode's.
  if (!SMOKE) {
    // --- Offline: create an event, create-and-link a provider, link a seeded one
    proxyA.setOnline(false);
    await A.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000);
    const entryId = await A.evaluate(`crypto.randomUUID()`);
    const offline = await onDevice(
      A,
      `const entryId = ${JSON.stringify(entryId)};
     const made = await liveEntry.materializeLiveEntry(db, {
       id: entryId, groupId: ${JSON.stringify(DEV_FAMILY)}, kind: "event", title: ${JSON.stringify(`${tag} cardiology visit`)},
       occurredAt: new Date().toISOString(), timeZone: "America/Los_Angeles",
     });
     const created = await providers.createAndLinkProvider(db, entryId, {
       type: "clinician", name: ${JSON.stringify(`${tag} Dr. Offline`)}, specialty: "Cardiology",
       phones: [{ label: "Office", number: "(555) 010-9900" }, { label: "Fax", number: "(555) 010-9901" }],
       website: "offline-heart.example",
     });
     const pharmacy = (await db.powersync.getAll("SELECT id FROM provider WHERE name = 'Cornerstone Pharmacy'"))[0];
     const linked = await providers.linkProvider(db, entryId, pharmacy.id);
     const again = await providers.linkProvider(db, entryId, pharmacy.id);
     const symptom = (await db.powersync.getAll("SELECT id FROM timeline_entry WHERE kind = 'symptom' AND deleted_at IS NULL LIMIT 1"))[0];
     const wrongKind = await providers.linkProvider(db, symptom.id, pharmacy.id);
     const bad = await providers.createProvider(db, ${JSON.stringify(DEV_FAMILY)}, { type: "practice", name: "x", practiceId: pharmacy.id });
     const local = await db.powersync.getAll("SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?", [entryId]);
     return { made, created, linked, again, wrongKind: wrongKind.ok, bad: bad.ok, pharmacyId: pharmacy.id, local: local.length };`,
    );
    check(
      "offline: the event, a new provider and two links are written locally",
      offline.made.ok && offline.created.ok && offline.linked.ok && offline.again.ok && offline.local === 2,
      JSON.stringify({ local: offline.local, created: offline.created.ok }),
    );
    check(
      "local writes refuse a symptom link and an invalid provider",
      offline.wrongKind === false && offline.bad === false,
    );
    const providerId = offline.created.id;
    check(
      "nothing reaches Postgres while offline",
      psql(`SELECT count(*) FROM provider WHERE id = '${providerId}'`) === "0" &&
        psql(`SELECT count(*) FROM timeline_entry_provider WHERE entry_id = '${entryId}'`) === "0",
    );

    proxyA.setOnline(true);
    const uploaded = await waitForSql(
      `SELECT count(*) FROM timeline_entry_provider WHERE entry_id = '${entryId}'`,
      (v) => v === "2",
      30000,
    );
    check("back online: the event's two links upload", uploaded === "2", `${uploaded} links`);
    const row = psql(
      `SELECT type || '|' || name || '|' || jsonb_array_length(phones) || '|' || website || '|' || is_primary FROM provider WHERE id = '${providerId}'`,
    );
    check(
      "…and the new provider, whole",
      row === `clinician|${tag} Dr. Offline|2|offline-heart.example|false`,
      row,
    );

    // The other member's device gets them through sync.
    await B.waitFor(
      `window.caretookSync.powersync.getAll("SELECT id FROM timeline_entry_provider WHERE entry_id = '${entryId}'").then((r) => r.length === 2)`,
      20000,
    ).then(
      () => check("another member's device receives the new links", true),
      () => check("another member's device receives the new links", false),
    );

    // --- Edit, unlink and delete sync too -----------------------------------
    const edits = await onDevice(
      A,
      `const updated = await providers.updateProvider(db, ${JSON.stringify(providerId)}, { isPrimary: true, status: "past" });
     const unlinked = await providers.unlinkProvider(db, ${JSON.stringify(entryId)}, ${JSON.stringify(offline.pharmacyId)});
     const removed = await providers.removeProvider(db, ${JSON.stringify(providerId)});
     return [updated.ok, unlinked.ok, removed.ok];`,
    );
    check("edit, unlink and delete locally", edits.every(Boolean), JSON.stringify(edits));
    const after = await waitForSql(
      `SELECT (SELECT count(*) FROM timeline_entry_provider WHERE entry_id = '${entryId}') || '|' || (SELECT (deleted_at IS NOT NULL)::text || is_primary::text || status FROM provider WHERE id = '${providerId}')`,
      (v) => v === "1|truetruepast",
      20000,
    );
    check("…and they upload: one link left, the provider soft-deleted", after === "1|truetruepast", after);

    // --- A viewer's device refuses writes -----------------------------------
    await signIn(C, "viewer@example.com");
    const viewer = await onDevice(
      C,
      `const created = await providers.createProvider(db, ${JSON.stringify(DEV_FAMILY)}, { type: "other", name: ${JSON.stringify(`${tag} viewer`)} });
     const linked = await providers.linkProvider(db, ${JSON.stringify(entryId)}, ${JSON.stringify(offline.pharmacyId)});
     return [created.ok, linked.ok];`,
    );
    check(
      "a viewer's device refuses to add or link",
      viewer.every((ok) => ok === false),
      JSON.stringify(viewer),
    );
    const viewerSees = await localRows(
      C,
      `SELECT count(*) AS n FROM provider WHERE group_id = ? AND deleted_at IS NULL`,
      [DEV_FAMILY],
    );
    check("…but sees the directory", viewerSees[0]?.n >= 6, `${viewerSees[0]?.n}`);
    await C.goto(`/app/groups/${DEV_FAMILY}/providers`);
    await waitForList(C, `names.length >= 5`, 30000).catch(() => {});
    const viewerList = await directory(C);
    const viewerNote = await C.evaluate(`document.querySelector("main header p")?.textContent ?? ""`);
    check(
      "a viewer sees the same list, marked view-only",
      same(viewerList.current, SEEDED_CURRENT) && viewerNote.includes("You can view this directory"),
      JSON.stringify({ current: viewerList.current, viewerNote }),
    );

    // A viewer: no Add, and the sheet URLs are the list with no form.
    const viewerAdd = await C.evaluate(`!!document.querySelector("main [data-add-provider]")`);
    await C.goto(`/app/groups/${DEV_FAMILY}/providers/new?type=pharmacy`);
    await C.waitFor(`location.pathname.endsWith("/providers")`, 20000).catch(() => {});
    await sleep(500);
    const viewerNew = await C.evaluate(
      `({ path: location.pathname, search: location.search, form: !!document.querySelector("[data-provider-form]") })`,
    );
    const seededId = psql(
      `SELECT id FROM provider WHERE name = 'Dr. Samuel Patel' AND group_id = '${DEV_FAMILY}'`,
    );
    await C.goto(`/app/groups/${DEV_FAMILY}/providers/${seededId}/edit`);
    await C.waitFor(`location.pathname.endsWith("/providers")`, 20000).catch(() => {});
    await sleep(500);
    const viewerEdit = await C.evaluate(
      `({ path: location.pathname, form: !!document.querySelector("[data-provider-form]"), list: document.querySelectorAll("main li[data-provider-id]").length })`,
    );
    check(
      "a viewer gets no Add; …/providers/new and …/:id/edit show the list with no form",
      !viewerAdd &&
        viewerNew.path.endsWith("/providers") &&
        !viewerNew.form &&
        viewerNew.search === "?type=pharmacy" &&
        viewerEdit.path.endsWith("/providers") &&
        !viewerEdit.form &&
        viewerEdit.list >= 5,
      JSON.stringify({ viewerAdd, viewerNew, viewerEdit }),
    );

    await viewerProviderSteps(C, notesProvider, providerId);

    // --- A non-member's providers URL is the 404, with no names --------------
    const D = await openPage(bD, "admin");
    pages.push(D);
    await D.signIn("admin@example.com", PW, { home: true });
    await D.goto(`/app/groups/${DEV_FAMILY}/providers?q=cardio`);
    await D.waitFor(`document.querySelector("main h1")?.textContent === "Not found"`, 20000).catch(() => {});
    const stranger = await D.evaluate(`({
    h1: document.querySelector("main h1")?.textContent,
    leaks: /Grandma|Pat|Dev Family|Alvarez|Patel|Westside|Cornerstone|Maria/.test(document.querySelector("main")?.innerText ?? ""),
  })`);
    check(
      "non-member: …/providers is the 404 with no names",
      stranger.h1 === "Not found" && !stranger.leaks,
      JSON.stringify(stranger),
    );
    await D.goto(providerPath(WESTSIDE));
    await D.waitFor(`document.querySelector("main h1")?.textContent === "Not found"`, 20000).catch(() => {});
    const strangerPage = await D.evaluate(`({
    h1: document.querySelector("main h1")?.textContent,
    leaks: /Grandma|Pat|Dev Family|Westside|level 2/.test(document.querySelector("main")?.innerText ?? ""),
  })`);
    check(
      "non-member: a provider's page is the 404 with no names",
      strangerPage.h1 === "Not found" && !strangerPage.leaks,
      JSON.stringify(strangerPage),
    );

    // --- Clean up: soft-delete this run's event --------------------------------
    const cleaned = await onDevice(
      A,
      `return (await timeline.removeEntry(db, ${JSON.stringify(entryId)})).ok;`,
    );
    const gone = await waitForSql(
      `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE id = '${entryId}'`,
      (v) => v === "true",
    );
    check("clean up: this run's event is deleted", cleaned && gone === "true");
  }
  const sheetCleaned = await onDevice(
    A,
    `const out = [];
     for (const id of ${JSON.stringify(made.ids)}) out.push((await providers.removeProvider(db, id)).ok);
     return out.every(Boolean);`,
  );
  const sheetGone = await waitForSql(
    `SELECT count(*) FROM provider WHERE id IN ('${made.ids.join("','")}') AND deleted_at IS NULL`,
    (v) => v === "0",
  );
  check("clean up: this run's providers are deleted", sheetCleaned && sheetGone === "0");

  if (!SMOKE) {
    const cleanedProvider = await onDevice(
      A,
      `return (await providers.removeProvider(db, ${JSON.stringify(notesProvider)})).ok;`,
    );
    const providerGone = await waitForSql(
      `SELECT (deleted_at IS NOT NULL)::text FROM provider WHERE id = '${notesProvider}'`,
      (v) => v === "true",
    );
    check("clean up: this run's provider is deleted", cleanedProvider && providerGone === "true");
  }

  // Being offline is noisy on purpose (the proxy cuts Vite's socket and PowerSync's stream).
  const noise =
    /401|Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_PROXY|Failed to fetch|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
} catch (e) {
  check("ran to the end", false, e.message);
} finally {
  for (const p of pages) p.close();
  for (const b of [bA, bB, bC, bD]) b?.proc.kill();
  proxyA.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
