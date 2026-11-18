import { launch, openPage, sleep } from "./cdp.mjs";
// After sign-out, does the IndexedDB that backs local SQLite still hold care data?
const countIdb = `(async () => {
  const names = (await indexedDB.databases()).map((d) => d.name);
  if (!names.includes("caretook.sqlite")) return "no database: " + JSON.stringify(names);
  const db = await Promise.race([
    new Promise((res, rej) => { const r = indexedDB.open("caretook.sqlite"); r.onsuccess = () => res(r.result); r.onerror = rej; }),
    new Promise((res) => setTimeout(() => res(null), 3000)),
  ]);
  if (!db) return "open blocked (a delete is pending)";
  const out = {};
  for (const name of db.objectStoreNames) {
    out[name] = await new Promise((res) => { const r = db.transaction(name).objectStore(name).count(); r.onsuccess = () => res(r.result); });
  }
  db.close();
  return JSON.stringify(out);
})()`;
const b = await launch(9331);
try {
  const p = await openPage(b, "member");
  await p.signIn("member@example.com", "caretook-dev-password");
  await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);
  await sleep(1000);
  console.log(
    "signed in, rows in SQLite:",
    await p.evaluate(
      `window.caretookSync.powersync.get("SELECT count(*) n FROM timeline_entry").then(r => r.n)`,
    ),
  );
  console.log("IDB while signed in:", await p.evaluate(countIdb));
  await p.press(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Sign out")`);
  await p
    .waitFor(`location.pathname === "/sign-in"`, 15000)
    .catch(async () => console.log("still at", await p.evaluate("location.pathname")));
  await sleep(1000);
  console.log("IDB after sign-out:", await p.evaluate(countIdb));
  console.log("localStorage keys:", await p.evaluate(`JSON.stringify(Object.keys(localStorage))`));
  await p.goto("/sign-in");
  await sleep(1500);
  console.log("IDB after a reload:", await p.evaluate(countIdb));
  console.log("errors:", p.errors);
} finally {
  b.proc.kill();
}
