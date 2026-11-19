import { launch, openPage, sleep } from "./cdp.mjs";
// The UI primitives on a real check build: the production CSS (Tailwind and
// daisyUI as built), React Aria's styles under the CSP, and real CDP taps and
// keys. One pass at a phone's width in dark and one at a desktop's in light:
// the user menu (tap opens it named, on a dark or light surface; Escape
// closes it and focus returns), the add sheet (full screen at 420, centred
// at 1280; Escape returns focus to its link) and the calendar inside it
// (Escape closes only the calendar).
//
// Everything else ui.mjs checked is in component tests, which run the same
// screens in Chromium against the test device: every menu, sheet, popover,
// confirm, chip group, field, tooltip and the date field's fit
// (components/ui/inScreens.browser.test.tsx, components/ui/primitives.browser.test.tsx),
// and account and group settings (routes/app/settings/settings.browser.test.tsx,
// routes/app/groups/settings/groupSettings.browser.test.tsx).
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const TIMELINE = `/app/groups/${DEV_FAMILY}/timeline`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const MENU = `document.querySelector('[role="menu"]')`;
const USER = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
const SYMPTOM = `[...document.querySelectorAll('[aria-label="Add to the timeline"] a')].find((a) => a.textContent.trim() === "Symptom")`;
const DIALOGS = `[...document.querySelectorAll('[role="dialog"], dialog[open]')]`;
const PICK = `document.querySelector('[role="dialog"] [aria-label="Pick a date"]')`;
const ACTIVE = `document.activeElement?.outerHTML.slice(0, 160)`;

/** Lightness (0–1) of the first opaque background at or above `start`: oklch from daisyUI 5, or rgb. */
const lightness = (start) => `(() => {
  for (let el = ${start}; el; el = el.parentElement) {
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
const themed = (l, scheme) => l !== null && (scheme === "dark" ? l < 0.45 : l > 0.75);

const escape = async (p) => {
  // Escape goes to the focused element: wait until the open overlay has focus.
  await p
    .waitFor(
      `!document.querySelector('[role="menu"], [role="dialog"]') || document.activeElement?.closest('[role="menu"], [role="dialog"]')`,
      5000,
      { quiet: true },
    )
    .catch(() => undefined);
  const base = { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
};
/** Wait until `closed` holds and focus is on `target` (React Aria restores focus a frame or two after closing). */
const settlesOn = (p, closed, target) =>
  p.waitFor(`(${closed}) && document.activeElement === ${target}`, 10000, { quiet: true }).then(
    () => true,
    () => false,
  );

async function pass(p, width, scheme) {
  const tag = `${width} ${scheme}`;
  await p.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 640,
  });
  await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await p.goto(TIMELINE);
  await p.waitFor(`document.querySelectorAll("main ol > li").length > 0 && ${USER} && ${SYMPTOM}`, 45000);
  await sleep(300);

  // The user menu.
  await p.tap(USER);
  const opened = await p.waitFor(MENU, 5000).then(
    () => true,
    () => false,
  );
  const menu = opened
    ? await p.evaluate(`({ name: ${MENU}.getAttribute("aria-label"), l: ${lightness(MENU)} })`)
    : null;
  check(
    `${tag} user menu: a tap opens it, named, on a ${scheme} surface`,
    !!menu && menu.name === "Account" && themed(menu.l, scheme),
    JSON.stringify(menu),
  );
  await p.screenshot(`ui-user-${width}-${scheme}`);
  await escape(p);
  check(
    `${tag} user menu: Escape closes it, and focus returns`,
    await settlesOn(p, `!${MENU}`, USER),
    await p.evaluate(ACTIVE),
  );

  // The add sheet, and the calendar inside it.
  await p.tap(SYMPTOM);
  const sheetOpen = await p.waitFor(`${DIALOGS}.length === 1 && ${PICK}`, 15000).then(
    () => true,
    () => false,
  );
  const g = sheetOpen
    ? await p.evaluate(`(async () => { let el = ${DIALOGS}[0]; while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
        await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
        const r = el.getBoundingClientRect(); const o = el.parentElement.getBoundingClientRect(); const vw = Math.round(o.width);
        return { top: Math.round(r.top), left: Math.round(r.left - o.left), width: Math.round(r.width), height: Math.round(r.height), bottom: r.bottom, vw, vh: innerHeight }; })()`)
    : null;
  const l = sheetOpen ? await p.evaluate(lightness(`${DIALOGS}[0]`)) : null;
  check(
    `${tag} add sheet: ${width < 640 ? "the full screen" : "a centred dialog"}, on a ${scheme} surface`,
    !!g &&
      themed(l, scheme) &&
      (width < 640
        ? g.top === 0 && g.left === 0 && g.width === g.vw && g.height === g.vh
        : g.bottom < g.vh && Math.abs(g.left * 2 + g.width - g.vw) <= 2),
    JSON.stringify({ ...g, l }),
  );
  await p.screenshot(`ui-sheet-${width}-${scheme}`);
  await p.tap(PICK);
  const calendar = await p.waitFor(`document.querySelector('[role="grid"]')`, 5000).then(
    () => true,
    () => false,
  );
  await escape(p);
  check(
    `${tag} sheet calendar: opens, and Escape closes only it`,
    calendar &&
      (await p.waitFor(`!document.querySelector('[role="grid"]') && ${DIALOGS}.length === 1`, 5000).then(
        () => true,
        () => false,
      )),
  );
  await escape(p);
  check(
    `${tag} add sheet: Escape closes it, and focus returns to its link`,
    await settlesOn(p, `${DIALOGS}.length === 0`, SYMPTOM),
    await p.evaluate(ACTIVE),
  );
}

const browser = await launch(9491);
let p;
try {
  p = await openPage(browser, "ui");
  // Keep the page focused, as a real window would be (headless Chrome can lose page focus).
  await p.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await p.signIn("member@example.com", PW);
  await pass(p, 420, "dark");
  await pass(p, 1280, "light");
  const thrown = p.errors.filter((e) => e.includes("exception]"));
  check("no uncaught exceptions", thrown.length === 0, thrown.join(" | "));
} catch (e) {
  console.log("FAIL ", e.message);
  results.push(false);
} finally {
  browser.proc.kill();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
