// Invites PRD: accounts by invitation and sign-in by email. Slice 2 covers the
// account emails, read from the dev mailbox (/dev/mail.json: the dev server,
// or a check build on a localhost APP_URL). Smoke mode runs steps 1 and 5:
//   1. Sign in with an emailed link; an unknown email gets no mail and no
//      account; a used link says so.
//   2. Sign in with an emailed 6-digit code; a wrong or expired code is
//      refused; an unknown email gets no mail. (The wording, the same for
//      every address, is unit-tested in authMessages.test.ts.)
//   3. Reset a password by email: the old one stops working, the link works once.
//   4. An unverified account is held at /verify-email, can resend, and the
//      emailed link confirms it.
//   Every send button can't be pressed twice (B-1): one press, one email.
// Slice 3 adds email invites, from Dev Family's Members page (member@, owner):
//   5. A new address: the mail names the group and inviter (no health
//      details); sign up with the email locked, consent, join as the role, and
//      the timeline syncs; Members shows who invited them; the used link says so.
//   6. An existing account signs in from the link and joins; signed in as
//      someone else, the link says it's for another address and offers Sign out.
//   7. Decline (signed out): declined for the inviter too.
//   8. Resend rotates the link; revoke and expiry close it, naming nothing.
//   9. Caretakers and viewers see no invite controls; the API refuses them.
//
// Order-independent and self-cleaning: it makes its own fictional accounts
// (inv<run>-…@example.com, with the seed password) and deletes them, their
// mail and their outbox rows at the end (their invites, consent rows and
// memberships too). Later slices append their steps.
import { execFileSync } from "node:child_process";
import { BASE, launch, openPage, sleep, step } from "./cdp.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const SYSTEM = "00000000-0000-0000-0000-000000000000";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
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
    DELETE FROM care_group_invite WHERE email LIKE ${like};
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
  await step("1. sign in with an emailed link", { smoke: true }, async () => {
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

    const u = await open(9502, "link-unknown");
    await u.goto("/sign-in?with=link");
    await u.waitFor(submit("Email me a link"));
    await u.type(q("#email"), unknown);
    await u.press(submit("Email me a link"));
    await u.waitFor(`${statusText}.startsWith("Check your email")`, 15000);
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
  });

  // 2. Code --------------------------------------------------------------------
  await step("2. sign in with an emailed code", async () => {
    const p = await open(9503, "code");
    await p.goto("/sign-in?with=code");
    await p.waitFor(submit("Email me a code"));
    await p.type(q("#email"), codeUser);
    await doublePress(p, submit("Email me a code"));
    await p.waitFor(`${statusText}.startsWith("Check your email") && ${q("#code")}`, 15000);
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
    await sleep(QUIET_MS);
    check((await mailTo(unknown)).length === 0, "and no code is sent");
  });

  // 3. Password reset ------------------------------------------------------------
  await step("3. reset a password by email", async () => {
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
    await sleep(QUIET_MS);
    check((await mailTo(unknown)).length === 0, "and no reset email");
  });

  // 4. An unverified account -------------------------------------------------------
  await step("4. an unverified account is held at verification", async () => {
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
  });

  // --- Slice 3: email invites ---------------------------------------------------
  // member@ (Dev Family's owner) invites from the Members page; the invitees
  // join, decline, or find old links closed. Each invite goes to an inv<run>
  // address, and cleanUp() removes the invites, consent rows and memberships.
  const MEMBERS_PATH = `/app/groups/${DEV_FAMILY}/settings/members`;
  const SHEET = `document.querySelector("[data-invite-sheet]")`;
  const sheetButton = (label) =>
    `[...(${SHEET}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
  const button = (label) =>
    `[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
  const heading = `(document.querySelector("main h1")?.textContent.trim() ?? "")`;
  const pendingRow = (address) =>
    `[...document.querySelectorAll("[data-pending-invites] li[data-invite]")].find((li) => li.textContent.includes(${JSON.stringify(address)}))`;
  const inviteLink = (mail) => {
    const link = mail.links.find((l) => l.includes("/invite/"));
    if (!link) throw new Error(`No invite link in ${mail.subject}`);
    return link;
  };
  const pathOf = (link) => new URL(link).pathname;
  const memberId = psql(`SELECT id FROM "user" WHERE email = 'member@example.com'`);
  const inviterName = psql(`SELECT name FROM "user" WHERE email = 'member@example.com'`);

  const openMembers = async (p) => {
    await p.goto(MEMBERS_PATH);
    await p.waitFor(
      `location.pathname === ${JSON.stringify(MEMBERS_PATH)} && document.querySelector("main li[data-member]")`,
      30000,
    );
  };

  /** Invite `address` as `role` from the Members page, through the sheet. */
  const inviteFromMembers = async (p, address, role) => {
    await p.waitFor(`document.querySelector("[data-invite-controls] button:not([disabled])")`, 15000);
    await p.press(`document.querySelector("[data-invite-controls] button")`);
    await p.waitFor(sheetButton("Send invitation"));
    await p.type(`${SHEET}.querySelector('input[name="email"]')`, address);
    await p.evaluate(
      `(() => { const s = ${SHEET}.querySelector('select[name="role"]'); s.value = ${JSON.stringify(role)}; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`,
    );
    await p.press(`${SHEET}.querySelector('input[name="attested"]')`);
    await p.press(sheetButton("Send invitation"));
    await p.waitFor(
      `!${SHEET} && document.querySelector("[data-invite-controls] [role=status]")?.textContent.includes(${JSON.stringify(address)})`,
      15000,
    );
    await p.waitFor(pendingRow(address), 15000);
  };

  const owner = await open(9511, "inv-owner");
  await owner.signIn("member@example.com", PASSWORD);
  await openMembers(owner);

  // 5. A new person: invite, mail, sign up with the email locked, consent, join.
  const newbie = email("newbie");
  await step("5. a new person is invited, signs up, consents and joins", { smoke: true }, async () => {
    await inviteFromMembers(owner, newbie, "caretaker");
    check(true, "an owner invites a new address from the Members page");
    const pendingText = await owner.evaluate(`${pendingRow(newbie)}.textContent`);
    check(
      pendingText.includes("Caretaker") &&
        pendingText.includes(`Sent by ${inviterName}`) &&
        pendingText.includes("Expires"),
      "Pending lists it with role, sender and expiry",
      pendingText,
    );

    const mail = await waitForMail(newbie, "groupInvite");
    check(
      mail.subject.includes(inviterName) && mail.subject.includes("Grandma Pat"),
      "the invite email names the inviter and the group",
      mail.subject,
    );
    check(
      !/vital|symptom|medication|blood|pain|note/i.test(`${mail.subject} ${mail.text}`),
      "the invite email carries no health details",
    );
    const link = inviteLink(mail);
    check(link.startsWith(`${BASE}/invite/`), "its link is on APP_URL", link);
    check(
      psql(
        `SELECT consent_attested_by || ':' || consent_version FROM care_group_invite WHERE email = '${newbie}'`,
      ).startsWith(`${memberId}:`),
      "the invite records who attested, with the consent version",
    );

    const p = await open(9512, "inv-newbie");
    await p.goto(pathOf(link));
    await p.waitFor(`${heading}.startsWith("Join")`, 20000);
    const form = await p.evaluate(
      `(() => { const e = document.querySelector('[data-invite-form="signUp"] input[name="email"]'); return { value: e?.value, readOnly: e?.readOnly, title: ${heading} }; })()`,
    );
    check(
      form.value === newbie && form.readOnly,
      "signing up, the email is the invite's and locked",
      JSON.stringify(form),
    );
    check(form.title === "Join Grandma Pat's care group", "the page names the group", form.title);
    await p.type(
      `document.querySelector('[data-invite-form="signUp"] input[name="name"]')`,
      `Inv Newbie ${RUN}`,
    );
    await p.type(`document.querySelector('[data-invite-form="signUp"] input[name="password"]')`, PASSWORD);
    await p.type(`document.querySelector('[data-invite-form="signUp"] input[name="confirm"]')`, PASSWORD);
    await doublePress(p, button("Create account"));
    await p.waitFor(`document.querySelector('[data-invite-form="accept"]')`, 30000);
    check(accountCount(newbie) === 1, "a double press creates one account");
    check(
      psql(`SELECT email_verified FROM "user" WHERE email = '${newbie}'`) === "t",
      "the new account is verified",
    );
    const consentText = await p.evaluate(`document.querySelector('[data-invite-form="accept"]').textContent`);
    check(
      /shares the care recipient's health information/.test(consentText) && /Timeline/.test(consentText),
      "the consent screen says what the group shares",
      consentText.slice(0, 120),
    );
    await p.press(`document.querySelector('[data-invite-form="accept"] input[name="consent"]')`);
    await p.press(button("Join the care group"));
    const joined = await p
      .waitFor(
        `location.pathname.startsWith("/app/groups/${DEV_FAMILY}") && document.querySelector('main a[href*="/entries/"]')`,
        60000,
      )
      .then(
        () => true,
        () => false,
      );
    check(joined, "joining opens the group, and its timeline syncs", await p.evaluate("location.pathname"));
    await p.screenshot("invites-joined-timeline");
    const newbieId = psql(`SELECT id FROM "user" WHERE email = '${newbie}'`);
    check(
      psql(
        `SELECT role || ':' || coalesce(invited_by::text, '') FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = '${newbieId}'`,
      ) === `caretaker:${memberId}`,
      "they join as the invited role, invited by the owner",
    );
    check(
      psql(
        `SELECT count(*) || ':' || max(consent_version) FROM care_group_consent WHERE user_id = '${newbieId}' AND group_id = '${DEV_FAMILY}'`,
      ).startsWith("1:"),
      "consent is recorded with its version",
    );
    check(
      psql(`SELECT status FROM care_group_invite WHERE email = '${newbie}'`) === "accepted",
      "the invite is accepted",
    );

    // The owner's Members page shows who invited them (live) and the invite leaves Pending.
    const history = await owner
      .waitFor(
        `document.querySelector('li[data-member="${newbieId}"] [data-member-history]')?.textContent.includes("Invited by")`,
        30000,
      )
      .then(
        () =>
          owner.evaluate(
            `document.querySelector('li[data-member="${newbieId}"] [data-member-history]').textContent`,
          ),
        () => "",
      );
    check(
      history.startsWith(`Invited by ${inviterName} · Joined`),
      "Members shows who invited them and when they joined",
      history,
    );

    // The used link now says so, and names nothing.
    const q2 = await open(9513, "inv-used");
    await q2.goto(pathOf(link));
    await q2.waitFor(`${heading}.length > 0`, 20000);
    const used = await q2.evaluate(`({ h: ${heading}, body: document.querySelector("main").textContent })`);
    check(
      used.h === "This invitation was already accepted" && !used.body.includes("Grandma"),
      "an accepted link says so without the recipient's details",
      used.h,
    );
  });

  // 6. An existing account signs in from the link; another account is told it's not theirs.
  await step("6-7. an existing account joins; another account is refused; decline", async () => {
    const existing = createAccount("existing");
    await owner.goto(MEMBERS_PATH);
    await openMembers(owner);
    await inviteFromMembers(owner, existing, "viewer");
    const link = inviteLink(await waitForMail(existing, "groupInvite"));

    const p = await open(9514, "inv-existing");
    await p.goto(pathOf(link));
    await p.waitFor(
      `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Sign in")`,
      20000,
    );
    await p.press(`[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Sign in")`);
    await p.waitFor(`location.pathname === "/sign-in" && ${submit("Sign in")}`);
    await p.type(q("#email"), existing);
    await p.type(q("#password"), PASSWORD);
    await p.press(submit("Sign in"));
    await p.waitFor(
      `location.pathname === ${JSON.stringify(pathOf(link))} && document.querySelector('[data-invite-form="accept"]')`,
      30000,
    );
    check(true, "an existing user signs in from the link and comes back to the invite");
    await p.press(`document.querySelector('[data-invite-form="accept"] input[name="consent"]')`);
    await p.press(button("Join the care group"));
    await p.waitFor(`location.pathname.startsWith("/app/groups/${DEV_FAMILY}")`, 60000);
    check(
      psql(
        `SELECT m.role FROM care_group_member m JOIN "user" u ON u.id = m.user_id WHERE u.email = '${existing}' AND m.group_id = '${DEV_FAMILY}'`,
      ) === "viewer",
      "and joins as a viewer",
    );

    // Now signed in as `existing`, open an invite for someone else.
    const other = email("other");
    await inviteFromMembers(owner, other, "caretaker");
    const otherLink = inviteLink(await waitForMail(other, "groupInvite"));
    await p.goto(pathOf(otherLink));
    await p.waitFor(`${heading}.length > 0`, 20000);
    check(
      (await p.evaluate(heading)) === "This invitation is for another email address",
      "signed in as someone else, the invite says it's for another address",
    );
    check(!(await p.evaluate(`document.querySelector('[data-invite-form="accept"]')`)), "and offers no Join");
    await p.press(button("Sign out"));
    await p.waitFor(
      `location.pathname === ${JSON.stringify(pathOf(otherLink))} && document.querySelector('[data-invite-form="signUp"]')`,
      30000,
    );
    check(true, "Sign out comes back to the invite, signed out");

    // 7. Decline, signed out.
    await doublePress(p, button("Decline invitation"));
    await p.waitFor(`${heading} === "Invitation declined"`, 15000);
    check(
      psql(`SELECT status FROM care_group_invite WHERE email = '${other}'`) === "declined",
      "Decline marks the invite declined",
    );
    await p.goto(pathOf(otherLink));
    await p.waitFor(`${heading}.length > 0`, 20000);
    check((await p.evaluate(heading)) === "This invitation was declined", "a declined link says so");
    await openMembers(owner);
    await owner.waitFor(pendingRow(other), 15000);
    check(
      (await owner.evaluate(`${pendingRow(other)}.textContent`)).includes("Declined"),
      "the inviter sees it declined in Pending",
    );
  });

  // 8. Resend rotates the link; revoke and expiry close it.
  await step("8. resend rotates the link; revoke and expiry close it", async () => {
    const target = email("resend");
    await inviteFromMembers(owner, target, "viewer");
    const first = inviteLink(await waitForMail(target, "groupInvite"));
    await owner.press(`${pendingRow(target)}.querySelector("button")`); // Resend
    const second = inviteLink(await waitForMail(target, "groupInvite", 2));
    check(first !== second, "Resend sends a new link");

    const p = await open(9515, "inv-closed");
    await p.goto(pathOf(first));
    await p.waitFor(`${heading}.length > 0`, 20000);
    const old = await p.evaluate(`({ h: ${heading}, body: document.querySelector("main").textContent })`);
    check(
      old.h === "This invitation isn't valid" && !old.body.includes("Grandma"),
      "and the old one stops working",
      old.h,
    );
    await p.goto(pathOf(second));
    await p.waitFor(`${heading}.startsWith("Join")`, 20000);
    check(true, "the new link works");

    await owner.press(
      `[...${pendingRow(target)}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Revoke")`,
    );
    await owner.waitFor(`document.querySelector("dialog[open]")`, 5000);
    await owner.press(
      `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Revoke")`,
    );
    await owner.waitFor(`!${pendingRow(target)}`, 15000);
    check(
      psql(`SELECT status FROM care_group_invite WHERE email = '${target}'`) === "revoked",
      "Revoke withdraws it",
    );
    await p.goto(pathOf(second));
    await p.waitFor(`${heading}.length > 0`, 20000);
    const revoked = await p.evaluate(`({ h: ${heading}, body: document.querySelector("main").textContent })`);
    check(
      revoked.h === "This invitation was withdrawn" && !revoked.body.includes("Grandma"),
      "a revoked link says so at once, naming nothing",
      revoked.h,
    );

    const late = email("late");
    await inviteFromMembers(owner, late, "viewer");
    const lateLink = inviteLink(await waitForMail(late, "groupInvite"));
    psql(`UPDATE care_group_invite SET expires_at = now() - interval '1 minute' WHERE email = '${late}'`);
    await p.goto(pathOf(lateLink));
    await p.waitFor(`${heading}.length > 0`, 20000);
    const expired = await p.evaluate(`({ h: ${heading}, body: document.querySelector("main").textContent })`);
    check(
      expired.h === "This invitation has expired" && !expired.body.includes("Grandma"),
      "an expired link says so, naming nothing",
      expired.h,
    );
  });

  // 9. Caretakers and viewers see no invite controls, and the API refuses them.
  await step("9. caretakers and viewers see no invite controls", async () => {
    for (const who of ["caretaker", "viewer"]) {
      const p = await open(who === "caretaker" ? 9516 : 9517, `inv-${who}`);
      await p.signIn(`${who}@example.com`, PASSWORD);
      await openMembers(p);
      const controls = await p.evaluate(
        `({ invite: !!document.querySelector("[data-invite-controls]"), pending: !!document.querySelector("[data-pending-invites]") })`,
      );
      check(
        !controls.invite && !controls.pending,
        `a ${who} sees no Invite button or Pending list`,
        JSON.stringify(controls),
      );
      const status = await p.evaluate(
        `fetch("/rpc/invite/createEmail", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: { groupId: ${JSON.stringify(DEV_FAMILY)}, email: ${JSON.stringify(email(`api-${who}`))}, role: "viewer", attested: true } }) }).then((r) => r.status)`,
      );
      check(status === 403, `a ${who}'s invite API call is refused`, String(status));
    }
  });
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
