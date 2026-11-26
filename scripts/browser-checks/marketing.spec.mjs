// The marketing site on the built site, with production CSS and real headers:
// home at 420 and 1280 in light and dark (no sideways scroll, the theme follows
// the device), a stored theme before first paint, the head's tags as rendered,
// no third-party requests and no /app or sync chunk, the header's call to
// action scrolling to the waitlist band, every page loading with one h1 and
// its screenshots served as SVG, sitemap.xml and robots.txt as files, and a
// legal page's in-page links landing below the sticky header. No sign-in. The
// forms through the server: joining stores the entry with its page and UTM
// source (checked with psql), the 11th call a minute from one address is
// refused, and contact stores the message and mails SUPPORT_EMAIL through the
// dev mailbox, flagged for a privacy topic. Its rows are tagged
// `+mkt<run>@example.com` and deleted at the end.
//
// One device's screens are component tests beside the marketing code
// (layout/layout, home/waitlist, contact/contact, sections/pages and
// sections/LegalPage `.browser.test.tsx`); the builders are unit tests
// (site/meta, site/seo, sections/forms, sections/legal, the content tests);
// what the server does with a form is packages/api/src/marketing/publicForms.int.test.ts's.
// The minimum time on a form is passed with Playwright's page clock, not a sleep.
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
  "home at 420 and 1280, light and dark: no sideways scroll, and the theme follows the device",
  { tag: "@smoke" },
  async ({ site: { page } }) => {
    const backgrounds = {};
    for (const width of [420, 1280]) {
      for (const theme of ["light", "dark"]) {
        await test.step(`home ${width} ${theme}`, async () => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: theme });
          await openHome(page);
          expect
            .soft(
              await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
              "no horizontal scroll",
            )
            .toBe(false);
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

// The tags' values are site/meta.test.ts's and home's own layout/layout.browser.test.tsx's:
// here, that the built page's head carries them.
test("the head carries the lockup's title and share image, the canonical URL, the icon and manifest links, and the JSON-LD", async ({
  site: { page },
}) => {
  await openHome(page);
  const head = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector("h1")?.innerText.replace(/\s+/g, " ").trim() ?? null,
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? null,
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null,
    ogImageAlt: document.querySelector('meta[property="og:image:alt"]')?.getAttribute("content") ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? null,
    icon: !!document.querySelector('link[rel="icon"][href="/favicon.svg"]'),
    manifest: !!document.querySelector('link[rel="manifest"]'),
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
      (s) => JSON.parse(s.textContent)["@type"],
    ),
  }));
  expect(new URL(head.canonical ?? "about:blank").pathname).toBe("/");
  expect(head.ogUrl).toBe(head.canonical);
  expect([head.icon, head.manifest], "favicon and manifest links").toEqual([true, true]);
  expect(head.ld).toContain("Organization");
  // The lockup: the tagline in the title and the share tags, and as the built page's h1.
  expect(head.title).toBe("Caretook: Care, taken.");
  expect(head.ogTitle).toBe(head.title);
  expect(head.h1).toBe("Caretook Care, taken.");
  expect(head.ogImageAlt).toContain("Care, taken.");
  // The share image is served as a PNG from this site.
  const image = await page.request.get(new URL(head.ogImage ?? "about:blank").pathname);
  expect([image.status(), image.headers()["content-type"]]).toEqual([200, "image/png"]);
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

test("the header's Join the waitlist scrolls the waitlist band into view", async ({ site: { page } }) => {
  await openHome(page);
  await page.locator("header a.btn-primary").click();
  await page.waitForURL(/#waitlist$/, { timeout: 3000 });
  await expect(page.locator('#waitlist form input[name="email"]')).toBeAttached();
  const bandTop = () => page.evaluate(() => document.getElementById("waitlist").getBoundingClientRect().top);
  await expect
    .poll(
      async () => {
        const top = await bandTop();
        return top >= 0 && top < 200;
      },
      { message: "the waitlist band scrolls into view, near the top", timeout: 3000 },
    )
    .toBe(true);
});

test("every marketing page loads with one h1 and no /app or sync chunk; its screenshots serve as SVG", async ({
  site,
}) => {
  const imageUrls = new Set();
  for (const path of PAGES) {
    await test.step(`${path}: one h1`, async () => {
      await site.page.goto(path);
      await expect(site.page.locator("h1")).toHaveCount(1, { timeout: 15_000 });
      for (const src of await site.page.locator("main img").evaluateAll((imgs) => imgs.map((i) => i.src)))
        imageUrls.add(src);
    });
  }
  expect(site.requested.filter((u) => APP_CHUNK.test(u))).toEqual([]);
  const missing = [];
  for (const u of [...imageUrls].filter(Boolean)) {
    const res = await fetch(u);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/svg+xml"))
      missing.push(`${u} ${res.status}`);
  }
  expect(imageUrls.size).toBeGreaterThan(0);
  expect(missing, "every screenshot placeholder serves as SVG").toEqual([]);
});

// What each lists is site/seo.test.ts's: here, that the build serves them.
test("sitemap.xml lists the marketing pages and robots.txt points at it, both served as files", async () => {
  const sitemap = await fetch(`${BASE}/sitemap.xml`);
  expect(sitemap.headers.get("content-type")).toMatch(/xml/);
  const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]).pathname,
  );
  expect(locs).toEqual(PAGES);
  const robots = await fetch(`${BASE}/robots.txt`);
  expect(robots.headers.get("content-type")).toMatch(/text\/plain/);
  const txt = await robots.text();
  expect(txt).toContain("Disallow: /app\n");
  expect(txt).toMatch(/Sitemap: .+\/sitemap\.xml/);
});

// A legal page's in-page links at 1280, once hydrated: a contents link and a
// heading's anchor each land on their section, below the sticky header. The
// three pages share sections/LegalPage.tsx, so one page stands for them; their
// structure at both widths is sections/LegalPage.browser.test.tsx's. Hydration
// restores the scroll (undoing a jump taken before it), so a click that didn't
// land is tried again.
test("a legal page's contents link and heading anchor land below the header", async ({ site: { page } }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/privacy");
  await expect(page.locator("[data-anchor]").first()).toBeAttached({ timeout: 15_000 });
  await routeLoaded(page, "routes/marketing/privacy/route");
  const lands = async (link, what) => {
    await test.step(`${what} goes to its section, below the header`, async () => {
      const id = await link.evaluate((a) => a.hash.slice(1));
      const place = () =>
        page.evaluate(
          (i) => ({
            top: document.getElementById(i).getBoundingClientRect().top,
            header: document.querySelector("header").getBoundingClientRect().bottom,
            hash: location.hash,
          }),
          id,
        );
      await expect(async () => {
        await link.click();
        await expect
          .poll(
            async () => {
              const { top, header, hash } = await place();
              return hash === `#${id}` && top >= header - 1 && top < 250;
            },
            { message: `#${id} below the header`, timeout: 1000 },
          )
          .toBe(true);
      }).toPass({ timeout: 10_000 });
    });
  };
  await lands(page.locator('nav[aria-labelledby="toc-heading"] a').nth(3), "a contents link");
  await page.evaluate(() => scrollTo(0, 0));
  await lands(page.locator("[data-anchor]").nth(2), "a heading's anchor");
});

// The forms through the server. Rows are tagged with RUN and removed at the
// end. A form counts its time from hydration, and the server stores nothing
// sent sooner than MIN_FORM_MS: the page's clock is moved past it, so no test
// sleeps for it.
test.describe("the forms", () => {
  test.afterAll(() => {
    psql(`DELETE FROM waitlist_entry WHERE email LIKE '%+${RUN}@example.com';
      DELETE FROM contact_message WHERE email LIKE '%+${RUN}@example.com';
      DELETE FROM dev_mail WHERE text LIKE '%+${RUN}@example.com%';
      DELETE FROM notification_outbox WHERE text LIKE '%+${RUN}@example.com%';`);
  });

  // Fields are set through the native value setter, as a user's typing would.
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
  /** Open `path` on a page clock, wait for its form to hydrate, then move past the minimum time. */
  const openForm = async (page, path, route, form) => {
    await page.clock.install();
    await page.goto(path);
    await expect(page.locator(form)).toBeAttached({ timeout: 15_000 });
    await routeLoaded(page, route);
    await page.clock.fastForward(MIN_FORM_MS + 300);
  };
  const thanks = async (page, scope) => {
    const s = page.locator(`${scope} [data-form-thanks]`);
    await expect(s).not.toBeEmpty({ timeout: 10_000 });
    return { text: (await s.textContent()).trim(), form: (await page.locator(`${scope} form`).count()) > 0 };
  };
  const entries = (email) =>
    psql(`SELECT coalesce(first_name,'') || '|' || coalesce(caring_for,'') || '|' || coalesce(heard_from,'') || '|' || coalesce(source->>'page','') || '|' || coalesce(source->>'utmSource','')
      FROM waitlist_entry WHERE email = '${email}'`)
      .split("\n")
      .filter(Boolean);

  test("joining stores one entry, lowercased, with the page and UTM source, and thanks the visitor", async ({
    site: { page },
  }) => {
    const joiner = tagged("join");
    await openForm(
      page,
      "/?utm_source=check&utm_campaign=slice4",
      "routes/marketing/home/route",
      "#waitlist form",
    );
    await fill(page, {
      email: joiner.toUpperCase(),
      firstName: "Robin",
      caringFor: "parent",
      heardFrom: "A friend",
    });
    await submit(page);
    expect((await thanks(page, "#waitlist")).form, "the thanks replaces the form").toBe(false);
    expect(entries(joiner)).toEqual(["Robin|parent|A friend|/|check"]);
  });

  // Through the real `x-forwarded-for` header (routes/rpc.ts's clientIpOf), so no browser.
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
    await openForm(page, "/contact", "routes/marketing/contact/route", "main form");
    await fill(page, {
      name: "Robin Example",
      email: writer,
      topic: "privacy",
      message: `Please delete my data (${RUN}).`,
    });
    await submit(page);
    await test.step("the contact form thanks the visitor in place of the form", async () => {
      expect((await thanks(page, "main")).form).toBe(false);
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
});
