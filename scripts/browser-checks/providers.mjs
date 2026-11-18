// The provider directory on devices (providers slice 1, the data layer):
// seeded providers, links and provider notes reach a signed-in device; each
// group's providers reach only its members; a writer's offline create-and-link
// (and link, unlink, delete) uploads once the network is back; a viewer's
// device write is refused locally.
//
// There are no provider screens yet, so it drives the device module itself
// (lib/sync/providers.ts, imported through Vite) against `window.caretookSync`.
// Later slices add their screens' steps here. Every provider and entry it makes
// carries this run's tag and is soft-deleted at the end, so it passes run
// after run without a reset.
import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const DEV_FAMILY_2 = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: `${sql};`,
  })
    .toString()
    .trim();
const waitForSql = async (sql, test, ms = 20000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (test(last)) return last;
    await sleep(300);
  }
  return last;
};

/** Run `body` in the page with the local database as `db` and the device modules as `providers` and `liveEntry`. */
const onDevice = (p, body) =>
  p.evaluate(`(async () => {
    const db = window.caretookSync;
    if (!db) throw new Error("window.caretookSync isn't there (dev builds only)");
    const providers = await import("/app/lib/sync/providers.ts");
    const liveEntry = await import("/app/lib/sync/liveEntry.ts");
    const timeline = await import("/app/lib/sync/timeline.ts");
    ${body}
  })()`);

const localRows = (p, sql, params = []) =>
  onDevice(p, `return db.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)});`);

async function signIn(p, email) {
  // On a fresh dev server the first load can fail while Vite optimises its deps: one retry.
  await p.signIn(email, PW).catch(async () => {
    await sleep(4000);
    await p.signIn(email, PW);
  });
  await p.waitFor(`window.caretookSync && window.caretookSync.powersync.currentStatus.hasSynced`, 30000);
}

const tag = `PV-${Date.now().toString(36)}`;
const proxyA = startProxy(9421);
const bA = await launch(9411, proxyA.args);
const bB = await launch(9412);
const bC = await launch(9413);
const pages = [];
try {
  const A = await openPage(bA, "caretaker");
  const B = await openPage(bB, "member");
  const C = await openPage(bC, "viewer");
  pages.push(A, B, C);

  // --- Seeds reach a member's device -------------------------------------
  await signIn(A, "caretaker@example.com");
  const seeded = psql(
    `SELECT count(*) FROM provider WHERE group_id = '${DEV_FAMILY}' AND deleted_at IS NULL AND name NOT LIKE 'PV-%'`,
  );
  const local = await localRows(
    A,
    `SELECT * FROM provider WHERE group_id = ? AND deleted_at IS NULL AND name NOT LIKE 'PV-%' ORDER BY is_primary DESC, status = 'past', name`,
    [DEV_FAMILY],
  );
  check(
    "Dev Family's seeded providers are on the caretaker's device",
    local.length === Number(seeded) && local.length >= 6,
    `${local.length} of ${seeded}`,
  );
  const alvarez = local.find((r) => r.name === "Dr. Elena Alvarez");
  const westside = local.find((r) => r.name === "Westside Family Medicine");
  check(
    "a provider arrives whole: practice, phones (JSON), primary (1)",
    !!alvarez &&
      alvarez.practice_id === westside?.id &&
      JSON.parse(alvarez.phones).length === 2 &&
      alvarez.is_primary === 1,
    JSON.stringify(
      alvarez && {
        practice: alvarez.practice_id === westside?.id,
        phones: alvarez.phones,
        primary: alvarez.is_primary,
      },
    ),
  );
  check("past providers sort last", local.at(-1)?.status === "past", local.at(-1)?.name);

  const links = await localRows(
    A,
    `SELECT l.id FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id WHERE l.group_id = ? AND p.name NOT LIKE 'PV-%'`,
    [DEV_FAMILY],
  );
  const pgLinks = psql(
    `SELECT count(*) FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id WHERE l.group_id = '${DEV_FAMILY}' AND p.name NOT LIKE 'PV-%'`,
  );
  check(
    "seeded links are on the device",
    links.length === Number(pgLinks) && links.length >= 6,
    `${links.length} of ${pgLinks}`,
  );
  const docs = await localRows(
    A,
    `SELECT id, subject, provider_id, text FROM note_document WHERE subject = 'provider' AND group_id = ?`,
    [DEV_FAMILY],
  );
  check(
    "provider notes (live documents) are on the device",
    docs.length >= 3 &&
      docs.every((d) => d.provider_id === d.id) &&
      docs.some((d) => d.text.includes("level 2")),
    `${docs.length} documents`,
  );
  const entryDocs = await localRows(
    A,
    `SELECT count(*) AS n FROM note_document WHERE subject = 'entry' AND entry_id = id`,
  );
  check("entry documents say they're an entry's", entryDocs[0]?.n > 0, `${entryDocs[0]?.n}`);

  const notMine = await localRows(A, `SELECT count(*) AS n FROM provider WHERE group_id = ?`, [DEV_FAMILY_2]);
  check(
    "another group's providers never reach the device",
    notMine[0]?.n === 0,
    `${notMine[0]?.n} from Dev Family 2`,
  );

  // --- A member of both groups gets both, each in its own group ------------
  await sleep(4000);
  await signIn(B, "member@example.com");
  const both = await localRows(
    B,
    `SELECT group_id, count(*) AS n FROM provider WHERE deleted_at IS NULL GROUP BY group_id`,
  );
  const byGroup = Object.fromEntries(both.map((r) => [r.group_id, r.n]));
  const lou = await localRows(B, `SELECT group_id FROM provider WHERE name = 'Dr. Grace Lindqvist'`);
  check(
    "member@ (two groups) gets each group's providers, kept apart",
    byGroup[DEV_FAMILY] >= 6 && byGroup[DEV_FAMILY_2] === 1 && lou[0]?.group_id === DEV_FAMILY_2,
    JSON.stringify(byGroup),
  );

  // --- Offline: create an event, create-and-link a provider, link a seeded one
  proxyA.setOnline(false);
  await A.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000);
  const entryId = await A.evaluate(`crypto.randomUUID()`);
  const offline = await onDevice(
    A,
    `const entryId = ${JSON.stringify(entryId)};
     const made = await liveEntry.materializeLiveEntry(db, {
       id: entryId, groupId: ${JSON.stringify(DEV_FAMILY)}, kind: "event", title: ${JSON.stringify(`${tag} cardiology visit`)},
       occurredAt: new Date().toISOString(), timeZone: "America/Los_Angeles",
     });
     const created = await providers.createAndLinkProvider(db, entryId, {
       type: "clinician", name: ${JSON.stringify(`${tag} Dr. Offline`)}, specialty: "Cardiology",
       phones: [{ label: "Office", number: "(555) 010-9900" }, { label: "Fax", number: "(555) 010-9901" }],
       website: "offline-heart.example",
     });
     const pharmacy = (await db.powersync.getAll("SELECT id FROM provider WHERE name = 'Cornerstone Pharmacy'"))[0];
     const linked = await providers.linkProvider(db, entryId, pharmacy.id);
     const again = await providers.linkProvider(db, entryId, pharmacy.id);
     const symptom = (await db.powersync.getAll("SELECT id FROM timeline_entry WHERE kind = 'symptom' AND deleted_at IS NULL LIMIT 1"))[0];
     const wrongKind = await providers.linkProvider(db, symptom.id, pharmacy.id);
     const bad = await providers.createProvider(db, ${JSON.stringify(DEV_FAMILY)}, { type: "practice", name: "x", practiceId: pharmacy.id });
     const local = await db.powersync.getAll("SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?", [entryId]);
     return { made, created, linked, again, wrongKind: wrongKind.ok, bad: bad.ok, pharmacyId: pharmacy.id, local: local.length };`,
  );
  check(
    "offline: the event, a new provider and two links are written locally",
    offline.made.ok && offline.created.ok && offline.linked.ok && offline.again.ok && offline.local === 2,
    JSON.stringify({ local: offline.local, created: offline.created.ok }),
  );
  check(
    "local writes refuse a symptom link and an invalid provider",
    offline.wrongKind === false && offline.bad === false,
  );
  const providerId = offline.created.id;
  check(
    "nothing reaches Postgres while offline",
    psql(`SELECT count(*) FROM provider WHERE id = '${providerId}'`) === "0" &&
      psql(`SELECT count(*) FROM timeline_entry_provider WHERE entry_id = '${entryId}'`) === "0",
  );

  proxyA.setOnline(true);
  const uploaded = await waitForSql(
    `SELECT count(*) FROM timeline_entry_provider WHERE entry_id = '${entryId}'`,
    (v) => v === "2",
    30000,
  );
  check("back online: the event's two links upload", uploaded === "2", `${uploaded} links`);
  const row = psql(
    `SELECT type || '|' || name || '|' || jsonb_array_length(phones) || '|' || website || '|' || is_primary FROM provider WHERE id = '${providerId}'`,
  );
  check(
    "…and the new provider, whole",
    row === `clinician|${tag} Dr. Offline|2|offline-heart.example|false`,
    row,
  );

  // The other member's device gets them through sync.
  await B.waitFor(
    `window.caretookSync.powersync.getAll("SELECT id FROM timeline_entry_provider WHERE entry_id = '${entryId}'").then((r) => r.length === 2)`,
    20000,
  ).then(
    () => check("another member's device receives the new links", true),
    () => check("another member's device receives the new links", false),
  );

  // --- Edit, unlink and delete sync too -----------------------------------
  const edits = await onDevice(
    A,
    `const updated = await providers.updateProvider(db, ${JSON.stringify(providerId)}, { isPrimary: true, status: "past" });
     const unlinked = await providers.unlinkProvider(db, ${JSON.stringify(entryId)}, ${JSON.stringify(offline.pharmacyId)});
     const removed = await providers.removeProvider(db, ${JSON.stringify(providerId)});
     return [updated.ok, unlinked.ok, removed.ok];`,
  );
  check("edit, unlink and delete locally", edits.every(Boolean), JSON.stringify(edits));
  const after = await waitForSql(
    `SELECT (SELECT count(*) FROM timeline_entry_provider WHERE entry_id = '${entryId}') || '|' || (SELECT (deleted_at IS NOT NULL)::text || is_primary::text || status FROM provider WHERE id = '${providerId}')`,
    (v) => v === "1|truetruepast",
    20000,
  );
  check("…and they upload: one link left, the provider soft-deleted", after === "1|truetruepast", after);

  // --- A viewer's device refuses writes -----------------------------------
  await sleep(4000);
  await signIn(C, "viewer@example.com");
  const viewer = await onDevice(
    C,
    `const created = await providers.createProvider(db, ${JSON.stringify(DEV_FAMILY)}, { type: "other", name: ${JSON.stringify(`${tag} viewer`)} });
     const linked = await providers.linkProvider(db, ${JSON.stringify(entryId)}, ${JSON.stringify(offline.pharmacyId)});
     return [created.ok, linked.ok];`,
  );
  check(
    "a viewer's device refuses to add or link",
    viewer.every((ok) => ok === false),
    JSON.stringify(viewer),
  );
  const viewerSees = await localRows(
    C,
    `SELECT count(*) AS n FROM provider WHERE group_id = ? AND deleted_at IS NULL`,
    [DEV_FAMILY],
  );
  check("…but sees the directory", viewerSees[0]?.n >= 6, `${viewerSees[0]?.n}`);

  // --- Clean up: soft-delete this run's event --------------------------------
  const cleaned = await onDevice(
    A,
    `return (await timeline.removeEntry(db, ${JSON.stringify(entryId)})).ok;`,
  );
  const gone = await waitForSql(
    `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE id = '${entryId}'`,
    (v) => v === "true",
  );
  check("clean up: this run's event is deleted", cleaned && gone === "true");

  // Being offline is noisy on purpose (the proxy cuts Vite's socket and PowerSync's stream).
  const noise =
    /401|Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_PROXY|Failed to fetch|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
} catch (e) {
  check("ran to the end", false, e.message);
} finally {
  for (const p of pages) p.close();
  for (const b of [bA, bB, bC]) b.proc.kill();
  proxyA.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
