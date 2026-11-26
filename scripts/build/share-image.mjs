// The share image: renders apps/web/public/og-default.svg (the lockup) to
// og-default.png at 1200×630, in headless Chromium through Playwright, with
// the site's typeface (apps/web/app/fonts/) so the words look as they do on
// the site. Run it by hand after changing the SVG, and commit both files:
//
//   node scripts/build/share-image.mjs
//
// Nothing runs it in a build or a check. The words in the SVG match home's
// hero lockup and the alt text in routes/marketing/site/meta.ts
// (site/meta.test.ts holds them together).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WIDTH = 1200;
const HEIGHT = 630;
const file = (path) => fileURLToPath(new URL(`../../apps/web/${path}`, import.meta.url));
const font = (name) => readFileSync(file(`app/fonts/${name}`)).toString("base64");
const face = (name, style) =>
  `@font-face { font-family: "Atkinson Hyperlegible Next"; font-weight: 200 800; font-style: ${style};
    src: url("data:font/woff2;base64,${font(name)}") format("woff2"); }`;

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  ${face("AtkinsonHyperlegibleNext-Variable.woff2", "normal")}
  ${face("AtkinsonHyperlegibleNext-Italic-Variable.woff2", "italic")}
  html, body { margin: 0; }
  svg { display: block; }
</style>
${readFileSync(file("public/og-default.svg"), "utf8")}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const out = file("public/og-default.png");
  writeFileSync(out, await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } }));
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
