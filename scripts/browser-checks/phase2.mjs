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
    const known = ["Show only notes", "Show only symptoms", "Show only events", "Show only vitals"];
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
      // Scrolled into an older page, then a filter: one page again, from the newest.
      const before = await state(p);
      await p.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
      await p.waitFor(`${rows} >= 60`, 5000).catch(() => undefined);
      const { id, after } = await filterBy(p, AUTHOR);
      check(
        `${at}: after scrolling into older pages, a filter starts again with one page`,
        after.rows === 30 && (await p.evaluate(`!!document.querySelector("[data-older-sentinel]")`)),
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
      await p.evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`),
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
      const column = document.querySelector('[aria-labelledby="timeline-heading"]');
      return { main: box(document.querySelector("main")), inner: document.documentElement.clientWidth, cap: parseFloat(getComputedStyle(column).maxWidth), days, texts, ends };
    })()`);
  // The page spans the window; the entries' column starts at the gutter and stops at its cap (1024 px).
  const spans = (m) =>
    Math.abs(m.main.left) < 1 &&
    Math.abs(m.main.width - m.inner) < 1 &&
    Math.abs(m.cap - 1024) < 1 &&
    m.days.every(
      (d) => Math.abs(d.list.left - 16) < 1 && Math.abs(d.list.width - Math.min(m.inner - 32, m.cap)) < 1,
    );
  // Cards sit one to a row at every width: each as wide as its day's list, one under another.
  const oneColumn = (m) =>
    m.days.every((d) =>
      d.cards.every(
        (c, i) =>
          Math.abs(c.width - d.list.width) < 1 &&
          Math.abs(c.left - d.list.left) < 1 &&
          (i === 0 || c.top >= d.cards[i - 1].top + d.cards[i - 1].height),
      ),
    );
  const capped = (m) => m.texts.every((t) => t.width <= t.cap + 0.5 && t.em > 28 && t.em < 50);
  const dayShape = (m) =>
    `${m.days.length} days of ${m.days.map((d) => d.cards.length).join(",")} entries, first list ${Math.round(m.days[0].list.left)}–${Math.round(m.days[0].list.right)}`;

  await p.evaluate(`window.scrollTo(0, 0)`);
  await step(
    "1280: the full width, the capped column, the text cap and one column of cards",
    { smoke: true },
    async () => {
      await width(1280);
      const rows = await measure();
      check(
        "1280, rows: the page spans the window, the entries stop at 1024 px",
        spans(rows),
        dayShape(rows),
      );
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
      check(
        "1280, cards: the page spans the window, the entries stop at 1024 px",
        spans(cards),
        dayShape(cards),
      );
      check(
        "1280, cards: one to a row under their day heading",
        oneColumn(cards) && cards.days.some((d) => d.cards.length > 1),
        dayShape(cards),
      );
      check("1280, cards: text is capped too", capped(cards));
      await noScroll(1280);
      await p.screenshot("phase2-wide-1280-cards");
      await setView(p, "Rows");
      await width(420);
    },
  );

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

      // Still one column, and the entries' column stops at its cap, at 1536 and 1024.
      await width(1536);
      const xl = await measure();
      check(
        "1536, cards: one to a row in a 1024 px column, text capped",
        spans(xl) && oneColumn(xl) && capped(xl) && xl.days.every((d) => d.list.width < xl.inner - 400),
        dayShape(xl),
      );
      await noScroll(1536);
      await p.screenshot("phase2-wide-1536-cards");
      await width(1024);
      const lg = await measure();
      check("1024, cards: one to a row", spans(lg) && oneColumn(lg), dayShape(lg));
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
        return { off: Math.round(r.left + r.width / 2 - document.documentElement.clientWidth / 2), width: Math.round(r.width), inside: r.left >= 0 && r.right <= document.documentElement.clientWidth && r.top >= 0 && r.bottom <= window.innerHeight }; })()`);
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
            return { left: r.left, right: r.right, page: document.documentElement.clientWidth, height: r.height, join: r.right - j.right }; })()`)
          : null;
        check(
          "1280: the Live now banner spans the width in one line, Join at its end",
          !!at &&
            Math.abs(at.left - 16) < 1 &&
            Math.abs(at.right - (at.page - 16)) < 1 &&
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

/**
 * The author tooltip (timeline-polish slice 6): a row's initials show the
 * author's avatar and full name on hover and keyboard focus, as the link's
 * description (its name stays "Show only <name>'s entries"), above the sticky
 * day heading; moving away, Escape or Tab hides it; a touch tap filters and
 * shows none. Real mouse moves, keys and touches over CDP, at 1280 in rows.
 */
async function authorTooltip(p) {
  const TIP = `document.querySelector('[role="tooltip"]')`;
  // The first row's author control: right under its day's sticky heading.
  const LINK = `document.querySelector("section > ol > li a[data-author]")`;
  const centre = (sel) =>
    p.evaluate(
      `(() => { const r = ${sel}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
  const move = (point) => p.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  const shown = (ms = 3000) =>
    p.waitFor(`!!${TIP}`, ms, { quiet: true }).then(
      () => true,
      () => false,
    );
  const hidden = (ms = 3000) =>
    p.waitFor(`!${TIP}`, ms, { quiet: true }).then(
      () => true,
      () => false,
    );
  const path = await p.evaluate("location.pathname");
  await p.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await p.goto(path);
  await p.waitFor(`${rows} > 0 && !!${LINK}`, 30000);
  if ((await p.evaluate(`document.querySelector("ol")?.dataset.view`)) !== "rows") await setView(p, "Rows");
  await p.evaluate(`window.scrollTo(0, 0)`);
  await sleep(400);

  await step("author tooltip: hover on a row", { smoke: true }, async () => {
    await move({ x: 5, y: 890 });
    const before = await p.evaluate(`(() => { const a = ${LINK};
      return { name: a.getAttribute("aria-label"), titles: [a, ...a.querySelectorAll("*")].filter((el) => el.hasAttribute("title")).length,
        describedBy: a.getAttribute("aria-describedby") }; })()`);
    const name = before.name.replace(/^Show only (.+)'s entries$/, "$1");
    check(
      `the initials have no title, and no description before a hover`,
      before.titles === 0 && !before.describedBy,
      JSON.stringify(before),
    );
    await move(await centre(LINK));
    const open = await shown();
    const tip = open
      ? await p.evaluate(`(() => { const a = ${LINK}, t = ${TIP}; const r = t.getBoundingClientRect();
          const h = a.closest("section").querySelector("h3").getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { text: t.textContent.trim(), avatar: !!t.querySelector('[aria-hidden="true"]'),
            describes: (a.getAttribute("aria-describedby") ?? "").split(" ").includes(t.id),
            name: a.getAttribute("aria-label"), inList: !!t.closest("ol"),
            overHeading: r.bottom > h.top && r.top < h.bottom, onTop: t.contains(top) }; })()`)
      : null;
    check(
      `hovering ${name}'s initials shows a tooltip with the avatar and the full name`,
      open && tip.text.endsWith(name) && tip.avatar,
      JSON.stringify(tip),
    );
    check(
      `the tooltip is the link's description, and its name is unchanged`,
      !!tip && tip.describes && tip.name === `Show only ${name}'s entries`,
    );
    check(
      `the tooltip sits above the sticky day heading, outside the list`,
      !!tip && tip.overHeading && tip.onTop && !tip.inList,
      JSON.stringify(tip && { overHeading: tip.overHeading, onTop: tip.onTop, inList: tip.inList }),
    );
    await p.screenshot("phase2-author-tooltip");
    await move({ x: 5, y: 890 });
    check(`moving away hides it`, await hidden());
  });

  await step("author tooltip: keyboard focus, Escape and Tab", async () => {
    const focusFromIcon = async () => {
      await p.evaluate(
        `${LINK}.closest("li").querySelector('a[aria-label^="Show only"]:not([data-author])').focus()`,
      );
      for (let i = 0; i < 3; i++) {
        await key(p, "Tab", "Tab", 9);
        await sleep(150);
        if (await p.evaluate(`document.activeElement === ${LINK}`)) return true;
      }
      return false;
    };
    const reached = await focusFromIcon();
    check(`Tab reaches the initials and shows the tooltip`, reached && (await shown()));
    await escape(p);
    check(
      `Escape hides it, and focus and the URL stay`,
      (await hidden()) && (await p.evaluate(`document.activeElement === ${LINK} && location.search === ""`)),
    );
    await focusFromIcon();
    const again = await shown();
    await key(p, "Tab", "Tab", 9);
    check(`focus again shows it; Tab away hides it`, again && (await hidden()));
  });

  await step("author tooltip: a touch tap filters, with no tooltip", async () => {
    const id = await p.evaluate(`${LINK}.dataset.author`);
    const point = await centre(LINK);
    // A finger's tap (pointerType "touch"), each call with a limit so a stuck CDP call fails the step.
    const within = (ms, promise) =>
      Promise.race([
        promise,
        sleep(ms).then(() => Promise.reject(new Error("touch: no answer from Chrome"))),
      ]);
    const tapped = await within(
      5000,
      p.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 }),
    )
      .then(() =>
        within(5000, p.send("Input.synthesizeTapGesture", { ...point, gestureSourceType: "touch" })),
      )
      .then(
        () => "",
        (e) => e.message,
      );
    let tipSeen = false;
    for (let i = 0; i < 10; i++) {
      await sleep(100);
      if (await p.evaluate(`!!${TIP}`)) tipSeen = true;
    }
    const search = await p.evaluate("location.search");
    check(
      `a touch tap filters by the author and shows no tooltip`,
      !tapped && search === `?author=${id}` && !tipSeen,
      `${tapped || search}, tooltip ${tipSeen}`,
    );
    await within(5000, p.send("Emulation.setTouchEmulationEnabled", { enabled: false })).catch(() => {});
    await p.goto(path);
    await p.waitFor(`${rows} > 0`, 30000);
  });
  await p.send("Emulation.setDeviceMetricsOverride", {
    width: 420,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
}

/**
 * Infinite scroll (timeline-polish slice 7): scrolling loads older pages with
 * no button, down to "That's the beginning of the timeline", in rows (the
 * smoke block) and cards; each page is announced once in the polite status,
 * and the entries on screen don't move (nor lose a "with …" line) while one
 * loads. Then, in full mode: a filter starts again from the newest entry with
 * one page, a short filter ends at once, an empty one shows only its empty
 * state; an entry arriving at the top (written on the server, as another
 * device's upload would be) and its deletion leave what's on screen where it
 * is and keep the loaded pages; and offline, every page loads from the device.
 * The pure rules (the next limit, the end, the wording) are timelinePaging.test.ts.
 */
async function infiniteScroll(p, offlineDevice) {
  const END = "That's the beginning of the timeline";
  const LOADING = "Loading older…";
  const status = `document.querySelector("[data-older-entries] [role=status]")`;
  const liveCount = () =>
    Number(
      psql(`SELECT count(*) FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND deleted_at IS NULL`),
    );
  // Dev Family's timeline (the page may be on a sheet's URL here).
  const timeline = `/app/groups/${DEV_FAMILY}/timeline`;
  /** A fresh load of the unfiltered timeline: one page. */
  const fresh = async (pg) => {
    // Loading on scroll needs a rendered (visible) page: an earlier step can leave this tab hidden behind another.
    await pg.send("Page.bringToFront");
    await pg.goto(timeline);
    await pg.waitFor(`${rows} > 0`, 20000);
    await sleep(500);
  };
  /** Records the status's changes and, while each page loads, how far the last entry moved and whether a "with …" line went. */
  const record = (pg) =>
    pg.evaluate(`(() => {
      const log = [], moves = [];
      const st = () => ${status};
      let last = st()?.textContent ?? "", sampling = null;
      const withs = (s) => s.rowsAt.filter((li) => li.isConnected && li.querySelector("[data-with]")).length;
      const sample = () => {
        if (!sampling) return;
        sampling.max = Math.max(sampling.max, Math.abs(sampling.el.getBoundingClientRect().top - sampling.top));
        sampling.minWith = Math.min(sampling.minWith, withs(sampling));
        requestAnimationFrame(sample);
      };
      new MutationObserver(() => {
        const t = st()?.textContent ?? "";
        if (t === last) return;
        last = t;
        log.push(t);
        if (t === ${JSON.stringify(LOADING)}) {
          const rowsAt = [...document.querySelectorAll("ol > li")], el = rowsAt.at(-1);
          sampling = { el, rowsAt, top: el.getBoundingClientRect().top, max: 0 };
          sampling.withs = sampling.minWith = withs(sampling);
          requestAnimationFrame(sample);
        } else if (sampling) {
          moves.push({ max: sampling.max, withs: sampling.withs, minWith: sampling.minWith });
          sampling = null;
        }
      }).observe(document.querySelector("main"), { childList: true, subtree: true, characterData: true });
      window.__olderLog = { log, moves };
    })()`);
  /** Scroll to the end (never while a page loads, so the moves measured are the page's own) until the end message. */
  const toTheBeginning = async (pg) => {
    const started = Date.now();
    while (Date.now() - started < 60000) {
      const text = await pg.evaluate(`(() => {
        const t = ${status}?.textContent ?? "";
        if (t !== ${JSON.stringify(LOADING)}) window.scrollTo(0, document.documentElement.scrollHeight);
        return t;
      })()`);
      if (text === END) break;
      await sleep(300);
    }
    await pg.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
    await sleep(300);
    return JSON.parse(
      await pg.evaluate(`JSON.stringify((() => {
        const s = ${status}, r = s?.getBoundingClientRect();
        return { rows: ${rows}, text: s?.textContent ?? null, visible: !!r && r.height > 0 && r.bottom <= innerHeight,
          sentinel: !!document.querySelector("[data-older-sentinel]"), button: !!${button("Show older entries")},
          ...(window.__olderLog ?? {}) };
      })())`),
    );
  };
  const reachesTheBeginning = async (pg, at) => {
    await record(pg);
    const end = await toTheBeginning(pg);
    const total = liveCount();
    const pagesLoaded = Math.ceil(total / 30) - 1;
    check(
      `${at}: scrolling loads every page with no button, and ends with "${END}"`,
      end.rows === total && end.text === END && end.visible && !end.sentinel && !end.button,
      `${end.rows}/${total} rows, "${end.text}"`,
    );
    check(
      `${at}: each page is announced once, and the end once`,
      end.log.filter((t) => t === LOADING).length === pagesLoaded &&
        end.log.filter((t) => t === END).length === 1,
      JSON.stringify(end.log),
    );
    check(
      `${at}: while a page loads, the entries on screen don't move and keep their "with …" lines`,
      end.moves.length === pagesLoaded && end.moves.every((m) => m.max <= 1 && m.minWith === m.withs),
      JSON.stringify(end.moves),
    );
  };

  await step("infinite scroll: rows, to the beginning", { smoke: true }, async () => {
    await fresh(p);
    check("infinite scroll: a fresh load shows one page", (await p.evaluate(rows)) === 30);
    await reachesTheBeginning(p, "writer, rows");
    await p.screenshot("phase2-infinite-end");
  });

  await step("infinite scroll: cards, to the beginning", async () => {
    await setView(p, "Cards");
    await sleep(1500);
    await fresh(p);
    await reachesTheBeginning(p, "writer, cards");
    await setView(p, "Rows");
    await sleep(1500);
  });

  await step("infinite scroll: a filter starts again from the newest, with one page", async () => {
    await fresh(p);
    // Three pages down.
    for (let i = 0; i < 20 && (await p.evaluate(`${rows} < 90`)); i++) {
      await p.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
      await sleep(400);
    }
    await p.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight - 2 * innerHeight)`);
    await sleep(500);
    const vitalIcon = `[...document.querySelectorAll("ol > li")].find((li) => {
      const r = li.getBoundingClientRect();
      return r.top > 100 && r.bottom < innerHeight - 100 && li.querySelector(".sr-only")?.textContent === "Vitals: ";
    })?.querySelector('a[aria-label^="Show only"]:not([data-author])')`;
    const deep = await p.evaluate(`({ rows: ${rows}, icon: !!${vitalIcon} })`);
    await tap(p, vitalIcon);
    await p.waitFor(`location.search === "?kind=vital" && ${rows} > 0`, 8000).catch(() => undefined);
    await sleep(800);
    const newest = psql(
      `SELECT id FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND kind = 'vital' AND deleted_at IS NULL ORDER BY occurred_at DESC, id DESC LIMIT 1`,
    );
    const after = await p.evaluate(`({
      search: location.search, rows: ${rows},
      top: Math.round(document.querySelector('section[aria-labelledby="timeline-heading"]').getBoundingClientRect().top),
      first: document.querySelector("ol > li a[href*='/timeline/']")?.getAttribute("href") ?? "",
      sentinel: !!document.querySelector("[data-older-sentinel]") })`);
    check(
      "a vital's icon tapped three pages down shows the newest vital first, with one page",
      deep.rows >= 90 &&
        deep.icon &&
        after.search === "?kind=vital" &&
        after.rows === 30 &&
        after.top >= -1 &&
        after.first.includes(newest) &&
        after.sentinel,
      JSON.stringify({ deep, after }),
    );

    // Fewer than a page of events: the end at once, nothing left to load.
    await p.press(
      `[...document.querySelectorAll('nav[aria-label="Show entries"] a')].find((a) => a.textContent.trim() === "Events")`,
    );
    await p.waitFor(`location.search === "?kind=event" && ${rows} > 0`, 8000).catch(() => undefined);
    await sleep(800);
    const events = Number(
      psql(
        `SELECT count(*) FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND kind = 'event' AND deleted_at IS NULL`,
      ),
    );
    const short = await p.evaluate(
      `({ rows: ${rows}, text: ${status}?.textContent, sentinel: !!document.querySelector("[data-older-sentinel]") })`,
    );
    check(
      `a filter with fewer than 30 matches (${events} events) shows the end, and loads nothing more`,
      events < 30 && short.rows === events && short.text === END && !short.sentinel,
      JSON.stringify(short),
    );

    // An empty timeline: its empty state, not the end message (member@ wrote no symptoms).
    const memberId = psql(`SELECT id FROM "user" WHERE email = 'member@example.com'`);
    await p.goto(`${timeline}?kind=symptom&author=${memberId}`);
    await p.waitFor(`!!document.querySelector("[data-empty]")`, 20000).catch(() => undefined);
    const empty = await p.evaluate(
      `({ empty: !!document.querySelector("[data-empty]"), text: ${status}?.textContent ?? null })`,
    );
    check(
      "an empty timeline shows its empty state, not the end message",
      empty.empty && empty.text === "",
      JSON.stringify(empty),
    );
  });

  await step(
    "infinite scroll: an entry arriving at the top keeps your place and the loaded pages",
    async () => {
      await fresh(p);
      for (let i = 0; i < 20 && (await p.evaluate(`${rows} < 120`)); i++) {
        await p.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
        await sleep(400);
      }
      // Three pages down, where nothing more loads.
      await p.evaluate(
        `window.scrollTo(0, document.querySelectorAll("ol > li")[89].getBoundingClientRect().top + scrollY - 300)`,
      );
      await sleep(800);
      await p.evaluate(
        `window.__anchor = document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest("ol > li"), true`,
      );
      const place = () =>
        p.evaluate(`({ rows: ${rows}, top: Math.round(window.__anchor?.getBoundingClientRect().top ?? NaN), y: Math.round(scrollY),
        connected: !!window.__anchor?.isConnected })`);
      const before = await place();
      const tag = `P2-IS-${Date.now().toString(36)}`;
      const caretaker = psql(`SELECT id FROM "user" WHERE email = 'caretaker@example.com'`);
      const id = psql(
        `INSERT INTO timeline_entry (group_id, recipient_id, kind, occurred_at, time_zone, details, created_by, updated_by)
       SELECT group_id, id, 'symptom', now(), 'America/Los_Angeles', '{"name": "${tag}", "severity": 2}'::jsonb, '${caretaker}', '${caretaker}'
       FROM care_recipient WHERE group_id = '${DEV_FAMILY}' RETURNING id`,
      );
      try {
        const arrived = await p
          .waitFor(`document.querySelector("main").textContent.includes(${JSON.stringify(tag)})`, 30000, {
            quiet: true,
          })
          .then(
            () => true,
            () => false,
          );
        await sleep(500);
        const after = await place();
        check(
          "three pages down, an entry arriving at the top leaves what's on screen where it is",
          arrived && after.connected && Math.abs(after.top - before.top) <= 1 && after.rows >= before.rows,
          JSON.stringify({ arrived, before, after }),
        );
        psql(`UPDATE timeline_entry SET deleted_at = now() WHERE id = '${id}'`);
        await p
          .waitFor(`!document.querySelector("main").textContent.includes(${JSON.stringify(tag)})`, 30000, {
            quiet: true,
          })
          .catch(() => undefined);
        await sleep(500);
        const gone = await place();
        check(
          "…and its deletion too, keeping the loaded pages",
          gone.connected && Math.abs(gone.top - before.top) <= 1 && gone.rows === before.rows,
          JSON.stringify({ before, gone }),
        );
      } finally {
        psql(`UPDATE timeline_entry SET deleted_at = now() WHERE id = '${id}' AND deleted_at IS NULL`);
      }
    },
  );

  await step("infinite scroll: offline, every page loads from the device", async () => {
    const { page: o, proxy } = await offlineDevice();
    await fresh(o);
    proxy.setOnline(false);
    try {
      await sleep(1000);
      const end = await toTheBeginning(o);
      const total = liveCount();
      check(
        "offline: scrolling loads every page from the device",
        end.rows === total && end.text === END,
        `${end.rows}/${total} rows, "${end.text}"`,
      );
    } finally {
      proxy.setOnline(true);
    }
  });

  await fresh(p);
  await p.evaluate(`window.scrollTo(0, 0)`);
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
    await p.evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`),
  );
  check("first page is 30 entries", (await p.evaluate(rows)) === 30, `${await p.evaluate(rows)}`);
  // The day headings' stickiness, over rows and cards, is `dayHeadings` below.

  const vitalsShown = await p.evaluate(`document.body.innerText.match(/BP \\d+\\/\\d+/) !== null`);
  check("latest vitals strip shows", vitalsShown);

  const path = await p.evaluate("location.pathname");
  await step("scrolling adds a page, More and Less, the ⋯ menu", async () => {
    check(
      "no live notes links or menu items anywhere",
      !(await p.evaluate(`/live notes/i.test(document.body.innerText)`)),
    );
    await p.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
    await p.waitFor(`${rows} >= 60`, 5000).then(
      () => check("scrolling near the end adds a page (local)", true),
      async () => check("scrolling near the end adds a page (local)", false, `${await p.evaluate(rows)}`),
    );
    await p.evaluate(`window.scrollTo(0, 0)`);
    await sleep(300);

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
  /** A signed-in device behind a proxy that can be cut, opened once (CDP's offline doesn't cut PowerSync's stream). */
  const offlineDevice = async () => {
    if (!offline) {
      offline = { proxy: startProxy(9324) };
      offline.browser = await launch(9343, offline.proxy.args);
      // Not in `pages`: a cut connection logs errors of its own.
      offline.page = await signedIn(offline.browser, "offline", "caretaker@example.com");
    }
    return { page: offline.page, proxy: offline.proxy };
  };
  await authorFilters([["writer", p], ...(v ? [["viewer", v]] : [])], offlineDevice);
  await wideLayout(p);
  await authorTooltip(p);
  await infiniteScroll(p, offlineDevice);

  // PowerSync warns when a full page load closes the previous page's database,
  // and its shared sync worker logs "Sync aborted" to every page when it stops
  // the sync for a page that closed (on a check build the next page is already
  // connected and gets it; B-38), and can fail its first connect right after a reset (a 401 while it
  // refetches the JWKS); a full load while it syncs logs "Sync error" (the old
  // page's connection closing; infinite scroll's fresh loads); a first visit
  // can make Vite reload a route module.
  const noise =
    /error closing database connection|\[PowerSync\]: Sync aborted|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|status of 401|Error loading route module|Failed to fetch dynamically imported module/;
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
