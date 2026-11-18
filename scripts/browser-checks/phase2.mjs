import { launch, openPage, sleep } from "./cdp.mjs";
// The phase 2 timeline checks, against the local (PowerSync) data.
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const button = (text) =>
  `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const rows = `document.querySelectorAll("ol > li").length`;
const b = await launch(9341);
try {
  const p = await openPage(b, "member");
  await p.signIn("member@example.com", "caretook-dev-password");
  await p.waitFor(`${rows} > 0`, 20000);
  await sleep(500);

  const firstTop = await p.evaluate(`document.querySelector("ol > li").getBoundingClientRect().top`);
  check("first entry above the fold", firstTop < 900, `top ${Math.round(firstTop)}px`);
  const onScreen = await p.evaluate(
    `[...document.querySelectorAll("ol > li")].filter((li) => li.getBoundingClientRect().top < 900).length`,
  );
  check("dense first screen", onScreen >= 6, `${onScreen} rows start above the fold`);
  check(
    "no horizontal scroll",
    await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`),
  );
  check("first page is 30 entries", (await p.evaluate(rows)) === 30, `${await p.evaluate(rows)}`);

  await p.evaluate(`window.scrollTo(0, 1500)`);
  await sleep(200);
  const sticky = await p.evaluate(
    `[...document.querySelectorAll("section h3")].some((h) => { const t = h.getBoundingClientRect().top; return t >= 0 && t < 5; })`,
  );
  check("day header sticks while scrolling", sticky);
  await p.evaluate(`window.scrollTo(0, 0)`);

  const vitalsShown = await p.evaluate(`document.body.innerText.match(/BP \\d+\\/\\d+/) !== null`);
  check("latest vitals strip shows", vitalsShown);

  await p.press(button("Show older entries"));
  await p.waitFor(`${rows} === 60`, 5000).then(
    () => check("Show older adds a page (local)", true),
    async () => check("Show older adds a page (local)", false, `${await p.evaluate(rows)}`),
  );

  const more = await p.evaluate(`!!${button("More")}`);
  check("long text is clamped, with More", more);
  if (more) {
    await p.press(button("More"));
    check("More expands", await p.evaluate(`!!${button("Less")}`));
  }

  await p.press(
    `[...document.querySelectorAll('nav[aria-label="Show entries"] a')].find((a) => a.textContent.includes("Symptom"))`,
  );
  await p.waitFor(`location.search.includes("kind=symptom")`);
  await sleep(500);
  const kinds = await p.evaluate(
    `[...document.querySelectorAll("ol > li")].map((li) => li.textContent).join("|")`,
  );
  const count = await p.evaluate(rows);
  check("Symptoms filter", count > 0 && !kinds.includes("BP "), `${count} rows`);
  await p.press(`[...document.querySelectorAll('nav[aria-label="Show entries"] a')][0]`);
  await p.waitFor(`!location.search.includes("kind=")`);

  // Vitals menu, then Esc closes the sheet.
  await p.press(
    `[...document.querySelectorAll('[aria-label="Add to the timeline"] button')].find((b) => b.textContent.includes("Vitals"))`,
  );
  await p.waitFor(`document.querySelectorAll("[role=menuitem]").length > 0`, 5000);
  check(
    "Vitals menu opens",
    true,
    `${await p.evaluate(`document.querySelectorAll("[role=menuitem]").length`)} types`,
  );
  await p.press(`document.querySelector("[role=menuitem]")`);
  await p.waitFor(`document.querySelector("[role=dialog]")`, 5000);
  check("a vital type opens the sheet", true);
  await sleep(300);
  console.log("   focus:", await p.evaluate(`document.activeElement?.outerHTML.slice(0, 100)`));
  await p.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await p.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await p.waitFor(`!document.querySelector("[role=dialog]")`, 5000).then(
    () => check("Esc closes the sheet", true),
    () => check("Esc closes the sheet", false),
  );

  // The view survives a reload.
  await p.press(`document.querySelector('[aria-label="Cards"]')`);
  await sleep(1500);
  const cardsBefore = await p.evaluate(`document.querySelector("ol")?.className.includes("space-y-2")`);
  await p.goto(await p.evaluate("location.pathname"));
  await p.waitFor(`${rows} > 0`, 20000);
  const cardsAfter = await p.evaluate(`document.querySelector("ol")?.className.includes("space-y-2")`);
  check(
    "cards view survives a reload",
    cardsBefore && cardsAfter,
    `before ${cardsBefore}, after ${cardsAfter}, url ${await p.evaluate("location.href")}`,
  );
  await p.screenshot("phase2-cards");
  await p.press(`document.querySelector('[aria-label="Rows"]')`);
  await sleep(1500);

  check(
    "no console errors or warnings",
    p.errors.length === 0,
    p.errors.slice(0, 3).join(" | ").slice(0, 500),
  );
} catch (e) {
  console.log("ERROR", e.message);
  results.push(false);
} finally {
  b.proc.kill();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
}
