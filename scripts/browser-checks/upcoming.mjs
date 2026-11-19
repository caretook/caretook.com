// Appointments and reminders (the appointments PRD). Slice 3, the Upcoming
// section (`…/upcoming`) and its Past tab (`…/upcoming/past`):
//
// - Upcoming is a group section after Timeline and Providers: the tab bar at
//   420 and the header's links at 1280, with `aria-current`;
// - the seeded items show soonest first by day, items in progress first,
//   all-day first in their day, the cancelled ones struck through and
//   labelled (one "Rescheduled to …"), the reminder note among them;
// - the kind and author filters live in the URL and survive a reload;
// - call and map actions on rows with a provider or a place, none without;
// - Add appointment and Add reminder open drafts at `?when=pick` for
//   writers; viewers see neither;
// - an item whose time passes leaves without a reload, and one with an end
//   time shows "Now · until …" until it ends (full mode: about a minute);
// - the Past tab lists past events newest first, the seeded cancelled ones
//   included;
// - both tabs offline from the device's copy; a non-member's URL is the 404.
//
// Slice 4, cancel and undo cancel (full mode, `cancelSteps`): a writer
// cancels an upcoming event from Upcoming with a reason and a past one from
// the timeline without; both are struck through and labelled there, in the
// Past tab and on a viewer's device; the entry page's banner (reason, who,
// Undo for writers only); Undo from the banner and the menu; an offline
// cancel syncs on reconnect; a viewer's device refuses the write.
//
// Later slices (6: the timeline's Next strip and Upcoming block) add their
// steps here. The rules themselves (timing, order, labels, filters, the
// actions) are unit-tested; the steps here check the wiring, one case each.
// The entries this run makes carry its tag and are soft-deleted at the end,
// so it passes run after run without a reset. SMOKE=1 runs caretaker@'s core
// path: the section, the seeded list and the Add links.
import { execSync } from "node:child_process";
import { launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const DEV_RECIPIENT = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0002";
const DEV_FAMILY_2 = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";
const TAG = `UP-${Date.now().toString(36)}`;

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

const upcomingPath = (group = DEV_FAMILY) => `/app/groups/${group}/upcoming`;
const metrics = (p, width, mobile) =>
  p.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile });
const BAR = `document.querySelector('nav.dock[aria-label="Group sections"]')`;
const HEADER_NAV = `document.querySelector('header [data-region="sections"] nav[aria-label="Group sections"]')`;
const navState = (nav) => `(() => {
  const nav = ${nav};
  if (!nav || nav.getBoundingClientRect().height === 0) return null;
  const links = [...nav.querySelectorAll("a")];
  const up = links.find((a) => a.textContent.trim() === "Upcoming");
  return { labels: links.map((a) => a.textContent.trim()).join(","), current: up?.getAttribute("aria-current") ?? null };
})()`;

/** Every listed row, in order: its section, title text, and what it carries. */
const ROWS = `[...document.querySelectorAll("main [data-upcoming-list] [data-day]")].flatMap((day) =>
  [...day.querySelectorAll("[data-upcoming-item]")].map((li) => ({
    day: day.dataset.day,
    heading: day.querySelector("h3").textContent.trim(),
    id: li.dataset.upcomingItem,
    text: li.textContent,
    at: li.querySelector("time")?.getAttribute("datetime"),
    when: li.querySelector("[data-when]")?.textContent.replace(/\\u200b/g, ""),
    cancelled: li.hasAttribute("data-cancelled"),
    struck: [...li.querySelectorAll("div")].some((d) => getComputedStyle(d).textDecorationLine.includes("line-through")),
    actions: [...li.querySelectorAll("[data-action]")].map((a) => ({ kind: a.dataset.action, href: a.getAttribute("href"), label: a.getAttribute("aria-label") })),
    kindLink: li.querySelector('a[aria-label^="Show only"]')?.getAttribute("aria-label"),
    author: li.querySelector("[data-author]")?.dataset.author,
    open: li.querySelector("a.absolute")?.getAttribute("href"),
  })))`;
const rowsOf = (p) => p.evaluate(ROWS);
const find = (rows, title) => rows.find((r) => r.text.includes(title));
const seedTitles = [
  "Physical therapy",
  "Cardiology follow-up: Dr. Patel",
  "Call the pharmacy about the refill",
  "Dental cleaning",
  "Primary care: Dr. Alvarez",
  "Hospice intake visit",
  "Ride to the senior center",
];

/** Opens Upcoming from the section nav (a client navigation, as a tap would). */
const openUpcoming = async (p) => {
  const link = `[...(${BAR}?.querySelectorAll("a") ?? [])].find((a) => a.textContent.trim() === "Upcoming")`;
  await p.waitFor(link, 20000);
  await p.tap(link);
  await p.waitFor(
    `location.pathname.endsWith("/upcoming") && document.querySelector("main [data-upcoming-list]")`,
    20000,
  );
};

async function sectionSteps(p) {
  const bar = await p.evaluate(navState(BAR));
  await openUpcoming(p);
  const onPage = await p.evaluate(navState(BAR));
  check(
    "420: the tab bar lists Upcoming after Timeline and Providers, current on its page",
    bar?.labels === "Timeline,Providers,Upcoming" && bar.current === null && onPage?.current === "page",
    JSON.stringify({ bar, onPage }),
  );
  await metrics(p, 1280, false);
  await p.waitFor(`${navState(HEADER_NAV)}`, 5000).catch(() => {});
  const wide = await p.evaluate(navState(HEADER_NAV));
  await metrics(p, 420, true);
  check(
    "1280: the header's section links end with Upcoming, current",
    wide?.labels === "Timeline,Providers,Upcoming" && wide.current === "page",
    JSON.stringify(wide),
  );
}

async function seededSteps(p) {
  await p.waitFor(
    `document.querySelectorAll("main [data-upcoming-item]").length >= ${seedTitles.length}`,
    30000,
  );
  const rows = await rowsOf(p);
  const order = seedTitles.map((t) => rows.findIndex((r) => r.text.includes(t)));
  check(
    "the seeded items are listed soonest first",
    order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])),
    order.join(","),
  );
  const keys = [...new Set(rows.map((r) => r.day))];
  const dayKeys = keys.filter((k) => k !== "now");
  check(
    "a section per day, in date order (items in progress first), headed Today, Tomorrow or a date",
    dayKeys.every((k, i) => i === 0 || k > dayKeys[i - 1]) &&
      (keys[0] === "now" || !keys.includes("now")) &&
      rows.every((r) =>
        r.day === "now" ? r.heading === "Now" : /^(Today|Tomorrow|\w+day, \w{3} \d+)/.test(r.heading),
      ),
    keys.join(","),
  );
  const hospice = find(rows, "Hospice intake visit");
  const sameDay = rows.filter((r) => r.day === hospice?.day);
  check(
    "an all-day item says All day and comes first in its day",
    hospice?.when === "All day" && sameDay[0]?.id === hospice.id,
    JSON.stringify(sameDay.map((r) => r.when)),
  );
  const patel = find(rows, "Cardiology follow-up");
  check(
    "a timed item with an end shows its range",
    /^\d{1,2}:\d{2}\s?[AP]M–\d{1,2}:\d{2}\s?[AP]M$/.test(patel?.when ?? ""),
    patel?.when,
  );
  const dentist = find(rows, "Dental cleaning");
  const eyes = rows.filter((r) => r.text.includes("Eye doctor"));
  check(
    "cancelled items are struck through and labelled; a rescheduled one names its new day",
    dentist?.cancelled &&
      dentist.struck &&
      dentist.text.includes("Cancelled") &&
      eyes.length === 2 &&
      eyes[0].cancelled &&
      eyes[0].text.includes("Rescheduled to") &&
      !eyes[1].cancelled,
    JSON.stringify({
      dentist: dentist && [dentist.cancelled, dentist.struck],
      eyes: eyes.map((e) => e.cancelled),
    }),
  );
  const refill = find(rows, "Call the pharmacy");
  check(
    "the reminder note is listed with the appointments, and opens its page",
    refill?.kindLink === "Show only notes" && /\/entries\/[0-9a-f-]+$/.test(refill.open ?? ""),
    JSON.stringify(refill && { kind: refill.kindLink, open: refill.open }),
  );
  const call = patel?.actions.find((a) => a.kind === "call");
  const map = patel?.actions.find((a) => a.kind === "map");
  const ride = find(rows, "Ride to the senior center");
  check(
    "call and map actions on a row with a provider and a place; none on a row with neither",
    call?.href === "tel:5550103300" &&
      /^Call .*Patel/.test(call.label) &&
      map?.href?.startsWith("https://www.google.com/maps/search/?api=1&query=48%20Harbor") &&
      ride?.actions.length === 0,
    JSON.stringify({ patel: patel?.actions, ride: ride?.actions }),
  );
  // Therapy has no place of its own: it maps the linked aide's address, if any, and calls her.
  const therapy = find(rows, "Physical therapy");
  check(
    "a row with only a provider calls them",
    therapy?.actions.some((a) => a.kind === "call" && a.href === "tel:+15550105500"),
    JSON.stringify(therapy?.actions),
  );
}

async function addSteps(p, writer) {
  const links = await p.evaluate(
    `[...document.querySelectorAll("main [data-upcoming-add] a")].map((a) => [a.textContent.trim(), a.getAttribute("href")])`,
  );
  if (!writer) {
    check("a viewer sees no Add appointment or Add reminder", links.length === 0, JSON.stringify(links));
    return;
  }
  const base = `/app/groups/${DEV_FAMILY}/entries/new`;
  check(
    "a writer gets Add appointment and Add reminder, drafts that pick the time first",
    links.length === 2 &&
      links[0][0] === "Add appointment" &&
      links[0][1] === `${base}?kind=event&when=pick` &&
      links[1][0] === "Add reminder" &&
      links[1][1] === `${base}?kind=note&when=pick`,
    JSON.stringify(links),
  );
  await p.tap(`[...document.querySelectorAll("main [data-upcoming-add] a")][0]`);
  const opened = await p
    .waitFor(
      `location.pathname.endsWith("/entries/new") && location.search.includes("when=pick") && document.querySelector("main")`,
      20000,
    )
    .catch(() => false);
  check("Add appointment opens the draft", opened);
  await p.evaluate(`history.back()`);
  await p.waitFor(
    `location.pathname.endsWith("/upcoming") && document.querySelector("main [data-upcoming-list]")`,
    20000,
  );
}

async function filterSteps(p) {
  const chip = (label) =>
    `[...document.querySelectorAll('main nav[aria-label="Show items"] a')].find((a) => a.textContent.trim() === ${JSON.stringify(label)})`;
  await p.tap(chip("Appointments"));
  await p.waitFor(`location.search === "?kind=event"`, 10000);
  await p
    .waitFor(
      `![...document.querySelectorAll("main [data-upcoming-item]")].some((li) => li.textContent.includes(${JSON.stringify(seedTitles[2])}))`,
      10000,
    )
    .catch(() => {});
  await p.send("Page.reload");
  await p.waitFor(
    `document.readyState === "complete" && document.querySelector("main [data-upcoming-list]")`,
    30000,
  );
  await p.waitFor(`document.querySelectorAll("main [data-upcoming-item]").length > 0`, 20000);
  const filtered = await rowsOf(p);
  const current = await p.evaluate(`${chip("Appointments")}?.getAttribute("aria-current")`);
  check(
    "the Appointments chip shows only events, and survives a reload",
    current === "true" && filtered.length > 0 && filtered.every((r) => r.kindLink === "Show only events"),
    `${current} ${filtered.map((r) => r.kindLink).join(",")}`,
  );
  // An author's initials filter to their items, with the chip naming them.
  const author = filtered.find((r) => r.text.includes("Physical therapy"))?.author;
  await p.tap(`document.querySelector('main [data-upcoming-item] [data-author="${author}"]')`);
  await p.waitFor(`location.search.includes("author=${author}")`, 10000);
  await sleep(500);
  const mine = await rowsOf(p);
  const byChip = await p.evaluate(
    `[...document.querySelectorAll('main nav[aria-label="Show items"] a')].some((a) => a.getAttribute("aria-label")?.startsWith("By "))`,
  );
  check(
    "an author's initials show only their items, and the chip names them",
    mine.length > 0 && mine.every((r) => r.author === author) && byChip,
    `${mine.length} ${byChip}`,
  );
  await p.tap(chip("All"));
  await p.waitFor(`location.search === "?author=${author}"`, 10000);
  await p.tap(
    `[...document.querySelectorAll('main nav[aria-label="Show items"] a')].find((a) => a.getAttribute("aria-label")?.startsWith("By "))`,
  );
  await p.waitFor(`location.search === ""`, 10000);
}

async function pastSteps(p) {
  const tab = (label) =>
    `[...document.querySelectorAll('main nav[aria-label="Upcoming or past"] a')].find((a) => a.textContent.trim() === ${JSON.stringify(label)})`;
  await p.tap(tab("Past"));
  await p.waitFor(
    `location.pathname.endsWith("/upcoming/past") && document.querySelector("main[data-past-events]")`,
    20000,
  );
  await p
    .waitFor(
      `[...document.querySelectorAll("main [data-upcoming-item]")].some((li) => li.textContent.includes("Hearing test"))`,
      20000,
    )
    .catch(() => {});
  // Podiatry was 12 days ago: scrolling to the end loads older pages until it's in.
  const hasPodiatry = `[...document.querySelectorAll("main [data-upcoming-item]")].some((li) => li.textContent.includes("Podiatry visit"))`;
  for (let i = 0; i < 10 && !(await p.evaluate(hasPodiatry)); i++) {
    await p.evaluate(`document.querySelector("[data-older-entries]")?.scrollIntoView({ block: "end" })`);
    await p.waitFor(hasPodiatry, 3000, { quiet: true }).catch(() => {});
  }
  const rows = await rowsOf(p);
  const days = [...new Set(rows.map((r) => r.day))];
  const hearing = find(rows, "Hearing test");
  const podiatry = find(rows, "Podiatry visit");
  const kinds = new Set(rows.map((r) => r.kindLink));
  const current = await p.evaluate(
    `[${tab("Upcoming")}?.getAttribute("aria-current"), ${tab("Past")}?.getAttribute("aria-current")].join(",")`,
  );
  const nav = await p.evaluate(navState(BAR));
  check(
    "the Past tab lists past events only, newest first, the seeded cancelled ones included",
    days.every((k, i) => i === 0 || k < days[i - 1]) &&
      hearing?.cancelled &&
      podiatry?.cancelled &&
      rows.indexOf(hearing) < rows.indexOf(podiatry) &&
      kinds.size === 1 &&
      kinds.has("Show only events") &&
      rows.every((r) => Date.parse(r.at) <= Date.now()),
    `${rows.length} rows, ${days.slice(0, 4).join(",")} ${[...kinds].join(",")} hearing ${!!hearing?.cancelled} podiatry ${!!podiatry?.cancelled}`,
  );
  check(
    "the Past tab is current, and the section is still Upcoming",
    current === ",page" && nav?.current === "true",
    `${current} ${nav?.current}`,
  );
  await p.tap(tab("Upcoming"));
  await p.waitFor(
    `location.pathname.endsWith("/upcoming") && document.querySelector("main[data-upcoming]")`,
    20000,
  );
}

/** Inserts an event on the server (it syncs down), as caretaker@. */
const insertEvent = (title, startOffsetMs, endOffsetMs) => {
  const at = (ms) => `'${new Date(Date.now() + ms).toISOString()}'`;
  return psql(`INSERT INTO timeline_entry (group_id, recipient_id, kind, occurred_at, ends_at, time_zone, title, created_by, updated_by)
    SELECT '${DEV_FAMILY}', '${DEV_RECIPIENT}', 'event', ${at(startOffsetMs)}, ${endOffsetMs == null ? "NULL" : at(endOffsetMs)},
      'America/Los_Angeles', '${title}', u.id, u.id FROM "user" u WHERE u.email = 'caretaker@example.com' RETURNING id`);
};

async function timingSteps(p) {
  // One starting in 20 s; one that started a minute ago and ends in 40 s.
  const soon = `${TAG} soon`;
  const visit = `${TAG} visit`;
  insertEvent(soon, 20_000, null);
  insertEvent(visit, -60_000, 40_000);
  const has = (t) =>
    `[...document.querySelectorAll("main [data-upcoming-item]")].find((li) => li.textContent.includes(${JSON.stringify(t)}))`;
  await p.waitFor(`${has(soon)} && ${has(visit)}`, 30000).catch(() => {});
  const rows = await rowsOf(p);
  const s = find(rows, soon);
  const v = find(rows, visit);
  check(
    "an event later today shows under Today; one in progress under Now, as Now · until …",
    s?.heading === "Today" &&
      v?.heading === "Now" &&
      /^Now · until \d{1,2}:\d{2}\s?[AP]M$/.test(v.when ?? ""),
    JSON.stringify({ soon: s && [s.heading, s.when], visit: v && [v.heading, v.when] }),
  );
  const started = Date.now();
  // The clock ticks every 30 s: both are gone within about a minute and a half, with no reload.
  const gone = await p.waitFor(`!${has(soon)} && !${has(visit)}`, 100_000, { quiet: true }).then(
    () => true,
    () => false,
  );
  const reloaded = await p.evaluate(`!!window.__upcomingNoReload`);
  check(
    "they leave Upcoming on their own once their time passes (start, and end), without a reload",
    gone && reloaded,
    `${Math.round((Date.now() - started) / 1000)} s`,
  );
}

async function offlineSteps(p, proxy) {
  proxy.setOnline(false);
  await sleep(1000);
  const tab = (label) =>
    `[...document.querySelectorAll('main nav[aria-label="Upcoming or past"] a')].find((a) => a.textContent.trim() === ${JSON.stringify(label)})`;
  await p.tap(tab("Past"));
  const past = await p
    .waitFor(
      `location.pathname.endsWith("/upcoming/past") && document.querySelectorAll("main [data-upcoming-item]").length > 0`,
      20000,
    )
    .then(
      () => true,
      () => false,
    );
  await p.tap(tab("Upcoming"));
  const upcoming = await p
    .waitFor(
      `location.pathname.endsWith("/upcoming") && document.querySelectorAll("main [data-upcoming-item]").length >= ${seedTitles.length}`,
      20000,
    )
    .then(
      () => true,
      () => false,
    );
  proxy.setOnline(true);
  check("offline, both tabs list from the device's copy", past && upcoming, `${past} ${upcoming}`);
}

async function strangerSteps(p) {
  // caretaker@ is only in Dev Family.
  await p.goto(upcomingPath(DEV_FAMILY_2));
  await p.waitFor(`document.querySelector("main h1")?.textContent === "Not found"`, 30000).catch(() => {});
  const seen = await p.evaluate(
    `({ h1: document.querySelector("main h1")?.textContent, leaks: document.body.innerText.includes("Lindqvist") })`,
  );
  check(
    "another group's Upcoming is the 404, with nothing of it",
    seen.h1 === "Not found" && !seen.leaks,
    JSON.stringify(seen),
  );
}

// ---- Slice 4: cancel and undo cancel ------------------------------------------
const UUID_RE = "[0-9a-f-]{36}";
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const dialogButton = (text) =>
  `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
/** An entry's row or card on the timeline, by its open link. */
const timelineRow = (id) =>
  `[...document.querySelectorAll("main li")].find((li) => li.querySelector('a[href*="/entries/${id}"]'))`;
const upcomingRow = (id) => `document.querySelector('main [data-upcoming-item="${id}"]')`;
/** Whether a row is marked, labelled and struck through as cancelled. */
const cancelledState = (row) => `(() => { const li = ${row}; if (!li) return null;
  return { marked: li.hasAttribute("data-cancelled"), label: !!li.querySelector("[data-cancelled-label]")?.textContent.includes("Cancelled"),
    struck: [...li.querySelectorAll("div")].some((d) => getComputedStyle(d).textDecorationLine.includes("line-through")),
    menu: !!li.querySelector('button[aria-label^="Actions for"]') }; })()`;
const isCancelled = (st) => !!st && st.marked && st.label && st.struck;
const BANNER = `document.querySelector("main [data-cancelled-banner]")`;
const cancelSql = (id) =>
  psql(
    `SELECT coalesce(cancelled_at::text, '-') || '|' || coalesce(cancel_reason, '-') || '|' || coalesce(cancelled_by::text, '-') FROM timeline_entry WHERE id = '${id}'`,
  );
const waitForSql = async (id, ok, ms = 20000) => {
  const end = Date.now() + ms;
  let last = cancelSql(id);
  while (!ok(last) && Date.now() < end) {
    await sleep(500);
    last = cancelSql(id);
  }
  return last;
};

/**
 * Opens the ⋯ menu inside `scope`, picks Cancel event and confirms with
 * `reason` (none: left empty). Returns the menu's items, in order.
 */
const cancelFrom = async (p, scope, reason) => {
  await p.press(`${scope}?.querySelector('button[aria-label^="Actions for"]')`);
  await p.waitFor(menuItem("Cancel event"), 5000);
  const items = await p.evaluate(
    `[...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent.trim())`,
  );
  await p.press(menuItem("Cancel event"));
  await p.waitFor(`document.querySelector("dialog[open] [data-cancel-reason]")`, 5000);
  if (reason) await p.type(`document.querySelector("dialog[open] [data-cancel-reason]")`, reason);
  await p.press(dialogButton("Cancel event"));
  await p.waitFor(`!document.querySelector("dialog[open]")`, 5000);
  return items;
};

async function cancelSteps(A, B, proxy) {
  const ahead = insertEvent(`${TAG} cancel ahead`, 2 * 86_400_000, 2 * 86_400_000 + 3_600_000).match(
    UUID_RE,
  )[0];
  const past = insertEvent(`${TAG} cancel past`, -3_600_000, null).match(UUID_RE)[0];
  const caretaker = psql(`SELECT id || '|' || name FROM "user" WHERE email = 'caretaker@example.com'`).split(
    "|",
  );
  const reason = `${TAG} office called, doctor out sick`;

  // An upcoming event, cancelled from Upcoming with a reason.
  await A.goto(upcomingPath());
  await A.waitFor(upcomingRow(ahead), 30000);
  const offered = await cancelFrom(A, upcomingRow(ahead), reason);
  check(
    "a writer's event menu on Upcoming: Cancel event, then Delete",
    offered.join(",") === "Cancel event,Delete",
    offered.join(","),
  );
  await A.waitFor(`${cancelledState(upcomingRow(ahead))}?.marked`, 10000).catch(() => {});
  const aheadRow = await A.evaluate(cancelledState(upcomingRow(ahead)));
  const aheadSql = await waitForSql(ahead, (r) => !r.startsWith("-"));
  const [at, savedReason, by] = aheadSql.split("|");
  check(
    "cancelling from Upcoming with a reason: struck through and labelled at once, and on the server with who",
    isCancelled(aheadRow) && at !== "-" && savedReason === reason && by === caretaker[0],
    JSON.stringify({ aheadRow, aheadSql }),
  );

  // A past event, cancelled from the timeline without a reason.
  await A.goto(`/app/groups/${DEV_FAMILY}/timeline`);
  await A.waitFor(timelineRow(past), 30000);
  await cancelFrom(A, timelineRow(past), null);
  await A.waitFor(`${cancelledState(timelineRow(past))}?.marked`, 10000).catch(() => {});
  const pastRow = await A.evaluate(cancelledState(timelineRow(past)));
  const pastSql = await waitForSql(past, (r) => !r.startsWith("-"));
  check(
    "cancelling a past event from the timeline, without a reason: struck through and labelled",
    isCancelled(pastRow) && !pastSql.startsWith("-") && pastSql.split("|")[1] === "-",
    JSON.stringify({ pastRow, pastSql }),
  );
  await A.goto(`${upcomingPath()}/past`);
  await A.waitFor(upcomingRow(past), 30000).catch(() => {});
  check(
    "the Past tab shows the past one cancelled",
    isCancelled(await A.evaluate(cancelledState(upcomingRow(past)))),
  );

  // The viewer's device: the labels, no menus.
  await B.goto(upcomingPath());
  await B.waitFor(`${cancelledState(upcomingRow(ahead))}?.marked`, 30000).catch(() => {});
  const seenUp = await B.evaluate(cancelledState(upcomingRow(ahead)));
  await B.goto(`/app/groups/${DEV_FAMILY}/timeline`);
  await B.waitFor(`${cancelledState(timelineRow(past))}?.marked`, 30000).catch(() => {});
  const seenTl = await B.evaluate(cancelledState(timelineRow(past)));
  check(
    "on a viewer's device both show cancelled, with no ⋯ menu",
    isCancelled(seenUp) && isCancelled(seenTl) && !seenUp.menu && !seenTl.menu,
    JSON.stringify({ seenUp, seenTl }),
  );
  const refused = await B.evaluate(`(async () => {
    const { appointments } = await window.caretookModules();
    return (await appointments.uncancelEvent(window.caretookSync, "${ahead}")).ok; })()`);
  check("a viewer's device refuses the write", refused === false, String(refused));

  // The entry page: the banner, for both; Undo for the writer only.
  const entryPath = `/app/groups/${DEV_FAMILY}/entries/${ahead}`;
  await A.goto(entryPath);
  await B.goto(entryPath);
  // The names come from the members' live query, a moment after the banner.
  const named = `${BANNER}?.querySelector("[data-cancelled-by]")?.textContent.startsWith("Cancelled by")`;
  await A.waitFor(named, 30000).catch(() => {});
  await B.waitFor(named, 30000).catch(() => {});
  const bannerOf = (p) =>
    p.evaluate(`(() => { const b = ${BANNER}; return b && { reason: b.querySelector("[data-cancel-reason]")?.textContent,
      by: b.querySelector("[data-cancelled-by]")?.textContent, undo: [...b.querySelectorAll("button")].some((x) => x.textContent.trim() === "Undo cancel") }; })()`);
  const bannerA = await bannerOf(A);
  const bannerB = await bannerOf(B);
  check(
    "the entry page's banner: the reason, who and when; Undo for the writer, not the viewer",
    bannerA?.reason === reason &&
      bannerA.by?.startsWith(`Cancelled by ${caretaker[1]} · Today`) &&
      bannerA.undo &&
      bannerB?.reason === reason &&
      bannerB.by === bannerA.by &&
      !bannerB.undo,
    JSON.stringify({ bannerA, bannerB }),
  );
  await A.press(
    `[...${BANNER}.querySelectorAll("button")].find((x) => x.textContent.trim() === "Undo cancel")`,
  );
  const goneA = await A.waitFor(`!${BANNER}`, 10000).then(
    () => true,
    () => false,
  );
  const goneB = await B.waitFor(`!${BANNER}`, 30000).then(
    () => true,
    () => false,
  );
  const undone = await waitForSql(ahead, (r) => r === "-|-|-");
  check(
    "Undo cancel restores it: the banner goes on both devices, and on the server",
    goneA && goneB && undone === "-|-|-",
    undone,
  );

  // Offline: cancelled at once on the device, on the server after reconnecting.
  proxy.setOnline(false);
  await sleep(1000);
  await cancelFrom(A, `document.querySelector('main header [data-region="actions"]')`, null);
  const offlineBanner = await A.waitFor(BANNER, 5000).then(
    () => true,
    () => false,
  );
  await sleep(1500);
  const whileOffline = cancelSql(ahead);
  proxy.setOnline(true);
  const synced = await waitForSql(ahead, (r) => !r.startsWith("-"), 30000);
  const reachedB = await B.waitFor(BANNER, 30000).then(
    () => true,
    () => false,
  );
  check(
    "an offline cancel shows at once, and syncs on reconnect",
    offlineBanner && whileOffline.startsWith("-") && !synced.startsWith("-") && reachedB,
    JSON.stringify({ offlineBanner, whileOffline, synced, reachedB }),
  );

  // Undo from the menu (the timeline's past event).
  await A.goto(`/app/groups/${DEV_FAMILY}/timeline`);
  await A.waitFor(timelineRow(past), 30000);
  await A.press(`${timelineRow(past)}.querySelector('button[aria-label^="Actions for"]')`);
  await A.waitFor(menuItem("Undo cancel"), 5000);
  await A.press(menuItem("Undo cancel"));
  await A.waitFor(`${cancelledState(timelineRow(past))}?.marked === false`, 10000).catch(() => {});
  const back = await A.evaluate(cancelledState(timelineRow(past)));
  check(
    "Undo cancel from the menu: the label and the line go",
    back && !back.marked && !back.label && !back.struck,
    JSON.stringify(back),
  );
}

const proxy = SMOKE ? null : startProxy(9711);
const bA = await launch(9701, proxy ? proxy.args : []);
const bB = SMOKE ? null : await launch(9702);
const pages = [];

try {
  const A = await openPage(bA, "caretaker");
  pages.push(A);
  await A.send("Emulation.setTimezoneOverride", { timezoneId: "America/Los_Angeles" });
  await A.signIn("caretaker@example.com", PW);
  await sectionSteps(A);
  await seededSteps(A);
  await addSteps(A, true);
  await step("filters", () => filterSteps(A));
  await step("the Past tab", () => pastSteps(A));
  await step("offline", () => offlineSteps(A, proxy));
  await step("time passing", async () => {
    await A.evaluate(`window.__upcomingNoReload = true`);
    await timingSteps(A);
  });
  await step("a non-member", () => strangerSteps(A));

  if (!SMOKE) {
    const B = await openPage(bB, "viewer");
    pages.push(B);
    await B.send("Emulation.setTimezoneOverride", { timezoneId: "America/Los_Angeles" });
    await B.signIn("viewer@example.com", PW);
    await openUpcoming(B);
    await B.waitFor(
      `document.querySelectorAll("main [data-upcoming-item]").length >= ${seedTitles.length}`,
      30000,
    ).catch(() => {});
    const rows = await rowsOf(B);
    check(
      "a viewer sees Upcoming",
      seedTitles.every((t) => find(rows, t)),
      `${rows.length} rows`,
    );
    await addSteps(B, false);
    await step("cancel and undo cancel", () => cancelSteps(A, B, proxy));
  }

  // The offline step's cut connection: PowerSync's sync error "network error".
  const noise = /401|Failed to load resource|\[PowerSync\]: Sync aborted|network error/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
} catch (e) {
  check("ran to the end", false, e.message);
} finally {
  try {
    psql(`UPDATE timeline_entry SET deleted_at = now() WHERE deleted_at IS NULL AND title LIKE '${TAG}%'`);
  } catch (e) {
    console.log(`clean-up failed: ${e.message}`);
  }
  for (const p of pages) p.close();
  for (const b of [bA, bB]) b?.proc.kill();
  proxy?.close?.();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
