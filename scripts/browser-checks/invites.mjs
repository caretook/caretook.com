// Invites PRD: accounts by invitation and sign-in by email. Slice 2 covers the
// account emails, read from the dev mailbox (/dev/mail.json, so this runs
// against the dev server, never a production build):
//   1. Sign in with an emailed link; an unknown email gets the same message,
//      no mail and no account; a used link says so.
//   2. Sign in with an emailed 6-digit code; a wrong or expired code is
//      refused; an unknown email gets the same message and no mail.
//   3. Reset a password by email: the old one stops working, the link works once.
//   4. An unverified account is held at /verify-email, can resend, and the
//      emailed link confirms it.
//   Every send button can't be pressed twice (B-1): one press, one email.
//
// Order-independent and self-cleaning: it makes its own fictional accounts
// (inv<run>-…@example.com, with the seed password) and deletes them, their
// mail and their outbox rows at the end. Later slices append their steps.
import { execFileSync } from "node:child_process";
import { BASE, launch, openPage, sleep } from "./cdp.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const SYSTEM = "00000000-0000-0000-0000-000000000000";
const RUN = `inv${Date.now().toString(36)}`;
const email = (who) => `${RUN}-${who}@example.com`;

const psql = (sql) =>
  execFileSync("docker", [
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

let failed = 0;
let passed = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
  if (ok) passed++;
  else failed++;
};

// --- Accounts -----------------------------------------------------------------

/** A fictional account with the seed password; `verified` false for step 4. */
const createAccount = (who, { verified = true } = {}) => {
  psql(`
    WITH u AS (
      INSERT INTO "user" (email, name, email_verified, created_by, updated_by)
      VALUES ('${email(who)}', 'Inv ${who} Tester', ${verified}, '${SYSTEM}', '${SYSTEM}')
      RETURNING id
    )
    INSERT INTO account (user_id, provider_id, account_id, password)
    SELECT u.id, 'credential', u.id::text,
      (SELECT a.password FROM account a JOIN "user" s ON s.id = a.user_id
        WHERE s.email = 'member@example.com' AND a.provider_id = 'credential')
    FROM u;`);
  return email(who);
};

const accountCount = (address) =>
  Number(psql(`SELECT count(*) FROM "user" WHERE lower(email) = lower('${address}')`));

const cleanUp = () => {
  const like = `'${RUN}-%@example.com'`;
  psql(`
    DELETE FROM "user" WHERE email LIKE ${like};
    DELETE FROM verification WHERE identifier LIKE '%${RUN}-%' OR value LIKE '%${RUN}-%';
    DELETE FROM dev_mail WHERE recipient LIKE ${like};
    DELETE FROM notification_outbox WHERE recipient LIKE ${like};`);
};

// --- Mail -----------------------------------------------------------------------

const mailTo = async (address) => {
  const res = await fetch(`${BASE}/dev/mail.json?to=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`/dev/mail.json answered ${res.status}: is this the dev server?`);
  return (await res.json()).messages;
};

/** Wait for the `count`th message called `name` to `address` (newest first in the list). */
const waitForMail = async (address, name, count = 1, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const mine = (await mailTo(address)).filter((m) => m.name === name);
    if (mine.length >= count) return mine[0];
    await sleep(300);
  }
  throw new Error(`No ${name} mail (#${count}) for ${address} within ${ms} ms`);
};

/** Long enough for a background send that was going to happen to have happened. */
const QUIET_MS = 2500;

// --- Page helpers ---------------------------------------------------------------

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const submit = (label) =>
  `[...document.querySelectorAll('main button[type="submit"]')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const statusText = `(${q('[role="status"]')}?.textContent.trim() ?? "")`;
const alertText = `(${q('[role="alert"]')}?.textContent.trim() ?? "")`;
const onApp = `location.pathname.startsWith("/app") && !document.querySelector("#email")`;

/**
 * Press a submit button twice before the page can re-render (a double tap
 * faster than React): the second press must do nothing. A press after the
 * first request has finished is a new request, so this is the race (B-1).
 */
const doublePress = async (p, button) => {
  await p.evaluate(`(() => { const b = ${button}; b.click(); b.click(); return true; })()`);
  await sleep(150);
};

const sameMessage = (a, b, addressA, addressB) => a.replaceAll(addressA, "@") === b.replaceAll(addressB, "@");

// Better Auth allows only a few sign-in requests per window: space them out.
const pause = () => sleep(4000);

const browsers = [];
const open = async (port, label) => {
  const b = await launch(port);
  browsers.push(b);
  return openPage(b, label);
};

try {
  const linkUser = createAccount("link");
  const codeUser = createAccount("code");
  const resetUser = createAccount("reset");
  const unverifiedUser = createAccount("unverified", { verified: false });
  const unknown = email("nobody");

  // 1. Magic link --------------------------------------------------------------
  {
    const p = await open(9501, "link");
    await p.goto("/sign-in");
    await p.waitFor(q('nav[aria-label="Ways to sign in"]'));
    await p.press(
      `[...document.querySelectorAll('nav[aria-label="Ways to sign in"] a')].find((a) => a.textContent.trim() === "Email link")`,
    );
    await p.waitFor(`location.search.includes("with=link") && ${submit("Email me a link")}`);
    await p.type(q("#email"), linkUser);
    await doublePress(p, submit("Email me a link"));
    await p.waitFor(`${statusText}.startsWith("Check your email")`, 15000);
    const sentLink = await p.evaluate(statusText);
    check(sentLink.includes(linkUser), "the link form says to check the email", sentLink);
    const mail = await waitForMail(linkUser, "magicLink");
    const link = mail.links.find((l) => l.includes("/api/auth/magic-link/verify"));
    check(Boolean(link) && link.startsWith(`${BASE}/`), "the email has a sign-in link on APP_URL", link);
    check(!/vital|symptom|medication|note/i.test(mail.text), "the email carries no health details");
    await sleep(QUIET_MS);
    check((await mailTo(linkUser)).length === 1, "a double press sends one email");

    await p.goto(new URL(link).pathname + new URL(link).search);
    const landed = await p.waitFor(onApp, 45000).then(
      () => true,
      () => false,
    );
    check(landed, "the emailed link signs in and lands on /app", await p.evaluate("location.pathname"));
    await p.screenshot("invites-magic-link-app");

    await pause();
    const u = await open(9502, "link-unknown");
    await u.goto("/sign-in?with=link");
    await u.waitFor(submit("Email me a link"));
    await u.type(q("#email"), unknown);
    await u.press(submit("Email me a link"));
    await u.waitFor(`${statusText}.startsWith("Check your email")`, 15000);
    const sentUnknown = await u.evaluate(statusText);
    check(
      sameMessage(sentLink, sentUnknown, linkUser, unknown),
      "an unknown email gets the same message",
      sentUnknown,
    );
    await sleep(QUIET_MS);
    check((await mailTo(unknown)).length === 0, "an unknown email gets no mail");
    check(accountCount(unknown) === 0, "and no account is created");

    // The link works once: a second use goes back to sign-in and says so.
    await u.goto(new URL(link).pathname + new URL(link).search);
    await u.waitFor(`location.pathname === "/sign-in" && ${alertText}.length > 0`, 15000);
    check(
      (await u.evaluate(alertText)).includes("expired or was already used"),
      "a used link is refused with a plain message",
      await u.evaluate(alertText),
    );
    check(!(await u.evaluate(onApp)), "and doesn't sign in");
  }

  // 2. Code --------------------------------------------------------------------
  {
    await pause();
    const p = await open(9503, "code");
    await p.goto("/sign-in?with=code");
    await p.waitFor(submit("Email me a code"));
    await p.type(q("#email"), codeUser);
    await doublePress(p, submit("Email me a code"));
    await p.waitFor(`${statusText}.startsWith("Check your email") && ${q("#code")}`, 15000);
    const sentCode = await p.evaluate(statusText);
    const mail = await waitForMail(codeUser, "signInCode");
    const code = mail.text.match(/\b(\d{6})\b/)?.[1];
    check(Boolean(code), "the email has a 6-digit code", mail.subject);
    check(!mail.subject.includes(code), "the code isn't in the subject");
    await sleep(QUIET_MS);
    check((await mailTo(codeUser)).length === 1, "a double press sends one code");

    const wrong = code === "000000" ? "111111" : "000000";
    await p.type(q("#code"), wrong);
    await p.press(submit("Sign in"));
    await p.waitFor(`${alertText}.length > 0`, 15000);
    check((await p.evaluate(alertText)).startsWith("That code didn't work"), "a wrong code is refused");
    check(!(await p.evaluate(onApp)), "and doesn't sign in");

    await pause();
    await p.type(q("#code"), code);
    await p.press(submit("Sign in"));
    await sleep(50);
    check(
      await p.evaluate(
        `[...document.querySelectorAll('main button[type="submit"]')].every((b) => b.disabled)`,
      ),
      "every button is disabled while the code signs in",
    );
    const landed = await p.waitFor(onApp, 45000).then(
      () => true,
      () => false,
    );
    check(landed, "the right code signs in and lands on /app", await p.evaluate("location.pathname"));

    // An expired code is refused.
    await pause();
    const e = await open(9504, "code-expired");
    await e.goto("/sign-in?with=code");
    await e.waitFor(submit("Email me a code"));
    await e.type(q("#email"), codeUser);
    await e.press(submit("Email me a code"));
    await e.waitFor(q("#code"), 15000);
    const second = await waitForMail(codeUser, "signInCode", 2);
    const secondCode = second.text.match(/\b(\d{6})\b/)?.[1];
    psql(
      `UPDATE verification SET expires_at = now() - interval '1 minute' WHERE identifier LIKE '%${codeUser}%'`,
    );
    await e.type(q("#code"), secondCode);
    await e.press(submit("Sign in"));
    await e.waitFor(`${alertText}.length > 0`, 15000);
    check(
      (await e.evaluate(alertText)).startsWith("That code didn't work") && !(await e.evaluate(onApp)),
      "an expired code is refused",
      await e.evaluate(alertText),
    );

    // An unknown email: the same message, no mail.
    await pause();
    await e.goto("/sign-in?with=code");
    await e.waitFor(submit("Email me a code"));
    await e.type(q("#email"), unknown);
    await e.press(submit("Email me a code"));
    await e.waitFor(`${statusText}.startsWith("Check your email")`, 15000);
    check(
      sameMessage(sentCode, await e.evaluate(statusText), codeUser, unknown),
      "an unknown email gets the same code message",
    );
    await sleep(QUIET_MS);
    check((await mailTo(unknown)).length === 0, "and no code is sent");
  }

  // 3. Password reset ------------------------------------------------------------
  {
    await pause();
    const p = await open(9505, "reset");
    await p.goto("/sign-in");
    await p.waitFor(
      `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Forgot password?")`,
    );
    await p.press(
      `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Forgot password?")`,
    );
    await p.waitFor(`location.pathname === "/reset-password" && ${submit("Email me a link")}`);
    await p.type(q("#email"), resetUser);
    await doublePress(p, submit("Email me a link"));
    await p.waitFor(`${statusText}.startsWith("Check your email")`, 15000);
    const sentReset = await p.evaluate(statusText);
    const mail = await waitForMail(resetUser, "resetPassword");
    const link = mail.links.find((l) => l.includes("/reset-password?token="));
    check(
      Boolean(link) && link.startsWith(`${BASE}/`),
      "the reset email links to /reset-password on APP_URL",
      link,
    );
    await sleep(QUIET_MS);
    check((await mailTo(resetUser)).length === 1, "a double press sends one reset email");

    const path = new URL(link).pathname + new URL(link).search;
    await p.goto(path);
    await p.waitFor(submit("Save new password"));
    const newPassword = `new ${RUN} passphrase`;
    await p.type(q("#password"), newPassword);
    await p.type(q("#confirm"), `${newPassword}!`);
    await p.press(submit("Save new password"));
    await p.waitFor(`${alertText}.length > 0`, 10000);
    check(
      (await p.evaluate(alertText)) === "The two passwords don't match.",
      "mismatched passwords are caught",
    );
    await p.type(q("#confirm"), newPassword);
    await p.press(submit("Save new password"));
    await p.waitFor(`document.querySelector("main h1")?.textContent === "Password changed"`, 15000);
    check(true, "the emailed link sets a new password");

    // The old password no longer works; the new one does.
    await pause();
    await p.goto("/sign-in");
    await p.waitFor(submit("Sign in"));
    await p.type(q("#email"), resetUser);
    await p.type(q("#password"), PASSWORD);
    await p.press(submit("Sign in"));
    await p.waitFor(`${alertText}.length > 0`, 15000);
    check(
      (await p.evaluate(alertText)) === "That email and password don't match an account.",
      "the old password stops working",
    );
    await pause();
    await p.signIn(resetUser, newPassword, { home: true });
    check(await p.evaluate(onApp), "the new password signs in");

    // The link works once.
    const again = await open(9506, "reset-again");
    await again.goto(path);
    await again.waitFor(submit("Save new password"));
    await again.type(q("#password"), "another long passphrase");
    await again.type(q("#confirm"), "another long passphrase");
    await again.press(submit("Save new password"));
    await again.waitFor(`${alertText}.includes("expired or was already used")`, 15000);
    check(true, "the reset link works only once");

    // An unknown email: the same message, no mail.
    await again.goto("/reset-password");
    await again.waitFor(submit("Email me a link"));
    await again.type(q("#email"), unknown);
    await again.press(submit("Email me a link"));
    await again.waitFor(`${statusText}.startsWith("Check your email")`, 15000);
    check(
      sameMessage(sentReset, await again.evaluate(statusText), resetUser, unknown),
      "an unknown email gets the same reset message",
    );
    await sleep(QUIET_MS);
    check((await mailTo(unknown)).length === 0, "and no reset email");
  }

  // 4. An unverified account -------------------------------------------------------
  {
    await pause();
    const p = await open(9507, "unverified");
    await p.goto("/sign-in");
    await p.waitFor(submit("Sign in"));
    await p.type(q("#email"), unverifiedUser);
    await p.type(q("#password"), PASSWORD);
    await p.press(submit("Sign in"));
    await p.waitFor(`location.pathname === "/verify-email"`, 15000);
    check(
      (await p.evaluate(`document.querySelector("main h1")?.textContent`)) === "Confirm your email" &&
        (await p.evaluate(
          `document.querySelector("main")?.textContent.includes(${JSON.stringify(unverifiedUser)})`,
        )),
      "the right password for an unverified account opens the verify page",
    );
    await waitForMail(unverifiedUser, "verifyEmail");
    check(true, "signing in sent a verification email");

    await p.goto("/app");
    await p.waitFor(`location.pathname === "/sign-in" || location.pathname === "/verify-email"`, 15000);
    check(
      !(await p.evaluate(onApp)),
      "the unverified account can't reach /app",
      await p.evaluate("location.pathname"),
    );

    await p.goto(`/verify-email?email=${encodeURIComponent(unverifiedUser)}`);
    await p.waitFor(submit("Send a new link"));
    await doublePress(p, submit("Send a new link"));
    await p.waitFor(`${statusText}.includes("we've sent it a new link")`, 15000);
    const latest = await waitForMail(unverifiedUser, "verifyEmail", 2);
    await sleep(QUIET_MS);
    check(
      (await mailTo(unverifiedUser)).filter((m) => m.name === "verifyEmail").length === 2,
      "Send a new link sends one more email",
    );

    const link = latest.links.find((l) => l.includes("/verify-email?token="));
    check(Boolean(link) && link.startsWith(`${BASE}/`), "the verification link is on APP_URL", link);
    await p.goto(new URL(link).pathname + new URL(link).search);
    await p.waitFor(`document.querySelector("main h1")?.textContent === "Email confirmed"`, 15000);
    check(
      psql(`SELECT email_verified FROM "user" WHERE email = '${unverifiedUser}'`) === "t",
      "the link confirms the email",
    );
    await p.press(
      `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Continue to Caretook")`,
    );
    const landed = await p.waitFor(onApp, 45000).then(
      () => true,
      () => false,
    );
    check(landed, "and Continue opens /app, signed in", await p.evaluate("location.pathname"));
    await p.screenshot("invites-verified-app");
  }
} catch (error) {
  failed++;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  for (const b of browsers) b.proc.kill();
  try {
    cleanUp();
  } catch (error) {
    console.log(`cleanup failed: ${String(error)}`);
  }
}

console.log(`${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
