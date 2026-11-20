// Sign-in can't be submitted twice (B-1): the button stays disabled, showing
// "Signing in…", from submit until /app renders, and a wrong password
// re-enables it. Then the security headers on a document, /rpc, /api/auth and
// a prerendered marketing page.
//
// The redirect to /app is held on its session check: every /api/auth/get-session
// request after the submit waits until the spec releases it, so /app's
// middleware can't finish and the page stays on /sign-in, "loading", for as
// long as the assertions take (B-161: holding /api/auth/token for a fixed 4 s
// let a slow first sync give up and render /app's "Getting your care groups…"
// first, at load 88).
import { BASE, PASSWORD, expect, test } from "./fixtures.mjs";

const submitButton = (page) => page.locator('form button[type="submit"]');

async function fillSignIn(page, password) {
  await page.goto("/sign-in");
  await page.locator('input[name="email"]').fill("member@example.com");
  await page.locator('input[name="password"]').fill(password);
}

test(
  "one sign-in request on a double click; the button stays busy until /app renders",
  { tag: "@smoke" },
  async ({ device }) => {
    const { page, errors } = await device("member");
    await fillSignIn(page, PASSWORD);

    const signInRequests = [];
    let signInStatus;
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/sign-in/email")) signInRequests.push(r.url());
    });
    page.on("response", (r) => {
      if (r.url().includes("/api/auth/sign-in/email")) signInStatus = r.status();
    });
    // From the submit on, hold every session check (the redirect's middleware)
    // until released below.
    let held = 0;
    let release;
    const released = new Promise((r) => (release = r));
    await page.route("**/api/auth/get-session*", async (route) => {
      held++;
      await released;
      await route.continue().catch(() => {});
    });

    const button = submitButton(page);
    await button.click();
    await test.step("the button shows Signing in… while submitting", async () => {
      await expect(button).toBeDisabled({ timeout: 5000 });
      await expect(button).toHaveText("Signing in…");
    });

    await test.step("the sign-in succeeded and /app is loading", async () => {
      await expect.poll(() => signInStatus, { timeout: 30_000 }).toBeDefined();
      // A failed sign-in (the server's database timing out, say) rightly
      // re-enables the form, so the rest would be meaningless: stop with a reason.
      expect(signInStatus, "sign-in/email's status: is the stack healthy?").toBe(200);
      await expect
        .poll(() => held, { message: "the redirect's session check is held", timeout: 30_000 })
        .toBeGreaterThan(0);
    });

    await test.step("during the redirect the button is disabled and shows Signing in…", async () => {
      expect(new URL(page.url()).pathname).toBe("/sign-in");
      await expect(button).toBeDisabled();
      await expect(button).toHaveText("Signing in…");
    });

    await test.step("the button is still disabled after a second click and an Enter", async () => {
      await button.click({ force: true });
      await page.locator('input[name="password"]').press("Enter");
      await page.waitForTimeout(300);
      await expect(button).toBeDisabled();
      expect(new URL(page.url()).pathname).toBe("/sign-in");
    });

    release();
    await test.step("/app renders after the sign-in", async () => {
      await page.waitForURL((url) => url.pathname.startsWith("/app"), { timeout: 20_000 });
      await expect(page.locator('input[name="email"]')).toHaveCount(0, { timeout: 20_000 });
    });

    await test.step("exactly one sign-in/email request", async () => {
      await page.waitForTimeout(500);
      expect(signInRequests).toHaveLength(1);
    });
    await test.step("no console errors (success case)", () => {
      expect(errors).toEqual([]);
    });
  },
);

test("a wrong password re-enables the button with the error", async ({ device }) => {
  const { page, errors } = await device("wrong");
  await fillSignIn(page, "not-the-password-1234");
  const button = submitButton(page);
  await button.click();
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("That email and password don't match an account.");
  await expect(button).toBeEnabled({ timeout: 5000 });
  await expect(button).toHaveText("Sign in");
  expect(new URL(page.url()).pathname).toBe("/sign-in");
  // Browsers log failed fetches (the 401) as console errors; ignore those.
  expect(errors.filter((e) => !/401|Failed to load resource/.test(e))).toEqual([]);
});

// Security headers: a document, /rpc, /api/auth and a prerendered marketing
// page (served as a file, with the host's set).
test.describe("security headers", () => {
  const headersOf = async (request, path, method = "GET") => {
    const r = await request.fetch(`${BASE}${path}`, { method, maxRedirects: 0, failOnStatusCode: false });
    return r.headers();
  };
  const common = (h) => {
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["permissions-policy"] ?? "").toMatch(/camera=\(\)/);
    expect(h["content-security-policy"] ?? "").toMatch(/frame-ancestors 'none'/);
  };

  test("a document carries the headers, with a nonce in its policy, and each gets its own", async ({
    device,
  }) => {
    const { page } = await device("headers");
    const doc = await headersOf(page.request, "/sign-in");
    common(doc);
    const csp = doc["content-security-policy"];
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+' 'nonce-[^']+'/);
    expect(csp).toMatch(/default-src 'self'/);
    const again = await headersOf(page.request, "/sign-in");
    const nonce = (h) => h["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
    expect(nonce(again)).not.toBe(nonce(doc));
  });

  for (const [path, method] of [
    ["/rpc/me/get", "POST"],
    ["/api/auth/ok", "GET"],
    ["/features/", "GET"],
  ]) {
    test(`${method} ${path} carries the headers`, async ({ device }) => {
      const { page } = await device("headers");
      common(await headersOf(page.request, path, method));
    });
  }

  test("the page carries its policy as a <meta> too", async ({ device }) => {
    const { page } = await device("headers");
    await page.goto("/sign-in");
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      "content",
      /'nonce-/,
    );
  });
});
