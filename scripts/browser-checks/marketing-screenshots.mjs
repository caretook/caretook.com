// The marketing site's app screenshots (marketing PRD, slice 2). A generator,
// not a check: it signs in as the seed users and captures set screens at
// 420 px, in light and dark, as WebP into apps/web/public/screenshots/.
//
// NOT IN USE YET: the site shows SVG placeholders (<name>.svg) until the app's
// screens settle; real screenshots are a backlog item before launch. When
// that's done, run this, commit the images, and point site/screenshots.ts (and
// the `Screenshot` component's light/dark sources) back at them.
//
//   BASE=http://localhost:<WEB_PORT> PG_CONTAINER=<container> \
//     node scripts/browser-checks/marketing-screenshots.mjs
//
// It is a Playwright script, not a spec: it is not in the manifest and
// `pnpm prd browser` doesn't run it, and nothing runs it (B-40 is parked). Needs
// a freshly reset stack (`pnpm datastore:reset`) so only seed data shows, and a
// running check build (`pnpm prd serve --built`). Fictional seed data only.
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
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

import { BASE, DEV_FAMILY as GROUP, PASSWORD as PW, psql, randomIp, signIn, waitFor } from "./fixtures.mjs";

const OUT = new URL("../../apps/web/public/screenshots/", import.meta.url).pathname;
const WIDTH = 420;
const HEIGHT = 840;
const QUALITY = 78;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const written = [];
let failures = 0;

const timeline = `/app/groups/${GROUP}/timeline`;
const members = `/app/groups/${GROUP}/settings/members`;
const EDITOR = ".ProseMirror";
const BANNER = 'main section[aria-label="Live now"]';
const rowsShown = () => document.querySelectorAll("main ol > li").length > 3;

/** A phone at 2x, so one render gives both sizes; its own client IP for the sign-in limits. */
async function openPhone(browser) {
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    isMobile: true,
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    extraHTTPHeaders: { "x-forwarded-for": randomIp() },
  });
  const page = await context.newPage();
  page.cdp = await context.newCDPSession(page);
  return page;
}

const scheme = (page, colorScheme) => page.emulateMedia({ colorScheme });

// Playwright's own screenshot has no WebP, so the capture goes through CDP.
async function capture(page, scale) {
  const shot = page.cdp.send("Page.captureScreenshot", {
    format: "webp",
    quality: QUALITY,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale },
  });
  return Promise.race([shot, sleep(10_000).then(() => null)]);
}

async function shoot(page, name, theme) {
  // Connected, so the header shows no "Offline" chip; then let fonts and
  // transitions settle, and hide the caret.
  await waitFor(page, () => window.caretookSync?.powersync.currentStatus.connected, { timeout: 20_000 });
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  await sleep(800);
  for (const [scale, width] of [
    [1, 840],
    [0.5, 420],
  ]) {
    const result = await capture(page, scale);
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

async function typeLines(page, lines) {
  const editor = page.locator(EDITOR);
  await editor.evaluate((el) => {
    el.focus();
    const sel = getSelection();
    sel.selectAllChildren(el);
    sel.collapseToEnd();
  });
  for (const [i, line] of lines.entries()) {
    if (i > 0 || (await editor.evaluate((el) => el.textContent.length > 0)))
      await page.keyboard.press("Enter");
    await page.keyboard.insertText(line);
    await sleep(150);
  }
}

const memberId = psql(`SELECT id FROM "user" WHERE email = 'member@example.com'`);
const savedPrefs = psql(`SELECT preferences::text FROM "user" WHERE id = '${memberId}'`);
const setView = (view) =>
  psql(
    `UPDATE "user" SET preferences = coalesce(preferences, '{}'::jsonb) || '{"timelineView": "${view}"}'::jsonb WHERE id = '${memberId}'`,
  );

const browser = await chromium.launch();
let noteId = null;
try {
  const m = await openPhone(browser);
  const c = await openPhone(browser);
  setView("rows");
  // Straight to Dev Family's timeline by URL (member@ also has Dev Family 2).
  await signIn(m, "member@example.com", PW, { home: true });
  await m.goto(timeline);
  await waitFor(m, rowsShown, { timeout: 45_000 });

  // 1. Static screens, in both themes.
  for (const theme of ["light", "dark"]) {
    await scheme(m, theme);

    setView("rows");
    await m.goto(timeline);
    await waitFor(m, rowsShown, { timeout: 30_000 });
    await shoot(m, "timeline-rows", theme);

    // The Today card's vitals row (the old "All vitals" expander went with its strip).
    await m.locator('main [data-today-row="vitals"]').first().waitFor({ timeout: 5000 });
    await shoot(m, "vitals", theme);

    setView("cards");
    await m.goto(timeline);
    await waitFor(m, rowsShown, { timeout: 30_000 });
    await shoot(m, "timeline-cards", theme);
    setView("rows");

    await m.goto(members);
    await m.locator('[data-section="members"] li').first().waitFor({ timeout: 30_000 });
    await shoot(m, "members", theme);
  }

  // 2. A note written together: caretaker@ starts it, member@ sees Live now, then joins in.
  await signIn(c, "caretaker@example.com", PW, { home: true });
  await c.goto(`/app/groups/${GROUP}/entries/new?kind=note`);
  await c.locator(EDITOR).waitFor({ timeout: 30_000 });
  await typeLines(c, ["Dr. Okafor's visit: blood pressure looked better today."]);
  await c.waitForURL(/\/entries\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  noteId = new URL(c.url()).pathname.split("/").at(-1);
  const title = c.locator("main header input");
  await title.fill("Cardiology follow-up");
  await title.blur();
  await typeLines(c, [
    "She walked to the mailbox and back twice this week without getting short of breath.",
    "Keep the evening walk to 15 minutes, and lower salt at dinner.",
  ]);

  await scheme(m, "light");
  setView("rows");
  await m.goto(timeline);
  await m.locator(BANNER).waitFor({ timeout: 30_000 });
  for (const theme of ["light", "dark"]) {
    await scheme(m, theme);
    await typeLines(c, theme === "light" ? ["Weigh in every morning before breakfast."] : []);
    await m.locator(BANNER).waitFor({ timeout: 15_000 });
    await shoot(m, "live-now", theme);
  }

  await m.goto(`/app/groups/${GROUP}/entries/${noteId}`);
  await m.locator(EDITOR, { hasText: "lower salt" }).waitFor({ timeout: 30_000 });
  await typeLines(m, ["Ask the pharmacy about a weekly pill organizer."]);
  await typeLines(c, ["Next visit in three weeks, on a Tuesday morning."]);
  await m.locator('main [data-region="editors"] [data-person]').first().waitFor({ timeout: 15_000 });
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
  await browser.close();
}
console.log(`${written.length} images in ${OUT}`);
console.log(failures ? `FAILED (${failures})` : "done");
process.exit(failures ? 1 : 0);
