import { launch, openPage, sleep } from "./cdp.mjs";
// The /app frame (app-shell PRD): the header's regions and the user menu.
// Slice 1: Caretook, sync status and the avatar fit one row at 420 wide; the
// avatar shows initials and has a name; the menu opens by tap and keyboard,
// shows name and email, returns focus on Escape, and its Settings and Sign
// out items work. Later slices append their checks (theme, groups, sections).
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
const focusedText = (p) => p.evaluate(`document.activeElement?.textContent.trim() ?? ""`);

/** `p.signIn`, with a longer wait: the first /app load on a busy machine can take 20 s or more. */
async function signIn(p, email) {
  await p.goto("/sign-in");
  await p.waitFor(`document.querySelector('input[name="email"]')`, 20000);
  await p.type(`document.querySelector('input[name="email"]')`, email);
  await p.type(`document.querySelector('input[name="password"]')`, PW);
  await p.press(`document.querySelector('form button[type="submit"]')`);
  await p.waitFor(`location.pathname.startsWith("/app")`, 60000).catch(async (e) => {
    const alert = await p.evaluate(`document.querySelector('[role="alert"]')?.textContent ?? ""`);
    throw alert ? new Error(`${email}: sign-in refused: ${alert}`) : e;
  });
}

const pages = [];
const b = await launch(9471);
const browsers = [b];
try {
  // 1. member@ on the timeline, 420 wide.
  const A = await openPage(b, "member");
  pages.push(A);
  await signIn(A, "member@example.com");
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
    layout.regions === "group,sections,status,user",
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

  // 2. Keyboard: Enter opens, focus moves into the menu, arrows move, Escape closes and returns focus.
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
    first === "Settings" && second === "Sign out",
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

  // 4. Sign out from the menu.
  await A.signOut();
  const signedOut = await A.waitFor(`location.pathname === "/sign-in"`, 15000)
    .then(() => true)
    .catch(() => false);
  check("tap: Sign out signs out", signedOut);
  await A.goto("/app");
  await A.waitFor(`location.pathname === "/sign-in"`, 15000);
  check("sign out: /app needs signing in again", true);

  // 5. viewer@: their own initials and name.
  const bV = await launch(9472);
  browsers.push(bV);
  const V = await openPage(bV, "viewer");
  pages.push(V);
  await signIn(V, "viewer@example.com");
  await V.waitFor(TRIGGER, 40000);
  const vAvatar = await V.evaluate(
    `(() => { const b = ${TRIGGER}; return b.getAttribute("aria-label") + " / " + b.textContent.trim(); })()`,
  );
  check("viewer: avatar and name are theirs", vAvatar === "Account menu for Dev Viewer / DV", vAvatar);
  await V.screenshot("app-shell-viewer");

  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | "));
} finally {
  for (const br of browsers) br.proc.kill();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
