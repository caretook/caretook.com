// The timeline end to end: what only the real server, PowerSync and the seeds
// can show. member@ signs in and the first page of Dev Family's timeline
// arrives by sync; a provider linked on the server (as another device's
// upload would be) shows on its row without a reload and goes when it's
// unlinked; and offline (a cut proxy: Playwright's `setOffline` doesn't cut
// PowerSync's stream) an entry written elsewhere doesn't arrive until the
// device reconnects, then shows without a reload.
//
// Everything else the timeline does (filters by kind, author and vital type,
// row taps by role, More and Less, the ⋯ menu, day headings, the wide layout,
// the author tooltip, the strips, pass logs, infinite scroll, Live now and the
// live dot) is component tests on the test device, which has no server, so
// they all run offline too, beside the route:
// apps/web/app/routes/app/groups/timeline/timeline*.browser.test.tsx.
//
// Order-independent: it tags what it writes and deletes it at the end. The
// smoke run (`--smoke`) keeps the sign-in, the first page and the linked provider.
import {
  DEV_FAMILY,
  DEV_FAMILY_TIMELINE as TIMELINE,
  expect,
  psql,
  signIn,
  test,
  waitFor,
} from "./fixtures.mjs";

const TZ = "America/Los_Angeles";
const rows = `document.querySelectorAll("ol > li:not([data-marker])").length`;
const mainHas = (text) => `!!document.querySelector("main")?.textContent.includes(${JSON.stringify(text)})`;
const waits = (page, expr, timeout) =>
  waitFor(page, expr, { timeout }).then(
    () => true,
    () => false,
  );

/** PowerSync's console noise while a proxy is cut, and a first visit's reloads: never a failure here. */
const NOISE =
  /error closing database connection|\[PowerSync\]: Sync aborted|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|status of 401|Error loading route module|Failed to fetch dynamically imported module|Failed to load resource|\[vite\] failed to connect/;
const noErrors = (d) => {
  const errors = d.errors.filter((e) => !NOISE.test(e));
  expect(errors.slice(0, 3).join(" | ").slice(0, 500), "console errors or warnings").toBe("");
};

/** The "with …" line of the first entry titled `title`: the names shown and the "+N". */
const withLineOf = (page, title) =>
  page.evaluate(`(() => {
    const li = [...document.querySelectorAll("ol > li:not([data-marker])")].find((li) =>
      li.querySelector("p.font-semibold")?.textContent.trim() === ${JSON.stringify(title)});
    const line = li?.querySelector("[data-with]");
    return li ? {
      names: [...(line?.querySelectorAll("[data-with-name]") ?? [])].map((n) => n.textContent),
      more: line?.querySelector("[data-with-more]")?.textContent.trim() ?? null,
    } : null;
  })()`);

test.beforeEach(() => {
  test.setTimeout(150_000);
});

test(
  "signed in: the first page arrives by sync; a link made elsewhere shows on its row",
  { tag: "@smoke" },
  async ({ device }) => {
    const d = await device("member");
    const { page } = d;
    await signIn(page, "member@example.com");

    await test.step("signed in: the first page (30 entries) arrives by sync", async () => {
      await waitFor(page, `${rows} > 0`, { timeout: 30_000 });
      await expect.poll(() => page.evaluate(rows), { timeout: 10_000 }).toBe(30);
    });

    // A provider linked on the server shows on the row without a reload (+1),
    // and goes when it's unlinked. Events only: on the unfiltered timeline,
    // upcoming events, doses and changes can push the seeded event past the first page.
    await page.goto(`${TIMELINE}?kind=event`);
    await waitFor(page, `document.querySelector("ol > li:not([data-marker]) [data-with]")`, {
      timeout: 20_000,
    });
    await test.step("the seeded event's two providers arrive by sync", async () => {
      await expect
        .poll(async () => {
          const two = await withLineOf(page, "Pharmacy pickup");
          return two?.names.length === 2 && two.more === null;
        })
        .toBe(true);
    });

    const [entryId, providerId] = psql(
      `SELECT (SELECT id FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND title = 'Pharmacy pickup' AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 1)
         || '|' || (SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND name = 'Dr. Alan Whitford')`,
    ).split("|");
    const linkId = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8e9007";
    const unlink = () => psql(`DELETE FROM timeline_entry_provider WHERE id = '${linkId}'`);
    unlink();
    await page.evaluate("window.__noReload = true");
    try {
      psql(
        `INSERT INTO timeline_entry_provider (id, group_id, entry_id, provider_id, created_by, updated_by)
         SELECT '${linkId}', '${DEV_FAMILY}', '${entryId}', '${providerId}', created_by, created_by
         FROM timeline_entry WHERE id = '${entryId}'`,
      );
      const shows = `([...document.querySelectorAll("ol > li:not([data-marker])")].find((li) => li.querySelector("p.font-semibold")?.textContent.trim() === "Pharmacy pickup")?.querySelector("[data-with-more]")?.textContent.trim() === "+1")`;
      await test.step("a link made elsewhere shows on the row without a reload (+1)", async () => {
        expect(
          await waits(page, shows, 20_000),
          JSON.stringify(await withLineOf(page, "Pharmacy pickup")),
        ).toBe(true);
      });
      unlink();
      await test.step("…and goes when it's unlinked", async () => {
        expect(
          await waits(page, `!${shows}`, 20_000),
          JSON.stringify(await withLineOf(page, "Pharmacy pickup")),
        ).toBe(true);
      });
      await test.step("…with no reload", async () => {
        expect(await page.evaluate("window.__noReload === true")).toBe(true);
      });
    } finally {
      unlink();
    }

    await test.step("no console errors or warnings", () => noErrors(d));
  },
);

// Offline, then reconnect: with the proxy cut, an entry written on the server
// meanwhile doesn't arrive until the connection is back, then shows without a
// reload. (Filtering offline is timelineFilters.browser.test.tsx's.)
test("offline, then reconnect", async ({ device }) => {
  const d = await device("member", { offlineable: true });
  const { page } = d;
  await signIn(page, "member@example.com");
  await waitFor(page, `${rows} > 0`, { timeout: 30_000 });

  const tag = `P2-OFF-${Date.now().toString(36)}`;
  await page.goto(TIMELINE);
  await waitFor(page, `${rows} > 0 && window.caretookSync?.powersync.currentStatus.connected`, {
    timeout: 30_000,
  });
  d.offline(true);
  let id = "";
  try {
    await test.step("offline: PowerSync's stream is cut", async () => {
      expect(await waits(page, `!window.caretookSync.powersync.currentStatus.connected`, 20_000)).toBe(true);
    });
    const caretaker = psql(`SELECT id FROM "user" WHERE email = 'caretaker@example.com'`);
    id = psql(
      `INSERT INTO timeline_entry (group_id, recipient_id, kind, occurred_at, time_zone, details, created_by, updated_by)
       SELECT group_id, id, 'symptom', now(), '${TZ}', '{"name": "${tag}", "severity": 2}'::jsonb, '${caretaker}', '${caretaker}'
       FROM care_recipient WHERE group_id = '${DEV_FAMILY}' RETURNING id`,
    );
    // Disconnected, nothing can arrive: no pause to "give it a chance" is needed.
    await test.step("offline: the entry written elsewhere hasn't arrived", async () => {
      const local = await page.evaluate(
        (entry) =>
          window.caretookSync.powersync
            .getAll("SELECT count(*) AS n FROM timeline_entry WHERE id = ?", [entry])
            .then((r) => r[0].n),
        id,
      );
      expect(local).toBe(0);
      expect(await page.evaluate(mainHas(tag))).toBe(false);
    });

    d.offline(false);
    await test.step("reconnected: the entry written elsewhere arrives without a reload", async () => {
      await waitFor(page, mainHas(tag), { timeout: 30_000, message: "the entry written elsewhere arrives" });
    });
  } finally {
    d.offline(false);
    if (id) psql(`UPDATE timeline_entry SET deleted_at = now() WHERE id = '${id}' AND deleted_at IS NULL`);
  }

  await test.step("no console errors or warnings", () => noErrors(d));
});
