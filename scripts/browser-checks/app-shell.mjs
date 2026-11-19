import { launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
// The /app frame (app-shell PRD): the header's regions and the user menu.
// Slice 1: Caretook, sync status and the avatar fit one row at 420 wide; the
// avatar shows initials and has a name; the menu opens by tap and keyboard,
// shows name and email, returns focus on Escape, and its Settings and Sign
// out items work. Slice 2: the theme choice (System, Light, Dark) applies at
// once, persists across reload with the attribute set before first paint,
// System follows prefers-color-scheme both ways, it works offline without a
// request, and storage that throws still renders (System). Slice 3: the group
// menu names the current group (its recipient), switches groups and marks the
// current one; `/app` goes back to the last group (also after a reload), falls
// back when that group is gone, and single-group users go straight to their
// timeline; no group menu off group routes; sign-out forgets the last group.
// Slice 4: the tab bar at 420 (Timeline current, nothing hidden behind it, an
// open EntrySheet over it, none on the entry page) and the header's section
// links at 1280. Later slices append their checks.
// Slice 5: group settings (owner, caretaker, viewer, invalid input, offline, a non-member's 404), as one block before the console check.
// Slice 6: the members list (role change seen live on a second device, owner-only and last-owner refusals, remove, leave), as the last block: it changes Dev Family's memberships and puts the seeds' back.
//
// Pure rules are left to their unit tests: where /app goes (resolveHomeGroup in
// lastGroup.test.ts), what each role may edit and the field messages
// (groupSettings.test.ts). SMOKE=1 runs member@'s core path only: the header,
// the user menu, the group menu, the last group, a theme, and Sign out.
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const TRIGGER = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
const MENU = `document.querySelector('[role="menu"]')`;
const item = (text) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;
const rows = `document.querySelectorAll("ol > li").length`;
const radio = (text) =>
  `[...document.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;
const checkedTheme = `[...document.querySelectorAll('[role="menuitemradio"][aria-checked="true"]')].map((el) => el.textContent.trim()).join(",")`;
const themeState = `({ attr: document.documentElement.dataset.theme ?? null, scheme: getComputedStyle(document.documentElement).colorScheme, saved: (() => { try { return localStorage.getItem("caretook:theme"); } catch { return "throws"; } })() })`;
const scheme = (p, value) =>
  p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] });
/** Records data-theme as <body> is inserted and at the first animation frame (before first paint). */
const FIRST_PAINT_PROBE = `(() => {
  const probe = (window.__themeProbe = {});
  new MutationObserver((_, obs) => {
    if (document.body) { probe.body = document.documentElement.dataset.theme ?? null; obs.disconnect(); }
  }).observe(document, { childList: true, subtree: true });
  requestAnimationFrame(() => {
    probe.frame = document.documentElement.dataset.theme ?? null;
    probe.frameBg = document.body ? getComputedStyle(document.body).backgroundColor : null;
  });
})()`;
const reload = async (p) => {
  await p.send("Page.reload", { ignoreCache: false });
  await sleep(300);
  await p.waitFor(`document.readyState === "complete"`, 30000);
};
const chooseTheme = async (p, label) => {
  await p.press(TRIGGER);
  await p.waitFor(radio(label), 5000);
  await p.press(radio(label));
  await p.waitFor(`!${MENU}`, 5000).catch(() => {});
  await sleep(200);
};

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
// Escape goes to the focused element, and React Aria moves focus into a menu or
// dialog only after it renders: on a fast (built) server the key can arrive
// first and miss it. So wait until the open one has focus.
const escape = async (p) => {
  await p
    .waitFor(
      `!document.querySelector('[role="menu"], [role="dialog"]') || document.activeElement?.closest('[role="menu"], [role="dialog"]')`,
      5000,
      { quiet: true },
    )
    .catch(() => undefined);
  await key(p, "Escape", "Escape", 27);
};
const down = (p) => key(p, "ArrowDown", "ArrowDown", 40);
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const DEV_FAMILY_2 = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";
const timelineOf = (groupId) => `/app/groups/${groupId}/timeline`;
const GROUP_TRIGGER = `document.querySelector('header [data-region="group"] button')`;
const groupItem = (text) =>
  `[...document.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent.includes(${JSON.stringify(text)}))`;
const lastGroupKeys = `Object.keys(localStorage).filter((k) => k.startsWith("caretook:lastGroup:"))`;
const focusedText = (p) => p.evaluate(`document.activeElement?.textContent.trim() ?? ""`);

/**
 * `p.signIn`, with a longer wait: the first /app load on a busy machine can
 * take 20 s or more. Unless `home`, goes on from the group list to Dev Family.
 */
async function signIn(p, email, { home = false } = {}) {
  await p.goto("/sign-in");
  await p.waitFor(`document.querySelector('input[name="email"]')`, 20000);
  await p.type(`document.querySelector('input[name="email"]')`, email);
  await p.type(`document.querySelector('input[name="password"]')`, PW);
  await p.press(`document.querySelector('form button[type="submit"]')`);
  await p.waitFor(`location.pathname.startsWith("/app")`, 60000).catch(async (e) => {
    const alert = await p.evaluate(`document.querySelector('[role="alert"]')?.textContent ?? ""`);
    throw alert ? new Error(`${email}: sign-in refused: ${alert}`) : e;
  });
  if (!home) await p.openDevFamily(60000);
}

const BAR = `document.querySelector('nav.dock[aria-label="Group sections"]')`;
const HEADER_NAV = `document.querySelector('header [data-region="sections"] nav[aria-label="Group sections"]')`;
const shown = (sel) =>
  `(() => { const el = ${sel}; return !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0; })()`;
const metrics = (p, width, mobile) =>
  p.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile });

/** Slice 4: the tab bar at 420, the header links at 1280, and no bar on the entry page. */
async function sections(p) {
  const timelinePath = await p.evaluate(`location.pathname`);
  const bar = await p.evaluate(`(() => {
    const bar = ${BAR};
    if (!bar) return null;
    const links = [...bar.querySelectorAll("a")];
    const r = bar.getBoundingClientRect();
    return {
      labels: links.map((a) => a.textContent.trim()).join(","),
      current: links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent.trim()).join(","),
      href: links[0]?.getAttribute("href"),
      top: r.top, bottom: r.bottom, height: innerHeight,
      headerNav: ${shown(HEADER_NAV)},
    };
  })()`);
  check(
    "420: a bottom tab bar (Timeline, Providers, Medications, Upcoming) with Timeline marked current",
    bar &&
      bar.labels === "Timeline,Providers,Medications,Upcoming" &&
      bar.current === "Timeline" &&
      bar.href === timelinePath,
    JSON.stringify(bar),
  );
  check(
    "420: the bar is at the bottom, and the header's section links are hidden",
    bar && Math.abs(bar.bottom - bar.height) < 2 && !bar.headerNav,
  );

  // The quick-add bar and the end of the page (the last entry, the end message) clear the bar.
  const quick = await p.evaluate(`(() => {
    const q = document.querySelector('[role="group"][aria-label="Add to the timeline"]');
    const r = q.getBoundingClientRect(), top = ${BAR}.getBoundingClientRect().top;
    return { bottom: r.bottom, top, clear: r.bottom <= top };
  })()`);
  check("420: the quick-add bar is clear of the tab bar", quick.clear, JSON.stringify(quick));
  // Scrolling to the end loads every older page (infinite scroll), down to the end message.
  const endStatus = `document.querySelector("[data-older-entries] [role=status]")`;
  for (let i = 0; i < 40; i++) {
    await p.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
    await sleep(300);
    if (await p.evaluate(`${endStatus}?.textContent === "That's the beginning of the timeline"`)) break;
  }
  await p.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
  await sleep(300);
  const end = await p.evaluate(`(() => {
    const top = ${BAR}.getBoundingClientRect().top;
    const last = [...document.querySelectorAll("ol > li")].at(-1).getBoundingClientRect().bottom;
    const status = ${endStatus};
    const section = document.querySelector('section[aria-labelledby="timeline-heading"]').getBoundingClientRect().bottom;
    const r = status.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 4);
    return { top, last, section, text: status.textContent, endBottom: r.bottom, hitInEnd: status.contains(hit) };
  })()`);
  check(
    "420: scrolled to the end, the last entry and the end message are above the bar, not under it",
    end.text === "That's the beginning of the timeline" &&
      end.last <= end.top &&
      end.endBottom <= end.top &&
      end.section <= end.top &&
      end.hitInEnd,
    JSON.stringify(end),
  );
  await p.screenshot("app-shell-tabbar-end");
  await p.evaluate(`window.scrollTo(0, 0)`);

  // An open EntrySheet (a bottom sheet on phones) covers the bar, not the other way round.
  await p.press(
    `[...document.querySelectorAll('[aria-label="Add to the timeline"] a')].find((b) => b.textContent.trim() === "Symptom")`,
  );
  await p.waitFor(`document.querySelector('[role="dialog"] button[type="submit"]')`, 10000);
  await sleep(400);
  const sheet = await p.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const submit = dialog.querySelector('button[type="submit"]');
    submit.scrollIntoView({ block: "end" });
    const s = submit.getBoundingClientRect();
    const b = ${BAR}.getBoundingClientRect();
    const atSubmit = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
    const atBar = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { submitInDialog: dialog.contains(atSubmit), barOnTop: ${BAR}.contains(atBar), submitBottom: s.bottom };
  })()`);
  check(
    "420: an open EntrySheet is over the tab bar, and its Save button isn't hidden",
    sheet.submitInDialog && !sheet.barOnTop,
    JSON.stringify(sheet),
  );
  await p.screenshot("app-shell-tabbar-sheet");
  await escape(p);
  await p.waitFor(`!document.querySelector('[role="dialog"]')`, 5000);

  // The entry page: no bar, no spacer, the editor gets the whole screen.
  await p.press(`document.querySelector('ol > li a[href*="/entries/"]')`);
  await p.waitFor(
    `location.pathname.includes("/entries/") && document.querySelector('[contenteditable="true"]')`,
    20000,
  );
  await sleep(300);
  const entry = await p.evaluate(
    `({ bar: !!${BAR}, spacer: !!document.querySelector("[data-tab-bar-spacer]"), headerCurrent: ${HEADER_NAV}?.querySelector("a")?.getAttribute("aria-current") })`,
  );
  check("entry page: no tab bar and no spacer", !entry.bar && !entry.spacer, JSON.stringify(entry));
  check(
    'entry page: the header link says it\'s inside Timeline (aria-current="true")',
    entry.headerCurrent === "true",
  );
  await p.goto(`${timelinePath.replace(/\/timeline$/, "")}/entries/new?kind=note`);
  await p.waitFor(`document.querySelector('[contenteditable="true"]')`, 20000);
  check("new entry: no tab bar", !(await p.evaluate(`!!${BAR}`)));

  // 1280 wide: no bar, the header's links instead.
  await p.goto(timelinePath);
  await p.waitFor(`${rows} > 0`, 30000);
  await metrics(p, 1280, false);
  await sleep(400);
  const wide = await p.evaluate(`(() => {
    const nav = ${HEADER_NAV};
    const links = nav ? [...nav.querySelectorAll("a")] : [];
    return {
      bar: ${shown(BAR)},
      spacer: ${shown(`document.querySelector("[data-tab-bar-spacer]")`)},
      headerNav: ${shown(HEADER_NAV)},
      labels: links.map((a) => a.textContent.trim()).join(","),
      current: links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent.trim()).join(","),
    };
  })()`);
  check("1280: no tab bar (and no spacer)", !wide.bar && !wide.spacer, JSON.stringify(wide));
  check(
    "1280: the header shows the section links, Timeline current",
    wide.headerNav &&
      wide.labels === "Timeline,Providers,Medications,Upcoming" &&
      wide.current === "Timeline",
    JSON.stringify(wide),
  );
  await p.screenshot("app-shell-sections-wide");
  await metrics(p, 420, true);
  await sleep(300);
}

const pages = [];
const b = await launch(9471);
const browsers = [b];
try {
  // 1. member@ on the timeline, 420 wide.
  const A = await openPage(b, "member");
  pages.push(A);
  await signIn(A, "member@example.com", { home: true });
  // A fresh device remembers no group, and member@ is in two: the list.
  const list = await A.waitFor(
    `location.pathname === "/app" && document.querySelectorAll('main a[href$="/timeline"]').length === 2`,
    40000,
  )
    .then(() => true)
    .catch(() => false);
  check("/app: two groups and none remembered shows the list", list);
  await A.openDevFamily(40000);
  await A.waitFor(`${rows} > 0`, 40000);
  await A.waitFor(TRIGGER, 10000);
  await sleep(500);

  const layout = await A.evaluate(`(() => {
    const header = document.querySelector("body header");
    const brand = header.querySelector('[data-region="group"] a');
    const avatar = ${TRIGGER};
    const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    return {
      height: header.getBoundingClientRect().height,
      brand: brand?.textContent.trim(),
      sameRow: Math.abs(mid(brand) - mid(avatar)) < 4,
      right: avatar.getBoundingClientRect().right,
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      status: !!header.querySelector('[data-region="status"] [role="status"]'),
      regions: [...header.querySelectorAll("[data-region]")].map((el) => el.dataset.region).join(","),
    };
  })()`);
  check(
    "header: Caretook, sync status and avatar on one row at 420 wide",
    layout.brand === "Caretook" && layout.sameRow && layout.status && layout.height <= 72,
    JSON.stringify(layout),
  );
  check(
    "header: nothing overflows the window",
    layout.right <= layout.width && layout.scroll <= layout.width,
    `${layout.right} / ${layout.scroll} / ${layout.width}`,
  );
  check(
    "header: the frame's regions are in place",
    layout.regions === "group,sections,search,status,user",
    layout.regions,
  );
  const settingsLink = await A.evaluate(
    `[...document.querySelectorAll("header a, header button")].some((el) => el.textContent.trim() === "Settings" || el.textContent.trim() === "Sign out")`,
  );
  check("header: no loose Settings or Sign out controls", !settingsLink);

  const avatar = await A.evaluate(
    `(() => { const b = ${TRIGGER}; return { label: b.getAttribute("aria-label"), text: b.textContent.trim() }; })()`,
  );
  check("avatar: initials for Dev Member", avatar.text === "DM", avatar.text);
  check("avatar: accessible name", avatar.label === "Account menu for Dev Member", avatar.label);

  // 1b. Sections (slice 4), 420 wide: the tab bar, nothing hidden behind it.
  await step("sections: the tab bar and the header's links", () => sections(A));

  // 2. Keyboard: Enter opens, focus moves into the menu, arrows move, Escape closes and returns focus.
  await step("the user menu by keyboard", async () => {
    await A.evaluate(`${TRIGGER}.focus()`);
    await enter(A);
    const opened = await A.waitFor(MENU, 5000)
      .then(() => true)
      .catch(() => false);
    check("keyboard: Enter opens the menu", opened);
    const header = await A.evaluate(`${MENU}?.textContent ?? ""`);
    check(
      "menu: shows the name and email",
      header.includes("Dev Member") && header.includes("member@example.com"),
    );
    await sleep(200);
    const first = await focusedText(A);
    await down(A);
    await sleep(100);
    const second = await focusedText(A);
    check(
      "keyboard: focus is on a menu item, and arrows move it",
      first === "Settings" && second === "System",
      `${first} → ${second}`,
    );
    const headerFocusable = await A.evaluate(
      `[...${MENU}.querySelectorAll('[role="menuitem"]')].some((el) => el.textContent.includes("member@example.com"))`,
    );
    check("menu: the name and email aren't an item", !headerFocusable);
    await escape(A);
    await A.waitFor(`!${MENU}`, 5000);
    await sleep(200);
    check(
      "keyboard: Escape closes, and focus returns to the avatar",
      await A.evaluate(`document.activeElement === ${TRIGGER}`),
    );
  });

  // 3. Tap: open, Settings navigates.
  await A.press(TRIGGER);
  await A.waitFor(item("Settings"), 5000);
  await A.screenshot("app-shell-menu");
  await A.press(item("Settings"));
  // Settings loads online (me.get), which can be slow on a busy machine.
  const toSettings = await A.waitFor(`location.pathname === "/app/settings"`, 30000)
    .then(() => true)
    .catch(() => false);
  check("tap: Settings goes to /app/settings", toSettings);
  await A.waitFor(TRIGGER, 10000);
  check("settings: the frame's header is still there", await A.evaluate(`!!${TRIGGER}`));
  check(
    "settings: no group menu off group routes",
    await A.evaluate(
      `!${GROUP_TRIGGER} && document.querySelector('header [data-region="group"]').textContent.trim() === "Caretook"`,
    ),
  );

  // 3b. The group menu (slice 3).
  await A.goto(timelineOf(DEV_FAMILY));
  await A.waitFor(`${rows} > 0 && ${GROUP_TRIGGER}`, 30000);
  const groupName = (p) => p.evaluate(`${GROUP_TRIGGER}?.textContent.trim() ?? ""`);
  const devName = await groupName(A);
  check("group menu: shows Grandma Pat on Dev Family's timeline", devName === "Grandma Pat", devName);
  await A.press(GROUP_TRIGGER);
  await A.waitFor(groupItem("Grandpa Lou"), 5000);
  const marks = await A.evaluate(
    `[...document.querySelectorAll('[role="menuitemradio"]')].map((el) => el.textContent.trim() + "=" + el.getAttribute("aria-checked")).join(", ")`,
  );
  check(
    "group menu: lists both groups, the current one checked",
    marks.includes("Grandma Pat") &&
      /Grandma Pat[^,]*=true/.test(marks) &&
      /Grandpa Lou[^,]*=false/.test(marks),
    marks,
  );
  await A.screenshot("app-shell-groups");
  await A.press(groupItem("Grandpa Lou"));
  const switched = await A.waitFor(
    `location.pathname === ${JSON.stringify(timelineOf(DEV_FAMILY_2))} && ${rows} > 0`,
    15000,
  )
    .then(() => true)
    .catch(() => false);
  check("group menu: one tap switches to Dev Family 2's timeline", switched);
  await A.waitFor(`${GROUP_TRIGGER}?.textContent.trim() === "Grandpa Lou"`, 5000).catch(() => undefined);
  const louName = await groupName(A);
  check("group menu: shows Grandpa Lou on its timeline", louName === "Grandpa Lou", louName);
  const remembered = await A.evaluate(
    `localStorage.getItem("caretook:lastGroup:" + window.caretookSync.userId)`,
  );
  check("a group route remembers its group", remembered === DEV_FAMILY_2, remembered);
  await A.press(GROUP_TRIGGER);
  await A.waitFor(groupItem("Grandpa Lou"), 5000);
  check(
    "group menu: now marks Grandpa Lou",
    await A.evaluate(
      `${groupItem("Grandpa Lou")}.getAttribute("aria-checked") === "true" && ${groupItem("Grandma Pat")}.getAttribute("aria-checked") === "false"`,
    ),
  );
  await escape(A);
  await A.waitFor(`!${MENU}`, 5000);

  // /app goes back to the last group: by the Caretook link, then after a reload.
  await A.press(`document.querySelector('header [data-region="group"] a')`);
  const back = await A.waitFor(
    `location.pathname === ${JSON.stringify(timelineOf(DEV_FAMILY_2))} && ${rows} > 0`,
    15000,
  )
    .then(() => true)
    .catch(() => false);
  check("/app: goes to the last group (Caretook link)", back);
  await A.goto("/app");
  const reloaded = await A.waitFor(`location.pathname === ${JSON.stringify(timelineOf(DEV_FAMILY_2))}`, 20000)
    .then(() => true)
    .catch(() => false);
  check("/app: goes to the last group after a reload", reloaded);

  // A remembered group you're no longer in falls back to the list: resolveHomeGroup's rule (lastGroup.test.ts).
  await A.waitFor(`${GROUP_TRIGGER}?.textContent.trim() === "Grandpa Lou"`, 20000);

  // 4. Theme (slice 2).
  await step("theme: the menu's radios", async () => {
    await A.press(TRIGGER);
    await A.waitFor(radio("Dark"), 5000);
    const themeItems = await A.evaluate(
      `[...document.querySelectorAll('[role="menuitemradio"]')].map((el) => el.textContent.trim()).join(",")`,
    );
    check("theme: System, Light and Dark radios in the menu", themeItems === "System,Light,Dark", themeItems);
    check("theme: System is checked by default", (await A.evaluate(checkedTheme)) === "System");
    await A.screenshot("app-shell-theme-menu");
    await escape(A);
    await A.waitFor(`!${MENU}`, 5000);
  });

  await scheme(A, "light");
  const rpcCount = `performance.getEntriesByType("resource").filter((e) => new URL(e.name).pathname.startsWith("/rpc")).length`;
  const rpcBefore = await A.evaluate(rpcCount);
  await chooseTheme(A, "Dark");
  const dark = await A.evaluate(themeState);
  check(
    "theme: Dark applies at once and is saved on this device",
    dark.attr === "dark" && dark.scheme === "dark" && dark.saved === "dark",
    JSON.stringify(dark),
  );
  await sleep(500);
  check("theme: choosing isn't sent to the server", (await A.evaluate(rpcCount)) === rpcBefore);

  await step("theme: reload, Light, System and offline", async () => {
    const { identifier: probeId } = await A.send("Page.addScriptToEvaluateOnNewDocument", {
      source: FIRST_PAINT_PROBE,
    });
    await reload(A);
    await A.waitFor(TRIGGER, 30000);
    const probe = await A.evaluate(`window.__themeProbe`);
    check(
      "theme: after reload, Dark is set before first paint (no light flash)",
      probe?.body === "dark" && probe?.frame === "dark",
      JSON.stringify(probe),
    );
    await A.screenshot("app-shell-theme-dark");
    await A.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: probeId });
    await A.press(TRIGGER);
    await A.waitFor(radio("Dark"), 5000);
    check("theme: the menu shows Dark checked after reload", (await A.evaluate(checkedTheme)) === "Dark");
    await escape(A);
    await A.waitFor(`!${MENU}`, 5000);

    await chooseTheme(A, "Light");
    await scheme(A, "dark");
    const light = await A.evaluate(themeState);
    check(
      "theme: Light overrides a dark device",
      light.attr === "light" && light.scheme === "light" && light.saved === "light",
      JSON.stringify(light),
    );

    await chooseTheme(A, "System");
    const sysDark = await A.evaluate(themeState);
    await scheme(A, "light");
    await sleep(200);
    const sysLight = await A.evaluate(themeState);
    check(
      "theme: System removes the attribute and follows prefers-color-scheme both ways",
      sysDark.attr === null &&
        sysDark.saved === null &&
        sysDark.scheme === "dark" &&
        sysLight.attr === null &&
        sysLight.scheme === "light",
      `${JSON.stringify(sysDark)} / ${JSON.stringify(sysLight)}`,
    );

    // Offline: the choice still works (it's local only).
    await A.offline(true);
    await chooseTheme(A, "Dark");
    const offlineDark = await A.evaluate(themeState);
    await chooseTheme(A, "System");
    await A.offline(false);
    check(
      "theme: works offline",
      offlineDark.attr === "dark" && offlineDark.saved === "dark",
      JSON.stringify(offlineDark),
    );
  });
  if (SMOKE) await chooseTheme(A, "System");
  await A.send("Emulation.setEmulatedMedia", { features: [] });

  // 5. Sign out from the menu.
  await A.signOut();
  const signedOut = await A.waitFor(`location.pathname === "/sign-in"`, 15000)
    .then(() => true)
    .catch(() => false);
  check("tap: Sign out signs out", signedOut);
  const keysLeft = await A.evaluate(`JSON.stringify(${lastGroupKeys})`);
  check("sign out: forgets the last group", keysLeft === "[]", keysLeft);
  await A.goto("/app");
  await A.waitFor(`location.pathname === "/sign-in"`, 15000);
  check("sign out: /app needs signing in again", true);

  // 6. viewer@: their own initials and name.
  await step("viewer, and storage that throws", async () => {
    const bV = await launch(9472);
    browsers.push(bV);
    const V = await openPage(bV, "viewer");
    pages.push(V);
    await signIn(V, "viewer@example.com", { home: true });
    await V.waitFor(TRIGGER, 40000);
    const vHome = await V.waitFor(`location.pathname === ${JSON.stringify(timelineOf(DEV_FAMILY))}`, 40000)
      .then(() => true)
      .catch(() => false);
    check("viewer: one group, so /app goes straight to its timeline", vHome);
    const vAvatar = await V.evaluate(
      `(() => { const b = ${TRIGGER}; return b.getAttribute("aria-label") + " / " + b.textContent.trim(); })()`,
    );
    check("viewer: avatar and name are theirs", vAvatar === "Account menu for Dev Viewer / DV", vAvatar);
    await V.screenshot("app-shell-viewer");
    // Step 7 reuses this browser's port. (caretaker@'s one group goes the same
    // way: resolveHomeGroup, lastGroup.test.ts.)
    bV.proc.kill();

    // 7. Storage that throws: the app still renders, in System (fresh browser, viewer@).
    const bS = await launch(9472);
    browsers.push(bS);
    const S = await openPage(bS, "no-storage");
    pages.push(S);
    await S.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });`,
    });
    await scheme(S, "dark");
    await signIn(S, "viewer@example.com");
    await S.waitFor(TRIGGER, 40000);
    await S.waitFor(`${rows} > 0`, 40000);
    const noStore = await S.evaluate(themeState);
    check(
      "theme: storage that throws still renders, in System",
      noStore.attr === null && noStore.scheme === "dark" && noStore.saved === "throws",
      JSON.stringify(noStore),
    );
    await chooseTheme(S, "Light");
    const noStoreLight = await S.evaluate(themeState);
    check(
      "theme: without storage, a choice still applies for the visit",
      noStoreLight.attr === "light" && noStoreLight.scheme === "light",
      JSON.stringify(noStoreLight),
    );
    await S.screenshot("app-shell-no-storage");
  });

  // ───────────────────────── Slice 5: group settings ─────────────────────────
  // Its own browsers (the ones above are signed out or killed by now), and
  // everything it renames is put back to the seeds' values at the end (and
  // again in `finally`, in SQL, if a step throws).
  await step("group settings (slice 5)", async () => {
    const { execSync } = await import("node:child_process");
    const { startProxy } = await import("./proxy.mjs");
    const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
    const psql = (sql) =>
      execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
        .toString()
        .trim();
    const SEED = {
      group: "Dev Family",
      name: "Pat Example",
      preferred: "Grandma Pat",
      dob: "1941-03-14",
      zone: "America/Los_Angeles",
    };
    const serverGroup = () => psql(`SELECT name FROM care_group WHERE id = '${DEV_FAMILY}'`);
    const serverRecipient = () =>
      psql(
        `SELECT name || '|' || coalesce(preferred_name, '') || '|' || coalesce(date_of_birth::text, '') FROM care_recipient WHERE group_id = '${DEV_FAMILY}'`,
      );
    const restoreSeeds = () => {
      psql(`UPDATE care_group SET name = '${SEED.group}' WHERE id = '${DEV_FAMILY}'`);
      psql(
        `UPDATE care_recipient SET name = '${SEED.name}', preferred_name = '${SEED.preferred}', date_of_birth = '${SEED.dob}', time_zone = '${SEED.zone}' WHERE group_id = '${DEV_FAMILY}'`,
      );
    };
    const serverZone = () => psql(`SELECT time_zone FROM care_recipient WHERE group_id = '${DEV_FAMILY}'`);
    const ZONE = `document.querySelector('main [data-section="care-recipient"]')?.querySelector('select[name="timeZone"]')`;
    /** Choose a zone in the recipient's time zone select, as a person would. */
    const chooseZone = (p, zone) =>
      p.evaluate(`(() => { const el = ${ZONE};
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, ${JSON.stringify(zone)});
        el.dispatchEvent(new Event("change", { bubbles: true })); return el.value; })()`);
    const tag = Date.now().toString(36);
    const NEW = {
      group: `Dev Family ${tag}`,
      name: `Pat Example ${tag}`,
      preferred: `Pat ${tag}`,
      dob: "1941-03-09",
    };
    const settingsOf = (groupId) => `/app/groups/${groupId}/settings`;
    const SETTINGS = settingsOf(DEV_FAMILY);
    // The list (phones) opens Details, where the group and the recipient are.
    const DETAILS = `${SETTINGS}/details`;
    const listItem = (id) => `document.querySelector('main [data-settings-item="${id}"]')`;
    const section = (id) => `document.querySelector('main [data-section="${id}"]')`;
    const GROUP = section("group-details");
    const RECIPIENT = section("care-recipient");
    const input = (sec, name) => `${sec}?.querySelector('input[name="${name}"]')`;
    // A field's error: the line its input is described by (`ui/Field`'s `<id>-error`).
    const fieldError = (sec, name) =>
      `((document.getElementById((${input(sec, name)}?.getAttribute("aria-describedby") ?? "").split(" ").find((id) => id.endsWith("-error")) ?? "")?.textContent.trim()) ?? "")`;
    const controls = (sec) => `(${sec}?.querySelectorAll("input:not([type=hidden]), button").length ?? -1)`;
    const text = (sec) => `(${sec}?.textContent ?? "")`;
    const onSettings = (p, ms = 40000) =>
      p.waitFor(`location.pathname === ${JSON.stringify(DETAILS)} && ${GROUP} && ${RECIPIENT}`, ms);
    /** Press a section's Save and wait for its result ("Saved." or an alert). */
    const save = async (p, sec) => {
      await p.evaluate(`${sec}.querySelector('button[type="submit"]').click()`);
      await sleep(150);
      await p.waitFor(
        `!${sec}.querySelector('button[type="submit"]').disabled && ${sec}.querySelector('[role="status"], [role="alert"]')`,
        20000,
      );
      return p.evaluate(
        `(${sec}.querySelector('[role="status"]') ? "ok: " : "error: ") + ${sec}.querySelector('[role="status"], [role="alert"]').textContent.trim()`,
      );
    };
    /** Count this page's saves (`careGroup.update` and `updateRecipient` calls) from now on, until a reload. */
    const countRpc = (p) =>
      p.evaluate(`(() => { if (window.__rpc !== undefined) return; window.__rpc = 0; const f = window.fetch;
        window.fetch = (...a) => { if (String(a[0]?.url ?? a[0]).includes("/rpc/careGroup/update")) window.__rpc++; return f(...a); }; })()`);
    const rpcs = (p) => p.evaluate(`window.__rpc`);
    const openGroupSettings = async (p) => {
      await p.press(GROUP_TRIGGER);
      await p.waitFor(item("Group settings"), 5000);
      await p.press(item("Group settings"));
      await p.waitFor(listItem("details"), 30000);
      await p.press(listItem("details"));
    };

    const proxy = startProxy(9475);
    const bM = await launch(9473, proxy.args);
    const bO = await launch(9474);
    browsers.push(bM, bO);
    try {
      restoreSeeds();

      // 5a. member@ (owner): from the group menu to the page.
      const M = await openPage(bM, "settings-owner");
      pages.push(M);
      await signIn(M, "member@example.com");
      await M.waitFor(`${rows} > 0 && ${GROUP_TRIGGER}`, 40000);
      await M.press(GROUP_TRIGGER);
      await M.waitFor(item("Group settings"), 5000);
      const menuEnd = await M.evaluate(
        `(() => { const all = [...${MENU}.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="separator"]')];
          return all.slice(-3).map((el) => el.getAttribute("role") + ":" + el.textContent.trim()).join(" > "); })()`,
      );
      check(
        "group menu: ends with a separator, then Group settings and New care group",
        menuEnd === "separator: > menuitem:Group settings > menuitem:New care group",
        menuEnd,
      );
      await M.press(item("Group settings"));
      const opened5 = await M.waitFor(
        `location.pathname === ${JSON.stringify(SETTINGS)} && document.querySelector("main h1")?.textContent.trim() === "Group settings" && ${listItem("members")}`,
        40000,
      )
        .then(() => true)
        .catch(() => false);
      check("group menu: Group settings opens /app/groups/:groupId/settings (the list)", opened5);
      await M.press(listItem("details"));
      await onSettings(M);
      await M.waitFor(input(RECIPIENT, "dateOfBirth"), 20000);
      const first5 = await M.evaluate(`({
        h1: document.querySelector("main h1")?.textContent.trim(),
        group: ${input(GROUP, "name")}?.value,
        name: ${input(RECIPIENT, "name")}?.value,
        preferred: ${input(RECIPIENT, "preferredName")}?.value,
        dob: ${input(RECIPIENT, "dateOfBirth")}?.value,
        sections: [...document.querySelectorAll("main [data-section]")].map((s) => s.dataset.section).join(","),
        bar: ${shown(BAR)},
        current: [...(${BAR}?.querySelectorAll("a[aria-current]") ?? [])].length,
        notice: !!document.querySelector("[data-needs-connection]"),
      })`);
      check(
        "owner: the page shows the group's name and the recipient's name, preferred name and date of birth",
        first5.h1 === "Details" &&
          first5.group === SEED.group &&
          first5.name === SEED.name &&
          first5.preferred === SEED.preferred &&
          first5.dob === SEED.dob &&
          first5.sections === "group-details,care-recipient" &&
          !first5.notice,
        JSON.stringify(first5),
      );
      check(
        "group settings: the tab bar shows, with no section current",
        first5.bar && first5.current === 0,
        JSON.stringify({ bar: first5.bar, current: first5.current }),
      );
      await M.screenshot("app-shell-group-settings-owner");

      // 5b. Invalid input: the field's error, nothing sent, nothing saved. One case;
      // the rules and their messages are parseGroupName's and parseRecipientProfile's
      // (groupSettings.test.ts).
      await M.evaluate(`window.__stay = ${JSON.stringify(tag)}`);
      await countRpc(M);
      await M.type(input(GROUP, "name"), "   ");
      const emptyGroup = await save(M, GROUP);
      const emptyGroupState = await M.evaluate(
        `({ error: ${fieldError(GROUP, "name")}, invalid: ${input(GROUP, "name")}.getAttribute("aria-invalid") })`,
      );
      check(
        "invalid: an empty group name shows the field's error, and nothing is sent or saved",
        emptyGroup.startsWith("error:") &&
          emptyGroupState.error === "Enter a name." &&
          emptyGroupState.invalid === "true" &&
          (await rpcs(M)) === 0 &&
          serverGroup() === SEED.group,
        `${emptyGroup} ${JSON.stringify(emptyGroupState)} rpc ${await rpcs(M)}`,
      );

      // 5c. The owner renames the group and edits the recipient.
      await M.type(input(GROUP, "name"), `  ${NEW.group} `);
      const renamed = await save(M, GROUP);
      check(
        "owner: renames the group",
        renamed === "ok: Saved." && serverGroup() === NEW.group,
        `${renamed} / ${serverGroup()}`,
      );
      check("a save goes through the API", (await rpcs(M)) === 1, String(await rpcs(M)));
      await M.type(input(RECIPIENT, "name"), NEW.name);
      await M.type(input(RECIPIENT, "preferredName"), NEW.preferred);
      await M.type(input(RECIPIENT, "dateOfBirth"), NEW.dob);
      const edited = await save(M, RECIPIENT);
      check(
        "owner: edits the recipient's name, preferred name and date of birth",
        edited === "ok: Saved." && serverRecipient() === `${NEW.name}|${NEW.preferred}|${NEW.dob}`,
        `${edited} / ${serverRecipient()}`,
      );
      const headerNew = await M.waitFor(
        `${GROUP_TRIGGER}?.textContent.trim() === ${JSON.stringify(NEW.preferred)}`,
        20000,
      )
        .then(() => true)
        .catch(() => false);
      check(
        "owner: the header shows the new name without a reload (through sync)",
        headerNew,
        await M.evaluate(`${GROUP_TRIGGER}?.textContent.trim() ?? ""`),
      );
      await M.evaluate(`${BAR}.querySelector("a").click()`);
      const timelineNew = await M.waitFor(
        `location.pathname === ${JSON.stringify(timelineOf(DEV_FAMILY))} && document.querySelector("main h1")?.textContent.trim() === ${JSON.stringify(NEW.preferred)} && document.querySelector("main header p")?.textContent.includes(${JSON.stringify(NEW.group)})`,
        20000,
      )
        .then(() => true)
        .catch(() => false);
      check(
        "owner: the timeline shows the new recipient and group names, still without a reload",
        timelineNew && (await M.evaluate(`window.__stay`)) === tag,
        await M.evaluate(`document.querySelector("main header")?.textContent ?? ""`),
      );
      await openGroupSettings(M);
      await onSettings(M);
      await M.waitFor(
        `${input(RECIPIENT, "dateOfBirth")}?.value === ${JSON.stringify(NEW.dob)}`,
        20000,
      ).catch(() => undefined);
      const reopened = await M.evaluate(
        `[${input(GROUP, "name")}?.value, ${input(RECIPIENT, "name")}?.value, ${input(RECIPIENT, "preferredName")}?.value, ${input(RECIPIENT, "dateOfBirth")}?.value].join("|")`,
      );
      check(
        "owner: coming back, the forms hold the saved values",
        reopened === `${NEW.group}|${NEW.name}|${NEW.preferred}|${NEW.dob}`,
        reopened,
      );

      // 5c'. The recipient's time zone (quick-fixes slice 27, B-65): the owner
      // picks another zone; it saves, syncs, and the medications page's Today
      // note follows it. Then "Use this device's" picks the device's zone, and
      // Los Angeles is put back through the page.
      const device = await M.evaluate(`Intl.DateTimeFormat().resolvedOptions().timeZone`);
      const other = device === "America/New_York" ? "America/Chicago" : "America/New_York";
      const place = other.split("/")[1].replaceAll("_", " ");
      const zoneField = await M.evaluate(`({ value: ${ZONE}?.value, options: ${ZONE}?.options.length ?? 0,
        help: document.getElementById((${ZONE}?.getAttribute("aria-describedby") ?? "").split(" ")[0])?.textContent.trim() })`);
      check(
        "time zone: the owner's form has the zone (Los Angeles), every zone, and the note",
        zoneField.value === SEED.zone &&
          zoneField.options > 50 &&
          zoneField.help === "Medication times follow this zone.",
        JSON.stringify(zoneField),
      );
      await chooseZone(M, other);
      const zoneSaved = await save(M, RECIPIENT);
      check(
        "time zone: the owner changes it online, and it saves",
        zoneSaved === "ok: Saved." && serverZone() === other,
        `${zoneSaved} / ${serverZone()}`,
      );
      await M.goto(`/app/groups/${DEV_FAMILY}/medications`);
      const noteFollows = await M.waitFor(
        `document.querySelector("main [data-today]")?.textContent.includes(${JSON.stringify(`Times are ${place} time`)})`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      check(
        "time zone: it syncs, and the medications page's zone note follows it",
        noteFollows,
        await M.evaluate(
          `document.querySelector("main [data-today]")?.textContent.slice(0, 120) ?? "no Today"`,
        ),
      );
      await M.goto(DETAILS);
      await onSettings(M);
      await M.waitFor(`${ZONE}?.value === ${JSON.stringify(other)}`, 20000).catch(() => undefined);
      const deviceButton = `document.querySelector("main [data-use-device-zone]")`;
      const shortcut = await M.evaluate(`${deviceButton}?.textContent.trim() ?? ""`);
      if (device !== other && shortcut) await M.tap(deviceButton);
      const afterShortcut = await M.evaluate(`${ZONE}?.value`);
      check(
        "time zone: \"Use this device's\" picks this device's zone",
        shortcut === `Use this device's (${device.replaceAll("_", " ")})` && afterShortcut === device,
        `${shortcut} → ${afterShortcut}`,
      );
      await chooseZone(M, SEED.zone);
      const zoneBack = await save(M, RECIPIENT);
      check(
        "time zone: Los Angeles is put back through the page",
        zoneBack === "ok: Saved." && serverZone() === SEED.zone,
        `${zoneBack} / ${serverZone()}`,
      );

      // 5d. caretaker@: edits the recipient, but not the group's name.
      const O = await openPage(bO, "settings-other");
      pages.push(O);
      await signIn(O, "caretaker@example.com", { home: true });
      await O.waitFor(GROUP_TRIGGER, 40000);
      await openGroupSettings(O);
      await onSettings(O);
      await O.waitFor(input(RECIPIENT, "dateOfBirth"), 20000);
      const caretaker = await O.evaluate(
        `({ groupControls: ${controls(GROUP)}, groupText: ${text(GROUP)}, recipientInputs: ${RECIPIENT}.querySelectorAll("input:not([type=hidden])").length, dob: ${input(RECIPIENT, "dateOfBirth")}.value })`,
      );
      check(
        "caretaker: the group's name is read-only, with no edit controls",
        caretaker.groupControls === 0 && caretaker.groupText.includes(NEW.group),
        JSON.stringify(caretaker),
      );
      check(
        "caretaker: the recipient's form is there, with the saved date of birth",
        caretaker.recipientInputs === 3 && caretaker.dob === NEW.dob,
        JSON.stringify(caretaker),
      );
      const byCaretaker = `${NEW.preferred} c`;
      await O.type(input(RECIPIENT, "preferredName"), byCaretaker);
      const caretakerSaved = await save(O, RECIPIENT);
      check(
        "caretaker: edits the recipient",
        caretakerSaved === "ok: Saved." && serverRecipient() === `${NEW.name}|${byCaretaker}|${NEW.dob}`,
        `${caretakerSaved} / ${serverRecipient()}`,
      );
      const seenByOwner = await M.waitFor(
        `${GROUP_TRIGGER}?.textContent.trim() === ${JSON.stringify(byCaretaker)} && ${input(RECIPIENT, "preferredName")}?.value === ${JSON.stringify(byCaretaker)}`,
        20000,
      )
        .then(() => true)
        .catch(() => false);
      check("caretaker's edit reaches the owner's header and form without a reload", seenByOwner);
      await O.screenshot("app-shell-group-settings-caretaker");

      // 5e. A viewer's cards are read-only like the caretaker's group card above
      // (groupSettingsAccess, groupSettings.test.ts), and another group's settings
      // is the 404 (routing.mjs, "non-member: another group's …/settings/members").
      // The time zone (slice 27): a viewer sees it as text, with no select.
      await O.signOut();
      await O.waitFor(`location.pathname === "/sign-in"`, 30000);
      await signIn(O, "viewer@example.com", { home: true });
      await O.waitFor(GROUP_TRIGGER, 40000);
      await O.goto(DETAILS);
      await onSettings(O);
      const viewerZone = await O.waitFor(`${text(RECIPIENT)}.includes("America/Los Angeles")`, 20000)
        .then(() => true)
        .catch(() => false);
      const viewer5 = await O.evaluate(
        `({ selects: document.querySelectorAll("main select").length, recipient: ${text(RECIPIENT)} })`,
      );
      check(
        "viewer: the time zone is read-only text",
        viewerZone && viewer5.selects === 0 && viewer5.recipient.includes("Time zone"),
        JSON.stringify(viewer5),
      );

      // 5f. Offline (the proxy cuts member@'s browser): read-only from local data, with the notice.
      await M.evaluate(`${BAR}.querySelector("a").click()`);
      await M.waitFor(
        `location.pathname === ${JSON.stringify(timelineOf(DEV_FAMILY))} && ${rows} > 0`,
        20000,
      );
      proxy.setOnline(false);
      await sleep(500);
      await openGroupSettings(M);
      const offlineLoaded = await onSettings(M, 30000)
        .then(() => true)
        .catch(() => false);
      const offline5 = await M.evaluate(
        `({ notice: document.querySelector("[data-needs-connection]")?.textContent.trim(), controls: document.querySelectorAll("main input, main select, main button, main form").length, group: ${text(GROUP)}, recipient: ${text(RECIPIENT)} })`,
      );
      check(
        "offline: the page loads from local data and says it needs a connection",
        offlineLoaded &&
          offline5.notice === "Needs a connection to edit." &&
          offline5.group.includes(NEW.group) &&
          offline5.recipient.includes(NEW.name) &&
          offline5.recipient.includes(byCaretaker) &&
          offline5.recipient.includes("America/Los Angeles"),
        JSON.stringify(offline5),
      );
      check(
        "offline: nothing to save with (no forms), and the date of birth says why it's missing",
        offline5.controls === 0 && offline5.recipient.includes("Not available offline"),
        JSON.stringify(offline5),
      );
      await M.screenshot("app-shell-group-settings-offline");
      proxy.setOnline(true);
      await sleep(1000);

      // 5g. Put the seeds' names back, through the page.
      await M.goto(DETAILS);
      await onSettings(M);
      await M.waitFor(input(RECIPIENT, "dateOfBirth"), 30000);
      await M.type(input(GROUP, "name"), SEED.group);
      const groupBack = await save(M, GROUP);
      await M.type(input(RECIPIENT, "name"), SEED.name);
      await M.type(input(RECIPIENT, "preferredName"), SEED.preferred);
      await M.type(input(RECIPIENT, "dateOfBirth"), SEED.dob);
      const recipientBack = await save(M, RECIPIENT);
      check(
        "online again: the forms are back, and the seeds' names are restored",
        groupBack === "ok: Saved." &&
          recipientBack === "ok: Saved." &&
          serverGroup() === SEED.group &&
          serverRecipient() === `${SEED.name}|${SEED.preferred}|${SEED.dob}`,
        `${groupBack} ${recipientBack} / ${serverGroup()} / ${serverRecipient()}`,
      );
      const headerBack = await M.waitFor(
        `${GROUP_TRIGGER}?.textContent.trim() === ${JSON.stringify(SEED.preferred)}`,
        20000,
      )
        .then(() => true)
        .catch(() => false);
      check("the header is back to Grandma Pat", headerBack);
    } finally {
      restoreSeeds();
      proxy.close();
    }
  });
  // ─────────────────────── end of slice 5: group settings ──────────────────────

  // ─────────────────── Slice 6: group settings, members ───────────────────
  // The last block in the file: it changes Dev Family's memberships
  // (caretaker@ to admin, then viewer, then removed; viewer@ leaves), which
  // every other step and check needs as seeded. They're put back in SQL at
  // its end, and again in `finally` if a step throws.
  await step("group settings, members (slice 6)", async () => {
    const { execSync } = await import("node:child_process");
    const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
    const psql = (sql) =>
      execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
        .toString()
        .trim();
    const SEEDED = [
      ["member@example.com", "owner"],
      ["caretaker@example.com", "caretaker"],
      ["viewer@example.com", "viewer"],
    ];
    const restoreMembers = () => {
      for (const [email, role] of SEEDED) {
        psql(
          `INSERT INTO care_group_member (group_id, user_id, role, created_by, updated_by) SELECT '${DEV_FAMILY}', id, '${role}', id, id FROM "user" WHERE email = '${email}' ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role WHERE care_group_member.role <> EXCLUDED.role`,
        );
      }
    };
    /** Dev Family's members on the server, as "name:role" by role. */
    const serverMembers = () =>
      psql(
        `SELECT coalesce(string_agg(u.name || ':' || m.role, ',' ORDER BY array_position(ARRAY['owner','admin','caretaker','viewer'], m.role), u.name), '') FROM care_group_member m JOIN "user" u ON u.id = m.user_id WHERE m.group_id = '${DEV_FAMILY}'`,
      );
    /** Wait (up to 20 s) for the server's members to be `expected`; the last value read. */
    const serverBecomes = async (expected) => {
      let last = serverMembers();
      for (let i = 0; i < 40 && last !== expected; i++) {
        await sleep(500);
        last = serverMembers();
      }
      return last;
    };
    const ALL_SEEDED = "Dev Member:owner,Dev Caretaker:caretaker,Dev Viewer:viewer";
    const LAST_OWNER = "A care group needs at least one owner. Make someone else an owner first.";
    const OWNER_ONLY = "Only an owner can add, change or remove owners";
    const NO_GROUPS = "You're not in a care group yet";
    const tag = Date.now().toString(36);

    // The list (phones) opens Members.
    const SETTINGS = `/app/groups/${DEV_FAMILY}/settings/members`;
    const MEMBERS_ITEM = `document.querySelector('main [data-settings-item="members"]')`;
    const MEMBERS = `document.querySelector('main [data-section="members"]')`;
    const memberRow = (name) =>
      `[...(${MEMBERS}?.querySelectorAll("li[data-member]") ?? [])].find((li) => li.querySelector("p").textContent.includes(${JSON.stringify(name)}))`;
    const roleSelect = (name) => `${memberRow(name)}?.querySelector("select")`;
    const rowButton = (name) => `${memberRow(name)}?.querySelector("button")`;
    const rowAlert = (name) =>
      `(${memberRow(name)}?.querySelector('[role="alert"]')?.textContent.trim() ?? "")`;
    /** The list as shown: "name:role" in order, "*" on a role menu, then the row's button. */
    const listed = (p) =>
      p.evaluate(`[...(${MEMBERS}?.querySelectorAll("li[data-member]") ?? [])].map((li) => {
        const select = li.querySelector("select");
        const role = select ? select.selectedOptions[0].textContent.trim() + "*" : li.querySelector("[data-role]").textContent.trim();
        const button = li.querySelector("button")?.textContent.trim();
        return li.querySelector("p").textContent.trim() + ":" + role + (button ? ":" + button : "");
      }).join(",")`);
    const waitListed = (p, expected, ms = 20000) =>
      p
        .waitFor(
          `[...(${MEMBERS}?.querySelectorAll("li[data-member]") ?? [])].map((li) => li.querySelector("p").textContent.trim() + ":" + (li.querySelector("select")?.value ?? li.querySelector("[data-role]").textContent.trim().toLowerCase())).join(",") === ${JSON.stringify(expected)}`,
          ms,
        )
        .then(() => true)
        .catch(() => false);
    const options = (name) => `[...${roleSelect(name)}.options].map((o) => o.value).join(",")`;
    /** Choose a role in a member's menu, as a person would (a change event). */
    const choose = (p, name, role) =>
      p.evaluate(`(() => { const el = ${roleSelect(name)}; if (!el) throw new Error("no role menu for ${name}");
        el.value = ${JSON.stringify(role)}; el.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    const DIALOG = `document.querySelector("dialog[open]")`;
    const dialogButton = (text) =>
      `[...(${DIALOG}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
    const openConfirm = async (p, name) => {
      // A row's controls are disabled while a change to it saves.
      await p.waitFor(`${rowButton(name)} && !${rowButton(name)}.disabled`, 20000);
      await p.evaluate(`${rowButton(name)}.click()`);
      await p.waitFor(DIALOG, 5000);
      return p.evaluate(`${DIALOG}.querySelector("h2").textContent.trim()`);
    };
    const onMembers = (p, ms = 40000) =>
      p.waitFor(
        `location.pathname === ${JSON.stringify(SETTINGS)} && ${MEMBERS}?.querySelector("li[data-member]")`,
        ms,
      );
    const openGroupSettings = async (p) => {
      await p.waitFor(GROUP_TRIGGER, 40000);
      await p.press(GROUP_TRIGGER);
      await p.waitFor(item("Group settings"), 5000);
      await p.press(item("Group settings"));
      await p.waitFor(MEMBERS_ITEM, 30000);
      await p.press(MEMBERS_ITEM);
      await onMembers(p);
      // Online: the forms and member controls come with the loader's API read.
      await p.waitFor(`${MEMBERS}.querySelector("button")`, 20000);
    };

    const bM = await launch(9476);
    const bO = await launch(9477);
    browsers.push(bM, bO);
    try {
      restoreMembers();

      // 6a. member@ (owner): everyone, with a role menu each, Leave on their own row and Remove on the others.
      const M = await openPage(bM, "members-owner");
      pages.push(M);
      await signIn(M, "member@example.com");
      await M.waitFor(`${rows} > 0`, 40000);
      await openGroupSettings(M);
      await M.evaluate(`window.__stay = ${JSON.stringify(tag)}`);
      const ownerList = await listed(M);
      const ownerView = await M.evaluate(`({
        sections: [...document.querySelectorAll("main [data-section]")].map((s) => s.dataset.section).join(","),
        heading: ${MEMBERS}.querySelector("h1").textContent.trim(),
        avatars: [...${MEMBERS}.querySelectorAll("li[data-member] > div > span[aria-hidden]")].map((a) => a.textContent.trim()).join(","),
        options: ${options("Dev Viewer")},
        labels: [...${MEMBERS}.querySelectorAll("li[data-member] select, li[data-member] button")].map((el) => el.getAttribute("aria-label")).join("|"),
        // The members themselves (invites and requests to join show addresses on purpose).
        text: [...${MEMBERS}.querySelectorAll("li[data-member]")].map((li) => li.textContent).join(" "),
      })`);
      check(
        "owner: Members lists everyone by role, with a role menu each, Leave for themselves and Remove for the others",
        ownerView.sections === "members" &&
          ownerView.heading === "Members" &&
          ownerList ===
            "Dev Member (you):Owner*:Leave,Dev Caretaker:Caretaker*:Remove,Dev Viewer:Viewer*:Remove",
        `${ownerView.sections} / ${ownerList}`,
      );
      check(
        "owner: avatars show initials, the controls are named, and a menu offers all four roles",
        ownerView.avatars === "DM,DC,DV" &&
          ownerView.options === "owner,admin,caretaker,viewer" &&
          ownerView.labels ===
            "Role for Dev Member|Leave this care group|Role for Dev Caretaker|Remove Dev Caretaker|Role for Dev Viewer|Remove Dev Viewer",
        JSON.stringify({ avatars: ownerView.avatars, options: ownerView.options, labels: ownerView.labels }),
      );
      check("members: no email anywhere in the list", !/@|example\.com/.test(ownerView.text));
      await M.evaluate(`${MEMBERS}.scrollIntoView({ block: "center" })`);
      await M.screenshot("app-shell-members-owner");

      // 6b. The last owner can't demote themselves or leave: the message, and nothing changes.
      await choose(M, "Dev Member", "viewer");
      const demoteRefused = await M.waitFor(`${rowAlert("Dev Member")} !== ""`, 20000)
        .then(() => true)
        .catch(() => false);
      const demote = await M.evaluate(
        `({ alert: ${rowAlert("Dev Member")}, role: ${roleSelect("Dev Member")}.value })`,
      );
      check(
        "last owner: demoting themselves shows why, and the menu goes back to Owner",
        demoteRefused &&
          demote.alert === LAST_OWNER &&
          demote.role === "owner" &&
          serverMembers() === ALL_SEEDED,
        `${JSON.stringify(demote)} / ${serverMembers()}`,
      );
      const leaveTitle = await openConfirm(M, "Dev Member");
      await M.evaluate(`${dialogButton("Cancel")}.click()`);
      await M.waitFor(`!${DIALOG}`, 5000);
      check(
        "leave: asks first, and Cancel changes nothing",
        leaveTitle.startsWith("Leave this care group?") && serverMembers() === ALL_SEEDED,
        leaveTitle,
      );
      // Clear the demotion's message first (choosing the role they have saves
      // nothing), so the wait below can only pass on the refusal to leave.
      await choose(M, "Dev Member", "owner");
      await sleep(150);
      await M.waitFor(`${rowAlert("Dev Member")} === "" && !${rowButton("Dev Member")}.disabled`, 20000);
      await openConfirm(M, "Dev Member");
      await M.evaluate(`${dialogButton("Leave")}.click()`);
      await M.waitFor(`!${DIALOG}`, 5000);
      await sleep(300);
      const leaveRefused = await M.waitFor(
        `${rowButton("Dev Member")}?.textContent.trim() === "Leave" && !${rowButton("Dev Member")}.disabled && ${rowAlert("Dev Member")} !== ""`,
        20000,
      )
        .then(() => true)
        .catch(() => false);
      const leave = await M.evaluate(
        `({ alert: ${rowAlert("Dev Member")}, path: location.pathname, stay: window.__stay })`,
      );
      check(
        "last owner: leaving shows why, they stay on the page, and nothing changes",
        leaveRefused &&
          leave.alert === LAST_OWNER &&
          leave.path === SETTINGS &&
          leave.stay === tag &&
          serverMembers() === ALL_SEEDED,
        `${JSON.stringify(leave)} / ${serverMembers()}`,
      );
      await M.evaluate(`${MEMBERS}.scrollIntoView({ block: "center" })`);
      await M.screenshot("app-shell-members-last-owner");

      // 6c. caretaker@ on a second device: a plain list, with Leave on their own row only.
      const O = await openPage(bO, "members-other");
      pages.push(O);
      await signIn(O, "caretaker@example.com", { home: true });
      await openGroupSettings(O);
      await O.evaluate(`window.__stay = ${JSON.stringify(tag)}`);
      const caretakerList = await listed(O);
      check(
        "caretaker: sees everyone and their roles, with no role menus and only Leave on their own row",
        caretakerList === "Dev Member:Owner,Dev Caretaker (you):Caretaker:Leave,Dev Viewer:Viewer",
        caretakerList,
      );

      // 6d. The owner makes caretaker@ an admin: it shows on their device without a reload,
      // with what an admin may do (nothing to the owner; no Owner in any menu).
      await choose(M, "Dev Caretaker", "admin");
      const adminSaved = await waitListed(M, "Dev Member (you):owner,Dev Caretaker:admin,Dev Viewer:viewer");
      // The menu shows the choice at once: wait for the save to reach the server.
      const adminOnServer = await serverBecomes("Dev Member:owner,Dev Caretaker:admin,Dev Viewer:viewer");
      check(
        "owner: makes the caretaker an admin",
        adminSaved && adminOnServer === "Dev Member:owner,Dev Caretaker:admin,Dev Viewer:viewer",
        `${await listed(M)} / ${adminOnServer}`,
      );
      const adminSeen = await O.waitFor(`${roleSelect("Dev Caretaker")}?.value === "admin"`, 20000)
        .then(() => true)
        .catch(() => false);
      const adminList = await listed(O);
      const adminOptions = adminSeen ? await O.evaluate(options("Dev Viewer")) : "";
      check(
        "admin (second device, no reload): gets role menus and Remove, but nothing on the owner's row",
        adminSeen &&
          adminList === "Dev Member:Owner,Dev Caretaker (you):Admin*:Leave,Dev Viewer:Viewer*:Remove" &&
          (await O.evaluate(`window.__stay`)) === tag,
        adminList,
      );
      check("admin: no menu offers Owner", adminOptions === "admin,caretaker,viewer", adminOptions);
      // A forged request (an Owner option added by hand) gets the owner-only message.
      await O.evaluate(
        `${roleSelect("Dev Viewer")}.append(Object.assign(document.createElement("option"), { value: "owner", textContent: "Owner", }))`,
      );
      await choose(O, "Dev Viewer", "owner");
      const forgedRefused = await O.waitFor(`${rowAlert("Dev Viewer")} !== ""`, 20000)
        .then(() => true)
        .catch(() => false);
      const forged = await O.evaluate(
        `({ alert: ${rowAlert("Dev Viewer")}, role: ${roleSelect("Dev Viewer")}.value })`,
      );
      check(
        "admin: a forged request to make someone an owner gets the owner-only message, and changes nothing",
        forgedRefused &&
          forged.alert === OWNER_ONLY &&
          forged.role === "viewer" &&
          serverMembers() === "Dev Member:owner,Dev Caretaker:admin,Dev Viewer:viewer",
        `${JSON.stringify(forged)} / ${serverMembers()}`,
      );
      await O.evaluate(`${MEMBERS}.scrollIntoView({ block: "center" })`);
      await O.screenshot("app-shell-members-admin");

      // 6e. The owner makes caretaker@ a viewer: their list shows it, and their next
      // timeline screen has no writer controls.
      await choose(M, "Dev Caretaker", "viewer");
      const viewerSaved = await waitListed(
        M,
        "Dev Member (you):owner,Dev Caretaker:viewer,Dev Viewer:viewer",
      );
      const viewerOnServer = await serverBecomes("Dev Member:owner,Dev Caretaker:viewer,Dev Viewer:viewer");
      check(
        "owner: changes the caretaker to viewer",
        viewerSaved && viewerOnServer === "Dev Member:owner,Dev Caretaker:viewer,Dev Viewer:viewer",
        `${await listed(M)} / ${viewerOnServer}`,
      );
      const demotedSeen = await waitListed(
        O,
        "Dev Member:owner,Dev Caretaker (you):viewer,Dev Viewer:viewer",
      );
      const demotedList = await listed(O);
      check(
        "second device: the members list shows the change without a reload, and the role menus are gone",
        demotedSeen &&
          demotedList === "Dev Member:Owner,Dev Caretaker (you):Viewer:Leave,Dev Viewer:Viewer" &&
          (await O.evaluate(`window.__stay`)) === tag,
        demotedList,
      );
      await O.evaluate(`${BAR}.querySelector("a").click()`);
      await O.waitFor(
        `location.pathname === ${JSON.stringify(timelineOf(DEV_FAMILY))} && ${rows} > 0`,
        20000,
      );
      const noWriter = await O.evaluate(`({
        addBar: !!document.querySelector('[aria-label="Add to the timeline"]'),
        menus: document.querySelectorAll('main ol button[aria-label^="Actions"], main ol [aria-label^="Edit "]').length,
        note: document.querySelector("main")?.textContent.includes("You can view this timeline"),
        stay: window.__stay,
      })`);
      check(
        "second device: the next timeline screen has no writer controls",
        !noWriter.addBar && noWriter.menus === 0 && noWriter.note && noWriter.stay === tag,
        JSON.stringify(noWriter),
      );
      await O.screenshot("app-shell-members-demoted-timeline");

      // 6f. The owner removes them, after confirming; they lose the group on their next sync.
      const removeTitle = await openConfirm(M, "Dev Caretaker");
      await M.evaluate(`${dialogButton("Cancel")}.click()`);
      await M.waitFor(`!${DIALOG}`, 5000);
      check(
        "remove: asks first, naming the member, and Cancel changes nothing",
        removeTitle.startsWith("Remove Dev Caretaker from this care group?") &&
          serverMembers() === "Dev Member:owner,Dev Caretaker:viewer,Dev Viewer:viewer",
        removeTitle,
      );
      await openConfirm(M, "Dev Caretaker");
      await M.evaluate(`${dialogButton("Remove")}.click()`);
      const removedShown = await waitListed(M, "Dev Member (you):owner,Dev Viewer:viewer");
      check(
        "owner: removes the member, who leaves the list without a reload",
        removedShown &&
          serverMembers() === "Dev Member:owner,Dev Viewer:viewer" &&
          (await M.evaluate(`window.__stay`)) === tag,
        `${await listed(M)} / ${serverMembers()}`,
      );
      const emptied = await O.waitFor(`${rows} === 0`, 30000)
        .then(() => true)
        .catch(() => false);
      await O.goto("/app");
      const lostGroup = await O.waitFor(
        `location.pathname === "/app" && document.querySelector("main")?.textContent.includes(${JSON.stringify(NO_GROUPS)})`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      check(
        "removed member: the group's entries go on their next sync, and /app says they're in no care group",
        emptied && lostGroup && !(await O.evaluate(`!!${GROUP_TRIGGER}`)),
        `emptied ${emptied}, ${await O.evaluate(`location.pathname`)}`,
      );

      // 6g. viewer@ leaves, after confirming: on to /app, with no group left.
      await O.signOut();
      await O.waitFor(`location.pathname === "/sign-in"`, 15000);
      await signIn(O, "viewer@example.com", { home: true });
      await openGroupSettings(O);
      const viewerList = await listed(O);
      const viewerControls = await O.evaluate(
        `[...document.querySelectorAll("main input, main select, main button")].filter((el) => !el.closest("dialog:not([open])")).map((el) => el.textContent.trim()).join(",")`,
      );
      check(
        "viewer: the only control on the whole page is Leave, on their own row",
        viewerList === "Dev Member:Owner,Dev Viewer (you):Viewer:Leave" && viewerControls === "Leave",
        `${viewerList} / ${viewerControls}`,
      );
      await O.screenshot("app-shell-members-viewer");
      await openConfirm(O, "Dev Viewer");
      await sleep(400);
      await O.screenshot("app-shell-members-leave-confirm");
      await O.evaluate(`${dialogButton("Leave")}.click()`);
      const left = await O.waitFor(
        `location.pathname === "/app" && document.querySelector("main")?.textContent.includes(${JSON.stringify(NO_GROUPS)})`,
        30000,
      )
        .then(() => true)
        .catch(() => false);
      check(
        "viewer: leaves after confirming, lands on /app, and has no care group (no group menu)",
        left && !(await O.evaluate(`!!${GROUP_TRIGGER}`)) && serverMembers() === "Dev Member:owner",
        `${await O.evaluate(`location.pathname`)} / ${serverMembers()}`,
      );
      await sleep(1500);
      check(
        "viewer: still on /app a moment later (nothing sends them back to the group)",
        (await O.evaluate(`location.pathname`)) === "/app",
      );
      const aloneShown = await waitListed(M, "Dev Member (you):owner");
      check("owner: sees them go without a reload", aloneShown, await listed(M));

      // 6h. Put the seeds' memberships back; the owner's list follows.
      restoreMembers();
      const restored = await waitListed(
        M,
        "Dev Member (you):owner,Dev Caretaker:caretaker,Dev Viewer:viewer",
        30000,
      );
      check(
        "the seeds' memberships are back (in SQL), and the list follows",
        restored && serverMembers() === ALL_SEEDED,
        `${await listed(M)} / ${serverMembers()}`,
      );
    } finally {
      restoreMembers();
    }
  });
  // ──────────────── end of slice 6: group settings, members ────────────────

  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted/;
  // With storage blocked, React Router's inline ScrollRestoration script reads
  // sessionStorage unguarded and throws; that's expected on that page only.
  const blocked = /^\[no-storage (console\.error|exception)\] SecurityError/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e) && !blocked.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | "));
} finally {
  for (const br of browsers) br.proc.kill();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
