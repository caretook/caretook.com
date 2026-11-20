// The marketing site: home at 420 and 1280 in light and dark, one h1,
// landmarks, the skip link, the phone menu (opens, closes with Escape), meta
// tags and JSON-LD, sitemap.xml and robots.txt, no third-party requests, no
// /app or sync chunk, the calls to action, and Sign in reaching /sign-in.
// Each marketing page loads with one h1. Features, FAQ and About at 420 and
// 1280: one h1, screenshots with alt text and responsive, lazy sources, and
// the FAQ's JSON-LD matching its visible questions. The legal pages. No
// sign-in. The waitlist and contact forms: joining stores one entry (checked
// with psql) and a repeat in another case updates it with the same thanks;
// field errors are linked to their fields; the honeypot and a too-fast submit
// store nothing but thank all the same; the 11th call a minute from one
// address is refused; contact stores the message and its mail reaches the dev
// mailbox for SUPPORT_EMAIL, flagged for a privacy topic. Its rows are tagged
// `+mkt<run>@example.com` and deleted at the end.
//
// Every test fails on a console error or warning from its page.
import { BASE, expect, psql, test as checks, waitFor } from "./fixtures.mjs";

const RUN = `mkt${Date.now().toString(36)}`;
const tagged = (who) => `${who}+${RUN}@example.com`;
const MIN_FORM_MS = 3000;
const PAGES = ["/", "/features", "/faq", "/about", "/contact", "/privacy", "/terms", "/health-data-privacy"];
// Modules that only the app needs: none may load on a marketing page.
const APP_CHUNK =
  /\/app\/routes\/app\/|\/app\/lib\/sync\/|\/app\/lib\/session|powersync|wa-sqlite|yjs|tiptap|prosemirror/i;
const origin = new URL(BASE).origin;

/** `site`: one device on the marketing site, with every URL it requested; no console errors allowed. */
const test = checks.extend({
  site: async ({ device }, use) => {
    const d = await device("marketing");
    d.requested = [];
    d.page.on("request", (r) => d.requested.push(r.url()));
    await use(d);
    expect(d.errors, "console errors").toEqual([]);
  },
});

const routeLoaded = (page, route) =>
  waitFor(page, (r) => window.__reactRouterRouteModules?.[r], { arg: route, timeout: 15_000 });
const openHome = async (page, path = "/") => {
  await page.goto(path);
  await expect(page.locator("header button[aria-controls]")).toBeAttached({ timeout: 15_000 });
  await routeLoaded(page, "routes/marketing/home/route");
};
const background = (page) =>
  page.evaluate(() => getComputedStyle(document.querySelector("main").parentElement).backgroundColor);

test(
  "home at 420 and 1280, light and dark; the theme follows the device",
  { tag: "@smoke" },
  async ({ site: { page } }) => {
    const backgrounds = {};
    for (const width of [420, 1280]) {
      for (const theme of ["light", "dark"]) {
        await test.step(`home ${width} ${theme}`, async () => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: theme });
          await openHome(page);
          const state = await page.evaluate(() => ({
            h1: document.querySelectorAll("h1").length,
            banner: !!document.querySelector("header"),
            main: document.querySelectorAll("main").length,
            footer: !!document.querySelector("footer"),
            overflow: document.documentElement.scrollWidth > innerWidth,
            menuButton:
              getComputedStyle(document.querySelector("header button[aria-controls]")).display !== "none",
            headerNav: getComputedStyle(document.querySelector("header nav")).display !== "none",
          }));
          expect.soft(state.h1, "one h1").toBe(1);
          expect
            .soft(state.banner && state.main === 1 && state.footer, "header, main, footer landmarks")
            .toBe(true);
          expect.soft(state.overflow, "no horizontal scroll").toBe(false);
          if (width < 768)
            expect
              .soft([state.menuButton, state.headerNav], "menu button, no header links")
              .toEqual([true, false]);
          else
            expect
              .soft([state.menuButton, state.headerNav], "header links, no menu button")
              .toEqual([false, true]);
          backgrounds[theme] = await background(page);
        });
      }
    }
    expect(backgrounds.light, "the theme follows the device").not.toBe(backgrounds.dark);
  },
);

test("a stored theme (dark) applies on a light device", async ({ site: { page } }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openHome(page);
  const dark = await background(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => localStorage.setItem("caretook:theme", "dark"));
  await openHome(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(await background(page)).toBe(dark);
});

test("meta tags and JSON-LD", async ({ site: { page } }) => {
  await openHome(page);
  const meta = await page.evaluate(() => {
    const m = (sel) => document.querySelector(sel)?.getAttribute("content") ?? null;
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
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
        JSON.parse(s.textContent),
      ),
    };
  });
  await test.step("title and description", () => {
    expect(meta.title).toContain("Caretook");
    expect(meta.description).toBeTruthy();
  });
  await test.step("canonical and og:url", () => {
    expect(meta.canonical).toBeTruthy();
    expect(meta.ogUrl).toBe(meta.canonical);
    expect(new URL(meta.canonical).pathname).toBe("/");
  });
  await test.step("Open Graph title and image", () => {
    expect(meta.ogTitle).toBeTruthy();
    expect(meta.ogImage ?? "").toMatch(/\/og-default\.png$/);
  });
  await test.step("Twitter card", () => expect(meta.twitter).toBe("summary_large_image"));
  await test.step("favicon and manifest links", () =>
    expect([meta.icon, meta.manifest]).toEqual([true, true]));
  await test.step("Organization JSON-LD", () =>
    expect(meta.ld.some((d) => d["@type"] === "Organization" && d.name === "Caretook")).toBe(true));
});

test("home makes no third-party request and loads no /app or sync chunk", async ({ site }) => {
  await openHome(site.page);
  await site.page.waitForLoadState("networkidle");
  const urls = site.requested.filter((u) => !u.startsWith("data:"));
  expect(
    urls.filter((u) => new URL(u).origin !== origin),
    "third-party requests",
  ).toEqual([]);
  expect(
    urls.filter((u) => APP_CHUNK.test(u)),
    "app chunks",
  ).toEqual([]);
});

test("the skip link is first, visible on focus, and moves focus to main", async ({ site: { page } }) => {
  await openHome(page);
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    return {
      text: a.textContent.trim(),
      href: a.getAttribute("href"),
      w: r.width,
      h: r.height,
      outline: getComputedStyle(a).outlineStyle,
    };
  });
  expect(skip).toMatchObject({ text: "Skip to content", href: "#main" });
  expect(skip.w).toBeGreaterThan(20);
  expect(skip.h).toBeGreaterThan(10);
  expect(skip.outline, "focus is visible").not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("the phone menu opens with Enter, traps nothing, and Escape closes it", async ({ site: { page } }) => {
  await openHome(page);
  const button = page.locator("header button[aria-controls]");
  const menu = page.locator(`#${await button.getAttribute("aria-controls")}`);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true", { timeout: 3000 });
  await expect(menu).not.toHaveAttribute("hidden");
  const links = await menu.locator("a").allTextContents();
  expect(links.map((l) => l.trim())).toEqual(expect.arrayContaining(["Features", "FAQ", "About", "Sign in"]));
  await page.keyboard.press("Tab");
  await test.step("Tab moves on (no trap)", async () => {
    expect(
      await page.evaluate(
        (id) =>
          document.getElementById(id).contains(document.activeElement) ||
          document.activeElement !== document.querySelector("header button[aria-controls]"),
        await button.getAttribute("aria-controls"),
      ),
    ).toBe(true);
  });
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false", { timeout: 3000 });
  await expect(menu).toHaveAttribute("hidden");
  await expect(button).toBeFocused();
});

test("the calls to action: the waitlist band and the access code", async ({ site: { page } }) => {
  await openHome(page);
  const join = page.locator("header a.btn-primary");
  await expect(join, "header: Join the waitlist links to the band").toHaveAttribute("href", "/#waitlist");
  await expect(
    page.locator("main a", { hasText: /^Have an access code\?$/ }).first(),
    "hero: Have an access code? links to /join",
  ).toHaveAttribute("href", "/join");
  await join.click();
  await page.waitForURL(/#waitlist$/, { timeout: 3000 });
  await page.waitForTimeout(500);
  const band = await page.evaluate(() => ({
    top: document.getElementById("waitlist").getBoundingClientRect().top,
    form: !!document.querySelector('#waitlist form input[name="email"]'),
  }));
  expect(band.form).toBe(true);
  expect(band.top, "the waitlist band scrolls into view").toBeGreaterThanOrEqual(0);
  expect(band.top).toBeLessThan(200);
});

test("every marketing page loads with one h1, and no /app or sync chunk", async ({ site }) => {
  for (const path of PAGES) {
    await test.step(`${path}: one h1`, async () => {
      await site.page.goto(path);
      await expect(site.page.locator("h1")).toHaveCount(1, { timeout: 15_000 });
    });
  }
  expect(site.requested.filter((u) => APP_CHUNK.test(u))).toEqual([]);
});

test("features, FAQ and About at both widths: one h1, alt text, lazy images served as SVG", async ({
  site: { page },
}) => {
  const imageUrls = new Set();
  for (const path of ["/features", "/faq", "/about"]) {
    for (const width of [420, 1280]) {
      await test.step(`${path} ${width}`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
        const s = await page.evaluate(() => ({
          h1: document.querySelectorAll("h1").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          imgs: [...document.querySelectorAll("main img")].map((i) => ({
            alt: i.getAttribute("alt") ?? "",
            src: i.getAttribute("src") ?? "",
            loading: i.loading,
          })),
        }));
        expect.soft(s.h1, "one h1").toBe(1);
        expect.soft(s.overflow, "no horizontal scroll").toBe(false);
        expect
          .soft(
            s.imgs.filter((i) => i.alt.trim().length <= 20 || !i.src),
            "images without alt text",
          )
          .toEqual([]);
        expect.soft(s.imgs.filter((i) => i.loading !== "lazy").length, "eager images").toBeLessThanOrEqual(1);
        for (const i of s.imgs) imageUrls.add(i.src);
      });
    }
  }
  const missing = [];
  for (const u of [...imageUrls].filter(Boolean)) {
    const res = await fetch(`${BASE}${u}`);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/svg+xml"))
      missing.push(`${u} ${res.status}`);
  }
  expect(imageUrls.size).toBeGreaterThan(0);
  expect(missing, "every screenshot placeholder serves as SVG").toEqual([]);
});

test("the FAQ's JSON-LD matches its visible questions and answers", async ({ site: { page } }) => {
  await page.goto("/faq");
  await expect(page.locator("[data-faq-item]").first()).toBeAttached({ timeout: 15_000 });
  const faq = await page.evaluate(() => {
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent))
      .find((d) => d["@type"] === "FAQPage");
    const visible = [...document.querySelectorAll("[data-faq-item]")].map((el) => ({
      q: el.querySelector("h3").textContent.trim(),
      a: [...el.querySelectorAll("p")].map((p) => p.textContent.trim()).join("\n\n"),
    }));
    return { ld: (ld?.mainEntity ?? []).map((q) => ({ q: q.name, a: q.acceptedAnswer.text })), visible };
  });
  expect(faq.visible.length).toBeGreaterThanOrEqual(8);
  expect(faq.ld).toEqual(faq.visible);
});

test("sitemap.xml lists the marketing pages; robots.txt disallows the private paths", async () => {
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(locs).toEqual(PAGES);
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  for (const d of ["/app", "/admin", "/invite", "/join", "/api", "/rpc", "/dev"])
    expect(robots).toContain(`Disallow: ${d}\n`);
  expect(robots).toMatch(/Sitemap: .+\/sitemap\.xml/);
});

test("Sign in (the header link at 1280) reaches /sign-in", async ({ site: { page } }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHome(page);
  await page
    .locator("header nav a", { hasText: /^Sign in$/ })
    .first()
    .click();
  await page.waitForURL(/\/sign-in$/, { timeout: 15_000 });
  await expect(page.locator('input[name="email"]')).toBeVisible();
});

// The legal pages: each loads at 420 and 1280 with one h1, the DRAFT banner and
// a last-updated date; a table-of-contents link and a heading's anchor link
// move to their section, below the sticky header.
for (const path of ["/privacy", "/terms", "/health-data-privacy"]) {
  test(`legal page ${path}`, async ({ site: { page } }) => {
    for (const width of [420, 1280]) {
      await test.step(`${path} ${width}: one h1, DRAFT, a date, contents, no sideways scroll`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.locator("[data-anchor]").first()).toBeAttached({ timeout: 15_000 });
        const state = await page.evaluate(() => ({
          h1: document.querySelectorAll("h1").length,
          draft: document.querySelector("[data-draft]")?.textContent ?? "",
          date: document.querySelector("[data-last-updated] time")?.getAttribute("datetime") ?? "",
          toc: document.querySelectorAll('nav[aria-labelledby="toc-heading"] a').length,
          sections: document.querySelectorAll("[data-anchor]").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        expect.soft(state.h1, "one h1").toBe(1);
        expect.soft(state.draft, "DRAFT banner").toMatch(/DRAFT/);
        expect.soft(state.date, "last-updated date").toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect.soft(state.toc, "a contents entry per section").toBe(state.sections);
        expect.soft(state.sections).toBeGreaterThanOrEqual(4);
        expect.soft(state.overflow, "no horizontal scroll").toBe(false);
      });
    }
    // At 1280, once hydrated (hydration restores the scroll, undoing an earlier jump).
    await routeLoaded(page, `routes/marketing${path}/route`);
    await page.waitForTimeout(1000);
    const lands = async (link, what) => {
      await test.step(`${what} goes to its section, below the header`, async () => {
        const id = await link.evaluate((a) => a.hash.slice(1));
        await link.click();
        await page.waitForURL(new RegExp(`#${id}$`), { timeout: 3000 });
        await page.waitForTimeout(300);
        const top = await page.evaluate((i) => document.getElementById(i).getBoundingClientRect().top, id);
        const header = await page.evaluate(
          () => document.querySelector("header").getBoundingClientRect().bottom,
        );
        expect(top, `#${id}`).toBeGreaterThanOrEqual(header - 1);
        expect(top, `#${id}`).toBeLessThan(250);
      });
    };
    await lands(page.locator('nav[aria-labelledby="toc-heading"] a').nth(3), "a contents link");
    await page.evaluate(() => scrollTo(0, 0));
    await lands(page.locator("[data-anchor]").nth(2), "a heading's anchor");
  });
}

// The waitlist and contact forms. Rows are tagged with RUN and removed at the end.
test.describe("the forms", () => {
  test.afterAll(() => {
    psql(`DELETE FROM waitlist_entry WHERE email LIKE '%+${RUN}@example.com';
      DELETE FROM contact_message WHERE email LIKE '%+${RUN}@example.com';
      DELETE FROM dev_mail WHERE text LIKE '%+${RUN}@example.com%';
      DELETE FROM notification_outbox WHERE text LIKE '%+${RUN}@example.com%';`);
  });

  // Fields are set through the native value setter, as a user's typing would
  // (the honeypot is out of sight, so Playwright's fill wouldn't reach it).
  const fill = (page, fields) =>
    page.evaluate((f) => {
      for (const [name, value] of Object.entries(f)) {
        const el = document.querySelector(`main form [name="${name}"]`);
        const proto =
          el instanceof HTMLSelectElement
            ? HTMLSelectElement
            : el instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement
              : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, value);
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
      }
    }, fields);
  const submit = (page) => page.locator('main form button[type="submit"]').click();
  const thanks = async (page, scope) => {
    const s = page.locator(`${scope} [data-form-thanks]`);
    await expect(s).not.toBeEmpty({ timeout: 10_000 });
    return {
      text: (await s.textContent()).trim(),
      role: await s.getAttribute("role"),
      live: await s.getAttribute("aria-live"),
      form: (await page.locator(`${scope} form`).count()) > 0,
    };
  };
  const waitlistForm = async (page, path = "/") => {
    await page.goto(path);
    await expect(page.locator("#waitlist form")).toBeAttached({ timeout: 15_000 });
    await routeLoaded(page, "routes/marketing/home/route");
  };
  const entries = (email) =>
    psql(`SELECT coalesce(first_name,'') || '|' || coalesce(caring_for,'') || '|' || coalesce(heard_from,'') || '|' || coalesce(source->>'page','') || '|' || coalesce(source->>'utmSource','')
      FROM waitlist_entry WHERE email = '${email}'`)
      .split("\n")
      .filter(Boolean);

  test("joining stores one entry; joining again in another case updates it, with the same thanks", async ({
    site: { page },
  }) => {
    const joiner = tagged("join");
    let first;
    await test.step("joining thanks the visitor (polite status) and stores one entry, lowercased, with the page and UTM source", async () => {
      await waitlistForm(page, "/?utm_source=check&utm_campaign=slice4");
      await page.waitForTimeout(MIN_FORM_MS + 300);
      await fill(page, {
        email: joiner.toUpperCase(),
        firstName: "Robin",
        caringFor: "parent",
        heardFrom: "A friend",
      });
      await submit(page);
      first = await thanks(page, "#waitlist");
      expect(first.text).toMatch(/on the list/i);
      expect(first).toMatchObject({ role: "status", live: "polite", form: false });
      expect(entries(joiner)).toEqual(["Robin|parent|A friend|/|check"]);
    });
    await test.step("joining again (another case) shows the same thanks and updates the one entry", async () => {
      await waitlistForm(page);
      await page.waitForTimeout(MIN_FORM_MS + 300);
      await fill(page, { email: `  ${joiner.replace("join", "JOIN")} `, heardFrom: "Search" });
      await submit(page);
      expect((await thanks(page, "#waitlist")).text).toBe(first.text);
      expect(entries(joiner), "left-out fields kept").toEqual(["Robin|parent|Search|/|"]);
    });
  });

  test("a field error is linked to its labelled field, which gets focus", async ({ site: { page } }) => {
    await waitlistForm(page);
    await page.waitForTimeout(MIN_FORM_MS + 300);
    await fill(page, { email: "not-an-email" });
    await submit(page);
    await expect(page.locator("#waitlist [data-field-error]")).toBeAttached({ timeout: 10_000 });
    const invalid = await page.evaluate(() => {
      const input = document.querySelector('#waitlist input[name="email"]');
      const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
      const error = document.querySelector("#waitlist [data-field-error]");
      return {
        invalid: input.getAttribute("aria-invalid"),
        linked: ids.includes(error.id),
        focused: document.activeElement === input,
        labelled: !!input.labels?.[0]?.textContent.trim(),
        alert: document.querySelector("#waitlist [data-form-error]")?.getAttribute("role"),
      };
    });
    expect(invalid).toEqual({ invalid: "true", linked: true, focused: true, labelled: true, alert: "alert" });
  });

  test("a filled honeypot, and a submit faster than the minimum, are thanked and store nothing", async ({
    site: { page },
  }) => {
    await test.step("a filled honeypot is thanked and stores nothing", async () => {
      const trapped = tagged("trap");
      await waitlistForm(page);
      await page.waitForTimeout(MIN_FORM_MS + 300);
      await fill(page, { email: trapped, website: "https://spam.example" });
      await submit(page);
      expect((await thanks(page, "#waitlist")).text).toMatch(/on the list/i);
      expect(entries(trapped)).toEqual([]);
    });
    await test.step("a submit faster than the minimum is thanked and stores nothing", async () => {
      const hasty = tagged("fast");
      await waitlistForm(page);
      await fill(page, { email: hasty });
      await submit(page);
      expect((await thanks(page, "#waitlist")).text).toMatch(/on the list/i);
      expect(entries(hasty)).toEqual([]);
    });
  });

  test("the rate limit refuses the 11th call in a minute from one address", async () => {
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
    expect(statuses).toEqual([...Array(10).fill(200), 429]);
    expect(entries(tagged("limit10"))).toEqual([]);
  });

  test("contact stores the message, and its mail is at /dev/mail for SUPPORT_EMAIL, flagged as privacy", async ({
    site: { page },
  }) => {
    const writer = tagged("contact");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/contact");
    await expect(page.locator("main form")).toBeAttached({ timeout: 15_000 });
    await routeLoaded(page, "routes/marketing/contact/route");
    await page.waitForTimeout(MIN_FORM_MS + 300);
    await fill(page, {
      name: "Robin Example",
      email: writer,
      topic: "privacy",
      message: `Please delete my data (${RUN}).`,
    });
    await submit(page);
    await test.step("the contact form thanks the visitor (polite status)", async () => {
      const sent = await thanks(page, "main");
      expect(sent.text).toMatch(/on its way/i);
      expect(sent).toMatchObject({ role: "status", live: "polite", form: false });
    });
    await test.step("contact stores the message", () => {
      expect(psql(`SELECT topic || '|' || message FROM contact_message WHERE email = '${writer}'`)).toBe(
        `privacy|Please delete my data (${RUN}).`,
      );
    });
    await test.step("its mail is at /dev/mail, to SUPPORT_EMAIL, flagged as privacy", async () => {
      let mail = "";
      await expect
        .poll(
          () =>
            (mail = psql(
              `SELECT recipient || '|' || subject FROM dev_mail WHERE name = 'contactMessage' AND text LIKE '%${writer}%'`,
            )),
          { timeout: 5000 },
        )
        .not.toBe("");
      const [recipient = "", subject = ""] = mail.split("|");
      expect(recipient).toMatch(/@/);
      expect(subject).toMatch(/^\[Privacy\] /);
      const res = await fetch(`${BASE}/dev/mail.json?to=${encodeURIComponent(recipient)}`);
      expect(res.ok).toBe(true);
      expect(JSON.stringify(await res.json())).toContain(subject);
    });
  });

  test("every contact field has a label (the honeypot is out of the tab order)", async ({
    site: { page },
  }) => {
    await page.goto("/contact");
    await expect(page.locator("main form")).toBeAttached({ timeout: 15_000 });
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('main form :is(input, select, textarea):not([tabindex="-1"])')].map(
        (el) => el.labels?.[0]?.textContent.trim() ?? "",
      ),
    );
    expect(labels).toHaveLength(4);
    expect(labels.filter((l) => !l)).toEqual([]);
  });
});
