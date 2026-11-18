import { launch, openPage, sleep } from "./cdp.mjs";
// The timeline checks, against the local (PowerSync) data: layout, filters,
// the sheet, the view toggle, and row taps (slice 5) in both views for a
// writer (member@) and a viewer (viewer@). It picks rows by kind, not by
// seed position, so entries other checks add (or a live dot or Live now
// banner on them) don't change what it checks; it passes with or without a
// fresh `pnpm datastore:reset`.
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

  await dayHeadings(p);

  // PowerSync warns when a full page load closes the previous page's database,
  // and can fail its first connect right after a reset (a 401 while it
  // refetches the JWKS); a first visit can make Vite reload a route module.
  const noise =
    /error closing database connection|\[PowerSync\]: Initial connect attempt|status of 401|Error loading route module|Failed to fetch dynamically imported module/;
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
