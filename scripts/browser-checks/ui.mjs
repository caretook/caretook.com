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
// closes only the menu).
//
// Slice 2: every sheet (add, edit, provider add and edit), popover (the time
// chip, the When field's calendar in a sheet and in the time chip), confirm
// dialog (the timeline's Delete, and the provider sheet's Delete, where Escape
// closes only the dialog), opened by tap and by keyboard: named, focus inside
// on open and back on the opener after Escape, themed; sheets fill the screen
// at 420 (B-73) and cover the tab bar. The chip groups (kind and provider type
// filters as links with aria-current, the event title suggestions as buttons),
// the field primitive's label and error (a symptom with no name), and the icon
// buttons' names (Close, Rows, Cards).
//
// Slice 6: settings, account (units, timeline layout, account) and group
// (details, members): the frame's nav or back link, each choice a named
// radiogroup (arrow keys move it), every field labelled, help and errors
// described.
//
// quick-fixes slice 15 (B-71): the date field fits at 360, 390 and 420 (sheets
// and the time chip), with its calendar inside the viewport.
//
// timeline-polish slice 6: the tooltip, on a row's author initials: opened by
// a real mouse hover and by keyboard focus, closed by moving away and Escape,
// the trigger's description (never its name), themed.
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
/** Enter as a keyboard types it (with its "\r" text, so a focused button or link activates natively too). */
const typedEnter = async (p) => {
  const base = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", ...base, text: "\r" });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
};
const escape = (p) => key(p, "Escape", "Escape", 27);
const down = (p) => key(p, "ArrowDown", "ArrowDown", 40);
const focusedIn = (sel) => `!!${sel} && ${sel}.contains(document.activeElement)`;
const isTrigger = (sel) => `document.activeElement === ${sel}`;

/**
 * After an Escape: wait (up to `ms`) until `closed` holds and focus is on
 * `target`. Closing and focus return are waited on together, never a fixed
 * sleep: React Aria restores focus a frame after the overlay unmounts, and
 * `ui/Sheet`'s backstop two frames after, which under load can be well past
 * a few hundred ms. True once both hold.
 */
const settlesOn = (p, closed, target, ms = 10000) =>
  p.waitFor(`(${closed}) && ${isTrigger(target)}`, ms, { quiet: true }).then(
    () => true,
    () => false,
  );

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
  check(
    `${label}: Escape closes it, and focus returns to the trigger`,
    await settlesOn(p, `!${MENU}`, trigger),
    await p.evaluate(ACTIVE),
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
  check(
    `${label}: keyboard Escape returns focus to the trigger`,
    await settlesOn(p, `!${MENU}`, trigger),
    await p.evaluate(ACTIVE),
  );
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

// ---- Sheets, popovers and dialogs (slice 2) ---------------------------------
const DIALOGS = `[...document.querySelectorAll('[role="dialog"], dialog[open]')]`;
const TOP = `${DIALOGS}.at(-1)`;
/** The top dialog's accessible name: aria-label, else the text of what labels it. */
const TOP_NAME = `(() => { const m = ${TOP}; if (!m) return "";
  return m.getAttribute("aria-label") || (m.getAttribute("aria-labelledby") ?? "").split(" ")
    .map((id) => { const el = document.getElementById(id); return el?.getAttribute("aria-label") || el?.textContent.trim() || ""; })
    .join(" ").trim(); })()`;
const lightnessOf = (start) => MENU_LIGHTNESS.replace(MENU, start);
const QUICK = (label) =>
  `[...document.querySelectorAll('[aria-label="Add to the timeline"] a')].find((a) => a.textContent.trim() === ${JSON.stringify(label)})`;
const SYMPTOM_ROW_LINK = `document.querySelector('main ol > li a[aria-label^="Edit symptom"]')`;
const TIME_CHIP = `document.querySelector('main header button[aria-label="Change when it happened"]')`;
const PICK = `document.querySelector('[role="dialog"] [aria-label="Pick a date"]')`;
const button = (text, within = "document") =>
  `[...${within}.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const ACTIVE = `document.activeElement?.outerHTML.slice(0, 160)`;
const count = (p) => p.evaluate(`${DIALOGS}.length`);

/**
 * A sheet, popover or dialog, opened from `trigger` by tap, then by keyboard
 * (focus, Enter): it is named `name`, focus moves into it, Escape closes it
 * (and only it), and focus returns to `trigger`. `sheet` adds the layout checks.
 */
async function overlay(p, label, trigger, { name, shot, scheme, sheet, width, key = typedEnter }) {
  for (const how of ["tap", "keyboard"]) {
    await p.waitFor(trigger, 30000);
    const before = await count(p);
    if (how === "tap") await p.tap(trigger);
    else {
      await p.evaluate(`${trigger}.focus()`);
      await key(p);
    }
    const opened = await p.waitFor(`${DIALOGS}.length === ${before + 1}`, 15000).then(
      () => true,
      () => false,
    );
    check(`${label}: ${how === "tap" ? "a tap" : "Enter"} opens it`, opened);
    if (!opened) return;
    await sleep(400);
    const n = await p.evaluate(TOP_NAME);
    check(`${label}: named`, name instanceof RegExp ? name.test(n) : n === name, n);
    check(`${label}: focus moves into it`, await p.evaluate(focusedIn(TOP)));
    if (how === "tap") {
      const l = await p.evaluate(lightnessOf(TOP));
      check(
        `${label}: a ${scheme} background`,
        l !== null && (scheme === "dark" ? l < 0.45 : l > 0.75),
        `lightness ${l}`,
      );
      if (sheet) {
        const g =
          await p.evaluate(`(async () => { let el = ${TOP}; while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
          await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
          const r = el.getBoundingClientRect(); const o = el.parentElement.getBoundingClientRect(); const vw = Math.round(o.width); const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(r.bottom, innerHeight) - 4);
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left - o.left), width: Math.round(r.width), height: Math.round(r.height), vw, cw: document.documentElement.clientWidth, vh: innerHeight, scrolls: getComputedStyle(el).overflowY === "auto", onTop: el.contains(hit) }; })()`);
        if (width < 640)
          check(
            `${label}: the full screen (0, 0, clientWidth, innerHeight), scrolling inside, above the tab bar`,
            g.top === 0 && g.left === 0 && g.width === g.cw && g.height === g.vh && g.scrolls && g.onTop,
            JSON.stringify(g),
          );
        else
          check(
            `${label}: a centred dialog`,
            g.bottom < g.vh && Math.abs(g.left * 2 + g.width - g.vw) <= 2 && g.onTop,
            JSON.stringify(g),
          );
        const close = await p.evaluate(`!!${TOP}.querySelector('button[aria-label="Close"]')`);
        check(`${label}: a Close button, named`, close);
      }
      await p.screenshot(`${PREFIX}-${shot}`);
    }
    await escape(p);
    const settled = await settlesOn(p, `${DIALOGS}.length === ${before}`, trigger);
    check(
      `${label}: Escape closes only it, and focus returns to the opener (${how})`,
      settled,
      `${await count(p)} of ${before} overlays open; focus ${await p.evaluate(ACTIVE)}`,
    );
  }
}

/** A chip group: its role and name, its chips, and the current one. */
async function chipGroup(p, label, sel, { tag, chipRole, current, shot }) {
  await p.waitFor(sel, 30000);
  const info =
    await p.evaluate(`(() => { const g = ${sel}; const chips = [...g.querySelectorAll(${JSON.stringify(chipRole)})];
    return { tag: g.tagName.toLowerCase(), n: chips.length, current: chips.filter((c) => c.getAttribute("aria-current") === "true").map((c) => c.textContent.trim()).join(","),
      pressed: chips.filter((c) => c.hasAttribute("aria-pressed")).length }; })()`);
  check(`${label}: a ${tag} of ${chipRole} chips`, info.tag === tag && info.n > 0, JSON.stringify(info));
  if (current !== undefined)
    check(`${label}: "${current}" is current`, info.current === current, info.current);
  else check(`${label}: no current or pressed chip`, info.current === "" && info.pressed === 0);
  await p.evaluate(`${sel}.scrollIntoView({ block: "center" })`);
  await sleep(150);
  await p.screenshot(`${PREFIX}-${shot}`);
}

async function slice2(p, width, scheme) {
  const tag = `${width} ${scheme}`;
  const shot = (name) => `${name}-${width}-${scheme}`;
  await p.goto(TIMELINE);
  await p.waitFor(`document.querySelectorAll("main ol > li").length > 0 && ${QUICK("Symptom")}`, 45000);
  await sleep(500);

  // Chips and icon buttons on the timeline.
  await chipGroup(p, `${tag} kind filter`, `document.querySelector('nav[aria-label="Show entries"]')`, {
    tag: "nav",
    chipRole: "a",
    current: "All",
    shot: shot("kind-chips"),
  });
  await p.tap(
    `[...document.querySelectorAll('nav[aria-label="Show entries"] a')].find((a) => a.textContent.trim() === "Symptoms")`,
  );
  const filtered = await p
    .waitFor(
      `location.search === "?kind=symptom" && document.querySelector('nav[aria-label="Show entries"] a[aria-current="true"]')?.textContent.trim() === "Symptoms"`,
      5000,
    )
    .then(
      () => true,
      () => false,
    );
  check(`${tag} kind filter: a tap on Symptoms filters, and it becomes current`, filtered);
  await p.tap(`document.querySelector('nav[aria-label="Show entries"] a')`);
  await p.waitFor(`location.search === ""`, 5000).catch(() => {});
  const toggles = await p.evaluate(
    `[...document.querySelectorAll('[role="group"][aria-label="Layout"] button')].map((b) => b.getAttribute("aria-label") + ":" + b.getAttribute("aria-pressed")).join(",")`,
  );
  check(
    `${tag} layout icon buttons: named, one pressed`,
    /^Rows:(true|false),Cards:(true|false)$/.test(toggles) && toggles.split("true").length === 2,
    toggles,
  );

  // Sheets: add (from the quick-add link) and edit (from a symptom row).
  await overlay(p, `${tag} add sheet`, QUICK("Symptom"), {
    name: "Add to the timeline",
    shot: shot("sheet-add"),
    scheme,
    sheet: true,
    width,
  });
  await overlay(p, `${tag} edit sheet`, SYMPTOM_ROW_LINK, {
    name: "Edit symptom",
    shot: shot("sheet-edit"),
    scheme,
    sheet: true,
    width,
  });

  // The field primitive: a symptom with no name, then the calendar popover inside the sheet.
  await p.tap(QUICK("Symptom"));
  await p.waitFor(`document.querySelector('[role="dialog"] input[name="symptomName"]')`, 15000);
  await sleep(300);
  await p.press(`document.querySelector('[role="dialog"] button[type="submit"]')`);
  await p
    .waitFor(
      `document.querySelector('[role="dialog"] input[name="symptomName"]')?.getAttribute("aria-invalid") === "true"`,
      5000,
    )
    .catch(() => {});
  const field =
    await p.evaluate(`(() => { const i = document.querySelector('[role="dialog"] input[name="symptomName"]');
    const label = document.querySelector('label[for="' + i.id + '"]')?.textContent.trim();
    const described = (i.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent.trim()).join(" ");
    return { label, invalid: i.getAttribute("aria-invalid"), described }; })()`);
  check(
    `${tag} field: labelled, and its error is invalid and described`,
    field.label === "Symptom" && field.invalid === "true" && field.described === "Name the symptom.",
    JSON.stringify(field),
  );
  await p.screenshot(`${PREFIX}-${shot("field-error")}`);
  await overlay(p, `${tag} sheet calendar`, PICK, {
    name: /\S/,
    shot: shot("sheet-calendar"),
    scheme,
    width,
  });
  check(`${tag} sheet calendar: the sheet stays open`, await p.evaluate(`!!${SHEET}`));
  await escape(p);
  await p.waitFor(`!${SHEET}`, 5000).catch(() => {});

  // The confirm dialog: the timeline's Delete, from a symptom row's ⋯ (by tap, then by keyboard).
  const trig = rowActions("symptom");
  for (const how of ["tap", "keyboard"]) {
    if (how === "tap") {
      await p.tap(trig);
      await p.waitFor(MENU, 5000);
      await sleep(200);
      await p.tap(`${ITEMS}.find((el) => el.textContent.trim() === "Delete")`);
    } else {
      await p.evaluate(`${trig}.focus()`);
      await enter(p);
      await p.waitFor(MENU, 5000);
      await sleep(200);
      await down(p);
      await sleep(100);
      await enter(p);
    }
    const open = await p.waitFor(`document.querySelector("dialog[open]")`, 5000).then(
      () => true,
      () => false,
    );
    await sleep(300);
    check(
      `${tag} confirm (${how}): opens, named`,
      open && (await p.evaluate(TOP_NAME)) === "Delete this entry?",
      await p.evaluate(TOP_NAME),
    );
    check(
      `${tag} confirm (${how}): focus moves into it`,
      await p.evaluate(focusedIn(`document.querySelector("dialog[open]")`)),
    );
    if (how === "tap") {
      const l = await p.evaluate(lightnessOf(`document.querySelector("dialog[open] .modal-box")`));
      check(
        `${tag} confirm: a ${scheme} background`,
        l !== null && (scheme === "dark" ? l < 0.45 : l > 0.75),
        `lightness ${l}`,
      );
      await p.screenshot(`${PREFIX}-${shot("confirm")}`);
    }
    await escape(p);
    check(
      `${tag} confirm (${how}): Escape closes it, focus back on the ⋯ button`,
      await settlesOn(p, `!document.querySelector("dialog[open]")`, trig),
      await p.evaluate(ACTIVE),
    );
  }

  // The popovers on the entry page: the time chip, and its calendar inside it.
  await p.evaluate(`window.scrollTo(0, 0)`);
  await p.press(NOTE_LINK);
  await p.waitFor(TIME_CHIP, 30000);
  await sleep(300);
  await overlay(p, `${tag} time chip`, TIME_CHIP, {
    name: "When it happened",
    shot: shot("time-chip"),
    scheme,
    width,
  });
  await p.tap(TIME_CHIP);
  await p.waitFor(PICK, 5000);
  await sleep(300);
  await overlay(p, `${tag} time chip calendar`, PICK, {
    name: /\S/,
    shot: shot("time-chip-calendar"),
    scheme,
    width,
  });
  check(`${tag} time chip calendar: the time popover stays open`, await p.evaluate(`!!${PICK}`));
  await escape(p);
  await p.waitFor(`!${PICK}`, 5000).catch(() => {});

  // Title suggestions on a new, unnamed event (nothing is saved until a change).
  await p.goto(`/app/groups/${DEV_FAMILY}/entries/new?kind=event`);
  await chipGroup(
    p,
    `${tag} title chips`,
    `document.querySelector('main header ul[aria-label="Suggested titles"]')`,
    {
      tag: "ul",
      chipRole: "li > button",
      shot: shot("title-chips"),
    },
  );

  // Providers: the type chips, the add sheet, and the edit sheet's Delete confirm.
  const providers = `/app/groups/${DEV_FAMILY}/providers`;
  await p.goto(providers);
  await chipGroup(
    p,
    `${tag} provider type filter`,
    `document.querySelector('main nav[aria-label="Show providers"]')`,
    {
      tag: "nav",
      chipRole: "a",
      current: "All",
      shot: shot("provider-chips"),
    },
  );
  await overlay(p, `${tag} provider add sheet`, `document.querySelector("main a[data-add-provider]")`, {
    name: "Add a provider",
    shot: shot("sheet-provider-add"),
    scheme,
    sheet: true,
    width,
  });
  const id = await p.evaluate(`document.querySelector("main [data-provider-id]")?.dataset.providerId`);
  await p.goto(`${providers}/${id}/edit`);
  await p.waitFor(`${SHEET} && ${button("Delete provider", SHEET)}`, 30000);
  await sleep(300);
  const sheetName = await p.evaluate(TOP_NAME);
  check(`${tag} provider edit sheet: named`, /^Edit /.test(sheetName), sheetName);
  await p.tap(button("Delete provider", SHEET));
  await p.waitFor(`document.querySelector("dialog[open]")`, 5000);
  await sleep(300);
  check(
    `${tag} provider delete confirm: named`,
    /^Delete .+\?$/.test(await p.evaluate(TOP_NAME)),
    await p.evaluate(TOP_NAME),
  );
  await p.screenshot(`${PREFIX}-${shot("provider-confirm")}`);
  await escape(p);
  check(
    `${tag} provider delete confirm: Escape closes only it, focus back on Delete provider`,
    await settlesOn(
      p,
      `!document.querySelector("dialog[open]") && !!${SHEET}`,
      button("Delete provider", SHEET),
    ),
    await p.evaluate(ACTIVE),
  );
  await escape(p);
  await p.waitFor(`!${SHEET}`, 5000).catch(() => {});
}

// ---- Settings (slice 6) ---------------------------------------------------------
const GROUP_SETTINGS = `/app/groups/${DEV_FAMILY}/settings`;
/** The accessible name of a radiogroup, from what labels it. */
const groupName = (g) =>
  `(document.getElementById(${g}.getAttribute("aria-labelledby") ?? "")?.textContent.trim() ?? "")`;
const RADIOGROUPS = `[...document.querySelectorAll('main [role="radiogroup"]')]`;
/** What a labelled control is called and described by: `label[for]`, then its description lines. */
const fieldOf = (sel) => `(() => { const i = ${sel}; if (!i) return null;
  const label = document.querySelector('label[for="' + i.id + '"]')?.textContent.trim();
  const described = (i.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean).map((id) => document.getElementById(id)?.textContent.trim()).join(" | ");
  return { label, invalid: i.getAttribute("aria-invalid"), described }; })()`;

/** Settings frame: at 1280 the side nav marks the page current; at 420 the page has a back link. */
async function settingsFrame(p, tag, width, listPath, page) {
  const frame = await p.evaluate(`({
    current: document.querySelector('nav[data-settings-nav] a[aria-current="page"]')?.getAttribute("href") ?? "",
    navShown: !!document.querySelector('nav[data-settings-nav]')?.offsetParent,
    back: [...document.querySelectorAll("main a")].some((a) => a.getAttribute("href") === ${JSON.stringify(listPath)} && a.offsetParent),
  })`);
  check(
    `${tag} settings frame (${page}): ${width < 768 ? "a back link, no side nav" : "the side nav, this page current"}`,
    frame.current.endsWith(`/${page}`) &&
      (width < 768 ? frame.back && !frame.navShown : frame.navShown && !frame.back),
    JSON.stringify(frame),
  );
}

async function settings(p, width, scheme) {
  const tag = `${width} ${scheme}`;
  const shot = (name) => `${name}-${width}-${scheme}`;

  // Units: one named choice per measure, each a radiogroup of joined radios with one chosen.
  await p.goto("/app/settings/units");
  await p.waitFor(`document.querySelector('main input[name="temperature"]')`, 30000);
  await sleep(300);
  const units = await p.evaluate(
    `${RADIOGROUPS}.map((g) => ${groupName("g")} + "=" + g.querySelectorAll("input:checked").length).join(",")`,
  );
  check(
    `${tag} units: four named choices, one option chosen in each`,
    units === "Temperature=1,Weight=1,Blood sugar=1,Fluid volume=1",
    units,
  );
  await settingsFrame(p, tag, width, "/app/settings", "units");
  // The arrow keys move the choice (native radios); nothing saves until Save.
  const temp = `[...document.querySelectorAll('main input[name="temperature"]')]`;
  const before = await p.evaluate(`${temp}.findIndex((i) => i.checked)`);
  await p.evaluate(`${temp}[${before}].focus()`);
  await key(p, "ArrowRight", "ArrowRight", 39);
  await sleep(100);
  const after = await p.evaluate(`${temp}.findIndex((i) => i.checked)`);
  check(
    `${tag} units: an arrow key moves the choice`,
    after !== before && after >= 0,
    `${before} → ${after}`,
  );
  await p.screenshot(`${PREFIX}-${shot("settings-units")}`);

  // Timeline layout: one choice named by the page's heading.
  await p.goto("/app/settings/timeline");
  await p.waitFor(`document.querySelector('main input[name="timelineView"]')`, 30000);
  await sleep(300);
  const layout = await p.evaluate(
    `${RADIOGROUPS}.map((g) => ${groupName("g")} + ":" + [...g.querySelectorAll("input")].map((i) => i.getAttribute("aria-label")).join("/")).join(",")`,
  );
  check(
    `${tag} timeline layout: one choice, named by the heading`,
    layout === "Timeline layout:Rows/Cards",
    layout,
  );
  await settingsFrame(p, tag, width, "/app/settings", "timeline");
  await p.screenshot(`${PREFIX}-${shot("settings-layout")}`);

  // Account: read-only details and Sign out.
  await p.goto("/app/settings/account");
  await p.waitFor(`document.querySelector('main [data-field="email"]')`, 30000);
  const account = await p.evaluate(`({
    email: document.querySelector('main [data-field="email"]')?.textContent.trim(),
    signOut: !!document.querySelector('main form[action="/sign-out"] button[type="submit"]'),
  })`);
  check(
    `${tag} account: the email and Sign out`,
    account.email === "member@example.com" && account.signOut,
    JSON.stringify(account),
  );
  await p.screenshot(`${PREFIX}-${shot("settings-account")}`);

  // Group details (member@ owns Dev Family): the group's name, labelled, with an error on the
  // field. (The recipient is edited on their profile now: profiles.mjs.)
  await p.goto(`${GROUP_SETTINGS}/details`);
  const NAME = `document.querySelector('main [data-section="group-details"] input[name="name"]')`;
  await p.waitFor(NAME, 30000);
  await sleep(300);
  await settingsFrame(p, tag, width, GROUP_SETTINGS, "details");
  const labels = await p.evaluate(
    `[...document.querySelectorAll('main input:not([type=hidden])')].map((i) => document.querySelector('label[for="' + i.id + '"]')?.textContent.trim() ?? "?").join(",")`,
  );
  check(`${tag} group details: every input has its label`, labels === "Name", labels);
  // A blank name is refused on the device (nothing is sent); leaving the page drops it.
  await p.evaluate(`(() => { const i = ${NAME};
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "");
    i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await p.press(`document.querySelector('main [data-section="group-details"] button[type="submit"]')`);
  await p.waitFor(`${NAME}?.getAttribute("aria-invalid") === "true"`, 10000).catch(() => {});
  const named = await p.evaluate(fieldOf(NAME));
  check(
    `${tag} group details: a blank name is invalid, described by its error`,
    named?.label === "Name" && named.invalid === "true" && named.described === "Enter a name.",
    JSON.stringify(named),
  );
  await p.screenshot(`${PREFIX}-${shot("settings-details-error")}`);

  // Members: a card of members, each role control named for its member.
  await p.goto(`${GROUP_SETTINGS}/members`);
  await p.waitFor(`document.querySelector('main [data-section="members"] li[data-member]')`, 30000);
  await sleep(300);
  const members = await p.evaluate(`({
    rows: document.querySelectorAll('main [data-section="members"] li[data-member]').length,
    selects: [...document.querySelectorAll('main [data-section="members"] select')].every((s) => /^Role for /.test(s.getAttribute("aria-label") ?? "")),
  })`);
  check(
    `${tag} members: listed, role controls named`,
    members.rows >= 3 && members.selects,
    JSON.stringify(members),
  );
  await settingsFrame(p, tag, width, GROUP_SETTINGS, "members");
  await p.screenshot(`${PREFIX}-${shot("settings-members")}`);
}

// ---- Tooltip (timeline-polish slice 6) --------------------------------------
const TOOLTIP = `document.querySelector('[role="tooltip"]')`;
const AUTHOR_INITIALS = `document.querySelector('main section > ol > li a[data-author]')`;

/**
 * The tooltip primitive, on a timeline row's author initials: a real mouse
 * hover opens it and moving away closes it; keyboard focus (Tab) opens it and
 * Escape closes it. It's the trigger's description, never its name, and its
 * background follows the theme.
 */
async function tooltip(p, width, scheme) {
  const tag = `${width} ${scheme}`;
  const shown = (want) =>
    p.waitFor(want ? `!!${TOOLTIP}` : `!${TOOLTIP}`, 3000, { quiet: true }).then(
      () => true,
      () => false,
    );
  const move = (point) => p.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await p.goto(TIMELINE);
  await p.waitFor(`document.querySelectorAll("main ol > li").length > 0`, 45000);
  if (await p.evaluate(`document.querySelector("main ol")?.dataset.view !== "rows"`)) {
    await p.press(`document.querySelector('[role="group"][aria-label="Layout"] button[aria-label="Rows"]')`);
    await p.waitFor(`document.querySelector("main ol")?.dataset.view === "rows"`, 5000);
  }
  await p.waitFor(AUTHOR_INITIALS, 10000);
  await p.evaluate(`window.scrollTo(0, 0)`);
  await sleep(300);
  await move({ x: 2, y: 890 });
  const point = await p.evaluate(
    `(() => { const r = ${AUTHOR_INITIALS}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
  );
  await move(point);
  const hovered = await shown(true);
  const info = hovered
    ? await p.evaluate(`(() => { const a = ${AUTHOR_INITIALS}, t = ${TOOLTIP};
        return { name: a.getAttribute("aria-label"), text: t.textContent.trim(), title: a.hasAttribute("title"),
          describes: (a.getAttribute("aria-describedby") ?? "").split(" ").includes(t.id),
          fits: t.getBoundingClientRect().left >= 0 && t.getBoundingClientRect().right <= window.innerWidth }; })()`)
    : null;
  check(
    `${tag} tooltip: a mouse hover opens it, as the trigger's description`,
    !!info &&
      /^Show only .+'s entries$/.test(info.name) &&
      info.describes &&
      !info.title &&
      info.fits &&
      info.text.endsWith(info.name.replace(/^Show only (.+)'s entries$/, "$1")),
    JSON.stringify(info),
  );
  const l = hovered ? await p.evaluate(lightnessOf(TOOLTIP)) : null;
  check(
    `${tag} tooltip: a ${scheme} background`,
    l !== null && (scheme === "dark" ? l < 0.45 : l > 0.75),
    `lightness ${l}`,
  );
  await p.screenshot(`${PREFIX}-tooltip-${width}-${scheme}`);
  await move({ x: 2, y: 890 });
  check(`${tag} tooltip: moving away closes it`, await shown(false));

  // Keyboard: Tab from the row's kind icon reaches the initials (past "More", if any).
  await p.evaluate(
    `${AUTHOR_INITIALS}.closest("li").querySelector('a[aria-label^="Show only"]:not([data-author])').focus()`,
  );
  let reached = false;
  for (let i = 0; i < 3 && !reached; i++) {
    await key(p, "Tab", "Tab", 9);
    await sleep(150);
    reached = await p.evaluate(isTrigger(AUTHOR_INITIALS));
  }
  check(`${tag} tooltip: keyboard focus opens it`, reached && (await shown(true)));
  await escape(p);
  check(
    `${tag} tooltip: Escape closes it, focus stays on the trigger`,
    (await shown(false)) && (await p.evaluate(isTrigger(AUTHOR_INITIALS))),
  );
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
      name: "group radios, then the recipient's profile, Group settings and New care group",
      test: (r) =>
        r.length >= 5 &&
        r.slice(0, -3).every((t) => t.startsWith("menuitemradio:")) &&
        /^menuitem:.+'s profile$/.test(r.at(-3)) &&
        r.at(-2) === "menuitem:Group settings" &&
        r.at(-1) === "menuitem:New care group",
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

  // The entry page's ⋯: the same items as the row's (an event adds Reschedule and Cancel event before Delete).
  await p.evaluate(`window.scrollTo(0, 0)`);
  await p.press(NOTE_LINK);
  await p.waitFor(PAGE_ACTIONS, 30000);
  await sleep(300);
  const kind = await p.evaluate(
    `${PAGE_ACTIONS}.getAttribute("aria-label").replace("Actions for this ", "")`,
  );
  await menu(p, `${tag} entry page ⋯ (${kind})`, PAGE_ACTIONS, {
    name: `Actions for this ${kind}`,
    items: kind === "event" ? "Reschedule,Cancel event,Delete" : "Delete",
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

  await slice2(p, width, scheme);
  await tooltip(p, width, scheme);
  await settings(p, width, scheme);
}

// ---- The date field on narrow phones (quick-fixes slice 15, B-71) -----------
// The symptom sheet's When, the Dose sheet's time and the entry page's time
// chip, at 360, 390 and 420 (and 1280 as before): no horizontal overflow on the
// page, the field's box inside its container and its popover or sheet, nothing
// clipped inside it, a 44 px tap target on "Pick a date", and the open calendar
// inside the viewport. Boxes are measured against documentElement.clientWidth.
const LAST_PICK = `[...document.querySelectorAll('[role="dialog"] [aria-label="Pick a date"]')].at(-1)`;
const FIELD_FIT = `(() => { const vw = document.documentElement.clientWidth; const b = ${LAST_PICK};
  const g = b.closest('[role="group"]'); const box = (el) => el.getBoundingClientRect();
  const [gr, fr, dr, br] = [box(g), box(g.parentElement), box(b.closest('[role="dialog"]')), box(b)];
  const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
  const hit = [[-21, 0], [0, -21], [0, 21]].every(([dx, dy]) => b.contains(document.elementFromPoint(cx + dx, cy + dy)));
  return { vw, page: document.documentElement.scrollWidth <= vw, inField: gr.left >= fr.left - 0.5 && gr.right <= fr.right + 0.5,
    inDialog: gr.left >= dr.left - 0.5 && gr.right <= dr.right + 0.5, inView: gr.left >= 0 && gr.right <= vw,
    unclipped: g.scrollWidth <= g.clientWidth, hit, group: [Math.round(gr.left), Math.round(gr.right)], dialog: [Math.round(dr.left), Math.round(dr.right)] }; })()`;
const CALENDAR_FIT = `(() => { const vw = document.documentElement.clientWidth; const grid = document.querySelector('[role="grid"]');
  const pop = grid?.closest('[role="dialog"]')?.parentElement; if (!pop) return null; const r = pop.getBoundingClientRect();
  return { vw, ok: r.left >= 0 && r.right <= vw && document.documentElement.scrollWidth <= vw, box: [Math.round(r.left), Math.round(r.right)] }; })()`;

async function dateFieldFits(p, tag) {
  const f = await p.evaluate(FIELD_FIT);
  check(
    `${tag}: no page overflow, the field inside its container and the dialog, nothing clipped`,
    f.page && f.inField && f.inDialog && f.inView && f.unclipped,
    JSON.stringify(f),
  );
  check(`${tag}: Pick a date takes a 44 px tap`, f.hit);
  await p.tap(LAST_PICK);
  const opened = await p.waitFor(`document.querySelector('[role="grid"]')`, 5000).then(
    () => true,
    () => false,
  );
  await sleep(400);
  const c = opened ? await p.evaluate(CALENDAR_FIT) : null;
  check(`${tag}: the open calendar is inside the viewport`, !!c?.ok, JSON.stringify(c));
  await escape(p);
  await p.waitFor(`!document.querySelector('[role="grid"]')`, 5000).catch(() => {});
  await sleep(200);
}

async function dateFit(p) {
  for (const width of [360, 390, 420, 1280]) {
    await p.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 800,
      deviceScaleFactor: 1,
      mobile: width < 640,
    });
    for (const kind of ["symptom", "dose"]) {
      await p.goto(`${TIMELINE}/new/${kind}`);
      await p.waitFor(LAST_PICK, 30000);
      await sleep(400);
      await dateFieldFits(p, `${width} date field (${kind} sheet)`);
    }
    await p.goto(`${TIMELINE}?kind=note`);
    await p.waitFor(NOTE_LINK, 30000);
    await p.press(NOTE_LINK);
    await p.waitFor(TIME_CHIP, 30000);
    await sleep(300);
    await p.tap(TIME_CHIP);
    await p.waitFor(LAST_PICK, 5000);
    await sleep(400);
    await dateFieldFits(p, `${width} date field (time chip)`);
    await p.screenshot(`${PREFIX}-date-fit-chip-${width}`);
    await escape(p);
    await p.waitFor(`!${LAST_PICK}`, 5000).catch(() => {});
  }
}

const browser = await launch(9491);
let p;
try {
  p = await openPage(browser, "ui");
  // Keep the page focused, as a real window would be: in headless Chrome the
  // page can lose focus (after a native <dialog> closes), and then nothing
  // returns focus anywhere.
  await p.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await p.signIn("member@example.com", PW);
  for (const width of [420, 1280])
    for (const scheme of ["light", "dark"]) {
      // A fresh client IP per pass. A check build rate-limits per IP, and
      // Better Auth's memory limiter only resets after 10 s with no request,
      // so one IP for all four passes can reach 100 session checks and get a
      // 429 (which signs the page out) whenever the run has no 10 s pause.
      const ip = () => Math.floor(Math.random() * 254) + 1;
      await p.send("Network.setExtraHTTPHeaders", {
        headers: { "x-forwarded-for": `10.${ip()}.${ip()}.${ip()}` },
      });
      await pass(p, width, scheme);
    }
  await p.send("Network.setExtraHTTPHeaders", {
    headers: { "x-forwarded-for": `10.9.${Date.now() % 250}.7` },
  });
  await p.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await dateFit(p);
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
