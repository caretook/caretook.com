import { launch, openPage, sleep } from "./cdp.mjs";
const PW = "caretook-dev-password";
const b = await launch(9301);
try {
  const p = await openPage(b, "member");
  await p.signIn("member@example.com", PW);
  await p.waitFor(`location.pathname.includes("/timeline")`, 20000);
  await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);
  console.log("rows:", await p.evaluate(`document.querySelectorAll("ol > li").length`));
  console.log("h1:", await p.evaluate(`document.querySelector("h1")?.textContent`));
  await sleep(1500);
  console.log(
    "status:",
    await p.evaluate(
      `JSON.stringify((() => { const s = window.caretookSync.powersync.currentStatus; return { connected: s.connected, hasSynced: s.hasSynced }; })())`,
    ),
  );
  console.log(
    "sample:",
    await p.evaluate(
      `window.caretookSync.powersync.getAll("SELECT occurred_at, created_at, deleted_at, details FROM timeline_entry ORDER BY occurred_at DESC LIMIT 3").then(JSON.stringify)`,
    ),
  );
  console.log(
    "counts:",
    await p.evaluate(
      `Promise.all(["care_group","care_group_member","care_recipient","timeline_entry","user"].map(t => window.caretookSync.powersync.get("SELECT count(*) AS n FROM \\"" + t + "\\"").then(r => t + "=" + r.n))).then(String)`,
    ),
  );
  console.log(
    "users:",
    await p.evaluate(`window.caretookSync.powersync.getAll('SELECT * FROM "user"').then(JSON.stringify)`),
  );
  await p.screenshot("smoke");
  console.log("errors:", p.errors);
} finally {
  b.proc.kill();
}
