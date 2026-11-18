import { launch, openPage, sleep } from "./cdp.mjs";
// The timeline checks, against the local (PowerSync) data: layout, filters,
// the sheet, the view toggle, and row taps (slice 5) in both views for a
// writer (member@) and a viewer (viewer@).
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

/** A real tap (mouse press and release) at the centre of an element, after scrolling it into view. */
async function tap(p, selector) {
  const rect = await p.evaluate(`(() => { const el = ${selector}; if (!el) return null;
    el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!rect) throw new Error(`nothing to tap: ${selector}`);
  await sleep(100);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await p.send("Input.dispatchMouseEvent", { type, ...rect, button: "left", clickCount: 1 });
  }
}
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
  await p.signIn(email, PW);
  await p.waitFor(`${rows} > 0`, 20000);
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

  await p.evaluate(`window.scrollTo(0, 1500)`);
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

  // PowerSync warns when a full page load closes the previous page's database.
  const noise = /error closing database connection/;
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
