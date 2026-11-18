import { launch, openPage, sleep } from "./cdp.mjs";
// The UI primitives (components PRD). Every menu in the app, at 420 and 1280
// wide, in light and dark: opened by a real tap and by keyboard (Enter, arrow
// keys, Escape), checked for its role and accessible name, its items, focus on
// open and return to the trigger on close, and a background that follows the
// theme. Screenshots: `<UI_SHOT_PREFIX>-<menu>-<width>-<scheme>.png` (default
// prefix `ui`; run with `UI_SHOT_PREFIX=ui-before` on a base for comparisons).
//
// Slice 1: the user menu (theme radios), the group menu (group radios), the
// entry actions menu on a note row, a symptom row and the entry page (the same
// items for the same kind), and the vital type menus (quick add, the add
// sheet's kind picker, and "Add a reading" inside the sheet, where Escape
// closes only the menu). Later slices append sheets, popovers, dialogs and chips.
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const PREFIX = process.env.UI_SHOT_PREFIX ?? "ui";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const TIMELINE = `/app/groups/${DEV_FAMILY}/timeline`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// ---- Selectors ---------------------------------------------------------------
const MENU = `document.querySelector('[role="menu"]')`;
const ITEMS = `[...document.querySelectorAll('[role="menu"] [role^="menuitem"]')]`;
const itemTexts = `${ITEMS}.map((el) => el.textContent.trim()).join(",")`;
const checkedTexts = `${ITEMS}.filter((el) => el.getAttribute("aria-checked") === "true").map((el) => el.textContent.trim()).join(",")`;
const itemRoles = `${ITEMS}.map((el) => el.getAttribute("role") + ":" + el.textContent.trim())`;
const USER = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
const GROUP = `document.querySelector('header [data-region="group"] button')`;
const rowActions = (kind) =>
  `document.querySelector('main ol > li button[aria-label^="Actions for ${kind} at"]')`;
const QUICK_VITALS = `[...document.querySelectorAll('[aria-label="Add to the timeline"] button')].find((b) => b.textContent.trim().startsWith("Vitals"))`;
const PAGE_ACTIONS = `document.querySelector('main header [data-region="actions"] button[aria-label^="Actions for this"]')`;
const NOTE_LINK = `document.querySelector('main ol > li a[href*="/entries/"][aria-label^="Open"]')`;
const SHEET = `document.querySelector('[role="dialog"]')`;
const SHEET_VITALS = `[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim().startsWith("Vitals"))`;
const ADD_READING = `[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "+ Add a reading")`;

/** The menu's accessible name: aria-label, else the text of what labels it. */
const MENU_NAME = `(() => { const m = ${MENU}; if (!m) return "";
  return m.getAttribute("aria-label") || (m.getAttribute("aria-labelledby") ?? "").split(" ")
    .map((id) => { const el = document.getElementById(id); return el?.getAttribute("aria-label") || el?.textContent.trim() || ""; })
    .join(" ").trim(); })()`;

/** Lightness (0–1) of the first opaque background at or above the menu: oklch from daisyUI 5, or rgb. */
const MENU_LIGHTNESS = `(() => {
  for (let el = ${MENU}; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (!bg || bg === "transparent" || /rgba\\(.*, 0\\)$/.test(bg)) continue;
    const ok = bg.match(/oklch\\(([\\d.]+)(%?)/);
    if (ok) return ok[2] ? Number(ok[1]) / 100 : Number(ok[1]);
    const rgb = bg.match(/rgba?\\(([\\d.]+),? ([\\d.]+),? ([\\d.]+)/);
    if (rgb) return (0.2126 * rgb[1] + 0.7152 * rgb[2] + 0.0722 * rgb[3]) / 255;
    return null;
  }
  return null;
})()`;

// ---- Input -------------------------------------------------------------------
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
const enter = (p) => key(p, "Enter", "Enter", 13);
const escape = (p) => key(p, "Escape", "Escape", 27);
const down = (p) => key(p, "ArrowDown", "ArrowDown", 40);
const focusedIn = (sel) => `!!${sel} && ${sel}.contains(document.activeElement)`;
const isTrigger = (sel) => `document.activeElement === ${sel}`;

/**
 * One menu, by tap then by keyboard. `items` (exact, comma-joined) or
 * `count`, `checked` (the checked radios), `name` (the menu's accessible
 * name, a string or RegExp).
 */
async function menu(p, label, trigger, { items, count, checked, name, shot, roles }) {
  // Tap: a real mouse press at the trigger's centre.
  await p.waitFor(trigger, 15000);
  await p.tap(trigger);
  const opened = await p.waitFor(MENU, 5000).then(
    () => true,
    () => false,
  );
  check(`${label}: a tap opens it`, opened);
  if (!opened) return;
  await sleep(250);
  const menuName = await p.evaluate(MENU_NAME);
  check(
    `${label}: role menu, named`,
    name instanceof RegExp ? name.test(menuName) : menuName === name,
    menuName,
  );
  const texts = await p.evaluate(itemTexts);
  if (items !== undefined) check(`${label}: items ${items}`, texts === items, texts);
  if (count !== undefined) {
    const n = await p.evaluate(`${ITEMS}.length`);
    check(`${label}: ${count} items`, n === count, texts);
  }
  if (checked !== undefined) {
    const c = await p.evaluate(checkedTexts);
    check(`${label}: ${checked} is the checked radio`, c.startsWith(checked) && !c.includes(","), c);
  }
  if (roles) {
    const r = await p.evaluate(itemRoles);
    check(`${label}: ${roles.name}`, roles.test(r), r.join(", "));
  }
  await p.screenshot(`${PREFIX}-${shot}`);
  await escape(p);
  const closed = await p.waitFor(`!${MENU}`, 5000).then(
    () => true,
    () => false,
  );
  await sleep(200);
  check(
    `${label}: Escape closes it, and focus returns to the trigger`,
    closed && (await p.evaluate(isTrigger(trigger))),
  );

  // Keyboard: Enter opens with focus on an item, an arrow moves it, Escape returns focus.
  await p.evaluate(`${trigger}.focus()`);
  await enter(p);
  const kOpened = await p.waitFor(MENU, 5000).then(
    () => true,
    () => false,
  );
  await sleep(250);
  const first = await p.evaluate(`document.activeElement?.getAttribute("role") ?? ""`);
  const firstText = await p.evaluate(`document.activeElement?.textContent.trim() ?? ""`);
  check(
    `${label}: Enter opens it with focus on an item`,
    kOpened && first.startsWith("menuitem"),
    `${first} ${firstText}`,
  );
  if ((await p.evaluate(`${ITEMS}.length`)) > 1) {
    await down(p);
    await sleep(150);
    const second = await p.evaluate(`document.activeElement?.textContent.trim() ?? ""`);
    check(
      `${label}: ArrowDown moves focus`,
      (await p.evaluate(focusedIn(MENU))) && second !== firstText,
      `${firstText} → ${second}`,
    );
  }
  await escape(p);
  await p.waitFor(`!${MENU}`, 5000).catch(() => {});
  await sleep(200);
  check(`${label}: keyboard Escape returns focus to the trigger`, await p.evaluate(isTrigger(trigger)));
}

/** The menu's background follows the theme (opened by tap, then closed). */
async function themed(p, label, trigger, scheme) {
  await p.tap(trigger);
  await p.waitFor(MENU, 5000);
  await sleep(200);
  const l = await p.evaluate(MENU_LIGHTNESS);
  check(
    `${label}: a ${scheme} background`,
    l !== null && (scheme === "dark" ? l < 0.45 : l > 0.75),
    `lightness ${l}`,
  );
  await escape(p);
  await p.waitFor(`!${MENU}`, 5000);
  await sleep(150);
}

async function pass(p, width, scheme) {
  const tag = `${width} ${scheme}`;
  const shot = (name) => `${name}-${width}-${scheme}`;
  await p.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 640,
  });
  await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await p.goto(TIMELINE);
  await p.waitFor(`document.querySelectorAll("main ol > li").length > 0 && ${GROUP}`, 45000);
  await sleep(500);

  await menu(p, `${tag} user menu`, USER, {
    name: "Account",
    items: "Settings,System,Light,Dark,Sign out",
    checked: "System",
    shot: shot("user"),
  });
  await themed(p, `${tag} user menu`, USER, scheme);
  await menu(p, `${tag} group menu`, GROUP, {
    name: "Care groups",
    checked: await p.evaluate(`${GROUP}.textContent.trim()`),
    roles: {
      name: "group radios, then Group settings",
      test: (r) =>
        r.length >= 3 &&
        r.slice(0, -1).every((t) => t.startsWith("menuitemradio:")) &&
        r.at(-1) === "menuitem:Group settings",
    },
    shot: shot("group"),
  });
  await themed(p, `${tag} group menu`, GROUP, scheme);

  await menu(p, `${tag} note row ⋯`, rowActions("note"), {
    name: /^Actions for note at /,
    items: "Delete",
    shot: shot("row-note"),
  });
  await menu(p, `${tag} symptom row ⋯`, rowActions("symptom"), {
    name: /^Actions for symptom at /,
    items: "Edit,Delete",
    shot: shot("row-symptom"),
  });
  await themed(p, `${tag} symptom row ⋯`, rowActions("symptom"), scheme);
  await menu(p, `${tag} quick-add Vitals`, QUICK_VITALS, {
    name: "Vital type",
    count: 10,
    shot: shot("quick-vitals"),
  });
  check(
    `${tag} quick-add Vitals: still on the timeline`,
    await p.evaluate(`location.pathname.endsWith("/timeline")`),
  );

  // The entry page's ⋯: the same items as the note row's.
  await p.evaluate(`window.scrollTo(0, 0)`);
  await p.press(NOTE_LINK);
  await p.waitFor(PAGE_ACTIONS, 30000);
  await sleep(300);
  const kind = await p.evaluate(
    `${PAGE_ACTIONS}.getAttribute("aria-label").replace("Actions for this ", "")`,
  );
  await menu(p, `${tag} entry page ⋯ (${kind})`, PAGE_ACTIONS, {
    name: `Actions for this ${kind}`,
    items: "Delete",
    shot: shot("entry-page"),
  });
  await themed(p, `${tag} entry page ⋯`, PAGE_ACTIONS, scheme);

  // The add sheet: the kind picker's Vitals menu, then "Add a reading" inside the sheet.
  await p.goto(`${TIMELINE}/new/symptom`);
  await p.waitFor(SHEET_VITALS, 30000);
  await sleep(300);
  await menu(p, `${tag} sheet kind Vitals`, SHEET_VITALS, {
    name: "Vital type",
    count: 10,
    shot: shot("sheet-vitals"),
  });
  // Choose the first type by keyboard: the sheet becomes a vitals form.
  await p.evaluate(`${SHEET_VITALS}.focus()`);
  await enter(p);
  await p.waitFor(MENU, 5000);
  await sleep(200);
  await enter(p);
  const chose = await p.waitFor(`!${MENU} && ${ADD_READING}`, 5000).then(
    () => true,
    () => false,
  );
  check(`${tag} sheet kind Vitals: Enter on a type chooses it`, chose);
  if (chose) {
    await menu(p, `${tag} sheet Add a reading`, ADD_READING, {
      name: "Vital type",
      count: 9,
      shot: shot("sheet-add-reading"),
    });
    check(`${tag} sheet Add a reading: Escape closed only the menu`, await p.evaluate(`!!${SHEET}`));
  }
  await escape(p);
  await p.waitFor(`!${SHEET}`, 5000).catch(() => {});
}

const browser = await launch(9491);
let p;
try {
  p = await openPage(browser, "ui");
  await p.signIn("member@example.com", PW);
  for (const width of [420, 1280]) for (const scheme of ["light", "dark"]) await pass(p, width, scheme);
  const thrown = p.errors.filter((e) => e.includes("exception]"));
  check("no uncaught exceptions", thrown.length === 0, thrown.join(" | "));
  if (p.errors.length) console.log(p.errors.join("\n"));
} catch (e) {
  console.log("FAIL ", e.message);
  results.push(false);
} finally {
  browser.proc.kill();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
