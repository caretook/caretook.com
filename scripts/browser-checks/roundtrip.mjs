import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

// The dev Postgres container: a loop's own (PG_CONTAINER in .env.loop) or the main one.
const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";

const PW = "caretook-dev-password";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();

const rowWith = (text) =>
  `[...document.querySelectorAll("ol > li")].find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
const button = (text, scope = "document") =>
  `[...${scope}.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;

async function addNote(p, body) {
  await p.press(button("Note"));
  await p.waitFor(`document.querySelector('[role=dialog] textarea[name="body"]')`);
  await p.type(`document.querySelector('[role=dialog] textarea[name="body"]')`, body);
  await p.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
}

async function timeUntil(p, expr, ms = 20000) {
  const t0 = Date.now();
  await p.waitFor(expr, ms);
  return Date.now() - t0;
}

const proxyA = startProxy(9321);
const bA = await launch(9311, proxyA.args);
const bB = await launch(9312);
const bC = await launch(9313);
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "caretaker");
  await A.signIn("member@example.com", PW);
  await B.signIn("caretaker@example.com", PW);
  for (const p of [A, B]) await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);
  check("both members see the synced timeline", true);

  // 1. Add on A, appears on B.
  const tag = `RT-${Date.now()}`;
  const t0 = Date.now();
  await addNote(A, `${tag} lunch note`);
  await A.waitFor(rowWith(tag), 5000);
  const localMs = Date.now() - t0;
  const remoteMs = await timeUntil(B, rowWith(tag));
  check("add: shows on this device at once", localMs < 1500, `${localMs} ms`);
  check("add: reaches the other member", true, `${remoteMs + localMs} ms after submit`);
  const author = psql(
    `SELECT u.email FROM timeline_entry e JOIN "user" u ON u.id = e.created_by WHERE e.body = '${tag} lunch note'`,
  );
  check("add: stored in Postgres as the member", author === "member@example.com", author);

  // 2. Edit on B, appears on A.
  await B.press(`${rowWith(tag)}.querySelector('button[aria-label]')`);
  await B.waitFor(menuItem("Edit"));
  await B.press(menuItem("Edit"));
  await B.waitFor(`document.querySelector('[role=dialog] textarea[name="body"]')`);
  await B.type(`document.querySelector('[role=dialog] textarea[name="body"]')`, `${tag} lunch note, edited`);
  await B.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
  const editMs = await timeUntil(A, `${rowWith(tag)}?.textContent.includes("edited")`);
  check("edit: reaches the other member", true, `${editMs} ms`);
  check(
    "edit: stored as the caretaker",
    psql(
      `SELECT u.email FROM timeline_entry e JOIN "user" u ON u.id = e.updated_by WHERE e.body LIKE '${tag}%'`,
    ) === "caretaker@example.com",
  );

  // 3. Validation stays local.
  await A.press(button("Note"));
  await A.waitFor(`document.querySelector('[role=dialog] textarea[name="body"]')`);
  await A.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
  await A.waitFor(
    `document.querySelector('[role=dialog]')?.textContent.match(/required|Write|empty|enter/i)`,
    5000,
  ).then(
    () => check("validation: an empty note shows a field error", true),
    async () =>
      check(
        "validation: an empty note shows a field error",
        false,
        await A.evaluate(`document.querySelector('[role=dialog]')?.innerText`),
      ),
  );
  await A.press(button("Cancel", `document.querySelector('[role=dialog]')`));
  await A.waitFor(`!document.querySelector('[role=dialog]')`);

  // 4. Delete on A, disappears on B.
  await A.press(`${rowWith(tag)}.querySelector('button[aria-label]')`);
  await A.waitFor(menuItem("Delete"));
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open] .btn-error")`);
  await A.press(`document.querySelector("dialog[open] .btn-error")`);
  await A.waitFor(`!${rowWith(tag)}`, 5000);
  const delMs = await timeUntil(B, `!${rowWith(tag)}`);
  check("delete: disappears for the other member", true, `${delMs} ms`);
  check(
    "delete: soft-deleted in Postgres",
    psql(`SELECT deleted_at IS NOT NULL FROM timeline_entry WHERE body LIKE '${tag}%'`) === "t",
  );

  // 5. Offline on A.
  const offTag = `OFF-${Date.now()}`;
  proxyA.setOnline(false);
  const attached = ["proxy"];
  await A.waitFor(`document.body.innerText.includes("Offline")`, 20000).then(
    () => check("offline: header says Offline", true, attached.join(",")),
    () => check("offline: header says Offline", false, attached.join(",")),
  );
  await addNote(A, `${offTag} written offline`);
  await A.waitFor(rowWith(offTag), 5000);
  check("offline: the entry shows on this device", true);
  await sleep(4000);
  check(
    "offline: not on the server yet",
    psql(`SELECT count(*) FROM timeline_entry WHERE body LIKE '${offTag}%'`) === "0",
  );
  check("offline: the other member doesn't have it yet", !(await B.evaluate(`!!${rowWith(offTag)}`)));
  await A.screenshot("offline-member");
  proxyA.setOnline(true);
  const backMs = await timeUntil(B, rowWith(offTag), 60000);
  check("reconnect: the offline entry reaches the other member", true, `${backMs} ms after reconnecting`);
  await A.waitFor(`!document.body.innerText.includes("Offline")`, 20000).then(
    () => check("reconnect: Offline badge clears", true),
    () => check("reconnect: Offline badge clears", false),
  );

  // 6. Viewer: read-only.
  const C = await openPage(bC, "viewer");
  await C.signIn("viewer@example.com", PW);
  await C.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);
  check("viewer: sees the timeline", await C.evaluate(`!!${rowWith(offTag)}`));
  check(
    "viewer: no add bar",
    !(await C.evaluate(`!!document.querySelector('[aria-label="Add to the timeline"]')`)),
  );
  check(
    "viewer: no entry menus",
    !(await C.evaluate(`!!document.querySelector('ol > li button[aria-label^="Actions"]')`)),
  );

  // 7. Sign-out wipes the device.
  await A.press(button("Sign out"));
  await A.waitFor(`location.pathname === "/sign-in"`, 15000);
  const left = await A.evaluate(`(async () => {
    const dbs = await indexedDB.databases(); return JSON.stringify(dbs.map((d) => d.name)); })()`);
  check("sign-out: lands on sign-in", true, `IndexedDB after: ${left}`);
  await A.goto("/app");
  await A.waitFor(`location.pathname === "/sign-in"`, 15000);
  check("sign-out: /app needs signing in again", true);

  await A.screenshot("rt-member");
  await B.screenshot("rt-caretaker");
  await C.screenshot("rt-viewer");
  const errors = [...A.errors, ...B.errors, ...C.errors].filter(
    (e) =>
      !e.includes("ERR_INTERNET_DISCONNECTED") &&
      !e.includes("Failed to fetch") &&
      // Vite's dev HMR socket doesn't pass through the test proxy (browser A only).
      !(e.startsWith("[member") && /\[vite\]|Vite server/.test(e)) &&
      // PowerSync logs the dropped stream while browser A is offline on purpose.
      !(e.startsWith("[member") && e.includes("[PowerSync]: Sync error")),
  );
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
} catch (e) {
  console.log("ERROR", e.message);
} finally {
  for (const b of [bA, bB, bC]) b.proc.kill();
  proxyA.close();
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
}
