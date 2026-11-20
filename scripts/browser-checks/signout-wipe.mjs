import { launch, localCopyHolds, openPage, sleep } from "./cdp.mjs";
// After sign-out, does the IndexedDB that backs local SQLite still hold care
// data? Prints the stores' counts at each stage. It also checks what search
// keeps on the device (from search.mjs): the search index (its tables live
// outside PowerSync's, so `dropSearchTables` must run before the wipe) and
// the user's recent searches (localStorage) are gone after sign-out.
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
const recentKeys = `JSON.stringify(Object.keys(localStorage).filter((k) => k.startsWith("caretook:recentSearches:")))`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const b = await launch(9331);
let errors = [];
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

  // A search used on the search page (submitted), and the index built.
  const groupPath = await p.evaluate(`location.pathname.replace(/\\/timeline$/, "")`);
  await p.goto(`${groupPath}/search`);
  await p.waitFor(`document.querySelector("[data-search-page] [data-search-field]")`, 20000);
  await p.type(`document.querySelector("[data-search-field]")`, "lisinopril");
  await p.evaluate(`document.querySelector("[data-search-field]").form.requestSubmit()`);
  await p.waitFor(`${recentKeys} !== "[]"`, 5000).catch(() => undefined);
  await p.evaluate(
    `(async () => { const { search } = await window.caretookModules(); await search.searchIndexSettled(); return true; })()`,
  );
  check("a used search is saved for its user", (await p.evaluate(recentKeys)) !== "[]");
  const indexed = await p.evaluate(localCopyHolds("search_fts"));
  check("the search index is in the local copy while signed in", indexed === "holds it", indexed);
  console.log("IDB while signed in:", await p.evaluate(countIdb));

  await p.signOut();
  await p
    .waitFor(`location.pathname === "/sign-in"`, 15000)
    .catch(async () => console.log("still at", await p.evaluate("location.pathname")));
  await sleep(1000);
  console.log("IDB after sign-out:", await p.evaluate(countIdb));
  console.log("localStorage keys:", await p.evaluate(`JSON.stringify(Object.keys(localStorage))`));
  check("sign-out clears the recent searches", (await p.evaluate(recentKeys)) === "[]");
  const dropped = await p.evaluate(localCopyHolds("search_fts"));
  check(
    "sign-out drops the search index (no search table left in the file)",
    dropped === "clean" || dropped === "no file",
    dropped,
  );
  await p.goto("/sign-in");
  await sleep(1500);
  console.log("IDB after a reload:", await p.evaluate(countIdb));
  errors = p.errors;
} catch (e) {
  check("the check ran to the end", false, e.stack ?? String(e));
} finally {
  b.proc.kill();
}
// The verdict: the exit code, or the "N/M passed" line when browser.sh stops
// the check (2 s after its last line, "errors:", if it hasn't exited).
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exitCode = passed === results.length ? 0 : 1;
console.log("errors:", errors);
