// Invites PRD: accounts by invitation and sign-in by email. Slice 2 covers the
// account emails, read from the dev mailbox (/dev/mail.json: the dev server,
// or a check build on a localhost APP_URL). Smoke mode runs steps 1 and 5:
//   1. "Send email" sends one email with a link and a code
//      (B-96); the link signs in; an unknown email gets no mail and no
//      account; a used link says so.
//   2. The same email's 6-digit code, typed into the page, signs in; a wrong
//      or expired code is refused; an unknown email gets no mail. (The
//      wording, the same for every address, is unit-tested in
//      authMessages.test.ts.)
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
//   9. Caretakers and viewers see no invite controls (email or link); the
//      API refuses them.
// Slice 4 adds invite links and join requests (smoke mode runs step 10):
//  10. The owner makes a viewer link and copies it (and a second device
//      copies the same link); a new person signs up through it, confirms
//      their email, consents and asks to join: home says "Waiting for
//      approval" and the device holds no group data. The owner gets the
//      joinRequested mail, approves from Members, and the requester's home
//      shows the group without a reload; they're a viewer and get joinApproved.
//  11. One request per person however often they ask; maximum uses, revoke
//      and expiry close a link; Decline emails them and home says so; the API
//      refuses owner and admin links, and never gives back an email invite's token.
// Quick fixes slice 24 (B-64):
//  12. A requester withdraws a waiting request from home (after a confirm):
//      the row goes, it's withdrawn in Postgres and gone from Members;
//      offline the button is disabled; a declined row has no button.
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

/** Link invites this run made (they carry no address to clean up by). */
const linkIds = [];

const cleanUp = () => {
  const like = `'${RUN}-%@example.com'`;
  const links = linkIds.length ? linkIds.map((id) => `'${id}'`).join(", ") : "NULL";
  psql(`
    DELETE FROM care_group_invite WHERE id IN (${links});
    DELETE FROM dev_mail WHERE name = 'joinRequested' AND text LIKE '%${RUN}-%';
    DELETE FROM notification_outbox WHERE name = 'joinRequested' AND text LIKE '%${RUN}-%';
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

/** Wait for a `name` message to `address` whose text mentions `about` (a shared inbox, like member@'s). */
const mailAbout = async (address, name, about, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const found = (await mailTo(address)).find((m) => m.name === name && m.text.includes(about));
    if (found) return found;
    await sleep(300);
  }
  return undefined;
};

/** Long enough for a background send that was going to happen to have happened. */
const QUIET_MS = 2500;

/** The sign-in email's code: six digits on a line of their own (never part of the link). */
const codeIn = (text) => text.match(/^\s*(\d{6})\s*$/m)?.[1];

// --- Page helpers ---------------------------------------------------------------

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const submit = (label) =>
  `[...document.querySelectorAll('main button[type="submit"]')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const statusText = `(${q('[role="status"]')}?.textContent.trim() ?? "")`;
const alertText = `(${q('[role="alert"]')}?.textContent.trim() ?? "")`;
const onApp = `location.pathname.startsWith("/app") && !document.querySelector('input[name="email"]')`;

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
      `[...document.querySelectorAll('nav[aria-label="Ways to sign in"] a')].find((a) => a.textContent.trim() === "Email")`,
    );
    await p.waitFor(`location.search.includes("with=email") && ${submit("Send email")}`);
    await p.type(q('input[name="email"]'), linkUser);
    await doublePress(p, submit("Send email"));
    await p.waitFor(`${statusText}.startsWith("Check your email") && ${q('input[name="code"]')}`, 15000);
    const sentLink = await p.evaluate(statusText);
    check(sentLink.includes(linkUser), "the form says to check the email, and shows a code box", sentLink);
    const mail = await waitForMail(linkUser, "signInEmail");
    const link = mail.links.find((l) => l.includes("/api/auth/magic-link/verify"));
    check(Boolean(link) && link.startsWith(`${BASE}/`), "the email has a sign-in link on APP_URL", link);
    check(Boolean(codeIn(mail.text)), "and a 6-digit code", mail.subject);
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
    await u.goto("/sign-in?with=email");
    await u.waitFor(submit("Send email"));
    await u.type(q('input[name="email"]'), unknown);
    await u.press(submit("Send email"));
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
    await p.goto("/sign-in?with=email");
    await p.waitFor(submit("Send email"));
    await p.type(q('input[name="email"]'), codeUser);
    await doublePress(p, submit("Send email"));
    await p.waitFor(`${statusText}.startsWith("Check your email") && ${q('input[name="code"]')}`, 15000);
    const mail = await waitForMail(codeUser, "signInEmail");
    const code = codeIn(mail.text);
    check(Boolean(code), "the email has a 6-digit code", mail.subject);
    check(!mail.subject.includes(code), "the code isn't in the subject");
    await sleep(QUIET_MS);
    check((await mailTo(codeUser)).length === 1, "a double press sends one email");

    const wrong = code === "000000" ? "111111" : "000000";
    await p.type(q('input[name="code"]'), wrong);
    await p.press(submit("Sign in"));
    await p.waitFor(`${alertText}.length > 0`, 15000);
    check((await p.evaluate(alertText)).startsWith("That code didn't work"), "a wrong code is refused");
    check(!(await p.evaluate(onApp)), "and doesn't sign in");

    await pause();
    await p.type(q('input[name="code"]'), code);
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
    await e.goto("/sign-in?with=email");
    await e.waitFor(submit("Send email"));
    await e.type(q('input[name="email"]'), codeUser);
    await e.press(submit("Send email"));
    await e.waitFor(q('input[name="code"]'), 15000);
    const second = await waitForMail(codeUser, "signInEmail", 2);
    const secondCode = codeIn(second.text);
    psql(
      `UPDATE verification SET expires_at = now() - interval '1 minute' WHERE identifier LIKE '%${codeUser}%'`,
    );
    await e.type(q('input[name="code"]'), secondCode);
    await e.press(submit("Sign in"));
    await e.waitFor(`${alertText}.length > 0`, 15000);
    check(
      (await e.evaluate(alertText)).startsWith("That code didn't work") && !(await e.evaluate(onApp)),
      "an expired code is refused",
      await e.evaluate(alertText),
    );

    // An unknown email: the same message, no mail.
    await pause();
    await e.goto("/sign-in?with=email");
    await e.waitFor(submit("Send email"));
    await e.type(q('input[name="email"]'), unknown);
    await e.press(submit("Send email"));
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
    await p.type(q('input[name="email"]'), resetUser);
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
    await p.type(q('input[name="password"]'), newPassword);
    await p.type(q('input[name="confirm"]'), newPassword);
    await p.press(submit("Save new password"));
    await p.waitFor(`document.querySelector("main h1")?.textContent === "Password changed"`, 15000);
    check(true, "the emailed link sets a new password");

    // The old password no longer works; the new one does.
    await pause();
    await p.goto("/sign-in");
    await p.waitFor(submit("Sign in"));
    await p.type(q('input[name="email"]'), resetUser);
    await p.type(q('input[name="password"]'), PASSWORD);
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
    await again.type(q('input[name="password"]'), "another long passphrase");
    await again.type(q('input[name="confirm"]'), "another long passphrase");
    await again.press(submit("Save new password"));
    await again.waitFor(`${alertText}.includes("expired or was already used")`, 15000);
    check(true, "the reset link works only once");

    // An unknown email: the same message, no mail.
    await again.goto("/reset-password");
    await again.waitFor(submit("Email me a link"));
    await again.type(q('input[name="email"]'), unknown);
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
    await p.type(q('input[name="email"]'), unverifiedUser);
    await p.type(q('input[name="password"]'), PASSWORD);
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
    await p.type(q('input[name="email"]'), existing);
    await p.type(q('input[name="password"]'), PASSWORD);
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
        `({ invite: !!document.querySelector("[data-invite-controls]"), pending: !!document.querySelector("[data-pending-invites]"), link: !!document.querySelector("[data-link-controls]"), links: !!document.querySelector("[data-invite-links]"), requests: !!document.querySelector("[data-join-requests]") })`,
      );
      check(
        Object.values(controls).every((shown) => !shown),
        `a ${who} sees no Invite or Create a link button, and no Pending, links or requests`,
        JSON.stringify(controls),
      );
      const linkStatus = await p.evaluate(
        `fetch("/rpc/invite/createLink", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: { groupId: ${JSON.stringify(DEV_FAMILY)}, role: "viewer" } }) }).then((r) => r.status)`,
      );
      check(linkStatus === 403, `a ${who}'s link API call is refused`, String(linkStatus));
      const status = await p.evaluate(
        `fetch("/rpc/invite/createEmail", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: { groupId: ${JSON.stringify(DEV_FAMILY)}, email: ${JSON.stringify(email(`api-${who}`))}, role: "viewer", attested: true } }) }).then((r) => r.status)`,
      );
      check(status === 403, `a ${who}'s invite API call is refused`, String(status));
    }
  });

  // --- Slice 4: invite links and join requests -------------------------------------
  const LINK_SHEET = `document.querySelector("[data-link-sheet]")`;
  const linkRows = `[...document.querySelectorAll("[data-invite-links] li[data-invite-link]")]`;
  const linkRow = (id) => `document.querySelector('[data-invite-links] li[data-invite-link="${id}"]')`;
  const rowButton = (row, label) =>
    `[...(${row}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
  const requestRow = (address) =>
    `[...document.querySelectorAll("[data-join-requests] li[data-join-request]")].find((li) => li.textContent.includes(${JSON.stringify(address)}))`;
  const myRequest = `document.querySelector('[data-my-request="${DEV_FAMILY}"]')`;
  const devFamilyCard = `document.querySelector('main a[href="/app/groups/${DEV_FAMILY}/timeline"]')`;
  /** Rows of the device's own copy (PowerSync), for "nothing of the group is here". */
  const localCount = (p, table) =>
    p.evaluate(
      `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM ${table}").then((rows) => rows[0].n)`,
    );
  /** Record what the page copies or shares, instead of the real clipboard and share sheet. */
  const stubSharing = (p) =>
    p.evaluate(`(() => {
      window.__copied = []; window.__shared = [];
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => (window.__copied.push(t), Promise.resolve()) } });
      navigator.canShare = () => true;
      navigator.share = (d) => (window.__shared.push(d), Promise.resolve());
      return true; })()`);
  const rpcCall = (p, path, json) =>
    p.evaluate(
      `fetch("/rpc/${path}", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: ${JSON.stringify(json)} }) }).then(async (r) => ({ status: r.status, body: await r.json() }))`,
    );
  /** A link made through the API as the owner, for the steps that don't test the form. */
  const apiLink = async (input) => {
    const res = await rpcCall(owner, "invite/createLink", { groupId: DEV_FAMILY, ...input });
    if (res.status !== 200) throw new Error(`createLink answered ${res.status}`);
    linkIds.push(res.body.json.invite.id);
    return { id: res.body.json.invite.id, path: `/invite/${res.body.json.token}` };
  };
  /** Sign in as `address` and ask to join with the link at `path`; lands on home. */
  const askToJoin = async (p, path) => {
    await p.goto(path);
    await p.waitFor(`document.querySelector('[data-invite-form="accept"]')`, 30000);
    await p.press(`document.querySelector('[data-invite-form="accept"] input[name="consent"]')`);
    await p.press(button("Ask to join"));
    await p.waitFor(`location.pathname === "/app" && ${myRequest}`, 30000);
  };

  // 10. Make a link, copy it, sign up through it, ask, get approved.
  const joiner = email("joiner");
  await step("10. a link: sign up through it, ask to join, approved", { smoke: true }, async () => {
    await openMembers(owner);
    await owner.waitFor(`document.querySelector("[data-link-controls] button:not([disabled])")`, 15000);
    const before = await owner.evaluate(`${linkRows}.map((li) => li.dataset.inviteLink)`);
    await owner.press(`document.querySelector("[data-link-controls] button")`);
    await owner.waitFor(`${LINK_SHEET}?.querySelector('select[name="role"]')`, 10000);
    const roles = await owner.evaluate(
      `[...${LINK_SHEET}.querySelectorAll('select[name="role"] option')].map((o) => o.value)`,
    );
    check(roles.join() === "caretaker,viewer", "a link offers caretaker and viewer only", roles.join());
    await owner.type(`${LINK_SHEET}.querySelector('input[name="maxUses"]')`, "5");
    await owner.press(
      `[...${LINK_SHEET}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Create link")`,
    );
    await owner.waitFor(
      `!${LINK_SHEET} && ${linkRows}.some((li) => !${JSON.stringify(before)}.includes(li.dataset.inviteLink))`,
      15000,
    );
    const linkId = await owner.evaluate(
      `${linkRows}.map((li) => li.dataset.inviteLink).find((id) => !${JSON.stringify(before)}.includes(id))`,
    );
    linkIds.push(linkId);
    const line = await owner.evaluate(`${linkRow(linkId)}.textContent`);
    check(
      line.includes("Viewer link") && line.includes("Used 0 of 5 times") && line.includes("Expires"),
      "the new link is listed with its role, uses and expiry",
      line,
    );
    check(
      psql(
        `SELECT kind || ':' || role || ':' || (token_ciphertext IS NOT NULL) FROM care_group_invite WHERE id = '${linkId}'`,
      ) === "link:viewer:true",
      "it's stored as a viewer link, its token sealed",
    );

    await stubSharing(owner);
    await owner.waitFor(
      `${rowButton(linkRow(linkId), "Copy")} && !${rowButton(linkRow(linkId), "Copy")}.disabled`,
      15000,
    );
    await owner.press(rowButton(linkRow(linkId), "Copy"));
    await owner.waitFor(`window.__copied.length === 1`, 5000);
    const url = await owner.evaluate(`window.__copied[0]`);
    check(url.startsWith(`${BASE}/invite/`), "Copy puts the invite link on the clipboard", url);
    await owner.press(rowButton(linkRow(linkId), "Share"));
    await owner.waitFor(`window.__shared.length === 1`, 5000);
    check(
      (await owner.evaluate(`window.__shared[0].url`)) === url,
      "Share hands the same link to the share sheet",
    );

    // A second device copies the same link.
    const second = await open(9521, "inv-owner-2");
    await second.signIn("member@example.com", PASSWORD);
    await openMembers(second);
    await stubSharing(second);
    await second.waitFor(
      `${rowButton(linkRow(linkId), "Copy")} && !${rowButton(linkRow(linkId), "Copy")}.disabled`,
      15000,
    );
    await second.press(rowButton(linkRow(linkId), "Copy"));
    await second.waitFor(`window.__copied.length === 1`, 5000);
    check((await second.evaluate(`window.__copied[0]`)) === url, "a second device copies the same link");

    // A new person opens it, signed out.
    const p = await open(9522, "inv-joiner");
    const path = pathOf(url);
    await p.goto(path);
    await p.waitFor(
      `${heading}.startsWith("Join") && document.querySelector('[data-invite-form="signUp"]')`,
      20000,
    );
    const form = await p.evaluate(
      `(() => { const e = document.querySelector('[data-invite-form="signUp"] input[name="email"]'); return { value: e?.value, readOnly: e?.readOnly, decline: !!document.querySelector('[data-invite-form="decline"]') }; })()`,
    );
    check(
      form.value === "" && !form.readOnly && !form.decline,
      "a link's sign-up takes any address, with no Decline",
      JSON.stringify(form),
    );
    await p.type(`document.querySelector('[data-invite-form="signUp"] input[name="email"]')`, joiner);
    await p.type(
      `document.querySelector('[data-invite-form="signUp"] input[name="name"]')`,
      `Inv Joiner ${RUN}`,
    );
    await p.type(`document.querySelector('[data-invite-form="signUp"] input[name="password"]')`, PASSWORD);
    await p.type(`document.querySelector('[data-invite-form="signUp"] input[name="confirm"]')`, PASSWORD);
    await doublePress(p, button("Create account"));
    await p.waitFor(`location.pathname === "/verify-email"`, 30000);
    check(accountCount(joiner) === 1, "a double press creates one account");
    check(
      psql(`SELECT email_verified FROM "user" WHERE email = '${joiner}'`) === "f",
      "a link's account starts unconfirmed, and waits at /verify-email",
    );
    const verify = await waitForMail(joiner, "verifyEmail");
    const verifyLink = verify.links.find((l) => l.includes("/verify-email?token="));
    await p.goto(new URL(verifyLink).pathname + new URL(verifyLink).search);
    await p.waitFor(`${heading} === "Email confirmed"`, 20000);
    await p.press(
      `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Continue to Caretook")`,
    );
    await p.waitFor(
      `location.pathname === ${JSON.stringify(path)} && document.querySelector('[data-invite-form="accept"]')`,
      30000,
    );
    check(true, "the confirmation link signs them in and brings them back to the link");
    const consentText = await p.evaluate(`document.querySelector('[data-invite-form="accept"]').textContent`);
    check(
      /health information/.test(consentText) && /approves each request/.test(consentText),
      "the consent screen says what's shared and that a request waits for approval",
    );
    await p.press(`document.querySelector('[data-invite-form="accept"] input[name="consent"]')`);
    await p.press(button("Ask to join"));
    await p.waitFor(`location.pathname === "/app" && ${myRequest}`, 30000);
    const waiting = await p.evaluate(`${myRequest}.textContent`);
    check(
      waiting.includes("Waiting for approval: Grandma Pat"),
      "home says it's waiting for approval",
      waiting,
    );
    await p.screenshot("invites-waiting-for-approval");
    const held = {
      groups: await localCount(p, "care_group"),
      entries: await localCount(p, "timeline_entry"),
    };
    check(held.groups === 0 && held.entries === 0, "the device holds no group data", JSON.stringify(held));
    const joinerId = psql(`SELECT id FROM "user" WHERE email = '${joiner}'`);
    check(
      psql(
        `SELECT count(*) FROM care_group_consent WHERE user_id = '${joinerId}' AND group_id = '${DEV_FAMILY}'`,
      ) === "1",
      "consent is recorded",
    );

    // The owner is emailed, and answers from Members.
    const asked = await mailAbout("member@example.com", "joinRequested", joiner);
    check(
      Boolean(asked) &&
        asked.subject.includes(`Inv Joiner ${RUN}`) &&
        asked.links.some((l) => l.endsWith(MEMBERS_PATH)),
      "the owner gets a joinRequested email linking to Members",
      asked?.subject,
    );
    check(
      !/vital|symptom|medication|blood|pain|note/i.test(`${asked?.subject} ${asked?.text}`),
      "with no health details",
    );
    await openMembers(owner);
    await owner.waitFor(requestRow(joiner), 15000);
    const reqLine = await owner.evaluate(`${requestRow(joiner)}.textContent`);
    check(
      reqLine.includes(`Inv Joiner ${RUN}`) && reqLine.includes("Viewer"),
      "Requests shows their name, email and role",
      reqLine,
    );
    check(
      (await owner.evaluate(`${linkRow(linkId)}.textContent`)).includes("Used 1 of 5 times"),
      "the link counts the use",
    );
    await owner.press(rowButton(requestRow(joiner), "Approve"));
    await owner.waitFor(`!${requestRow(joiner)}`, 15000);

    const opened = await p.waitFor(`${devFamilyCard} && !${myRequest}`, 30000).then(
      () => true,
      () => false,
    );
    check(opened, "approval turns the requester's home into the group, without a reload");
    check(
      psql(
        `SELECT role FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = '${joinerId}'`,
      ) === "viewer",
      "they're a member as a viewer",
    );
    const approved = await waitForMail(joiner, "joinApproved");
    check(approved.subject.includes("Grandma Pat"), "and get a joinApproved email", approved.subject);
    await p.screenshot("invites-approved-home");
  });

  // 11. One request per person; limits, revoke and expiry; decline; the API's refusals.
  await step("11. one request each; uses, revoke and expiry; decline; API refusals", async () => {
    const twice = await apiLink({ role: "caretaker", maxUses: 3 });
    const asker = createAccount("asker");
    const p = await open(9523, "inv-asker");
    await p.signIn(asker, PASSWORD, { home: true });
    await askToJoin(p, twice.path);
    await askToJoin(p, twice.path);
    const askerId = psql(`SELECT id FROM "user" WHERE email = '${asker}'`);
    check(
      psql(`SELECT count(*) FROM care_group_join_request WHERE user_id = '${askerId}'`) === "1" &&
        psql(`SELECT use_count FROM care_group_invite WHERE id = '${twice.id}'`) === "1",
      "asking twice makes one request and counts one use",
    );

    // A link whose uses are all taken (counting is covered by the integration tests).
    const once = await apiLink({ role: "viewer", maxUses: 1 });
    psql(`UPDATE care_group_invite SET use_count = 1 WHERE id = '${once.id}'`);
    const late = await open(9524, "inv-late");
    await late.goto(once.path);
    await late.waitFor(`${heading}.length > 0`, 20000);
    check((await late.evaluate(heading)) === "This invitation has been used up", "a used-up link says so");

    // Decline, from Members.
    await openMembers(owner);
    await owner.waitFor(requestRow(asker), 15000);
    await owner.press(rowButton(requestRow(asker), "Decline"));
    await owner.waitFor(`document.querySelector("dialog[open]")`, 5000);
    await owner.press(
      `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Decline")`,
    );
    await owner.waitFor(`!${requestRow(asker)}`, 15000);
    const declined = await waitForMail(asker, "joinDeclined");
    check(declined.subject.includes("Grandma Pat"), "Decline emails them", declined.subject);
    await p.goto("/app");
    await p.waitFor(`${myRequest}?.dataset.requestStatus === "declined"`, 20000);
    check(
      (await p.evaluate(`${myRequest}.textContent`)).startsWith("Not approved: Grandma Pat"),
      "and their home says it wasn't approved",
    );
    check(
      !(await p.evaluate(`!!${myRequest}.querySelector("[data-withdraw-request]")`)),
      "a declined request has no Withdraw button",
    );
    check(
      psql(`SELECT count(*) FROM care_group_member WHERE user_id = '${askerId}'`) === "0",
      "they're not a member",
    );

    // Revoke from Members; expiry.
    const revoked = await apiLink({ role: "viewer" });
    await openMembers(owner);
    await owner.waitFor(linkRow(revoked.id), 15000);
    await owner.press(rowButton(linkRow(revoked.id), "Revoke"));
    await owner.waitFor(`document.querySelector("dialog[open]")`, 5000);
    await owner.press(
      `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Revoke")`,
    );
    await owner.waitFor(`!${linkRow(revoked.id)}`, 15000);
    await late.goto(revoked.path);
    await late.waitFor(`${heading}.length > 0`, 20000);
    const gone = await late.evaluate(`({ h: ${heading}, body: document.querySelector("main").textContent })`);
    check(
      gone.h === "This invitation was withdrawn" && !gone.body.includes("Grandma"),
      "a revoked link stops at once",
      gone.h,
    );

    const old = await apiLink({ role: "viewer", expiresInDays: 1 });
    psql(`UPDATE care_group_invite SET expires_at = now() - interval '1 minute' WHERE id = '${old.id}'`);
    await late.goto(old.path);
    await late.waitFor(`${heading}.length > 0`, 20000);
    check((await late.evaluate(heading)) === "This invitation has expired", "an expired link says so");

    // The API never makes an owner or admin link, and never reads back an email invite's token.
    for (const role of ["owner", "admin"]) {
      const res = await rpcCall(owner, "invite/createLink", { groupId: DEV_FAMILY, role });
      check(res.status === 400, `the API refuses an ${role} link`, String(res.status));
    }
    const emailInvite = psql(
      `SELECT id FROM care_group_invite WHERE kind = 'email' AND group_id = '${DEV_FAMILY}' LIMIT 1`,
    );
    const read = await rpcCall(owner, "invite/copyLink", { id: emailInvite });
    check(
      read.status === 400 && !("token" in (read.body.json ?? {})),
      "an email invite's token can't be read back",
      String(read.status),
    );
  });

  // 12. Withdraw a waiting request (B-64).
  await step("12. a requester withdraws a waiting request", async () => {
    const link = await apiLink({ role: "viewer" });
    const withdrawer = createAccount("withdrawer");
    const p = await open(9525, "inv-withdrawer");
    await p.signIn(withdrawer, PASSWORD, { home: true });
    await askToJoin(p, link.path);
    const withdrawerId = psql(`SELECT id FROM "user" WHERE email = '${withdrawer}'`);
    const requestId = psql(
      `SELECT id FROM care_group_join_request WHERE user_id = '${withdrawerId}' AND status = 'pending'`,
    );
    const withdraw = `${myRequest}?.querySelector("[data-withdraw-request]")`;
    await p.waitFor(`${withdraw} && !${withdraw}.disabled`, 15000);

    await p.offline(true);
    await p.waitFor(`${withdraw}.disabled`, 5000);
    check(
      (await p.evaluate(`${myRequest}.textContent`)).includes("Needs a connection"),
      "offline, Withdraw is disabled and says it needs a connection",
    );
    await p.offline(false);
    await p.waitFor(`!${withdraw}.disabled`, 5000);

    await p.press(withdraw);
    await p.waitFor(`document.querySelector("dialog[open]")`, 5000);
    const title = await p.evaluate(`document.querySelector("dialog[open] h2").textContent`);
    check(
      title === "Withdraw your request to join Grandma Pat?",
      "Withdraw asks first, naming the group",
      title,
    );
    await p.press(
      `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Withdraw")`,
    );
    const gone = await p.waitFor(`!${myRequest}`, 15000).then(
      () => true,
      () => false,
    );
    check(gone, "after confirming, the row goes");
    check(
      psql(`SELECT status FROM care_group_join_request WHERE id = '${requestId}'`) === "withdrawn",
      "the request is withdrawn in Postgres",
    );
    await openMembers(owner);
    await owner.waitFor(`document.querySelector("[data-link-controls]")`, 15000);
    check(!(await owner.evaluate(`!!${requestRow(withdrawer)}`)), "owners no longer see it under Requests");
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
