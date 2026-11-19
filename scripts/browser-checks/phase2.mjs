import { execSync } from "node:child_process";
import { launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";
// The timeline checks, against the local (PowerSync) data: layout, filters,
// the sheet, the view toggle, and row taps (slice 5) in both views for a
// writer (member@) and a viewer (viewer@). It picks rows by kind, not by
// seed position, so entries other checks add (or a live dot or Live now
// banner on them) don't change what it checks; it passes with or without a
// fresh `pnpm datastore:reset`.
//
// timeline-polish adds one function per slice, called at the end of the run:
// `kindIconFilters` (slice 1), `dayHeadings` (slice 2) and `latestVitalsLine`
// (slice 3). Each leaves the page at 420 wide in the rows view with no filter.
//
// The browser runs in the seeds' time zone, so rows don't grow a "… in Los
// Angeles" line, and density is checked per row rather than by how many rows
// happen to fit today (that depended on the time of day).
//
// What a pure module decides is left to its unit tests (the filter URLs in
// timelineFilters.test.ts, the day labels in format.test.ts, the ⋯ items in
// entryActionItems.test.ts, what a row opens in entryOpen.test.ts); this check
// covers the wiring: the controls are on the page, and a tap does the thing.
// Rows and cards share the open target, the kind icon and the body, so cards
// get one case of each. SMOKE=1 runs the writer's core path only (no viewer).
const TZ = "America/Los_Angeles";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const button = (text) =>
  `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const rows = `document.querySelectorAll("ol > li").length`;
/** The first row of a kind, by its sr-only "Note: " prefix. */
const rowOf = (label) =>
  `[...document.querySelectorAll("ol > li")].find((li) => li.querySelector(".sr-only")?.textContent === ${JSON.stringify(`${label}: `)})`;
const ENTRY_URL = /\/entries\/[0-9a-f-]{36}$/;

/** A real tap (mouse press and release) at the centre of an element (`tap()` in cdp.mjs). */
const tap = (p, selector) => p.tap(selector);
const key = async (p, k, code, keyCode) => {
  await p.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: k,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: keyCode });
};
const escape = (p) => key(p, "Escape", "Escape", 27);

async function signedIn(b, label, email) {
  const p = await openPage(b, label);
  await p.send("Emulation.setTimezoneOverride", { timezoneId: TZ });
  // On a fresh dev server the first load can fail while Vite optimises its deps: one retry.
  await p.signIn(email, PW).catch(async () => {
    await sleep(2000);
    await p.signIn(email, PW);
  });
  await p.waitFor(`${rows} > 0`, 30000);
  await sleep(500);
  return p;
}
async function setView(p, view) {
  await p.press(`document.querySelector('[aria-label="${view}"]')`);
  await p.waitFor(
    `document.querySelector("ol")?.dataset.view === ${JSON.stringify(view.toLowerCase())}`,
    5000,
  );
}

/**
 * The kind icon as a filter (timeline-polish slice 1). The writer, in rows,
 * gets the whole flow; the writer's cards and the viewer's rows get one tap
 * each (the icon is the same `KindFilterLink` in every frame). Each page starts
 * and ends on the unfiltered timeline, in rows. `users` is [who, page][].
 */
async function kindIconFilters(users) {
  const chips = `[...document.querySelectorAll('nav[aria-label="Show entries"] a')]`;
  const currentChip = `${chips}.filter((a) => a.getAttribute("aria-current") === "true").map((a) => a.textContent.trim()).join(",")`;
  const rowKinds = `[...new Set([...document.querySelectorAll("ol > li")].map((li) => li.querySelector(".sr-only")?.textContent))].join(",")`;
  const icon = (label) => `${rowOf(label)}.querySelector('a[aria-label^="Show only"]')`;
  const state = (p) =>
    p.evaluate(
      `JSON.stringify({ search: location.search, rows: ${rows}, kinds: ${rowKinds}, chip: ${currentChip}, history: history.length })`,
    );
  const clear = async (p) => {
    await p.press(`${chips}[0]`);
    await p.waitFor(`location.search === "" && ${rowKinds}.split(",").length > 1`, 8000);
  };
  /** Every entry's icon is a named link; tapping a symptom's shows only symptoms, with its chip current. */
  const iconFilters = async (p, at) => {
    const timeline = await p.evaluate("location.pathname");
    const names = await p.evaluate(
      `[...document.querySelectorAll("ol > li")].map((li) => li.querySelector('a[aria-label^="Show only"]')?.getAttribute("aria-label") ?? "none")`,
    );
    const known = [
      "Show only notes",
      "Show only symptoms",
      "Show only events",
      "Show only vitals",
      "Show only doses",
      "Show only medication changes",
    ];
    check(
      `${at}: every entry's icon is a "Show only <kind>" link`,
      names.length > 0 && names.every((n) => known.includes(n)),
      [...new Set(names)].join(", "),
    );
    await tap(p, icon("Symptom"));
    await p
      .waitFor(`location.search === "?kind=symptom" && ${rowKinds} === "Symptom: "`, 8000)
      .catch(() => undefined);
    const filtered = JSON.parse(await state(p));
    check(
      `${at}: tapping a symptom's icon shows only symptoms`,
      filtered.search === "?kind=symptom" &&
        filtered.kinds === "Symptom: " &&
        filtered.rows > 0 &&
        filtered.chip === "Symptoms" &&
        (await p.evaluate(`location.pathname === ${JSON.stringify(timeline)}`)),
      `${filtered.search}, ${filtered.rows} rows, chip "${filtered.chip}"`,
    );
    return { timeline, filtered };
  };

  for (const [who, p] of users) {
    // These steps reload the page, and a full load while PowerSync is syncing
    // logs "Sync error" (the old page's connection closing): not ours.
    const errorsBefore = p.errors.length;
    const dropReloadNoise = () => {
      const mine = p.errors.splice(errorsBefore).filter((e) => !e.includes("[PowerSync]: Sync error"));
      p.errors.push(...mine);
    };
    const at = `${who}, rows`;
    const { timeline } = await iconFilters(p, at);

    if (who === "writer") {
      // A reload keeps the filter.
      await step(`${at}: reload, chips and keyboard`, async () => {
        await p.goto(`${timeline}?kind=symptom`);
        await p.waitFor(`${rows} > 0`, 20000);
        await sleep(500);
        const reloaded = JSON.parse(await state(p));
        check(
          `${at}: a reload keeps the filter`,
          reloaded.search === "?kind=symptom" &&
            reloaded.kinds === "Symptom: " &&
            reloaded.chip === "Symptoms",
          `${reloaded.search}, ${reloaded.rows} rows, chip "${reloaded.chip}"`,
        );

        // Another kind's chip; a tap elsewhere on a row opens the entry, and Back keeps the filter.
        await p.press(`${chips}.find((a) => a.textContent.trim() === "Events")`);
        await p.waitFor(`location.search === "?kind=event" && ${rowKinds} === "Event: "`, 8000).then(
          () => check(`${at}: the Events chip changes the kind`, true),
          async () => check(`${at}: the Events chip changes the kind`, false, await state(p)),
        );
        await tap(p, `${rowOf("Event")}.querySelector("p")`);
        const opened = await p
          .waitFor(`${ENTRY_URL}.test(location.pathname)`, 8000)
          .then(() => true)
          .catch(() => false);
        check(`${at}: a tap elsewhere on an event still opens it`, opened);
        if (opened) {
          await p.waitFor(`document.querySelector(".ProseMirror")`, 15000).catch(() => undefined);
          await p.evaluate("history.back()");
        }
        await p.waitFor(`location.pathname === ${JSON.stringify(timeline)} && ${rows} > 0`, 10000);
        await sleep(500);
        const back = JSON.parse(await state(p));
        check(
          `${at}: Back keeps the filter`,
          back.search === "?kind=event" && back.kinds === "Event: " && back.chip === "Events",
          `${back.search}, chip "${back.chip}"`,
        );
      });
    }

    // "All" clears the kind, and is then the current chip.
    await clear(p).then(
      async () => check(`${at}: All clears the kind`, (await p.evaluate(currentChip)) === "All"),
      async () => check(`${at}: All clears the kind`, false, await state(p)),
    );

    if (who === "writer") {
      await step(`${at}: the icon by keyboard`, async () => {
        // Keyboard: Tab from the row's open target lands on its icon; Enter filters.
        await p.evaluate(`${rowOf("Note")}.querySelector('a[aria-label^="Open"]').focus()`);
        await key(p, "Tab", "Tab", 9);
        await sleep(200);
        const focused = await p.evaluate(
          `document.activeElement === ${icon("Note")} ? document.activeElement.getAttribute("aria-label") : "not the icon: " + document.activeElement?.outerHTML.slice(0, 120)`,
        );
        check(`${at}: Tab reaches the icon, named "Show only notes"`, focused === "Show only notes", focused);
        await p.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Enter",
          code: "Enter",
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13,
          text: "\r",
        });
        await p.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Enter",
          code: "Enter",
          windowsVirtualKeyCode: 13,
        });
        await p.waitFor(`location.search === "?kind=note" && ${rowKinds} === "Note: "`, 8000).then(
          () => check(`${at}: Enter on the icon shows only notes`, true),
          async () => check(`${at}: Enter on the icon shows only notes`, false, await state(p)),
        );
        await clear(p);
      });

      // Cards: the same icon, in the card's frame.
      await step("writer, cards: the icon", async () => {
        await setView(p, "Cards");
        await iconFilters(p, "writer, cards");
        await p.screenshot(`phase2-kind-icon-${who}-cards`);
        await clear(p);
        await setView(p, "Rows");
        await sleep(1500);
      });
    }
    dropReloadNoise();
  }
}

/** Tap each kind's text (a note's and an event's by default): each opens its page. Then back to the timeline. */
async function tapsOpenEntries(p, who, view, kinds = ["Note", "Event"]) {
  const timeline = await p.evaluate("location.pathname");
  for (const kind of kinds) {
    // Tap the row's text, not a link: anywhere on the row opens it.
    await tap(p, `${rowOf(kind)}.querySelector("p")`);
    const opened = await p
      .waitFor(`${ENTRY_URL}.test(location.pathname)`, 8000)
      .then(() => true)
      .catch(() => false);
    check(`${who}, ${view}: tapping ${kind === "Event" ? "an" : "a"} ${kind.toLowerCase()} opens it`, opened);
    if (opened) await p.waitFor(`document.querySelector(".ProseMirror")`, 15000).catch(() => undefined);
    await p.evaluate("history.back()");
    await p.waitFor(`location.pathname === ${JSON.stringify(timeline)} && ${rows} > 0`, 10000);
    await sleep(300);
  }
}

/**
 * Day headings (timeline-polish slice 2): "Today" and "Yesterday", then
 * "Monday, Nov 16"; larger and full contrast in both themes; stuck to the top,
 * above the rows' controls, in rows and in cards. Ends in the rows view at 420.
 */
async function dayHeadings(p) {
  const metrics = (width, mobile) =>
    p.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile });
  // Each heading with the day it stands for (its section's key, in the browser's zone).
  const headings = await p.evaluate(`(() => {
    const key = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toLocaleDateString("en-CA"); };
    return { today: key(0), yesterday: key(1),
      all: [...document.querySelectorAll("section h3")].map((h) => ({ key: h.id.replace("day-", ""), text: h.textContent.trim() })) };
  })()`);
  const labelOf = (dayKey) => headings.all.find((h) => h.key === dayKey)?.text;
  // The labels themselves ("Yesterday", "Monday, Nov 16", the year) are dayLabel's, in format.test.ts.
  check(
    'the headings are labelled in the browser\'s zone: the newest day reads "Today"',
    labelOf(headings.today) === "Today",
    `${labelOf(headings.today)}`,
  );

  // Larger, normal case, semibold and the page's full text colour, in both themes.
  const style = `(() => { const s = getComputedStyle(document.querySelector("section h3"));
    return { size: s.fontSize, weight: s.fontWeight, transform: s.textTransform, color: s.color,
      text: getComputedStyle(document.body).color, position: s.position }; })()`;
  const saved = await p.evaluate(`document.documentElement.dataset.theme ?? ""`);
  const colors = {};
  for (const theme of ["light", "dark"]) {
    await p.evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`);
    await sleep(300);
    const s = await p.evaluate(style);
    colors[theme] = s.color;
    check(
      `${theme}: the day heading is 16px, semibold, normal case, full contrast and sticky`,
      s.size === "16px" &&
        s.weight === "600" &&
        s.transform === "none" &&
        s.color === s.text &&
        s.position === "sticky",
      JSON.stringify(s),
    );
    await p.screenshot(`phase2-day-headings-${theme}`);
  }
  check("the heading's colour follows the theme", colors.light !== colors.dark, JSON.stringify(colors));
  await p.evaluate(
    saved
      ? `document.documentElement.dataset.theme = ${JSON.stringify(saved)}`
      : `delete document.documentElement.dataset.theme`,
  );
  await metrics(1280, false);
  await sleep(300);
  const wide = await p.evaluate(style);
  check("1280: the day heading is 18px", wide.size === "18px", wide.size);
  await metrics(420, true);
  await sleep(300);

  // Stuck at the top while scrolling, and above the rows' controls, in both views.
  // "Held": moved down from its place in its section to stay in view. Between
  // two days the next heading is arriving within a heading's height of the top.
  const probe = `(() => {
    const hs = [...document.querySelectorAll("section h3")].map((h) => ({ h, r: h.getBoundingClientRect(), s: h.parentElement.getBoundingClientRect() }));
    const held = hs.find(({ r, s }) => r.top - s.top > 1 && r.bottom > 0);
    const arriving = hs.some(({ r }) => r.top >= 0 && r.top < 60);
    if (!held) return { held: null, arriving, through: [] };
    const { h, r } = held;
    const top = Math.max(r.top, 0);
    const xs = [r.left + 12, r.left + r.width / 2, r.right - 20, r.right - 4];
    const ys = r.bottom - top < 6 ? [] : [top + 2, (top + r.bottom) / 2, r.bottom - 2];
    const through = xs.flatMap((x) => ys.map((y) => document.elementFromPoint(x, y)))
      .filter((el) => el && !h.contains(el)).map((el) => el.tagName + "." + el.className);
    return { held: h.textContent.trim(), top: r.top, arriving, through };
  })()`;
  for (const view of ["Rows", "Cards"]) {
    if (view === "Cards") await setView(p, "Cards");
    await sleep(500);
    const end = await p.evaluate(`document.documentElement.scrollHeight - window.innerHeight`);
    const seen = new Set();
    const gaps = [];
    const above = [];
    let atTop = 0;
    for (let y = 500; y < end; y += 130) {
      await p.evaluate(`window.scrollTo(0, ${y})`);
      await sleep(100);
      const at = await p.evaluate(probe);
      if (at.held) seen.add(at.held);
      if (at.held && Math.abs(at.top) < 1) atTop += 1;
      if (!at.held && !at.arriving) gaps.push(y);
      above.push(...at.through);
    }
    const name = view.toLowerCase();
    check(
      `${name}: a day heading stays stuck to the top while scrolling`,
      gaps.length === 0 && atTop > 3 && seen.size > 1,
      `${seen.size} days' headings held in turn, ${atTop} positions at the very top, gaps at ${gaps.join(",") || "none"}`,
    );
    check(
      `${name}: a row's controls never show above a stuck heading`,
      above.length === 0,
      above.slice(0, 3).join(" | "),
    );
    if (view === "Cards") await p.screenshot("phase2-day-heading-stuck-cards");
    await p.evaluate(`window.scrollTo(0, 0)`);
  }
  await setView(p, "Rows");
  await sleep(1500);
}

/**
 * Latest vitals (timeline-polish slice 3): one line of the same height at 420
 * and 1280 wide, newest readings first, "All vitals" never clipped; it expands
 * (keyboard) and collapses (tap), ignores the kind filter, and a reload starts
 * collapsed. Ends at 420 wide with no filter, as it started.
 */
async function latestVitalsLine(p) {
  const strip = `document.querySelector('section[aria-labelledby="latest-vitals"]')`;
  const toggle = `${strip}.querySelector("button[aria-expanded]")`;
  const expanded = `${toggle}.getAttribute("aria-expanded")`;
  const measure = () =>
    p.evaluate(`(() => { const s = ${strip}; const ul = s.querySelector("ul"); const b = ${toggle};
      const sr = s.getBoundingClientRect(); const ur = ul.getBoundingClientRect(); const br = b.getBoundingClientRect();
      const lis = [...ul.children];
      return { height: sr.height, lines: new Set(lis.map((li) => Math.round(li.getBoundingClientRect().top))).size,
        started: lis.filter((li) => li.getBoundingClientRect().left < ur.right - 24).length,
        whole: lis.filter((li) => li.getBoundingClientRect().right <= ur.right + 0.5).length, count: lis.length,
        times: lis.map((li) => li.querySelector("time").dateTime),
        readings: lis.map((li) => li.querySelector("span").textContent + "@" + li.querySelector("time").dateTime).join("|"),
        buttonClear: br.right <= sr.right + 0.5 && (br.left >= ur.right - 0.5 || br.bottom <= ur.top + 0.5) &&
          b.contains(document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2)),
        controls: !!document.getElementById(b.getAttribute("aria-controls"))?.contains(lis[0]),
        name: b.textContent.trim() }; })()`);
  const width = async (w) => {
    await p.send("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: 900,
      deviceScaleFactor: 1,
      mobile: w < 600,
    });
    await sleep(400);
  };
  await p.evaluate(`window.scrollTo(0, 0)`);

  const phone = await measure();
  check(
    "vitals at 420: one line, All vitals never clipped",
    phone.lines === 1 && phone.height <= 36 && phone.buttonClear && phone.started >= 2,
    `${phone.height}px, ${phone.started} of ${phone.count} readings begin in the line`,
  );
  check(
    "vitals: most recent readings first",
    phone.times.every((t, i) => i === 0 || phone.times[i - 1] >= t),
    phone.times.slice(0, 3).join(" "),
  );
  check(
    "vitals: the toggle is collapsed, named, and controls the list",
    (await p.evaluate(expanded)) === "false" && phone.name === "All vitals" && phone.controls,
  );

  await width(1280);
  const wide = await measure();
  check(
    "vitals at 1280: one line of the same height, with more readings",
    wide.lines === 1 && wide.height === phone.height && wide.buttonClear && wide.whole >= 3,
    `${wide.height}px, ${wide.whole} whole readings`,
  );
  await p.screenshot("phase2-vitals-1280");
  await width(420);

  // The kind filter doesn't change the strip.
  await p.press(
    `[...document.querySelectorAll('nav[aria-label="Show entries"] a')].find((a) => a.textContent.includes("Note"))`,
  );
  await p.waitFor(`location.search.includes("kind=note")`);
  await sleep(500);
  check("vitals: the same readings with ?kind=note", (await measure()).readings === phone.readings);

  // Keyboard: Enter on the toggle expands every type's reading.
  await p.evaluate(`${toggle}.focus()`);
  await p.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await p.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await p.waitFor(`${expanded} === "true"`, 5000).catch(() => undefined);
  const open = await measure();
  check(
    "vitals: Enter expands every type's latest reading",
    (await p.evaluate(expanded)) === "true" &&
      open.whole === open.count &&
      open.count === phone.count &&
      open.lines > 1 &&
      open.readings === phone.readings &&
      open.buttonClear,
    `${open.whole} of ${open.count} readings on ${open.lines} lines`,
  );
  await p.screenshot("phase2-vitals-expanded");
  await tap(p, toggle);
  await p.waitFor(`${expanded} === "false"`, 5000).catch(() => undefined);
  const closed = await measure();
  check(
    "vitals: a second tap collapses to one line",
    closed.lines === 1 && closed.height === phone.height,
    `${closed.height}px`,
  );

  // Expanded isn't remembered: a reload starts collapsed.
  await tap(p, toggle);
  await p.waitFor(`${expanded} === "true"`, 5000).catch(() => undefined);
  await p.goto(await p.evaluate("location.pathname"));
  await p.waitFor(`${rows} > 0 && ${strip}`, 20000);
  await sleep(500);
  const reloaded = await measure();
  check(
    "vitals: a reload starts collapsed",
    (await p.evaluate(expanded)) === "false" && reloaded.lines === 1 && reloaded.height === phone.height,
  );
}

const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: sql,
  })
    .toString()
    .trim();

/** The "with …" line of the first entry titled `title`: the names shown and the "+N". */
const withLineOf = (p, title) =>
  p.evaluate(`(() => {
    const li = [...document.querySelectorAll("ol > li")].find((li) =>
      li.querySelector("p.font-semibold")?.textContent.trim() === ${JSON.stringify(title)});
    const line = li?.querySelector("[data-with]");
    return li ? {
      names: [...(line?.querySelectorAll("[data-with-name]") ?? [])].map((n) => n.textContent),
      more: line?.querySelector("[data-with-more]")?.textContent.trim() ?? null,
      label: line?.querySelector(".sr-only")?.textContent ?? null,
    } : null;
  })()`);

/**
 * Providers on notes and events (providers slice 7): the seeded event with
 * two linked providers and the one with three, in rows and cards (the wording
 * itself is entryProviders.test.ts); then, in full mode, a link made
 * elsewhere (written on the server, as another device's upload would be)
 * shows on the row without a reload, and goes when it's removed.
 */
async function withLines(p) {
  for (const view of ["Rows", "Cards"]) {
    await setView(p, view);
    const two = await withLineOf(p, "Pharmacy pickup");
    const three = await withLineOf(p, "Primary care visit: Dr. Alvarez");
    check(
      `${view.toLowerCase()}: an event with two providers shows both names`,
      two?.names.length === 2 && two.more === null,
      JSON.stringify(two),
    );
    check(
      `${view.toLowerCase()}: an event with three shows two names and "+1"`,
      three?.names.length === 2 && three.more === "+1",
      JSON.stringify(three),
    );
  }
  await setView(p, "Rows");
  if (SMOKE) return;

  const [entryId, providerId] = psql(
    `SELECT (SELECT id FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND title = 'Pharmacy pickup' AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 1)
       || '|' || (SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND name = 'Dr. Alan Whitford')`,
  ).split("|");
  const linkId = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8e9007";
  const unlink = () => psql(`DELETE FROM timeline_entry_provider WHERE id = '${linkId}'`);
  unlink();
  await p.evaluate("window.__noReload = true");
  try {
    psql(
      `INSERT INTO timeline_entry_provider (id, group_id, entry_id, provider_id, created_by, updated_by)
       SELECT '${linkId}', '${DEV_FAMILY}', '${entryId}', '${providerId}', created_by, created_by
       FROM timeline_entry WHERE id = '${entryId}'`,
    );
    const shows = `([...document.querySelectorAll("ol > li")].find((li) => li.querySelector("p.font-semibold")?.textContent.trim() === "Pharmacy pickup")?.querySelector("[data-with-more]")?.textContent.trim() === "+1")`;
    await p.waitFor(shows, 20000).then(
      () => check("a link made elsewhere shows on the row without a reload (+1)", true),
      async () =>
        check(
          "a link made elsewhere shows on the row without a reload (+1)",
          false,
          JSON.stringify(await withLineOf(p, "Pharmacy pickup")),
        ),
    );
    unlink();
    await p.waitFor(`!${shows}`, 20000).then(
      () => check("…and goes when it's unlinked", true),
      async () =>
        check("…and goes when it's unlinked", false, JSON.stringify(await withLineOf(p, "Pharmacy pickup"))),
    );
    check("…with no reload", await p.evaluate("window.__noReload === true"));
  } finally {
    unlink();
  }
}

/**
 * The author filter (timeline-polish slice 4). The writer, in rows, gets the
 * whole flow: a row's initials, then a kind on top, each clear, the re-tap,
 * the page reset, the "with …" line, the empty state and the keyboard. The
 * writer's cards, the viewer's rows and an offline device get one case each
 * (the control is the same `AuthorFilterLink` everywhere). The query's SQL
 * and the empty state's words are unit tests (lib/sync/timeline.test.ts,
 * entryLabels.test.ts). Each page starts and ends on the unfiltered timeline,
 * in rows. `users` is [who, page][]; `offlineDevice` opens a signed-in page
 * behind a proxy, as { page, proxy }.
 */
async function authorFilters(users, offlineDevice) {
  const AUTHOR = "Dev Caretaker"; // caretaker@: most of the seeds, of every kind.
  const NO_SYMPTOMS = "Dev Member"; // member@: notes, events and vitals only.
  const chips = `[...document.querySelectorAll('nav[aria-label="Show entries"] a')]`;
  const authorChip = `document.querySelector('nav[aria-label="Show entries"] a[aria-label^="By "]')`;
  const rowKinds = `[...new Set([...document.querySelectorAll("ol > li")].map((li) => li.querySelector(".sr-only")?.textContent))].join(",")`;
  /** The first entry's author control for `name`, by its accessible name. */
  const authorLink = (name) =>
    `[...document.querySelectorAll("ol > li a[data-author]")].find((a) => a.getAttribute("aria-label") === ${JSON.stringify(`Show only ${name}'s entries`)})`;
  const symptomIcon = `${rowOf("Symptom")}.querySelector('a[aria-label^="Show only"]:not([data-author])')`;
  const state = async (p) =>
    JSON.parse(
      await p.evaluate(`JSON.stringify({
        search: location.search, rows: ${rows}, kinds: ${rowKinds}, history: history.length,
        authors: [...new Set([...document.querySelectorAll("ol > li a[data-author]")].map((a) => a.dataset.author))].join(","),
        current: ${chips}.filter((a) => a.getAttribute("aria-current") === "true").map((a) => a.getAttribute("aria-label") ?? a.textContent.trim()).join(","),
        chipAvatar: ${authorChip}?.querySelector("[aria-hidden]")?.textContent.trim() ?? null,
        chipText: ${authorChip}?.textContent.trim() ?? null,
        empty: document.querySelector("[data-empty]")?.textContent.trim() ?? null,
        vitals: document.querySelector('section[aria-labelledby="latest-vitals"] ul')?.textContent ?? null,
      })`),
    );
  const settle = (p, search) =>
    p
      .waitFor(
        `location.search === ${JSON.stringify(search)} && (${rows} > 0 || document.querySelector("[data-empty]"))`,
        8000,
        { quiet: true },
      )
      .then(() => sleep(300))
      .catch(() => undefined);
  /** Back to no filters: the author chip, then "All". */
  const clear = async (p) => {
    if (await p.evaluate(`!!${authorChip}`)) await p.press(authorChip);
    await p.waitFor(`!${authorChip}`, 8000);
    await p.press(`${chips}[0]`);
    await p.waitFor(`location.search === "" && ${rowKinds}.split(",").length > 1`, 8000);
  };
  /** Tap `name`'s author control on the first entry that has one; returns their id and the state after. */
  const filterBy = async (p, name) => {
    const id = await p.evaluate(`${authorLink(name)}?.dataset.author ?? ""`);
    const kind = new URLSearchParams(await p.evaluate("location.search")).get("kind");
    await tap(p, authorLink(name));
    await settle(p, kind ? `?kind=${kind}&author=${id}` : `?author=${id}`);
    return { id, after: await state(p) };
  };
  /** One tap on an author's control shows only their entries, with their chip. */
  const oneTap = async (p, at) => {
    const names = await p.evaluate(
      `[...document.querySelectorAll("ol > li")].map((li) => li.querySelector("a[data-author]")?.getAttribute("aria-label") ?? "none")`,
    );
    check(
      `${at}: every entry's author is a "Show only <name>'s entries" link`,
      names.length > 0 && names.every((n) => /^Show only .+'s entries$/.test(n)),
      [...new Set(names)].join(", "),
    );
    const { id, after } = await filterBy(p, AUTHOR);
    check(
      `${at}: tapping ${AUTHOR}'s control shows only their entries, with their chip`,
      id !== "" &&
        after.search === `?author=${id}` &&
        after.authors === id &&
        after.rows > 0 &&
        after.current === `All,By ${AUTHOR}: clear this filter` &&
        after.chipAvatar === "DC" &&
        after.chipText.includes(`By ${AUTHOR}`),
      `${after.search}, ${after.rows} rows, current "${after.current}", avatar "${after.chipAvatar}"`,
    );
    return id;
  };

  for (const [who, p] of users) {
    const at = `${who}, rows`;
    await step(`${at}: author, then kind, and each clear`, { smoke: who === "writer" }, async () => {
      const id = await oneTap(p, at);
      if (who !== "writer") return clear(p);
      await p.screenshot("phase2-author-chip");

      // A kind on top: both in the URL, both chips on.
      await tap(p, symptomIcon);
      await settle(p, `?kind=symptom&author=${id}`);
      const both = await state(p);
      check(
        `${at}: then a symptom's icon shows only that person's symptoms`,
        both.search === `?kind=symptom&author=${id}` &&
          both.kinds === "Symptom: " &&
          both.authors === id &&
          both.current === `Symptoms,By ${AUTHOR}: clear this filter`,
        `${both.search}, ${both.rows} rows, current "${both.current}"`,
      );

      // The author chip clears the author and keeps the kind; "All" clears the kind and keeps the author.
      await p.press(authorChip);
      await settle(p, "?kind=symptom");
      const kindOnly = await state(p);
      check(
        `${at}: the author chip clears the author and keeps the kind`,
        kindOnly.search === "?kind=symptom" && kindOnly.current === "Symptoms" && kindOnly.chipText === null,
        `${kindOnly.search}, current "${kindOnly.current}"`,
      );
      await filterBy(p, AUTHOR);
      await p.press(`${chips}[0]`);
      await settle(p, `?author=${id}`);
      const authorOnly = await state(p);
      check(
        `${at}: All clears the kind and keeps the author`,
        authorOnly.search === `?author=${id}` &&
          authorOnly.current === `All,By ${AUTHOR}: clear this filter` &&
          authorOnly.kinds.split(",").length > 1,
        `${authorOnly.search}, current "${authorOnly.current}"`,
      );
      await clear(p);
    });
    if (who !== "writer") continue;

    await step(`${at}: the re-tap, the page reset, vitals and the "with …" line`, async () => {
      // "Show older", then a filter: one page again, from the newest.
      const before = await state(p);
      await p.press(button("Show older entries"));
      await p.waitFor(`${rows} === 60`, 5000).catch(() => undefined);
      const { id, after } = await filterBy(p, AUTHOR);
      check(
        `${at}: after "Show older", a filter starts again with one page`,
        after.rows === 30 && (await p.evaluate(`!!${button("Show older entries")}`)),
        `${after.rows} rows`,
      );
      check(
        `${at}: latest vitals ignores the author filter`,
        !!after.vitals && after.vitals === before.vitals,
      );

      // The same author again: nothing changes, and no history entry is added.
      await tap(p, authorLink(AUTHOR));
      await sleep(600);
      const again = await state(p);
      check(
        `${at}: tapping the same author again changes nothing`,
        again.search === `?author=${id}` && again.rows === after.rows && again.history === after.history,
        `${again.search}, ${again.rows} rows`,
      );

      // The links query follows the filters: the caretaker's event still has its providers.
      await p.press(`${chips}.find((a) => a.textContent.trim() === "Events")`);
      await settle(p, `?kind=event&author=${id}`);
      const line = await withLineOf(p, "Primary care visit: Dr. Alvarez");
      check(
        `${at}: with both filters on, an event's "with …" line still shows`,
        line?.names.length === 2 && line.more === "+1",
        JSON.stringify(line),
      );
      await clear(p);
    });

    await step(`${at}: a filter with no matches says so`, async () => {
      // member@ wrote events but no symptoms: their control on an event, then the Symptoms chip.
      await p.press(`${chips}.find((a) => a.textContent.trim() === "Events")`);
      await settle(p, "?kind=event");
      const { id } = await filterBy(p, NO_SYMPTOMS);
      await p.press(`${chips}.find((a) => a.textContent.trim() === "Symptoms")`);
      await settle(p, `?kind=symptom&author=${id}`);
      const none = await state(p);
      check(
        `${at}: no matches names the filters, and the chips stay`,
        none.rows === 0 &&
          none.empty === `No symptoms by ${NO_SYMPTOMS} yet.` &&
          none.current === `Symptoms,By ${NO_SYMPTOMS}: clear this filter`,
        `"${none.empty}", current "${none.current}"`,
      );
      await p.screenshot("phase2-author-empty");
      await clear(p);
    });

    await step(`${at}: the author control by keyboard`, async () => {
      // Tab from the row's kind icon reaches its author control (past "More", if the text is long); Enter filters.
      const row = `${authorLink(AUTHOR)}.closest("li")`;
      const id = await p.evaluate(`${authorLink(AUTHOR)}.dataset.author`);
      await p.evaluate(`${row}.querySelector('a[aria-label^="Show only"]:not([data-author])').focus()`);
      let focused = "";
      for (let i = 0; i < 3 && !focused.startsWith("Show only Dev"); i++) {
        await key(p, "Tab", "Tab", 9);
        await sleep(150);
        focused = await p.evaluate(`document.activeElement?.getAttribute("aria-label") ?? ""`);
      }
      check(
        `${at}: Tab reaches the author control, named "Show only ${AUTHOR}'s entries"`,
        focused === `Show only ${AUTHOR}'s entries`,
        focused,
      );
      await p.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        text: "\r",
      });
      await p.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
      });
      await settle(p, `?author=${id}`);
      const entered = await state(p);
      check(
        `${at}: Enter on it shows only their entries`,
        entered.search === `?author=${id}` && entered.authors === id,
        entered.search,
      );
      await clear(p);
    });

    await step("writer, cards: the author's name", async () => {
      await setView(p, "Cards");
      const text = await p.evaluate(`${authorLink(AUTHOR)}?.textContent.trim() ?? ""`);
      check("writer, cards: the author's name is the control", text === AUTHOR, text);
      await oneTap(p, "writer, cards");
      await p.screenshot("phase2-author-cards");
      await clear(p);
      await setView(p, "Rows");
      await sleep(1500);
    });
  }

  await step("offline: both filters", async () => {
    const { page: o, proxy } = await offlineDevice();
    try {
      proxy.setOnline(false);
      await sleep(1000);
      const { id } = await filterBy(o, AUTHOR);
      await tap(o, symptomIcon);
      await settle(o, `?kind=symptom&author=${id}`);
      const both = await state(o);
      check(
        "offline: the author and the kind filter both work",
        both.search === `?kind=symptom&author=${id}` &&
          both.kinds === "Symptom: " &&
          both.authors === id &&
          both.rows > 0,
        `${both.search}, ${both.rows} rows`,
      );
      await clear(o);
    } finally {
      proxy.setOnline(true);
    }
  });
}

/**
 * Full width on large screens (timeline-polish slice 5): from `lg` the timeline
 * spans the window less its 16 px gutters, entry text stops at about 75ch, and
 * cards form a grid inside each day (two columns, three from `2xl`); at 420
 * nothing moved. Starts and ends at 420 wide, in rows, at the top.
 */
async function wideLayout(p) {
  const width = async (w) => {
    await p.send("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: 900,
      deviceScaleFactor: 1,
      mobile: w < 600,
    });
    await sleep(400);
  };
  const noScroll = async (w) =>
    check(
      `${w}: no horizontal page scroll`,
      await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`),
    );
  // The page's frame, each entry's box, and how wide the capped text is against its 75ch cap.
  const measure = () =>
    p.evaluate(`(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: Math.round(r.top), width: r.width, height: r.height }; };
      const days = [...document.querySelectorAll("section > ol")].map((ol) => ({
        list: box(ol), heading: box(ol.parentElement.querySelector("h3")), cards: [...ol.children].map(box) }));
      const lis = [...document.querySelectorAll("ol > li")];
      const texts = lis.flatMap((li) => [...li.querySelectorAll("p.break-words")]).map((el) => {
        const s = getComputedStyle(el);
        return { width: el.getBoundingClientRect().width, cap: parseFloat(s.maxWidth), em: parseFloat(s.maxWidth) / parseFloat(s.fontSize) };
      });
      const ends = lis.map((li) => { const r = li.getBoundingClientRect();
        const time = li.querySelector("time")?.getBoundingClientRect();
        const last = (li.querySelector('button[aria-label^="Actions"]') ?? li.lastElementChild).getBoundingClientRect();
        return { start: time ? time.left - r.left : null, end: r.right - last.right }; });
      return { main: box(document.querySelector("main")), inner: window.innerWidth, days, texts, ends };
    })()`);
  const spans = (m) =>
    Math.abs(m.main.left) < 1 &&
    Math.abs(m.main.width - m.inner) < 1 &&
    m.days.every((d) => Math.abs(d.list.left - 16) < 1 && Math.abs(d.list.right - (m.inner - 16)) < 1);
  // Cards in each day sit `columns` to a row: equal widths, row-mates at one top, a lone card one column wide.
  const grid = (m, columns) => {
    const column = (m.inner - 32 - 8 * (columns - 1)) / columns;
    return m.days.every((d) =>
      d.cards.every((c, i) => {
        const col = i % columns;
        const first = d.cards[i - col];
        return (
          Math.abs(c.width - column) < 1 &&
          Math.abs(c.left - (16 + col * (column + 8))) < 1 &&
          c.top === first.top
        );
      }),
    );
  };
  const capped = (m) => m.texts.every((t) => t.width <= t.cap + 0.5 && t.em > 28 && t.em < 50);
  const dayShape = (m) =>
    `${m.days.length} days of ${m.days.map((d) => d.cards.length).join(",")} entries, first list ${Math.round(m.days[0].list.left)}–${Math.round(m.days[0].list.right)}`;

  await p.evaluate(`window.scrollTo(0, 0)`);
  await step("1280: the full width, the text cap and the card grid", { smoke: true }, async () => {
    await width(1280);
    const rows = await measure();
    check("1280, rows: the timeline spans the window less its gutters", spans(rows), dayShape(rows));
    const widest = Math.max(...rows.texts.map((t) => t.width));
    const cap = Math.max(...rows.texts.map((t) => t.cap));
    check(
      "1280, rows: entry text stops at about 75ch, and the longest text reaches it",
      capped(rows) && widest >= cap - 1 && widest < rows.days[0].list.width - 200,
      `widest ${Math.round(widest)}px of a ${Math.round(cap)}px cap, in a ${Math.round(rows.days[0].list.width)}px list`,
    );
    check(
      "1280, rows: the time stays at the row's start, and the ⋯ at its end",
      rows.ends.every((e) => e.start !== null && e.start < 70 && e.end >= 0 && e.end <= 16),
      JSON.stringify(rows.ends.slice(0, 2)),
    );
    await noScroll(1280);
    await p.screenshot("phase2-wide-1280-rows");

    await setView(p, "Cards");
    await sleep(500);
    const cards = await measure();
    check("1280, cards: the timeline spans the window less its gutters", spans(cards), dayShape(cards));
    check(
      "1280, cards: two to a row under their day heading, a lone card one column wide",
      grid(cards, 2) && cards.days.some((d) => d.cards.length > 1),
      dayShape(cards),
    );
    const mates = cards.days.flatMap((d) =>
      d.cards.filter((_, i) => i % 2 === 0 && d.cards[i + 1]).map((c, i) => [c, d.cards[i * 2 + 1]]),
    );
    check(
      "1280, cards: a short card beside a tall one keeps its own height",
      mates.some(([a, b]) => Math.abs(a.height - b.height) > 8),
      `${mates.length} pairs`,
    );
    check("1280, cards: text is capped too", capped(cards));
    await noScroll(1280);
    await p.screenshot("phase2-wide-1280-cards");
    await setView(p, "Rows");
    await width(420);
  });

  await step(
    "wide: 1536, 1024, sticky headings, More and Less, the sheet, the confirm and Live now",
    async () => {
      // The sticky day heading spans the list and sticks, in both views at 1280.
      await width(1280);
      for (const view of ["Rows", "Cards"]) {
        if (view === "Cards") await setView(p, "Cards");
        await sleep(500);
        const m = await measure();
        // Into a day: its heading is held at the top of the window.
        const stuck = await p.evaluate(`(async () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const day = [...document.querySelectorAll("section > ol")].map((ol) => ol.parentElement)
          .find((s) => s.getBoundingClientRect().height > 120 && s.getBoundingClientRect().top + window.scrollY + 30 <= max);
        if (!day) return null;
        window.scrollTo(0, day.getBoundingClientRect().top + window.scrollY + 30);
        await new Promise((r) => setTimeout(r, 200));
        const h = day.querySelector("h3").getBoundingClientRect();
        return { top: h.top, moved: h.top - day.getBoundingClientRect().top, position: getComputedStyle(day.querySelector("h3")).position };
      })()`);
        check(
          `1280, ${view.toLowerCase()}: the day heading spans the list and sticks`,
          m.days.every((d) => d.heading.left <= d.list.left && d.heading.right >= d.list.right) &&
            !!stuck &&
            Math.abs(stuck.top) < 1 &&
            stuck.moved > 20,
          JSON.stringify(stuck),
        );
        await p.evaluate(`window.scrollTo(0, 0)`);
      }

      // Three to a row from 2xl; two at 1024 (lg).
      await width(1536);
      const xl = await measure();
      check(
        "1536, cards: three to a row, text capped",
        spans(xl) && grid(xl, 3) && capped(xl) && xl.days.some((d) => d.cards.length > 2),
        dayShape(xl),
      );
      await noScroll(1536);
      await p.screenshot("phase2-wide-1536-cards");
      await width(1024);
      const lg = await measure();
      check("1024, cards: two to a row", spans(lg) && grid(lg, 2), dayShape(lg));
      await noScroll(1024);

      // 420: one column, where it was before (cards 16…404 with 8 px between; rows inside the list's border).
      await width(420);
      const phoneCards = await measure();
      check(
        "420, cards: one column, the same boxes as before",
        phoneCards.days.every((d) =>
          d.cards.every(
            (c, i) =>
              Math.abs(c.left - 16) < 0.5 &&
              Math.abs(c.width - 388) < 0.5 &&
              (i === 0 || Math.abs(c.top - (d.cards[i - 1].top + d.cards[i - 1].height + 8)) <= 1),
          ),
        ),
        JSON.stringify(phoneCards.days[0].cards.slice(0, 2)),
      );
      await noScroll(420);
      await setView(p, "Rows");
      await sleep(500);
      const phoneRows = await measure();
      check(
        "420, rows: the same boxes as before",
        phoneRows.days.every((d) =>
          d.cards.every(
            (c, i) =>
              Math.abs(c.left - 17) < 0.5 &&
              Math.abs(c.width - 386) < 0.5 &&
              (i === 0 || Math.abs(c.top - (d.cards[i - 1].top + d.cards[i - 1].height)) <= 1),
          ),
        ),
        JSON.stringify(phoneRows.days[0].cards.slice(0, 2)),
      );
      await noScroll(420);

      // Rows at 1280: More and Less still work on long text.
      await width(1280);
      const more = await p.evaluate(`!!${button("More")}`);
      check("1280, rows: long text is clamped, with More", more);
      if (more) {
        await tap(p, button("More"));
        await sleep(300);
        const less = await p.evaluate(`!!${button("Less")}`);
        if (less) await tap(p, button("Less"));
        await sleep(300);
        check(
          "1280, rows: More expands and Less collapses",
          less && !(await p.evaluate(`!!${button("Less")}`)),
        );
      }
      await p.evaluate(`window.scrollTo(0, 0)`);

      // The entry sheet and the delete confirm at 1280: centred, over the wide page.
      const centred = (sel) =>
        p.evaluate(`(() => { const el = ${sel}; if (!el) return null; const r = el.getBoundingClientRect();
        return { off: Math.round(r.left + r.width / 2 - window.innerWidth / 2), width: Math.round(r.width), inside: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight }; })()`);
      await tap(p, `${rowOf("Symptom")}.querySelector("p")`);
      await p.waitFor(`document.querySelector("[role=dialog]")?.textContent.includes("Edit symptom")`, 5000);
      await sleep(400);
      const sheet = await centred(`document.querySelector("[role=dialog]")`);
      check(
        "1280: the entry sheet is a centred modal, not stretched",
        !!sheet && Math.abs(sheet.off) <= 2 && sheet.inside && sheet.width < 800,
        JSON.stringify(sheet),
      );
      await p.screenshot("phase2-wide-1280-sheet");
      await escape(p);
      await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000);

      await tap(p, `${rowOf("Note")}.querySelector('button[aria-label^="Actions"]')`);
      await p.waitFor(`document.querySelectorAll("[role=menuitem]").length > 0`, 5000);
      await tap(
        p,
        `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === "Delete")`,
      );
      await p.waitFor(`!!document.querySelector("dialog[open]")`, 5000);
      await sleep(400);
      const confirm = await centred(
        `document.querySelector("dialog[open]").firstElementChild ?? document.querySelector("dialog[open]")`,
      );
      check(
        "1280: the delete confirm is centred, not stretched",
        !!confirm && Math.abs(confirm.off) <= 2 && confirm.inside && confirm.width < 800,
        JSON.stringify(confirm),
      );
      await p.screenshot("phase2-wide-1280-confirm");
      await escape(p);
      await p.waitFor(`!document.querySelector("dialog[open]")`, 5000);

      // Live now at 1280: another member "writes" in a seeded note (its editors, set on the server and put back).
      const [docId, editors, caretaker] = psql(
        `SELECT d.id || '|' || d.editors::text || '|' || (SELECT id FROM "user" WHERE email = 'caretaker@example.com')
       FROM note_document d JOIN timeline_entry e ON e.id = d.id
       WHERE e.group_id = '${DEV_FAMILY}' AND e.kind = 'note' AND e.deleted_at IS NULL ORDER BY e.occurred_at DESC LIMIT 1`,
      ).split("|");
      const banner = `document.querySelector("[data-live-banner]")`;
      try {
        psql(
          `UPDATE note_document SET editors = editors || jsonb_build_object('${caretaker}', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) WHERE id = '${docId}'`,
        );
        const shown = await p.waitFor(`!!${banner}`, 30000).then(
          () => true,
          () => false,
        );
        const at = shown
          ? await p.evaluate(`(() => { const r = ${banner}.getBoundingClientRect(); const j = ${banner}.querySelector("a").getBoundingClientRect();
            return { left: r.left, right: r.right, height: r.height, join: r.right - j.right }; })()`)
          : null;
        check(
          "1280: the Live now banner spans the width in one line, Join at its end",
          !!at &&
            Math.abs(at.left - 16) < 1 &&
            Math.abs(at.right - 1264) < 1 &&
            at.height < 60 &&
            at.join > 0 &&
            at.join < 20,
          JSON.stringify(at),
        );
        await p.screenshot("phase2-wide-1280-live-now");
      } finally {
        psql(`UPDATE note_document SET editors = '${editors}'::jsonb WHERE id = '${docId}'`);
      }
      await p.waitFor(`!${banner}`, 30000).catch(() => undefined);
      await width(420);
      await p.evaluate(`window.scrollTo(0, 0)`);
    },
  );
}

const bM = await launch(9341);
// The viewer's browser only in full mode: smoke runs one role.
const bV = SMOKE ? null : await launch(9342);
const pages = [];
let offline = null;
try {
  const p = await signedIn(bM, "member", "member@example.com");
  pages.push(p);

  // Layout.
  const firstTop = await p.evaluate(`document.querySelector("ol > li").getBoundingClientRect().top`);
  check("first entry above the fold", firstTop < 900, `top ${Math.round(firstTop)}px`);
  const heights = await p.evaluate(
    `[...document.querySelectorAll("ol > li")].map((li) => li.getBoundingClientRect().height).sort((a, b) => a - b)`,
  );
  const median = heights[Math.floor(heights.length / 2)];
  check(
    "dense rows",
    median <= 72,
    `median row ${Math.round(median)}px, shortest ${Math.round(heights[0])}px`,
  );
  check(
    "no horizontal scroll",
    await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`),
  );
  check("first page is 30 entries", (await p.evaluate(rows)) === 30, `${await p.evaluate(rows)}`);
  // The day headings' stickiness, over rows and cards, is `dayHeadings` below.

  const vitalsShown = await p.evaluate(`document.body.innerText.match(/BP \\d+\\/\\d+/) !== null`);
  check("latest vitals strip shows", vitalsShown);

  const path = await p.evaluate("location.pathname");
  await step("Show older, More and Less, the ⋯ menu", async () => {
    check(
      "no live notes links or menu items anywhere",
      !(await p.evaluate(`/live notes/i.test(document.body.innerText)`)),
    );
    await p.press(button("Show older entries"));
    await p.waitFor(`${rows} === 60`, 5000).then(
      () => check("Show older adds a page (local)", true),
      async () => check("Show older adds a page (local)", false, `${await p.evaluate(rows)}`),
    );

    // More/Less toggles the text without opening the entry.
    const more = await p.evaluate(`!!${button("More")}`);
    check("long text is clamped, with More", more);
    if (more) {
      await tap(p, button("More"));
      await sleep(300);
      check(
        "More expands, and doesn't open the entry",
        (await p.evaluate(`!!${button("Less")}`)) &&
          (await p.evaluate(`location.pathname === ${JSON.stringify(path)}`)),
      );
      await tap(p, button("Less"));
      await sleep(300);
      check(
        "Less collapses, and doesn't open the entry",
        (await p.evaluate(`!${button("Less")}`)) &&
          (await p.evaluate(`location.pathname === ${JSON.stringify(path)}`)),
      );
    }

    // The ⋯ menu opens without opening the entry (which items each kind gets: entryActionItems.test.ts).
    const menuItems = `[...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent.trim()).join(",")`;
    await tap(p, `${rowOf("Note")}.querySelector('button[aria-label^="Actions"]')`);
    await p.waitFor(`document.querySelectorAll("[role=menuitem]").length > 0`, 5000);
    check(
      "⋯ on a note: Delete only, and the entry doesn't open",
      (await p.evaluate(menuItems)) === "Delete" &&
        (await p.evaluate(`location.pathname === ${JSON.stringify(path)}`)),
      await p.evaluate(menuItems),
    );
    await escape(p);
    await p.waitFor(`!document.querySelector("[role=menu]")`, 5000);
  });

  // Row taps, rows view, writer.
  await tapsOpenEntries(p, "writer", "rows", SMOKE ? ["Note"] : ["Note", "Event"]);
  await tap(p, `${rowOf("Symptom")}.querySelector("p")`);
  await p.waitFor(`document.querySelector("[role=dialog]")?.textContent.includes("Edit symptom")`, 5000).then(
    () => check("writer, rows: tapping a symptom opens its edit sheet", true),
    () => check("writer, rows: tapping a symptom opens its edit sheet", false),
  );
  await escape(p);
  await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000);

  await step("keyboard: a row's open link", async () => {
    // Keyboard: the row's open target is a named link; Enter opens it.
    const name = await p.evaluate(`${rowOf("Note")}.querySelector("a")?.getAttribute("aria-label") ?? ""`);
    check("keyboard: a note row has a named open link", /^Open .+ at /.test(name), name);
    await p.evaluate(`${rowOf("Note")}.querySelector("a").focus()`);
    await key(p, "Enter", "Enter", 13);
    await p.waitFor(`${ENTRY_URL}.test(location.pathname)`, 8000).then(
      () => check("keyboard: Enter on a row opens the entry", true),
      () => check("keyboard: Enter on a row opens the entry", false),
    );
    await p.evaluate("history.back()");
    await p.waitFor(`${rows} > 0 && !location.pathname.includes("/entries/")`, 10000);
    await sleep(300);
  });

  await step("cards: the view survives a reload, and a vital's tap", async () => {
    // The view survives a reload.
    await setView(p, "Cards");
    await sleep(1500);
    await p.goto(await p.evaluate("location.pathname"));
    await p.waitFor(`${rows} > 0`, 20000);
    const cardsAfter = await p.evaluate(`document.querySelector("ol")?.dataset.view === "cards"`);
    check("cards view survives a reload", cardsAfter, `url ${await p.evaluate("location.href")}`);
    await p.screenshot("phase2-cards");

    // Row taps, cards view, writer: one per frame (notes and events open the same way as in rows).
    await tapsOpenEntries(p, "writer", "cards", ["Note"]);
    await tap(p, `${rowOf("Vitals")}.querySelector("li")`);
    await p
      .waitFor(`document.querySelector("[role=dialog]")?.textContent.includes("Edit vitals")`, 5000)
      .then(
        () => check("writer, cards: tapping a vital opens its edit sheet", true),
        () => check("writer, cards: tapping a vital opens its edit sheet", false),
      );
    await escape(p);
    await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000);
    await setView(p, "Rows");
    await sleep(1500);
  });

  // The viewer: a note opens, a symptom does nothing, no ⋯ menu.
  const v = await step("viewer: row taps", async () => {
    const v = await signedIn(bV, "viewer", "viewer@example.com");
    pages.push(v);
    await tapsOpenEntries(v, "viewer", "rows", ["Note"]);
    const before = await v.evaluate("location.href");
    await tap(v, `${rowOf("Symptom")}.querySelector("p")`);
    await sleep(800);
    check(
      "viewer, rows: tapping a symptom does nothing",
      (await v.evaluate(`!document.querySelector("[role=dialog]")`)) &&
        (await v.evaluate("location.href")) === before,
    );
    check(
      "viewer, rows: no ⋯ menu",
      await v.evaluate(`!document.querySelector('ol button[aria-label^="Actions"]')`),
    );
    await v.screenshot("phase2-viewer");
    return v;
  });

  await kindIconFilters([["writer", p], ...(v ? [["viewer", v]] : [])]);
  await step("providers on notes and events", { smoke: true }, () => withLines(p));
  await step("day headings", () => dayHeadings(p));
  await step("the latest vitals line", () => latestVitalsLine(p));
  await authorFilters([["writer", p], ...(v ? [["viewer", v]] : [])], async () => {
    // Its own browser, behind a proxy that can be cut (CDP's offline doesn't cut PowerSync's stream).
    offline = { proxy: startProxy(9324) };
    offline.browser = await launch(9343, offline.proxy.args);
    // Not in `pages`: a cut connection logs errors of its own.
    const page = await signedIn(offline.browser, "offline", "caretaker@example.com");
    return { page, proxy: offline.proxy };
  });
  await wideLayout(p);

  // PowerSync warns when a full page load closes the previous page's database,
  // and its shared sync worker logs "Sync aborted" to every page when it stops
  // the sync for a page that closed (on a check build the next page is already
  // connected and gets it; B-38), and can fail its first connect right after a reset (a 401 while it
  // refetches the JWKS); a first visit can make Vite reload a route module.
  const noise =
    /error closing database connection|\[PowerSync\]: Sync aborted|\[PowerSync\]: Initial connect attempt|status of 401|Error loading route module|Failed to fetch dynamically imported module/;
  const errors = pages.flatMap((pg) => pg.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 500));
} catch (e) {
  console.log("ERROR", e.message);
  results.push(false);
} finally {
  bM.proc.kill();
  bV?.proc.kill();
  offline?.browser?.proc.kill();
  offline?.proxy.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
}
process.exit(results.every(Boolean) ? 0 : 1);
