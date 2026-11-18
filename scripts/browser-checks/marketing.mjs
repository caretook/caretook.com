// The marketing site (marketing PRD): home at 420 and 1280 in light and dark,
// one h1, landmarks, the skip link, the phone menu (opens, closes with Escape),
// meta tags and JSON-LD, sitemap.xml and robots.txt, no third-party requests,
// no /app or sync chunk, the calls to action, and Sign in reaching /sign-in.
// Each marketing page loads with one h1. Features, FAQ and About at 420 and
// 1280: one h1, screenshots with alt text and responsive, lazy sources, and
// the FAQ's JSON-LD matching its visible questions. No sign-in and nothing written, so
// there's nothing to clean up.
//
// Screenshots (full page) go to the worktree's git dir, never the repo:
// <git dir>/marketing-shots/home-<width>-<theme>.png
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BASE, launch, openPage, sleep } from "./cdp.mjs";

const PAGES = ["/", "/features", "/faq", "/about", "/contact", "/privacy", "/terms", "/health-data-privacy"];
// Modules that only the app needs: none may load on a marketing page (dev
// serves source paths, so these show in the resource URLs).
const APP_CHUNK =
  /\/app\/routes\/app\/|\/app\/lib\/sync\/|\/app\/lib\/session|powersync|wa-sqlite|yjs|tiptap|prosemirror/i;

const SHOTS = join(
  execFileSync("git", ["rev-parse", "--absolute-git-dir"]).toString().trim(),
  "marketing-shots",
);
mkdirSync(SHOTS, { recursive: true });

let passed = 0;
let failed = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
  if (ok) passed++;
  else failed++;
};

const origin = new URL(BASE).origin;

const b = await launch(9351);
try {
  const p = await openPage(b, "marketing");

  const viewport = (width) =>
    p.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
  const scheme = (value) =>
    p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] });
  const key = async (name, code, keyCode, text) => {
    await p.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: name,
      code,
      windowsVirtualKeyCode: keyCode,
      ...(text && { text }),
    });
    await p.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: name,
      code,
      windowsVirtualKeyCode: keyCode,
    });
  };
  const resources = () =>
    p.evaluate(`[location.href, ...performance.getEntriesByType("resource").map((e) => e.name)]`);
  const hydrated = `document.querySelector('header button[aria-controls]') && window.__reactRouterRouteModules && window.__reactRouterRouteModules["routes/marketing/home/route"]`;
  const background = `getComputedStyle(document.querySelector("main").parentElement).backgroundColor`;
  // Screenshots are for review, not assertions, so they're off unless MARKETING_SHOTS=1. A full-page
  // capture (captureBeyondViewport) once hung this check for over an hour, so these are viewport-only
  // and give up after 10 s.
  const shot = async (name) => {
    if (process.env.MARKETING_SHOTS !== "1") return;
    const capture = p.send("Page.captureScreenshot", { format: "png" });
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 10_000));
    const result = await Promise.race([capture, timeout]);
    if (result) writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(result.data, "base64"));
    else console.log(`screenshot ${name} timed out; skipped`);
  };

  // 1. Home at both widths, in both themes.
  const backgrounds = {};
  for (const width of [420, 1280]) {
    for (const theme of ["light", "dark"]) {
      const label = `home ${width} ${theme}`;
      await viewport(width);
      await scheme(theme);
      await p.goto("/");
      await p.waitFor(hydrated, 15000);
      const state = await p.evaluate(`({
        h1: document.querySelectorAll("h1").length,
        banner: !!document.querySelector("header"),
        main: document.querySelectorAll("main").length,
        footer: !!document.querySelector("footer"),
        navs: [...document.querySelectorAll("nav[aria-label]")].map((n) => n.getAttribute("aria-label")),
        overflow: document.documentElement.scrollWidth > innerWidth,
        menuButton: getComputedStyle(document.querySelector("header button[aria-controls]")).display !== "none",
        headerNav: getComputedStyle(document.querySelector("header nav")).display !== "none",
      })`);
      check(state.h1 === 1, `${label}: one h1`, `${state.h1}`);
      check(state.banner && state.main === 1 && state.footer, `${label}: header, main, footer landmarks`);
      check(!state.overflow, `${label}: no horizontal scroll`);
      check(
        width < 768 ? state.menuButton && !state.headerNav : !state.menuButton && state.headerNav,
        `${label}: ${width < 768 ? "menu button, no header links" : "header links, no menu button"}`,
      );
      backgrounds[theme] = await p.evaluate(background);
      await shot(`home-${width}-${theme}`);
    }
  }
  check(backgrounds.light !== backgrounds.dark, "the theme follows the device", JSON.stringify(backgrounds));

  // 2. A stored app theme choice wins over the device.
  await scheme("light");
  await p.evaluate(`localStorage.setItem("caretook:theme", "dark")`);
  await p.goto("/");
  await p.waitFor(hydrated, 15000);
  check(
    (await p.evaluate(`document.documentElement.dataset.theme`)) === "dark" &&
      (await p.evaluate(background)) === backgrounds.dark,
    "a stored theme (dark) applies on a light device",
  );
  await p.evaluate(`localStorage.removeItem("caretook:theme")`);

  // 3. Meta tags and JSON-LD.
  const meta = await p.evaluate(`(() => {
    const m = (sel) => document.querySelector(sel)?.getAttribute("content") ?? null;
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
    return {
      title: document.title,
      description: m('meta[name="description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
      ogTitle: m('meta[property="og:title"]'),
      ogImage: m('meta[property="og:image"]'),
      ogUrl: m('meta[property="og:url"]'),
      twitter: m('meta[name="twitter:card"]'),
      icon: !!document.querySelector('link[rel="icon"][href="/favicon.svg"]'),
      manifest: !!document.querySelector('link[rel="manifest"]'),
      ld,
    };
  })()`);
  check(meta.title.includes("Caretook") && !!meta.description, "title and description", meta.title);
  check(
    !!meta.canonical && meta.canonical === meta.ogUrl && new URL(meta.canonical).pathname === "/",
    "canonical and og:url",
    meta.canonical,
  );
  check(
    !!meta.ogTitle && /\/og-default\.png$/.test(meta.ogImage ?? ""),
    "Open Graph title and image",
    meta.ogImage,
  );
  check(meta.twitter === "summary_large_image", "Twitter card");
  check(meta.icon && meta.manifest, "favicon and manifest links");
  check(
    meta.ld.some((d) => d["@type"] === "Organization" && d.name === "Caretook"),
    "Organization JSON-LD",
    JSON.stringify(meta.ld),
  );

  // 4. No third-party requests and no app chunk (requested so far on home).
  const urls = await resources();
  const thirdParty = urls.filter((u) => !u.startsWith("data:") && new URL(u).origin !== origin);
  check(thirdParty.length === 0, "no third-party requests", thirdParty.join(", "));
  const appChunks = urls.filter((u) => APP_CHUNK.test(u));
  check(appChunks.length === 0, "no /app or sync chunk", appChunks.join(", "));

  // 5. Skip link: the first Tab shows it; Enter moves focus to main.
  await viewport(420);
  await p.goto("/");
  await p.waitFor(hydrated, 15000);
  await key("Tab", "Tab", 9);
  const skip =
    await p.evaluate(`(() => { const a = document.activeElement; const r = a.getBoundingClientRect();
    return { text: a.textContent.trim(), href: a.getAttribute("href"), w: r.width, h: r.height, outline: getComputedStyle(a).outlineStyle }; })()`);
  check(
    skip.text === "Skip to content" && skip.href === "#main" && skip.w > 20 && skip.h > 10,
    "skip link is first and visible on focus",
    JSON.stringify(skip),
  );
  check(skip.outline !== "none", "focus is visible", skip.outline);
  await key("Enter", "Enter", 13, "\r");
  await sleep(200);
  check((await p.evaluate(`document.activeElement?.id`)) === "main", "skip link moves focus to main");

  // 6. Phone menu: opens by keyboard, traps nothing, closes with Escape.
  const button = `document.querySelector('header button[aria-controls]')`;
  const menu = `document.getElementById(${button}.getAttribute("aria-controls"))`;
  await p.evaluate(`${button}.focus()`);
  await key("Enter", "Enter", 13, "\r");
  await p.waitFor(`${button}.getAttribute("aria-expanded") === "true"`, 3000);
  const opened = await p.evaluate(
    `({ hidden: ${menu}.hidden, links: [...${menu}.querySelectorAll("a")].map((a) => a.textContent.trim()) })`,
  );
  check(
    !opened.hidden && ["Features", "FAQ", "About", "Sign in"].every((l) => opened.links.includes(l)),
    "the menu opens with Enter",
    JSON.stringify(opened),
  );
  await key("Tab", "Tab", 9);
  check(
    await p.evaluate(`${menu}.contains(document.activeElement) || document.activeElement !== ${button}`),
    "Tab moves on (no trap)",
  );
  await key("Escape", "Escape", 27);
  await p.waitFor(`${button}.getAttribute("aria-expanded") === "false"`, 3000);
  check(
    (await p.evaluate(`${menu}.hidden`)) && (await p.evaluate(`document.activeElement === ${button}`)),
    "Escape closes the menu and returns focus to its button",
  );

  // 7. Calls to action.
  const hrefs = await p.evaluate(`({
    waitlist: document.querySelector('header a.btn-primary')?.getAttribute("href"),
    code: [...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Have an access code?")?.getAttribute("href"),
  })`);
  check(hrefs.waitlist === "/#waitlist", "header: Join the waitlist links to the band", hrefs.waitlist);
  check(hrefs.code === "/join", "hero: Have an access code? links to /join", hrefs.code);
  await p.evaluate(`document.querySelector('header a.btn-primary').click()`);
  await p.waitFor(`location.hash === "#waitlist"`, 3000);
  await sleep(500);
  const band = await p.evaluate(
    `(() => { const r = document.getElementById("waitlist").getBoundingClientRect(); return { top: r.top, note: document.querySelector("#waitlist [data-note]")?.textContent }; })()`,
  );
  check(
    band.top >= 0 && band.top < 200 && /soon/i.test(band.note ?? ""),
    "the waitlist band scrolls into view and says it's coming soon",
    JSON.stringify(band),
  );

  // 8. Every marketing page loads with one h1.
  for (const path of PAGES) {
    await p.goto(path);
    await p.waitFor(`document.querySelector("h1")`, 15000);
    const n = await p.evaluate(`document.querySelectorAll("h1").length`);
    check(n === 1, `${path}: one h1`, `${n}`);
  }
  const allUrls = await resources();
  check(!allUrls.some((u) => APP_CHUNK.test(u)), "no /app or sync chunk on the last page either");

  // 8b. Features, FAQ and About at both widths: one h1, no sideways scroll, and
  // every image with alt text, responsive sources and lazy loading (bar one).
  const imageUrls = new Set();
  for (const path of ["/features", "/faq", "/about"]) {
    for (const width of [420, 1280]) {
      await viewport(width);
      await p.goto(path);
      await p.waitFor(`document.querySelector("h1")`, 15000);
      const s = await p.evaluate(`({
        h1: document.querySelectorAll("h1").length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        imgs: [...document.querySelectorAll("main img")].map((i) => ({
          alt: i.getAttribute("alt") ?? "", srcset: i.getAttribute("srcset") ?? "", loading: i.loading,
          dark: i.parentElement.querySelector('source[media*="dark"]')?.getAttribute("srcset") ?? "",
        })),
      })`);
      const label = `${path} ${width}`;
      check(s.h1 === 1 && !s.overflow, `${label}: one h1, no horizontal scroll`, `${s.h1}`);
      check(
        s.imgs.every((i) => i.alt.trim().length > 20 && /420w.+840w/.test(i.srcset) && /840w/.test(i.dark)) &&
          s.imgs.filter((i) => i.loading !== "lazy").length <= 1,
        `${label}: ${s.imgs.length} images with alt text, srcset (light and dark), lazy below the fold`,
      );
      for (const i of s.imgs)
        for (const u of `${i.srcset}, ${i.dark}`.split(",")) imageUrls.add(u.trim().split(" ")[0]);
    }
  }
  const missing = [];
  for (const u of [...imageUrls].filter(Boolean)) {
    const res = await fetch(`${BASE}${u}`);
    if (!res.ok || res.headers.get("content-type") !== "image/webp") missing.push(`${u} ${res.status}`);
  }
  check(
    imageUrls.size > 0 && missing.length === 0,
    `every screenshot serves as WebP (${imageUrls.size})`,
    missing.join(", "),
  );

  // 8c. The FAQ's JSON-LD matches its visible questions and answers.
  await p.goto("/faq");
  await p.waitFor(`document.querySelector("[data-faq-item]")`, 15000);
  const faq = await p.evaluate(`(() => {
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((d) => d["@type"] === "FAQPage");
    const visible = [...document.querySelectorAll("[data-faq-item]")].map((el) => ({
      q: el.querySelector("h3").textContent.trim(),
      a: [...el.querySelectorAll("p")].map((p) => p.textContent.trim()).join("\\n\\n"),
    }));
    return { ld: (ld?.mainEntity ?? []).map((q) => ({ q: q.name, a: q.acceptedAnswer.text })), visible };
  })()`);
  check(
    faq.visible.length >= 8 && JSON.stringify(faq.ld) === JSON.stringify(faq.visible),
    "FAQ JSON-LD matches the visible questions and answers",
    `${faq.ld.length} in JSON-LD, ${faq.visible.length} on the page`,
  );

  // 9. sitemap.xml and robots.txt.
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  check(
    JSON.stringify(locs) === JSON.stringify(PAGES),
    "sitemap.xml lists the marketing pages",
    locs.join(" "),
  );
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  check(
    ["/app", "/admin", "/invite", "/join", "/api", "/rpc", "/dev"].every((d) =>
      robots.includes(`Disallow: ${d}\n`),
    ) && /Sitemap: .+\/sitemap\.xml/.test(robots),
    "robots.txt disallows the private paths and names the sitemap",
  );

  // 10. Sign in reaches /sign-in (header link at 1280).
  await viewport(1280);
  await p.goto("/");
  await p.waitFor(hydrated, 15000);
  await p.evaluate(
    `[...document.querySelectorAll("header nav a")].find((a) => a.textContent.trim() === "Sign in").click()`,
  );
  await p.waitFor(`location.pathname === "/sign-in" && document.querySelector('input[name="email"]')`, 15000);
  check(true, "Sign in reaches /sign-in");

  // 11. The legal pages (slice 3; its own function at the end of this file).
  await legalPages(p, viewport, check);

  check(p.errors.length === 0, "no console errors", p.errors.join(" | "));
  console.log(`screenshots: ${SHOTS}`);
} catch (e) {
  check(false, "unexpected error", e.message);
} finally {
  b.proc.kill();
}
console.log(`${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);

// The legal pages (marketing slice 3): each loads at 420 and 1280 with one h1,
// the DRAFT banner and a last-updated date; a table-of-contents link and a
// heading's anchor link move to their section, below the sticky header.
async function legalPages(p, viewport, check) {
  for (const path of ["/privacy", "/terms", "/health-data-privacy"]) {
    for (const width of [420, 1280]) {
      const label = `${path} ${width}`;
      await viewport(width);
      await p.goto(path);
      await p.waitFor(`document.querySelector("h1") && document.querySelector("[data-anchor]")`, 15000);
      const state = await p.evaluate(`({
        h1: document.querySelectorAll("h1").length,
        draft: document.querySelector("[data-draft]")?.textContent ?? "",
        date: document.querySelector("[data-last-updated] time")?.getAttribute("datetime") ?? "",
        toc: document.querySelectorAll('nav[aria-labelledby="toc-heading"] a').length,
        sections: document.querySelectorAll("[data-anchor]").length,
        overflow: document.documentElement.scrollWidth > innerWidth,
      })`);
      check(state.h1 === 1, `${label}: one h1`, `${state.h1}`);
      check(/DRAFT/.test(state.draft), `${label}: DRAFT banner`);
      check(/^\d{4}-\d{2}-\d{2}$/.test(state.date), `${label}: last-updated date`, state.date);
      check(state.toc === state.sections && state.sections >= 4, `${label}: a contents entry per section`);
      check(!state.overflow, `${label}: no horizontal scroll`);
    }
    // At 1280, once hydrated (hydration restores the scroll, undoing an earlier jump; the module loads before it hydrates): a contents
    // link, then a heading's own anchor, each lands its heading below the header.
    await p.waitFor(
      `Object.keys(window.__reactRouterRouteModules ?? {}).includes("routes/marketing${path}/route")`,
      15000,
    );
    await new Promise((r) => setTimeout(r, 1000));
    const lands = async (selector, what) => {
      const id = await p.evaluate(`(() => { const a = ${selector}; a.click(); return a.hash.slice(1); })()`);
      await p.waitFor(`location.hash === "#${id}"`, 3000);
      await new Promise((r) => setTimeout(r, 300));
      const top = await p.evaluate(`document.getElementById("${id}").getBoundingClientRect().top`);
      const header = await p.evaluate(`document.querySelector("header").getBoundingClientRect().bottom`);
      check(top >= header - 1 && top < 250, `${path}: ${what} goes to #${id}`, `top ${Math.round(top)}`);
    };
    await lands(`document.querySelectorAll('nav[aria-labelledby="toc-heading"] a')[3]`, "a contents link");
    await p.evaluate(`scrollTo(0, 0)`);
    await lands(`document.querySelectorAll("[data-anchor]")[2]`, "a heading's anchor");
  }
}
