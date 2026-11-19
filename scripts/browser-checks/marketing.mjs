// The marketing site (marketing PRD): home at 420 and 1280 in light and dark,
// one h1, landmarks, the skip link, the phone menu (opens, closes with Escape),
// meta tags and JSON-LD, sitemap.xml and robots.txt, no third-party requests,
// no /app or sync chunk, the calls to action, and Sign in reaching /sign-in.
// Each marketing page loads with one h1. Features, FAQ and About at 420 and
// 1280: one h1, screenshots with alt text and responsive, lazy sources, and
// the FAQ's JSON-LD matching its visible questions. No sign-in. The waitlist
// and contact forms (slice 4): joining stores one entry (checked with psql)
// and a repeat in another case updates it with the same thanks; field errors
// are linked to their fields; the honeypot and a too-fast submit store
// nothing but thank all the same; the 11th call a minute from one address is
// refused; contact stores the message and its mail reaches the dev mailbox
// for SUPPORT_EMAIL, flagged for a privacy topic. Its rows are tagged
// `+mkt<run>@example.com` and deleted at the end.
//
// Screenshots (full page) go to the worktree's git dir, never the repo:
// <git dir>/marketing-shots/home-<width>-<theme>.png
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BASE, launch, openPage, sleep } from "./cdp.mjs";

// The waitlist and contact forms (marketing slice 4). Rows are tagged with
// RUN in the address (`<who>+<RUN>@example.com`) and removed by cleanUpForms.
const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const RUN = `mkt${Date.now().toString(36)}`;
const tagged = (who) => `${who}+${RUN}@example.com`;
const MIN_FORM_MS = 3000;

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
    `(() => { const r = document.getElementById("waitlist").getBoundingClientRect(); return { top: r.top, form: !!document.querySelector('#waitlist form input[name="email"]') }; })()`,
  );
  check(
    band.top >= 0 && band.top < 200 && band.form,
    "the waitlist band scrolls into view with its form",
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
          alt: i.getAttribute("alt") ?? "", src: i.getAttribute("src") ?? "", loading: i.loading,
        })),
      })`);
      const label = `${path} ${width}`;
      check(s.h1 === 1 && !s.overflow, `${label}: one h1, no horizontal scroll`, `${s.h1}`);
      check(
        s.imgs.every((i) => i.alt.trim().length > 20 && !!i.src) &&
          s.imgs.filter((i) => i.loading !== "lazy").length <= 1,
        `${label}: ${s.imgs.length} images with alt text, lazy below the fold`,
      );
      for (const i of s.imgs) imageUrls.add(i.src);
    }
  }
  const missing = [];
  for (const u of [...imageUrls].filter(Boolean)) {
    const res = await fetch(`${BASE}${u}`);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/svg+xml"))
      missing.push(`${u} ${res.status}`);
  }
  check(
    imageUrls.size > 0 && missing.length === 0,
    `every screenshot placeholder serves as SVG (${imageUrls.size})`,
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

  // 12. The waitlist and contact forms (slice 4; its own function at the end of this file).
  await forms(p, viewport, check);

  check(p.errors.length === 0, "no console errors", p.errors.join(" | "));
  console.log(`screenshots: ${SHOTS}`);
} catch (e) {
  check(false, "unexpected error", e.message);
} finally {
  cleanUpForms();
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

function psql(sql) {
  return execFileSync("docker", [
    "exec",
    "-i",
    PG_CONTAINER,
    "psql",
    "-U",
    "caretook",
    "-d",
    "caretook",
    "-tAq",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ])
    .toString()
    .trim();
}

function cleanUpForms() {
  try {
    psql(`DELETE FROM waitlist_entry WHERE email LIKE '%+${RUN}@example.com';
      DELETE FROM contact_message WHERE email LIKE '%+${RUN}@example.com';
      DELETE FROM dev_mail WHERE text LIKE '%+${RUN}@example.com%';
      DELETE FROM notification_outbox WHERE text LIKE '%+${RUN}@example.com%';`);
  } catch (e) {
    console.log(`cleanup failed: ${e.message}`);
  }
}

async function forms(p, viewport, check) {
  const fill = (fields) =>
    p.evaluate(`(() => {
      for (const [name, value] of Object.entries(${JSON.stringify(fields)})) {
        const el = document.querySelector('main form [name="' + name + '"]');
        const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, value);
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
      }
    })()`);
  const submit = () => p.evaluate(`document.querySelector('main form button[type="submit"]').click()`);
  const thanked = (scope) =>
    p.waitFor(`document.querySelector('${scope} [data-form-thanks]')?.textContent.trim().length > 0`, 10000);
  const thanks = (scope) =>
    p.evaluate(`(() => { const s = document.querySelector('${scope} [data-form-thanks]');
      return { text: s?.textContent.trim() ?? "", role: s?.getAttribute("role"), live: s?.getAttribute("aria-live"), form: !!document.querySelector('${scope} form') }; })()`);
  const openHome = async () => {
    await p.goto("/");
    await p.waitFor(
      `window.__reactRouterRouteModules?.["routes/marketing/home/route"] && document.querySelector('#waitlist form')`,
      15000,
    );
  };
  const entries = (email) =>
    psql(`SELECT coalesce(first_name,'') || '|' || coalesce(caring_for,'') || '|' || coalesce(heard_from,'') || '|' || coalesce(source->>'page','') || '|' || coalesce(source->>'utmSource','')
      FROM waitlist_entry WHERE email = '${email}'`)
      .split("\n")
      .filter(Boolean);

  await viewport(420);

  // Join: one entry, with the page and UTM source, and a polite thanks.
  const joiner = tagged("join");
  await p.goto("/?utm_source=check&utm_campaign=slice4");
  await p.waitFor(
    `window.__reactRouterRouteModules?.["routes/marketing/home/route"] && document.querySelector('#waitlist form')`,
    15000,
  );
  await sleep(MIN_FORM_MS + 300);
  await fill({ email: joiner.toUpperCase(), firstName: "Robin", caringFor: "parent", heardFrom: "A friend" });
  await submit();
  await thanked("#waitlist");
  const first = await thanks("#waitlist");
  check(
    /on the list/i.test(first.text) && first.role === "status" && first.live === "polite" && !first.form,
    "joining the waitlist thanks the visitor (polite status) in place of the form",
    JSON.stringify(first),
  );
  check(
    JSON.stringify(entries(joiner)) === JSON.stringify(["Robin|parent|A friend|/|check"]),
    "joining stores one entry, email lowercased, with the page and UTM source",
    entries(joiner).join(" / "),
  );

  // Again, in another case: the same thanks, the entry updated, still one row.
  await openHome();
  await sleep(MIN_FORM_MS + 300);
  await fill({ email: `  ${joiner.replace("join", "JOIN")} `, heardFrom: "Search" });
  await submit();
  await thanked("#waitlist");
  const again = await thanks("#waitlist");
  check(again.text === first.text, "joining again (another case) shows the same thanks", again.text);
  check(
    JSON.stringify(entries(joiner)) === JSON.stringify(["Robin|parent|Search|/|"]),
    "joining again updates the one entry (left-out fields kept)",
    entries(joiner).join(" / "),
  );

  // Field errors: an email that isn't one is linked to its field, which gets focus.
  await openHome();
  await sleep(MIN_FORM_MS + 300);
  await fill({ email: "not-an-email" });
  await submit();
  await p.waitFor(`document.querySelector('#waitlist [data-field-error]')`, 10000);
  const invalid = await p.evaluate(`(() => {
    const input = document.querySelector('#waitlist input[name="email"]');
    const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
    const error = document.querySelector('#waitlist [data-field-error]');
    return {
      invalid: input.getAttribute("aria-invalid"),
      linked: ids.includes(error.id),
      focused: document.activeElement === input,
      label: input.labels?.[0]?.textContent.trim(),
      alert: document.querySelector('#waitlist [data-form-error]')?.getAttribute("role"),
    };
  })()`);
  check(
    invalid.invalid === "true" &&
      invalid.linked &&
      invalid.focused &&
      invalid.alert === "alert" &&
      !!invalid.label,
    "a field error is linked to its labelled field, which gets focus",
    JSON.stringify(invalid),
  );

  // The honeypot, then a submit faster than the minimum: thanks, nothing stored.
  const trapped = tagged("trap");
  await openHome();
  await sleep(MIN_FORM_MS + 300);
  await fill({ email: trapped, website: "https://spam.example" });
  await submit();
  await thanked("#waitlist");
  check(
    /on the list/i.test((await thanks("#waitlist")).text) && entries(trapped).length === 0,
    "a filled honeypot is thanked and stores nothing",
  );
  const hasty = tagged("fast");
  await openHome();
  await fill({ email: hasty });
  await submit();
  await thanked("#waitlist");
  check(
    /on the list/i.test((await thanks("#waitlist")).text) && entries(hasty).length === 0,
    "a submit faster than the minimum is thanked and stores nothing",
  );

  // The rate limit: from one address, the 11th call in a minute is refused.
  const ip = `10.250.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    const res = await fetch(`${BASE}/rpc/public/waitlist/join`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "orpc", "x-forwarded-for": ip },
      body: JSON.stringify({ json: { email: tagged(`limit${i}`), elapsedMs: 5000 } }),
    });
    statuses.push(res.status);
  }
  check(
    statuses.slice(0, 10).every((s) => s === 200) &&
      statuses[10] === 429 &&
      entries(tagged("limit10")).length === 0,
    "the rate limit refuses the 11th call in a minute from one address",
    statuses.join(","),
  );

  // Contact: stored, and its mail is in the dev mailbox for SUPPORT_EMAIL, flagged as privacy.
  const writer = tagged("contact");
  await viewport(1280);
  await p.goto("/contact");
  await p.waitFor(
    `window.__reactRouterRouteModules?.["routes/marketing/contact/route"] && document.querySelector('main form')`,
    15000,
  );
  await sleep(MIN_FORM_MS + 300);
  await fill({
    name: "Robin Example",
    email: writer,
    topic: "privacy",
    message: `Please delete my data (${RUN}).`,
  });
  await submit();
  await thanked("main");
  const sent = await thanks("main");
  check(
    /on its way/i.test(sent.text) && sent.role === "status" && sent.live === "polite" && !sent.form,
    "the contact form thanks the visitor (polite status)",
    sent.text,
  );
  check(
    psql(`SELECT topic || '|' || message FROM contact_message WHERE email = '${writer}'`) ===
      `privacy|Please delete my data (${RUN}).`,
    "contact stores the message",
  );
  let mail = "";
  for (let i = 0; i < 20 && !mail; i++) {
    mail = psql(
      `SELECT recipient || '|' || subject FROM dev_mail WHERE name = 'contactMessage' AND text LIKE '%${writer}%'`,
    );
    if (!mail) await sleep(250);
  }
  const [recipient = "", subject = ""] = mail.split("|");
  const res = await fetch(`${BASE}/dev/mail.json?to=${encodeURIComponent(recipient)}`);
  const listed = res.ok ? JSON.stringify(await res.json()).includes(subject) : false;
  check(
    /@/.test(recipient) && subject.startsWith("[Privacy] ") && listed,
    "its mail is at /dev/mail, to SUPPORT_EMAIL, flagged as privacy",
    `${recipient} · ${subject}`,
  );

  // The contact form's fields by keyboard: each has a label, and Tab reaches them in order.
  await p.goto("/contact");
  await p.waitFor(`document.querySelector('main form')`, 15000);
  const labels = await p.evaluate(
    `[...document.querySelectorAll('main form :is(input, select, textarea):not([tabindex="-1"])')].map((el) => el.labels?.[0]?.textContent.trim() ?? "")`,
  );
  check(
    labels.length === 4 && labels.every((l) => l.length > 0),
    "every contact field has a label (the honeypot is out of the tab order)",
    JSON.stringify(labels),
  );
}
