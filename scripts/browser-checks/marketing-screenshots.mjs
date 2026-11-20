// The marketing site's app screenshots (marketing PRD, slice 2). A generator,
// not a check: it signs in as the seed users and captures set screens at
// 420 px, in light and dark, as WebP into apps/web/public/screenshots/.
//
// NOT IN USE YET: the site shows SVG placeholders (<name>.svg) until the app's
// screens settle; real screenshots are a backlog item before launch. When
// that's done, run this, commit the images, and point site/screenshots.ts (and
// the `Screenshot` component's light/dark sources) back at them.
//
//   pnpm prd browser marketing-screenshots --timeout 300
//
// Needs a freshly reset stack (`pnpm datastore:reset`) so only seed data
// shows, and a running dev server (`pnpm prd serve`). Fictional seed data only.
//
// Each screen is written twice: <name>-<theme>-840.webp (the 2x render) and
// <name>-<theme>-420.webp (the same render scaled down), for `srcset`. The
// names, sizes and alt text the site uses are in
// apps/web/app/routes/marketing/site/screenshots.ts: keep the two in step.
//
// It writes one live note (caretaker@ and member@ typing in it, for the Live
// now banner and the editor), then soft-deletes it, and sets member@'s
// timeline layout for the cards shot, then restores it. Captures are
// viewport-only (a full-page capture once hung headless Chrome for an hour)
// and give up after 10 s.
import { execSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launch, openPage, sleep } from "./cdp.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001"; // Dev Family (Grandma Pat)
const OUT = new URL("../../apps/web/public/screenshots/", import.meta.url).pathname;
const WIDTH = 420;
const HEIGHT = 840;
const QUALITY = 78;

const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: `${sql};`,
  })
    .toString()
    .trim();

mkdirSync(OUT, { recursive: true });
const written = [];
let failures = 0;

const timeline = `/app/groups/${GROUP}/timeline`;
const members = `/app/groups/${GROUP}/settings/members`;
const EDITOR = `document.querySelector(".ProseMirror")`;
const BANNER = `document.querySelector('main section[aria-label="Live now"]')`;
const ROWS = `document.querySelectorAll("main ol > li").length > 3`;

/** Phone metrics at 2x, so one render gives both sizes. */
const phone = (p) =>
  p.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: true,
  });
const scheme = (p, value) =>
  p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] });

async function capture(p, scale) {
  const shot = p.send("Page.captureScreenshot", {
    format: "webp",
    quality: QUALITY,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale },
  });
  return Promise.race([shot, sleep(10_000).then(() => null)]);
}

async function shoot(p, name, theme) {
  // Connected, so the header shows no "Offline" chip; then let fonts and
  // transitions settle, and hide the caret.
  await p.waitFor(`window.caretookSync?.powersync.currentStatus.connected`, 20000);
  await p.evaluate(`document.activeElement?.blur?.(); window.scrollTo(0, 0); true`);
  await sleep(800);
  for (const [scale, width] of [
    [1, 840],
    [0.5, 420],
  ]) {
    const result = await capture(p, scale);
    const file = `${name}-${theme}-${width}.webp`;
    if (!result) {
      console.log(`FAIL ${file}: capture timed out`);
      failures++;
      continue;
    }
    writeFileSync(join(OUT, file), Buffer.from(result.data, "base64"));
    written.push(file);
    console.log(`wrote ${file} (${Math.round(statSync(join(OUT, file)).size / 1024)} KB)`);
  }
}

async function typeLines(p, lines) {
  await p.evaluate(`(() => { const el = ${EDITOR}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  for (const [i, line] of lines.entries()) {
    if (i > 0 || (await p.evaluate(`${EDITOR}.textContent.length > 0`))) {
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
    }
    await p.send("Input.insertText", { text: line });
    await sleep(150);
  }
}

const memberId = psql(`SELECT id FROM "user" WHERE email = 'member@example.com'`);
const savedPrefs = psql(`SELECT preferences::text FROM "user" WHERE id = '${memberId}'`);
const setView = (view) =>
  psql(
    `UPDATE "user" SET preferences = coalesce(preferences, '{}'::jsonb) || '{"timelineView": "${view}"}'::jsonb WHERE id = '${memberId}'`,
  );

const M = await launch(9361);
const C = await launch(9362);
let noteId = null;
try {
  const m = await openPage(M, "member");
  const c = await openPage(C, "caretaker");
  await phone(m);
  await phone(c);
  setView("rows");
  // Straight to Dev Family's timeline by URL (member@ also has Dev Family 2).
  await m.signIn("member@example.com", PW, { home: true });
  await m.goto(timeline);
  await m.waitFor(ROWS, 45000);

  // 1. Static screens, in both themes.
  for (const theme of ["light", "dark"]) {
    await scheme(m, theme);

    setView("rows");
    await m.goto(timeline);
    await m.waitFor(ROWS, 30000);
    await shoot(m, "timeline-rows", theme);

    // The Today card's vitals row (the old "All vitals" expander went with its strip).
    await m.waitFor(`document.querySelector('main [data-today-row="vitals"]')`, 5000);
    await shoot(m, "vitals", theme);

    setView("cards");
    await m.goto(timeline);
    await m.waitFor(ROWS, 30000);
    await shoot(m, "timeline-cards", theme);
    setView("rows");

    await m.goto(members);
    await m.waitFor(`document.querySelector('[data-section="members"] li')`, 30000);
    await shoot(m, "members", theme);
  }

  // 2. A note written together: caretaker@ starts it, member@ sees Live now, then joins in.
  await c.signIn("caretaker@example.com", PW, { home: true });
  await c.goto(`/app/groups/${GROUP}/entries/new?kind=note`);
  await c.waitFor(EDITOR, 30000);
  await typeLines(c, ["Dr. Okafor's visit: blood pressure looked better today."]);
  await c.waitFor(`/\\/entries\\/[0-9a-f-]{36}$/.test(location.pathname)`, 10000);
  noteId = await c.evaluate(`location.pathname.split("/").at(-1)`);
  await c.evaluate(
    `(() => { const t = document.querySelector("main header input"); t.focus(); return true; })()`,
  );
  await c.type(`document.querySelector("main header input")`, "Cardiology follow-up");
  await c.evaluate(`document.querySelector("main header input").blur()`);
  await typeLines(c, [
    "She walked to the mailbox and back twice this week without getting short of breath.",
    "Keep the evening walk to 15 minutes, and lower salt at dinner.",
  ]);

  await scheme(m, "light");
  setView("rows");
  await m.goto(timeline);
  await m.waitFor(`${BANNER}`, 30000);
  for (const theme of ["light", "dark"]) {
    await scheme(m, theme);
    await typeLines(c, theme === "light" ? ["Weigh in every morning before breakfast."] : []);
    await m.waitFor(`${BANNER}`, 15000);
    await shoot(m, "live-now", theme);
  }

  await m.goto(`/app/groups/${GROUP}/entries/${noteId}`);
  await m.waitFor(`${EDITOR}?.textContent.includes("lower salt")`, 30000);
  await typeLines(m, ["Ask the pharmacy about a weekly pill organizer."]);
  await typeLines(c, ["Next visit in three weeks, on a Tuesday morning."]);
  await m.waitFor(`document.querySelector('main [data-region="editors"] [data-editor]')`, 15000);
  for (const theme of ["light", "dark"]) {
    await scheme(m, theme);
    await sleep(300);
    await shoot(m, "live-note", theme);
  }
} catch (e) {
  console.log(`FAIL ${e.message}`);
  failures++;
} finally {
  if (noteId)
    psql(`UPDATE timeline_entry SET deleted_at = now() WHERE id = '${noteId}' AND deleted_at IS NULL`);
  psql(`UPDATE "user" SET preferences = '${savedPrefs.replace(/'/g, "''")}'::jsonb WHERE id = '${memberId}'`);
  M.proc.kill();
  C.proc.kill();
}
console.log(`${written.length} images in ${OUT}`);
console.log(failures ? `FAILED (${failures})` : "done");
process.exit(failures ? 1 : 0);
