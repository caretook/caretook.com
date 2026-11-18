import { launch, openPage, sleep } from "./cdp.mjs";
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
    `document.querySelector("ol")?.className.includes("space-y-2") === ${view === "Cards"}`,
    5000,
  );
}

/**
 * The kind icon as a filter (timeline-polish slice 1): for each user, in rows
 * and in cards. Each page starts and ends on the unfiltered timeline, in rows.
 * `users` is [who, page, canWrite][].
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

  for (const [who, p, canWrite] of users) {
    // These steps reload the page several times, and a full load while PowerSync
    // is syncing logs "Sync error" (the old page's connection closing): not ours.
    const errorsBefore = p.errors.length;
    const dropReloadNoise = () => {
      const mine = p.errors.splice(errorsBefore).filter((e) => !e.includes("[PowerSync]: Sync error"));
      p.errors.push(...mine);
    };
    for (const view of ["rows", "cards"]) {
      const at = `${who}, ${view}`;
      if (view === "cards") await setView(p, "Cards");
      const timeline = await p.evaluate("location.pathname");

      // The icon is a named link of its own in every row.
      const names = await p.evaluate(
        `[...document.querySelectorAll("ol > li")].map((li) => li.querySelector('a[aria-label^="Show only"]')?.getAttribute("aria-label") ?? "none")`,
      );
      const known = ["Show only notes", "Show only symptoms", "Show only events", "Show only vitals"];
      check(
        `${at}: every entry's icon is a "Show only <kind>" link`,
        names.length > 0 && names.every((n) => known.includes(n)),
        [...new Set(names)].join(", "),
      );

      // Tap a symptom's icon: only symptoms, in the URL, and the chip is current.
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

      // The same icon again: nothing changes (and no new history entry).
      await tap(p, icon("Symptom"));
      await sleep(800);
      const again = JSON.parse(await state(p));
      check(
        `${at}: tapping it again changes nothing`,
        JSON.stringify(again) === JSON.stringify(filtered),
        `${again.search}, ${again.rows} rows`,
      );

      // Elsewhere on a symptom's row: its edit sheet for writers, nothing for viewers.
      await tap(p, `${rowOf("Symptom")}.querySelector("p")`);
      if (canWrite) {
        await p
          .waitFor(`document.querySelector("[role=dialog]")?.textContent.includes("Edit symptom")`, 5000)
          .then(
            () => check(`${at}: a tap elsewhere on a symptom still opens its edit sheet`, true),
            () => check(`${at}: a tap elsewhere on a symptom still opens its edit sheet`, false),
          );
        await escape(p);
        await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000);
      } else {
        await sleep(800);
        check(
          `${at}: a tap elsewhere on a symptom still does nothing`,
          (await p.evaluate(`!document.querySelector("[role=dialog]")`)) &&
            (await p.evaluate("location.search")) === "?kind=symptom",
        );
      }

      // A reload keeps the filter.
      await p.goto(`${timeline}?kind=symptom`);
      await p.waitFor(`${rows} > 0`, 20000);
      await sleep(500);
      const reloaded = JSON.parse(await state(p));
      check(
        `${at}: a reload keeps the filter`,
        reloaded.search === "?kind=symptom" && reloaded.kinds === "Symptom: " && reloaded.chip === "Symptoms",
        `${reloaded.search}, ${reloaded.rows} rows, chip "${reloaded.chip}"`,
      );

      // Another kind's chip, then that kind's icon is the no-op; a tap elsewhere opens the entry, and Back keeps the filter.
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

      // "All" clears the kind.
      await clear(p).then(
        () => check(`${at}: All clears the kind`, true),
        async () => check(`${at}: All clears the kind`, false, await state(p)),
      );
      check(`${at}: All is the current chip`, (await p.evaluate(currentChip)) === "All");

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

      // Unknown values are ignored: everything shows, and All is current.
      await p.goto(`${timeline}?kind=medication&author=nobody`);
      await p.waitFor(`${rows} > 0`, 20000);
      await sleep(500);
      const unknown = JSON.parse(await state(p));
      check(
        `${at}: an unknown ?kind= and ?author= are ignored`,
        unknown.rows === 30 && unknown.kinds.split(",").length > 1 && unknown.chip === "All",
        `${unknown.rows} rows, chip "${unknown.chip}"`,
      );
      await p.goto(timeline);
      await p.waitFor(`${rows} > 0`, 20000);
      await sleep(500);
      if (view === "cards") {
        await p.screenshot(`phase2-kind-icon-${who}-cards`);
        await setView(p, "Rows");
        await sleep(1500);
      }
    }
    dropReloadNoise();
  }
}

/** Tap a note's and an event's text: each opens its page. Then back to the timeline. */
async function tapsOpenEntries(p, who, view) {
  const timeline = await p.evaluate("location.pathname");
  for (const kind of ["Note", "Event"]) {
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
  check('the newest day reads "Today"', labelOf(headings.today) === "Today", `${labelOf(headings.today)}`);
  check(
    'the day before reads "Yesterday"',
    labelOf(headings.yesterday) === "Yesterday",
    `${labelOf(headings.yesterday)}`,
  );
  const older = headings.all.filter((h) => h.key < headings.yesterday);
  const dated = /^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day, [A-Z][a-z]{2} (\d{1,2})(, \d{4})?$/;
  const wrong = older.filter((h) => {
    const m = dated.exec(h.text);
    const sameYear = h.key.slice(0, 4) === headings.today.slice(0, 4);
    return !m || Number(m[2]) !== Number(h.key.slice(8)) || !!m[3] === sameYear;
  });
  check(
    'older days read like "Monday, Nov 16"',
    older.length > 0 && wrong.length === 0,
    `${older.length} older, e.g. ${older[0]?.text}${wrong.length ? `; wrong: ${wrong.map((h) => h.text).join(" | ")}` : ""}`,
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

const bM = await launch(9341);
const bV = await launch(9342);
const pages = [];
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

  // Partway down the tallest day, so its heading is the one held (not one being pushed out by the next day's).
  await p.evaluate(`(() => { const days = [...document.querySelectorAll("section h3")].map((h) => h.parentElement.getBoundingClientRect());
    const day = days.reduce((a, b) => (b.height > a.height ? b : a));
    window.scrollTo(0, day.top + window.scrollY + day.height / 3); })()`);
  await sleep(200);
  const sticky = await p.evaluate(
    `[...document.querySelectorAll("section h3")].some((h) => { const t = h.getBoundingClientRect().top; return t >= 0 && t < 5; })`,
  );
  check("day header sticks while scrolling", sticky);
  // The header must cover the rows' ⋯ buttons as they scroll under it.
  const covered = await p.evaluate(`(() => {
    const h = [...document.querySelectorAll("section h3")].find((h) => { const t = h.getBoundingClientRect().top; return t >= 0 && t < 5; });
    if (!h) return null; const r = h.getBoundingClientRect();
    const top = document.elementFromPoint(r.right - 20, r.top + r.height / 2);
    return h.contains(top); })()`);
  check("day header stays above rows' buttons", covered === true);
  await p.evaluate(`window.scrollTo(0, 0)`);

  const vitalsShown = await p.evaluate(`document.body.innerText.match(/BP \\d+\\/\\d+/) !== null`);
  check("latest vitals strip shows", vitalsShown);
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
  const path = await p.evaluate("location.pathname");
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

  // The ⋯ menu opens without opening the entry; notes and events keep only Delete.
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
  await tap(p, `${rowOf("Symptom")}.querySelector('button[aria-label^="Actions"]')`);
  await p.waitFor(`document.querySelectorAll("[role=menuitem]").length > 0`, 5000);
  check("⋯ on a symptom: Edit and Delete", (await p.evaluate(menuItems)) === "Edit,Delete");
  await escape(p);
  await p.waitFor(`!document.querySelector("[role=menu]")`, 5000);

  // Row taps, rows view, writer.
  await tapsOpenEntries(p, "writer", "rows");
  await tap(p, `${rowOf("Symptom")}.querySelector("p")`);
  await p.waitFor(`document.querySelector("[role=dialog]")?.textContent.includes("Edit symptom")`, 5000).then(
    () => check("writer, rows: tapping a symptom opens its edit sheet", true),
    () => check("writer, rows: tapping a symptom opens its edit sheet", false),
  );
  await escape(p);
  await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000);

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

  await p.press(
    `[...document.querySelectorAll('nav[aria-label="Show entries"] a')].find((a) => a.textContent.includes("Symptom"))`,
  );
  await p.waitFor(`location.search.includes("kind=symptom")`);
  await sleep(500);
  const kinds = await p.evaluate(
    `[...document.querySelectorAll("ol > li")].map((li) => li.textContent).join("|")`,
  );
  const count = await p.evaluate(rows);
  check("Symptoms filter", count > 0 && !kinds.includes("BP "), `${count} rows`);
  await p.press(`[...document.querySelectorAll('nav[aria-label="Show entries"] a')][0]`);
  await p.waitFor(`!location.search.includes("kind=")`);

  // Vitals menu, then Esc closes the sheet.
  await p.press(
    `[...document.querySelectorAll('[aria-label="Add to the timeline"] button')].find((b) => b.textContent.includes("Vitals"))`,
  );
  await p.waitFor(`document.querySelectorAll("[role=menuitem]").length > 0`, 5000);
  check(
    "Vitals menu opens",
    true,
    `${await p.evaluate(`document.querySelectorAll("[role=menuitem]").length`)} types`,
  );
  await p.press(`document.querySelector("[role=menuitem]")`);
  await p.waitFor(`document.querySelector("[role=dialog]")`, 5000);
  check("a vital type opens the sheet", true);
  await sleep(300);
  await escape(p);
  await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000).then(
    () => check("Esc closes the sheet", true),
    () => check("Esc closes the sheet", false),
  );

  // The view survives a reload.
  await setView(p, "Cards");
  await sleep(1500);
  await p.goto(await p.evaluate("location.pathname"));
  await p.waitFor(`${rows} > 0`, 20000);
  const cardsAfter = await p.evaluate(`document.querySelector("ol")?.className.includes("space-y-2")`);
  check("cards view survives a reload", cardsAfter, `url ${await p.evaluate("location.href")}`);
  await p.screenshot("phase2-cards");

  // Row taps, cards view, writer.
  await tapsOpenEntries(p, "writer", "cards");
  await tap(p, `${rowOf("Vitals")}.querySelector("li")`);
  await p.waitFor(`document.querySelector("[role=dialog]")?.textContent.includes("Edit vitals")`, 5000).then(
    () => check("writer, cards: tapping a vital opens its edit sheet", true),
    () => check("writer, cards: tapping a vital opens its edit sheet", false),
  );
  await escape(p);
  await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000);
  await setView(p, "Rows");
  await sleep(1500);

  // The viewer: notes and events open, symptoms and vitals do nothing, no ⋯ menu.
  const v = await signedIn(bV, "viewer", "viewer@example.com");
  pages.push(v);
  for (const view of ["rows", "cards"]) {
    if (view === "cards") await setView(v, "Cards");
    await tapsOpenEntries(v, "viewer", view);
    const before = await v.evaluate("location.href");
    await tap(v, `${rowOf("Symptom")}.querySelector("p")`);
    await sleep(800);
    check(
      `viewer, ${view}: tapping a symptom does nothing`,
      (await v.evaluate(`!document.querySelector("[role=dialog]")`)) &&
        (await v.evaluate("location.href")) === before,
    );
    check(
      `viewer, ${view}: no ⋯ menu`,
      await v.evaluate(`!document.querySelector('ol button[aria-label^="Actions"]')`),
    );
  }
  await v.screenshot("phase2-viewer-cards");
  await setView(v, "Rows");
  await sleep(1500);

  await kindIconFilters([
    ["writer", p, true],
    ["viewer", v, false],
  ]);
  await dayHeadings(p);
  await latestVitalsLine(p);

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
  bV.proc.kill();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
}
process.exit(results.every(Boolean) ? 0 : 1);
