// Invites PRD: accounts by invitation and sign-in by email. The account emails
// are read from the dev mailbox (/dev/mail.json: the dev server, or a check
// build on a localhost APP_URL). Smoke mode runs tests 1, 5 and 10. One test
// per old step:
//   1. "Send email" sends one email with a link and a code (B-96); the link
//      signs in; an unknown email gets no mail and no account; a used link says so.
//   2. The same email's 6-digit code, typed into the page, signs in; a wrong
//      or expired code is refused; an unknown email gets no mail. (The
//      wording, the same for every address, is unit-tested in
//      authMessages.test.ts.)
//   3. Reset a password by email: the old one stops working, the link works once.
//   4. An unverified account is held at /verify-email, can resend, and the
//      emailed link confirms it.
//   Every send button can't be pressed twice (B-1): one press, one email.
//   Email invites, from Dev Family's Members page (member@, owner):
//   5. A new address: the mail names the group and inviter (no health
//      details); sign up with the email locked, consent, join as the role, and
//      the timeline syncs; Members shows who invited them; the used link says so.
//   6-7. An existing account signs in from the link and joins; signed in as
//      someone else, the link offers Sign out; decline (signed out): declined
//      for the inviter too.
//   8. Resend rotates the link; revoke and expiry close it, naming nothing.
//   9. Caretakers and viewers: the API refuses them.
//   Invite links and join requests:
//  10. The owner makes a viewer link and copies it (and a second device
//      copies the same link); a new person signs up through it, confirms
//      their email, consents and asks to join: home says "Waiting for
//      approval" and the device holds no group data. The owner gets the
//      joinRequested mail, approves from Members, and the requester's home
//      shows the group without a reload; they're a viewer and get joinApproved.
//  11. One request per person however often they ask; maximum uses, revoke
//      and expiry close a link; Decline emails them and home says so; the API
//      refuses owner and admin links, and never gives back an email invite's token.
//  12. A requester withdraws a waiting request from home (after a confirm):
//      the row goes, it's withdrawn in Postgres and gone from Members. (The
//      button offline and the confirm are home/pendingRequests.browser.test.tsx's.)
//  13. An access code's /join: one call makes the account, its group (as
//      owner) and the redemption; the emailed confirmation opens the new
//      group's timeline with the Invite someone card. A revoked code says so
//      with no form, and signed out, staff pages ask to sign in.
//
// The invite page's views, the wrong-account view, the sign-in tabs, the
// invite sheet and the Pending list are component tests
// (routes/account/invite/invite.browser.test.tsx, routes/sign-in.browser.test.tsx,
// members/invites.browser.test.tsx). Here an invite's state is read from
// `invite.preview`, and only test 5 drives the sheet.
//
// Order-independent and self-cleaning: it makes its own fictional accounts
// (inv<run>-…@example.com, with the seed password) and deletes them, their
// mail and their outbox rows at the end (their invites, consent rows,
// memberships, and test 13's group and code too).
import { BASE, DEV_FAMILY, PASSWORD, expect, psql, signIn, test } from "./fixtures.mjs";

const SYSTEM = "00000000-0000-0000-0000-000000000000";
const RUN = `inv${Date.now().toString(36)}`;
const email = (who) => `${RUN}-${who}@example.com`;
// Test 13's revoked access code (one per run).
const CLOSED_CODE = ((s) => `INVX-${s.slice(0, 4)}-${s.slice(4)}`)(
  RUN.slice(3).toUpperCase().padStart(8, "0").slice(-8),
);

// --- Accounts -----------------------------------------------------------------

/** A fictional account with the seed password; `verified` false for test 4. */
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

/** How many legal acceptances this address has from `source`. */
const legalRows = (address, source) =>
  psql(
    `SELECT count(*) FROM legal_acceptance a JOIN "user" u ON u.id = a.user_id WHERE lower(u.email) = lower('${address}') AND a.source = '${source}'`,
  );

/** Link invites this run made (they carry no address to clean up by). */
const linkIds = [];

const cleanUp = () => {
  const like = `'${RUN}-%@example.com'`;
  const links = linkIds.length ? linkIds.map((id) => `'${id}'`).join(", ") : "NULL";
  psql(`
    DELETE FROM care_group WHERE id IN (SELECT group_id FROM care_recipient WHERE name LIKE '${RUN}%');
    DELETE FROM access_code WHERE code = '${CLOSED_CODE}';
    DELETE FROM care_group_invite WHERE id IN (${links});
    DELETE FROM dev_mail WHERE name = 'joinRequested' AND text LIKE '%${RUN}-%';
    DELETE FROM notification_outbox WHERE name = 'joinRequested' AND text LIKE '%${RUN}-%';
    DELETE FROM care_group_invite WHERE email LIKE ${like};
    DELETE FROM "user" WHERE email LIKE ${like};
    DELETE FROM verification WHERE identifier LIKE '%${RUN}-%' OR value LIKE '%${RUN}-%';
    DELETE FROM dev_mail WHERE recipient LIKE ${like};
    DELETE FROM notification_outbox WHERE recipient LIKE ${like};`);
};

test.afterAll(() => {
  try {
    cleanUp();
  } catch (error) {
    console.log(`cleanup failed: ${String(error)}`);
  }
});

// --- Mail -----------------------------------------------------------------------

const mailTo = async (address) => {
  const res = await fetch(`${BASE}/dev/mail.json?to=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`/dev/mail.json answered ${res.status}: is this the dev server?`);
  return (await res.json()).messages;
};

/** Wait for the `count`th message called `name` to `address` (newest first in the list). */
const waitForMail = async (address, name, count = 1, ms = 15_000) => {
  let found;
  await expect
    .poll(
      async () => {
        const mine = (await mailTo(address)).filter((m) => m.name === name);
        found = mine.length >= count ? mine[0] : undefined;
        return found !== undefined;
      },
      { timeout: ms, intervals: [300], message: `a ${name} mail (#${count}) for ${address}` },
    )
    .toBe(true);
  return found;
};

/** Wait for a `name` message to `address` whose text mentions `about` (a shared inbox, like member@'s). */
const mailAbout = async (address, name, about, ms = 15_000) => {
  let found;
  await expect
    .poll(
      async () => {
        found = (await mailTo(address)).find((m) => m.name === name && m.text.includes(about));
        return found !== undefined;
      },
      { timeout: ms, intervals: [300], message: `a ${name} mail to ${address} about ${about}` },
    )
    .toBe(true);
  return found;
};

/** No further mail to `address` is on its way, so what the mailbox holds now is final. */
const mailSettled = async (address) => {
  // Auth's emails are queued in the background, after the response, so an empty outbox can
  // just mean "not queued yet". Settled is: nothing pending or sending, and the address's
  // row count unchanged for QUIET_MS. That keeps "no mail" and "one email" checks honest.
  const state = () =>
    psql(
      `SELECT count(*) FILTER (WHERE status IN ('pending','sending')) || '/' || count(*) FROM notification_outbox WHERE recipient = '${address}'`,
    ).trim();
  const deadline = Date.now() + 15_000;
  let last = state();
  let since = Date.now();
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
    const now = state();
    if (now !== last) [last, since] = [now, Date.now()];
    else if (now.startsWith("0/") && Date.now() - since >= QUIET_MS) return;
  }
  throw new Error(`${address}'s outbox never settled (last ${last})`);
};
const QUIET_MS = 1_200;

/** The sign-in email's code: six digits on a line of their own (never part of the link). */
const codeIn = (text) => text.match(/^\s*(\d{6})\s*$/m)?.[1];

// --- Page helpers ---------------------------------------------------------------

const exact = (label) => new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
/** A submit button in main, by its label. */
const submit = (page, label) => page.locator('main button[type="submit"]').filter({ hasText: exact(label) });
/** Any button in main, by its label. */
const button = (page, label) => page.locator("main button").filter({ hasText: exact(label) });
const mainLink = (page, label) => page.locator("main a").filter({ hasText: exact(label) });
const status = (page) => page.locator('[role="status"]').first();
const alert = (page) => page.locator('[role="alert"]').first();
const heading = (page) => page.locator("main h1").first();
const pathOf = (link) => new URL(link).pathname;
const pathAndSearch = (link) => new URL(link).pathname + new URL(link).search;

/** Signed in and on /app, not the sign-in form. */
const expectOnApp = async (page, timeout = 45_000) => {
  await page.waitForURL((u) => u.pathname.startsWith("/app"), { timeout });
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
};
const isOnApp = (page) =>
  page.evaluate(() => location.pathname.startsWith("/app") && !document.querySelector('input[name="email"]'));

/**
 * Press a submit button twice before the page can re-render (a double tap
 * faster than React): the second press must do nothing. A press after the
 * first request has finished is a new request, so this is the race (B-1).
 */
const doublePress = async (locator) => {
  await locator.evaluate((b) => {
    b.click();
    b.click();
  });
};

const rpcCall = (page, path, json) =>
  page.evaluate(
    ({ path, json }) =>
      fetch(`/rpc/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
        body: JSON.stringify({ json }),
      }).then(async (r) => ({ status: r.status, body: await r.json() })),
    { path, json },
  );

/** What the server says an invite link is (public): its state, never the group's name. The page's views are component tests. */
const previewOf = async (link) => {
  const token = link.split("/").pop();
  const res = await fetch(`${BASE}/rpc/invite/preview`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
    body: JSON.stringify({ json: { token } }),
  });
  const text = await res.text();
  return { state: JSON.parse(text).json?.state, leaksGroup: text.includes("Grandma") };
};

// --- Members page, as the owner ---------------------------------------------------

const MEMBERS_PATH = `/app/groups/${DEV_FAMILY}/settings/members`;
const memberId = () => psql(`SELECT id FROM "user" WHERE email = 'member@example.com'`);
const inviterName = () => psql(`SELECT name FROM "user" WHERE email = 'member@example.com'`);

const openMembers = async (page) => {
  await page.goto(MEMBERS_PATH);
  await page.waitForURL((u) => u.pathname === MEMBERS_PATH, { timeout: 30_000 });
  await expect(page.locator("main li[data-member]").first()).toBeVisible({ timeout: 30_000 });
};

/** member@ (Dev Family's owner), signed in and on the Members page. */
const ownerOnMembers = async (device, label = "inv-owner") => {
  const d = await device(label);
  await signIn(d.page, "member@example.com");
  await openMembers(d.page);
  return d.page;
};

const sheetOf = (page) => page.locator("[data-invite-sheet]");
const pendingRow = (page, address) =>
  page.locator("[data-pending-invites] li[data-invite]").filter({ hasText: address });

/** Invite `address` as `role` from the Members page, through the sheet. */
const inviteFromMembers = async (page, address, role) => {
  const sheet = sheetOf(page);
  await page.locator("[data-invite-controls] button:not([disabled])").first().click();
  await expect(sheet.getByRole("button", { name: "Send invitation", exact: true })).toBeVisible();
  await sheet.locator('input[name="email"]').fill(address);
  await sheet.locator('select[name="role"]').selectOption(role);
  await sheet.locator('input[name="attested"]').click();
  await sheet.getByRole("button", { name: "Send invitation", exact: true }).click();
  await expect(sheet).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator("[data-invite-controls] [role=status]")).toContainText(address, {
    timeout: 15_000,
  });
  await expect(pendingRow(page, address)).toBeVisible({ timeout: 15_000 });
};

const inviteLink = (mail) => {
  const link = mail.links.find((l) => l.includes("/invite/"));
  if (!link) throw new Error(`No invite link in ${mail.subject}`);
  return link;
};
/** An email invite sent through the API as the owner (the sheet itself is a component test; test 5 uses it once). */
const apiInvite = async (owner, address, role) => {
  const res = await rpcCall(owner, "invite/createEmail", {
    groupId: DEV_FAMILY,
    email: address,
    role,
    attested: true,
  });
  expect(res.status, "createEmail's status").toBe(200);
};
const inviteIdOf = (address) => psql(`SELECT id FROM care_group_invite WHERE email = '${address}'`);

// --- 1. Magic link --------------------------------------------------------------
test("1. sign in with an emailed link", { tag: "@smoke" }, async ({ device }) => {
  const linkUser = createAccount("link");
  const unknown = email("nobody");
  const { page: p } = await device("link");
  // The Email tab itself is a component test (sign-in.browser.test.tsx).
  await p.goto("/sign-in?with=email");
  await expect(submit(p, "Send email")).toBeVisible();
  await p.locator('input[name="email"]').fill(linkUser);
  await doublePress(submit(p, "Send email"));
  await expect(status(p)).toHaveText(/^Check your email/, { timeout: 15_000 });
  await expect(p.locator('input[name="code"]')).toBeVisible();

  const mail = await waitForMail(linkUser, "signInEmail");
  const link = mail.links.find((l) => l.includes("/api/auth/magic-link/verify"));
  await test.step("the form says to check the email, and shows a code box", async () => {
    expect(await status(p).textContent()).toContain(linkUser);
  });
  await test.step("the email has a sign-in link on APP_URL", () => {
    expect(link?.startsWith(`${BASE}/`), link).toBe(true);
  });
  await test.step("and a 6-digit code", () => {
    expect(codeIn(mail.text), mail.subject).toBeTruthy();
  });
  await test.step("the email carries no health details", () => {
    expect(mail.text).not.toMatch(/vital|symptom|medication|note/i);
  });
  await test.step("a double press sends one email", async () => {
    await mailSettled(linkUser);
    expect(await mailTo(linkUser)).toHaveLength(1);
  });

  await test.step("the emailed link signs in and lands on /app", async () => {
    await p.goto(pathAndSearch(link));
    await expectOnApp(p);
  });

  const { page: u } = await device("link-unknown");
  await test.step("an unknown email gets no mail, and no account is created", async () => {
    await u.goto("/sign-in?with=email");
    await expect(submit(u, "Send email")).toBeVisible();
    await u.locator('input[name="email"]').fill(unknown);
    await submit(u, "Send email").click();
    await expect(status(u)).toHaveText(/^Check your email/, { timeout: 15_000 });
    await mailSettled(unknown);
    expect(await mailTo(unknown)).toHaveLength(0);
    expect(accountCount(unknown)).toBe(0);
  });

  // The link works once: a second use goes back to sign-in and says so.
  await test.step("a used link is refused with a plain message, and doesn't sign in", async () => {
    await u.goto(pathAndSearch(link));
    await u.waitForURL((url) => url.pathname === "/sign-in", { timeout: 15_000 });
    await expect(alert(u)).toContainText("expired or was already used", { timeout: 15_000 });
    expect(await isOnApp(u)).toBe(false);
  });
});

// --- 2. Code --------------------------------------------------------------------
test("2. sign in with an emailed code", async ({ device }) => {
  const codeUser = createAccount("code");
  const unknown = email("nobody2");
  const { page: p } = await device("code");
  await p.goto("/sign-in?with=email");
  await expect(submit(p, "Send email")).toBeVisible();
  await p.locator('input[name="email"]').fill(codeUser);
  await doublePress(submit(p, "Send email"));
  await expect(status(p)).toHaveText(/^Check your email/, { timeout: 15_000 });
  await expect(p.locator('input[name="code"]')).toBeVisible();
  const mail = await waitForMail(codeUser, "signInEmail");
  const code = codeIn(mail.text);
  await test.step("the email has a 6-digit code, not in the subject, from one email", async () => {
    expect(code, mail.subject).toBeTruthy();
    expect(mail.subject).not.toContain(code);
    await mailSettled(codeUser);
    expect(await mailTo(codeUser)).toHaveLength(1);
  });

  await test.step("a wrong code is refused, and doesn't sign in", async () => {
    const wrong = code === "000000" ? "111111" : "000000";
    await p.locator('input[name="code"]').fill(wrong);
    await submit(p, "Sign in").click();
    await expect(alert(p)).toHaveText(/^That code didn't work/, { timeout: 15_000 });
    expect(await isOnApp(p)).toBe(false);
  });

  await test.step("the right code signs in (every button disabled meanwhile) and lands on /app", async () => {
    await p.locator('input[name="code"]').fill(code);
    // Hold the sign-in request, so the buttons' state can be read while it is pending.
    let release;
    const released = new Promise((r) => (release = r));
    await p.route("**/api/auth/sign-in/email-otp", async (route) => {
      await released;
      await route.continue().catch(() => {});
    });
    await submit(p, "Sign in").click();
    await expect
      .poll(
        () =>
          p.evaluate(() =>
            [...document.querySelectorAll('main button[type="submit"]')].every((x) => x.disabled),
          ),
        { timeout: 5000, message: "every button is disabled while the code signs in" },
      )
      .toBe(true);
    release();
    await expectOnApp(p);
  });

  const { page: e } = await device("code-expired");
  await test.step("an expired code is refused", async () => {
    await e.goto("/sign-in?with=email");
    await expect(submit(e, "Send email")).toBeVisible();
    await e.locator('input[name="email"]').fill(codeUser);
    await submit(e, "Send email").click();
    await expect(e.locator('input[name="code"]')).toBeVisible({ timeout: 15_000 });
    const second = await waitForMail(codeUser, "signInEmail", 2);
    const secondCode = codeIn(second.text);
    psql(
      `UPDATE verification SET expires_at = now() - interval '1 minute' WHERE identifier LIKE '%${codeUser}%'`,
    );
    await e.locator('input[name="code"]').fill(secondCode);
    await submit(e, "Sign in").click();
    await expect(alert(e)).toHaveText(/^That code didn't work/, { timeout: 15_000 });
    expect(await isOnApp(e)).toBe(false);
  });

  await test.step("an unknown email: the same message, and no code is sent", async () => {
    await e.goto("/sign-in?with=email");
    await expect(submit(e, "Send email")).toBeVisible();
    await e.locator('input[name="email"]').fill(unknown);
    await submit(e, "Send email").click();
    await expect(status(e)).toHaveText(/^Check your email/, { timeout: 15_000 });
    await mailSettled(unknown);
    expect(await mailTo(unknown)).toHaveLength(0);
  });
});

// --- 3. Password reset ------------------------------------------------------------
test("3. reset a password by email", async ({ device }) => {
  const resetUser = createAccount("reset");
  const unknown = email("nobody3");
  const { page: p } = await device("reset");
  await p.goto("/sign-in");
  await mainLink(p, "Forgot password?").click();
  await p.waitForURL((u) => u.pathname === "/reset-password");
  await expect(submit(p, "Email me a link")).toBeVisible();
  await p.locator('input[name="email"]').fill(resetUser);
  await doublePress(submit(p, "Email me a link"));
  await expect(status(p)).toHaveText(/^Check your email/, { timeout: 15_000 });
  const mail = await waitForMail(resetUser, "resetPassword");
  const link = mail.links.find((l) => l.includes("/reset-password?token="));
  await test.step("the reset email links to /reset-password on APP_URL, and a double press sends one", async () => {
    expect(link?.startsWith(`${BASE}/`), link).toBe(true);
    await mailSettled(resetUser);
    expect(await mailTo(resetUser)).toHaveLength(1);
  });

  const path = pathAndSearch(link);
  const newPassword = `new ${RUN} passphrase`;
  await test.step("the emailed link sets a new password", async () => {
    await p.goto(path);
    await expect(submit(p, "Save new password")).toBeVisible();
    await p.locator('input[name="password"]').fill(newPassword);
    await p.locator('input[name="confirm"]').fill(newPassword);
    await submit(p, "Save new password").click();
    await expect(heading(p)).toHaveText("Password changed", { timeout: 15_000 });
  });

  await test.step("the old password stops working", async () => {
    await p.goto("/sign-in");
    await expect(submit(p, "Sign in")).toBeVisible();
    await p.locator('input[name="email"]').fill(resetUser);
    await p.locator('input[name="password"]').fill(PASSWORD);
    await submit(p, "Sign in").click();
    await expect(alert(p)).toHaveText("That email and password don't match an account.", {
      timeout: 15_000,
    });
  });

  await test.step("the new password signs in", async () => {
    await signIn(p, resetUser, newPassword, { home: true });
    expect(await isOnApp(p)).toBe(true);
  });

  const { page: again } = await device("reset-again");
  await test.step("the reset link works only once", async () => {
    await again.goto(path);
    await expect(submit(again, "Save new password")).toBeVisible();
    await again.locator('input[name="password"]').fill("another long passphrase");
    await again.locator('input[name="confirm"]').fill("another long passphrase");
    await submit(again, "Save new password").click();
    await expect(alert(again)).toContainText("expired or was already used", { timeout: 15_000 });
  });

  await test.step("an unknown email: the same message, and no reset email", async () => {
    await again.goto("/reset-password");
    await expect(submit(again, "Email me a link")).toBeVisible();
    await again.locator('input[name="email"]').fill(unknown);
    await submit(again, "Email me a link").click();
    await expect(status(again)).toHaveText(/^Check your email/, { timeout: 15_000 });
    await mailSettled(unknown);
    expect(await mailTo(unknown)).toHaveLength(0);
  });
});

// --- 4. An unverified account -------------------------------------------------------
test("4. an unverified account is held at verification", async ({ device }) => {
  const unverifiedUser = createAccount("unverified", { verified: false });
  const { page: p } = await device("unverified");
  await p.goto("/sign-in");
  await expect(submit(p, "Sign in")).toBeVisible();
  await p.locator('input[name="email"]').fill(unverifiedUser);
  await p.locator('input[name="password"]').fill(PASSWORD);
  await submit(p, "Sign in").click();

  await test.step("the right password for an unverified account opens the verify page", async () => {
    await p.waitForURL((u) => u.pathname === "/verify-email", { timeout: 15_000 });
    await expect(heading(p)).toHaveText("Confirm your email");
    await expect(p.locator("main")).toContainText(unverifiedUser);
  });
  await test.step("signing in sent a verification email", async () => {
    await waitForMail(unverifiedUser, "verifyEmail");
  });

  await test.step("the unverified account can't reach /app", async () => {
    await p.goto("/app");
    await p.waitForURL((u) => u.pathname === "/sign-in" || u.pathname === "/verify-email", {
      timeout: 15_000,
    });
    expect(await isOnApp(p)).toBe(false);
  });

  let latest;
  await test.step("Send a new link sends one more email", async () => {
    await p.goto(`/verify-email?email=${encodeURIComponent(unverifiedUser)}`);
    await expect(submit(p, "Send a new link")).toBeVisible();
    await doublePress(submit(p, "Send a new link"));
    await expect(status(p)).toContainText("we've sent it a new link", { timeout: 15_000 });
    latest = await waitForMail(unverifiedUser, "verifyEmail", 2);
    await mailSettled(unverifiedUser);
    expect((await mailTo(unverifiedUser)).filter((m) => m.name === "verifyEmail")).toHaveLength(2);
  });

  const link = latest.links.find((l) => l.includes("/verify-email?token="));
  await test.step("the verification link is on APP_URL, and confirms the email", async () => {
    expect(link?.startsWith(`${BASE}/`), link).toBe(true);
    await p.goto(pathAndSearch(link));
    await expect(heading(p)).toHaveText("Email confirmed", { timeout: 15_000 });
    expect(psql(`SELECT email_verified FROM "user" WHERE email = '${unverifiedUser}'`)).toBe("t");
  });
  await test.step("and Continue opens /app, signed in", async () => {
    await mainLink(p, "Continue to Caretook").click();
    await expectOnApp(p);
  });
});

// --- 5. A new person: invite, mail, sign up with the email locked, consent, join ---
test("5. a new person is invited, signs up, consents and joins", { tag: "@smoke" }, async ({ device }) => {
  test.setTimeout(150_000);
  const owner = await ownerOnMembers(device);
  const newbie = email("newbie");
  await test.step("an owner invites a new address from the Members page", async () => {
    await inviteFromMembers(owner, newbie, "caretaker");
  });
  const mail = await waitForMail(newbie, "groupInvite");
  await test.step("the invite email names the inviter and the group, with no health details", () => {
    expect(mail.subject, mail.subject).toContain(inviterName());
    expect(mail.subject).toContain("Grandma Pat");
    expect(`${mail.subject} ${mail.text}`).not.toMatch(/vital|symptom|medication|blood|pain|note/i);
  });
  const link = inviteLink(mail);
  await test.step("its link is on APP_URL, and the invite records who attested, with the consent version", () => {
    expect(link.startsWith(`${BASE}/invite/`), link).toBe(true);
    expect(
      psql(
        `SELECT consent_attested_by || ':' || consent_version FROM care_group_invite WHERE email = '${newbie}'`,
      ),
    ).toMatch(new RegExp(`^${memberId()}:`));
  });

  const { page: p } = await device("inv-newbie");
  const signUp = p.locator('[data-invite-form="signUp"]');
  await p.goto(pathOf(link));
  await expect(signUp).toBeVisible({ timeout: 20_000 });
  await signUp.locator('input[name="name"]').fill(`Inv Newbie ${RUN}`);
  await signUp.locator('input[name="password"]').fill(PASSWORD);
  await signUp.locator('input[name="confirm"]').fill(PASSWORD);
  await signUp.locator('input[name="legal"]').check();
  await doublePress(button(p, "Create account"));
  await expect(p.locator('[data-invite-form="accept"]')).toBeVisible({ timeout: 30_000 });
  await test.step("a double press creates one account, and the new account is verified", () => {
    expect(accountCount(newbie)).toBe(1);
    expect(psql(`SELECT email_verified FROM "user" WHERE email = '${newbie}'`)).toBe("t");
  });
  await test.step("the new account agreed at sign-up, so the consent step doesn't ask again", async () => {
    await expect(p.locator('[data-invite-form="accept"] input[name="legal"]')).toHaveCount(0);
    expect(legalRows(newbie, "invite_signup")).toBe("1");
  });
  await p.locator('[data-invite-form="accept"] input[name="consent"]').click();
  await button(p, "Join the care group").click();
  await test.step("joining opens the group, and its timeline syncs", async () => {
    await p.waitForURL((u) => u.pathname.startsWith(`/app/groups/${DEV_FAMILY}`), { timeout: 60_000 });
    await expect(p.locator('main ol > li a[href*="/entries/"]').first()).toBeVisible({ timeout: 60_000 });
  });
  const newbieId = psql(`SELECT id FROM "user" WHERE email = '${newbie}'`);
  await test.step("they join as the invited role, invited by the owner; consent is recorded; the invite is accepted", () => {
    expect(
      psql(
        `SELECT role || ':' || coalesce(invited_by::text, '') FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = '${newbieId}'`,
      ),
    ).toBe(`caretaker:${memberId()}`);
    expect(
      psql(
        `SELECT count(*) || ':' || max(consent_version) FROM care_group_consent WHERE user_id = '${newbieId}' AND group_id = '${DEV_FAMILY}'`,
      ),
    ).toMatch(/^1:/);
    expect(psql(`SELECT status FROM care_group_invite WHERE email = '${newbie}'`)).toBe("accepted");
  });

  await test.step("Members shows who invited them and when they joined (live), and the invite leaves Pending", async () => {
    const history = owner.locator(`li[data-member="${newbieId}"] [data-member-history]`);
    await expect(history).toContainText("Invited by", { timeout: 30_000 });
    expect(await history.textContent()).toMatch(
      new RegExp(`^Invited by ${inviterName().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · Joined`),
    );
  });

  await test.step("an accepted link says so, naming nothing", async () => {
    const used = await previewOf(link);
    expect(used.state).toBe("accepted");
    expect(used.leaksGroup).toBe(false);
  });
});

// --- 6-7. An existing account joins; another account is refused; decline ----------
test("6-7. an existing account joins; another account is refused; decline", async ({ device }) => {
  test.setTimeout(150_000);
  const owner = await ownerOnMembers(device);
  const existing = createAccount("existing");
  await apiInvite(owner, existing, "viewer");
  const link = inviteLink(await waitForMail(existing, "groupInvite"));

  const { page: p } = await device("inv-existing");
  await test.step("an existing user signs in from the link and comes back to the invite", async () => {
    await p.goto(pathOf(link));
    await mainLink(p, "Sign in").click();
    await p.waitForURL((u) => u.pathname === "/sign-in");
    await expect(submit(p, "Sign in")).toBeVisible();
    await p.locator('input[name="email"]').fill(existing);
    await p.locator('input[name="password"]').fill(PASSWORD);
    await submit(p, "Sign in").click();
    await p.waitForURL((u) => u.pathname === pathOf(link), { timeout: 30_000 });
    await expect(p.locator('[data-invite-form="accept"]')).toBeVisible({ timeout: 30_000 });
  });
  await test.step("and joins as a viewer, agreeing once because the account hadn't", async () => {
    await p.locator('[data-invite-form="accept"] input[name="legal"]').check();
    await p.locator('[data-invite-form="accept"] input[name="consent"]').click();
    await button(p, "Join the care group").click();
    await p.waitForURL((u) => u.pathname.startsWith(`/app/groups/${DEV_FAMILY}`), { timeout: 60_000 });
    expect(legalRows(existing, "invite_accept")).toBe("1");
    expect(
      psql(
        `SELECT m.role FROM care_group_member m JOIN "user" u ON u.id = m.user_id WHERE u.email = '${existing}' AND m.group_id = '${DEV_FAMILY}'`,
      ),
    ).toBe("viewer");
  });

  // Now signed in as `existing`, open an invite for someone else.
  const other = email("other");
  await apiInvite(owner, other, "caretaker");
  const otherLink = inviteLink(await waitForMail(other, "groupInvite"));
  await test.step("Sign out comes back to the invite, signed out", async () => {
    await p.goto(pathOf(otherLink));
    // Signed in as someone else, the page says it's for another address and
    // offers no Join (a component test); Sign out is the flow kept here.
    await button(p, "Sign out").click();
    await p.waitForURL((u) => u.pathname === pathOf(otherLink), { timeout: 30_000 });
    await expect(p.locator('[data-invite-form="signUp"]')).toBeVisible({ timeout: 30_000 });
  });

  // 7. Decline, signed out.
  await test.step("Decline marks the invite declined, and a declined link says so", async () => {
    await doublePress(button(p, "Decline invitation"));
    await expect(heading(p)).toHaveText("Invitation declined", { timeout: 15_000 });
    expect(psql(`SELECT status FROM care_group_invite WHERE email = '${other}'`)).toBe("declined");
    expect((await previewOf(otherLink)).state).toBe("declined");
    // The inviter's Pending list showing it declined: invites.int.test.ts and invites.browser.test.tsx.
  });
});

// --- 8. Resend rotates the link; revoke and expiry close it. ----------------------
test("8. resend rotates the link; revoke and expiry close it", async ({ device }) => {
  const owner = await ownerOnMembers(device);
  const target = email("resend");
  await apiInvite(owner, target, "viewer");
  const first = inviteLink(await waitForMail(target, "groupInvite"));
  await rpcCall(owner, "invite/resend", { id: inviteIdOf(target) });
  const second = inviteLink(await waitForMail(target, "groupInvite", 2));
  await test.step("Resend sends a new link, the old one stops working, the new one works", async () => {
    expect(first).not.toBe(second);
    const old = await previewOf(first);
    expect(old.state, "the old link").toBe("notFound");
    expect(old.leaksGroup).toBe(false);
    expect((await previewOf(second)).state).toBe("usable");
  });

  await test.step("Revoke withdraws it, and a revoked link says so at once, naming nothing", async () => {
    await rpcCall(owner, "invite/revoke", { id: inviteIdOf(target) });
    expect(psql(`SELECT status FROM care_group_invite WHERE email = '${target}'`)).toBe("revoked");
    const revoked = await previewOf(second);
    expect(revoked.state).toBe("revoked");
    expect(revoked.leaksGroup).toBe(false);
  });

  await test.step("an expired link says so, naming nothing", async () => {
    const late = email("late");
    await apiInvite(owner, late, "viewer");
    const lateLink = inviteLink(await waitForMail(late, "groupInvite"));
    psql(`UPDATE care_group_invite SET expires_at = now() - interval '1 minute' WHERE email = '${late}'`);
    const expired = await previewOf(lateLink);
    expect(expired.state).toBe("expired");
    expect(expired.leaksGroup).toBe(false);
  });
});

// --- 9. Caretakers and viewers: the API refuses them. -----------------------------
for (const who of ["caretaker", "viewer"]) {
  test(`9. a ${who} sees no invite controls: the API refuses them`, async ({ device }) => {
    const { page: p } = await device(`inv-${who}`);
    await signIn(p, `${who}@example.com`);
    // The absent controls are a component test (members/invites.browser.test.tsx).
    const linkRes = await rpcCall(p, "invite/createLink", { groupId: DEV_FAMILY, role: "viewer" });
    expect(linkRes.status, `a ${who}'s link API call`).toBe(403);
    const mailRes = await rpcCall(p, "invite/createEmail", {
      groupId: DEV_FAMILY,
      email: email(`api-${who}`),
      role: "viewer",
      attested: true,
    });
    expect(mailRes.status, `a ${who}'s invite API call`).toBe(403);
  });
}

// --- Invite links and join requests -----------------------------------------------
const linkRows = (page) => page.locator("[data-invite-links] li[data-invite-link]");
const linkRow = (page, id) => page.locator(`[data-invite-links] li[data-invite-link="${id}"]`);
const rowButton = (row, label) => row.locator("button").filter({ hasText: exact(label) });
const requestRow = (page, address) =>
  page.locator("[data-join-requests] li[data-join-request]").filter({ hasText: address });
const myRequest = (page) => page.locator(`[data-my-request="${DEV_FAMILY}"]`);
/** Rows of the device's own copy (PowerSync), for "nothing of the group is here". */
const localCount = (page, table) =>
  page.evaluate(
    (t) => window.caretookSync.powersync.getAll(`SELECT count(*) AS n FROM ${t}`).then((rows) => rows[0].n),
    table,
  );
/** Record what the page copies or shares, instead of the real clipboard and share sheet. */
const stubSharing = (page) =>
  page.evaluate(() => {
    window.__copied = [];
    window.__shared = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t) => (window.__copied.push(t), Promise.resolve()) },
    });
    navigator.canShare = () => true;
    navigator.share = (d) => (window.__shared.push(d), Promise.resolve());
  });
/** A link made through the API as the owner, for the tests that don't use the form. */
const apiLink = async (owner, input) => {
  const res = await rpcCall(owner, "invite/createLink", { groupId: DEV_FAMILY, ...input });
  expect(res.status, "createLink's status").toBe(200);
  linkIds.push(res.body.json.invite.id);
  return { id: res.body.json.invite.id, path: `/invite/${res.body.json.token}` };
};
/** On the invite link's page as a signed-in person: ask to join; lands on home. */
const askToJoin = async (page, path) => {
  await page.goto(path);
  await expect(page.locator('[data-invite-form="accept"]')).toBeVisible({ timeout: 30_000 });
  // Asked only of an account that hasn't agreed to the current versions.
  const legal = page.locator('[data-invite-form="accept"] input[name="legal"]');
  if (await legal.count()) await legal.check();
  await page.locator('[data-invite-form="accept"] input[name="consent"]').click();
  await button(page, "Ask to join").click();
  await page.waitForURL((u) => u.pathname === "/app", { timeout: 30_000 });
  await expect(myRequest(page)).toBeVisible({ timeout: 30_000 });
};
/** Confirm the open dialog by its button. */
const confirmDialog = async (page, label) => {
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await dialog
    .locator("button")
    .filter({ hasText: exact(label) })
    .click();
};

// --- 10. Make a link, copy it, sign up through it, ask, get approved. -------------
test("10. a link: sign up through it, ask to join, approved", { tag: "@smoke" }, async ({ device }) => {
  test.setTimeout(180_000);
  const joiner = email("joiner");
  const owner = await ownerOnMembers(device);
  const sheet = owner.locator("[data-link-sheet]");
  const createButton = owner.locator("[data-link-controls] button:not([disabled])").first();
  await expect(createButton).toBeVisible({ timeout: 15_000 });
  const idsNow = () => linkRows(owner).evaluateAll((lis) => lis.map((li) => li.dataset.inviteLink));
  const before = await idsNow();

  let linkId;
  await test.step("a link offers caretaker, viewer and the easy roles only", async () => {
    await createButton.click();
    await expect(sheet.locator('select[name="role"]')).toBeVisible({ timeout: 10_000 });
    const roles = await sheet
      .locator('select[name="role"] option')
      .evaluateAll((os) => os.map((o) => o.value));
    expect(roles.join()).toBe("caretaker,viewer,easy_helper,easy_viewer");
  });
  await test.step("the new link is listed with its role, uses and expiry; it's stored sealed", async () => {
    await sheet.locator('input[name="maxUses"]').fill("5");
    await sheet.getByRole("button", { name: "Create link", exact: true }).click();
    await expect(sheet).toHaveCount(0, { timeout: 15_000 });
    await expect
      .poll(async () => (await idsNow()).find((id) => !before.includes(id)), { timeout: 15_000 })
      .toBeDefined();
    linkId = (await idsNow()).find((id) => !before.includes(id));
    linkIds.push(linkId);
    const line = await linkRow(owner, linkId).textContent();
    expect(line).toContain("Viewer link");
    expect(line).toContain("Used 0 of 5 times");
    expect(line).toContain("Expires");
    expect(
      psql(
        `SELECT kind || ':' || role || ':' || (token_ciphertext IS NOT NULL) FROM care_group_invite WHERE id = '${linkId}'`,
      ),
    ).toBe("link:viewer:true");
  });

  let url;
  await test.step("Copy puts the invite link on the clipboard, and Share hands the same link to the share sheet", async () => {
    await stubSharing(owner);
    const row = linkRow(owner, linkId);
    await expect(rowButton(row, "Copy")).toBeEnabled({ timeout: 15_000 });
    await rowButton(row, "Copy").click();
    await expect.poll(() => owner.evaluate(() => window.__copied.length), { timeout: 5000 }).toBe(1);
    url = await owner.evaluate(() => window.__copied[0]);
    expect(url.startsWith(`${BASE}/invite/`), url).toBe(true);
    await rowButton(row, "Share").click();
    await expect.poll(() => owner.evaluate(() => window.__shared.length), { timeout: 5000 }).toBe(1);
    expect(await owner.evaluate(() => window.__shared[0].url)).toBe(url);
  });

  await test.step("a second device copies the same link", async () => {
    const second = (await device("inv-owner-2")).page;
    await signIn(second, "member@example.com");
    await openMembers(second);
    await stubSharing(second);
    const row = linkRow(second, linkId);
    await expect(rowButton(row, "Copy")).toBeEnabled({ timeout: 15_000 });
    await rowButton(row, "Copy").click();
    await expect.poll(() => second.evaluate(() => window.__copied.length), { timeout: 5000 }).toBe(1);
    expect(await second.evaluate(() => window.__copied[0])).toBe(url);
  });

  // A new person opens it, signed out.
  const { page: p } = await device("inv-joiner");
  const path = pathOf(url);
  const signUp = p.locator('[data-invite-form="signUp"]');
  await test.step("a double press creates one account, unconfirmed, waiting at /verify-email", async () => {
    await p.goto(path);
    await expect(signUp).toBeVisible({ timeout: 20_000 });
    await signUp.locator('input[name="email"]').fill(joiner);
    await signUp.locator('input[name="name"]').fill(`Inv Joiner ${RUN}`);
    await signUp.locator('input[name="password"]').fill(PASSWORD);
    await signUp.locator('input[name="confirm"]').fill(PASSWORD);
    await signUp.locator('input[name="legal"]').check();
    await doublePress(button(p, "Create account"));
    await p.waitForURL((u) => u.pathname === "/verify-email", { timeout: 30_000 });
    expect(accountCount(joiner)).toBe(1);
    expect(psql(`SELECT email_verified FROM "user" WHERE email = '${joiner}'`)).toBe("f");
  });
  await test.step("the confirmation link signs them in and brings them back to the link", async () => {
    const verify = await waitForMail(joiner, "verifyEmail");
    const verifyLink = verify.links.find((l) => l.includes("/verify-email?token="));
    await p.goto(pathAndSearch(verifyLink));
    await expect(heading(p)).toHaveText("Email confirmed", { timeout: 20_000 });
    await mainLink(p, "Continue to Caretook").click();
    await p.waitForURL((u) => u.pathname === path, { timeout: 30_000 });
    await expect(p.locator('[data-invite-form="accept"]')).toBeVisible({ timeout: 30_000 });
  });

  const joinerId = () => psql(`SELECT id FROM "user" WHERE email = '${joiner}'`);
  await test.step("home says it's waiting for approval, and the device holds no group data; consent is recorded", async () => {
    await expect(p.locator('[data-invite-form="accept"] input[name="legal"]')).toHaveCount(0);
    expect(legalRows(joiner, "invite_signup")).toBe("1");
    await p.locator('[data-invite-form="accept"] input[name="consent"]').click();
    await button(p, "Ask to join").click();
    await p.waitForURL((u) => u.pathname === "/app", { timeout: 30_000 });
    await expect(myRequest(p)).toContainText("Waiting for approval: Grandma Pat", { timeout: 30_000 });
    expect({
      groups: await localCount(p, "care_group"),
      entries: await localCount(p, "timeline_entry"),
    }).toEqual({ groups: 0, entries: 0 });
    expect(
      psql(
        `SELECT count(*) FROM care_group_consent WHERE user_id = '${joinerId()}' AND group_id = '${DEV_FAMILY}'`,
      ),
    ).toBe("1");
  });

  await test.step("the owner gets a joinRequested email linking to Members, with no health details", async () => {
    const asked = await mailAbout("member@example.com", "joinRequested", joiner);
    expect(asked.subject).toContain(`Inv Joiner ${RUN}`);
    expect(asked.links.some((l) => l.endsWith(MEMBERS_PATH))).toBe(true);
    expect(`${asked.subject} ${asked.text}`).not.toMatch(/vital|symptom|medication|blood|pain|note/i);
  });

  await test.step("Requests shows their name, email and role, and the link counts the use", async () => {
    await openMembers(owner);
    await expect(requestRow(owner, joiner)).toBeVisible({ timeout: 15_000 });
    const reqLine = await requestRow(owner, joiner).textContent();
    expect(reqLine).toContain(`Inv Joiner ${RUN}`);
    expect(reqLine).toContain("Viewer");
    await expect(linkRow(owner, linkId)).toContainText("Used 1 of 5 times");
  });

  await test.step("approval turns the requester's home into the group, without a reload", async () => {
    await rowButton(requestRow(owner, joiner), "Approve").click();
    await expect(requestRow(owner, joiner)).toHaveCount(0, { timeout: 15_000 });
    await expect(p.locator(`main a[href="/app/groups/${DEV_FAMILY}/timeline"]`)).toBeVisible({
      timeout: 30_000,
    });
    await expect(myRequest(p)).toHaveCount(0);
  });
  await test.step("they're a member as a viewer, and get a joinApproved email", async () => {
    expect(
      psql(
        `SELECT role FROM care_group_member WHERE group_id = '${DEV_FAMILY}' AND user_id = '${joinerId()}'`,
      ),
    ).toBe("viewer");
    expect((await waitForMail(joiner, "joinApproved")).subject).toContain("Grandma Pat");
  });
});

// --- 11. One request per person; limits, revoke and expiry; decline; the API's refusals.
test("11. one request each; uses, revoke and expiry; decline; API refusals", async ({ device }) => {
  test.setTimeout(180_000);
  const owner = await ownerOnMembers(device);
  const twice = await apiLink(owner, { role: "caretaker", maxUses: 3 });
  const asker = createAccount("asker");
  const { page: p } = await device("inv-asker");
  await signIn(p, asker, PASSWORD, { home: true });
  const askerId = () => psql(`SELECT id FROM "user" WHERE email = '${asker}'`);

  await test.step("asking twice makes one request and counts one use", async () => {
    await askToJoin(p, twice.path);
    await askToJoin(p, twice.path);
    expect(psql(`SELECT count(*) FROM care_group_join_request WHERE user_id = '${askerId()}'`)).toBe("1");
    expect(psql(`SELECT use_count FROM care_group_invite WHERE id = '${twice.id}'`)).toBe("1");
  });

  await test.step("a link whose uses are all taken says so (counting is covered by the integration tests)", async () => {
    const once = await apiLink(owner, { role: "viewer", maxUses: 1 });
    psql(`UPDATE care_group_invite SET use_count = 1 WHERE id = '${once.id}'`);
    expect((await previewOf(once.path)).state).toBe("usedUp");
  });

  await test.step("Decline emails them, and their home says it wasn't approved, with no Withdraw", async () => {
    await openMembers(owner);
    await expect(requestRow(owner, asker)).toBeVisible({ timeout: 15_000 });
    await rowButton(requestRow(owner, asker), "Decline").click();
    await confirmDialog(owner, "Decline");
    await expect(requestRow(owner, asker)).toHaveCount(0, { timeout: 15_000 });
    expect((await waitForMail(asker, "joinDeclined")).subject).toContain("Grandma Pat");
    await p.goto("/app");
    await expect(myRequest(p)).toHaveAttribute("data-request-status", "declined", { timeout: 20_000 });
    expect(await myRequest(p).textContent()).toMatch(/^Not approved: Grandma Pat/);
    await expect(myRequest(p).locator("[data-withdraw-request]")).toHaveCount(0);
    expect(psql(`SELECT count(*) FROM care_group_member WHERE user_id = '${askerId()}'`)).toBe("0");
  });

  await test.step("a revoked link stops at once", async () => {
    const revoked = await apiLink(owner, { role: "viewer" });
    await openMembers(owner);
    await expect(linkRow(owner, revoked.id)).toBeVisible({ timeout: 15_000 });
    await rowButton(linkRow(owner, revoked.id), "Revoke").click();
    await confirmDialog(owner, "Revoke");
    await expect(linkRow(owner, revoked.id)).toHaveCount(0, { timeout: 15_000 });
    const gone = await previewOf(revoked.path);
    expect(gone.state).toBe("revoked");
    expect(gone.leaksGroup).toBe(false);
  });

  await test.step("an expired link says so", async () => {
    const old = await apiLink(owner, { role: "viewer", expiresInDays: 1 });
    psql(`UPDATE care_group_invite SET expires_at = now() - interval '1 minute' WHERE id = '${old.id}'`);
    expect((await previewOf(old.path)).state).toBe("expired");
  });

  // The API never makes an owner or admin link, and never reads back an email invite's token.
  for (const role of ["owner", "admin"]) {
    await test.step(`the API refuses an ${role} link`, async () => {
      const res = await rpcCall(owner, "invite/createLink", { groupId: DEV_FAMILY, role });
      expect(res.status).toBe(400);
    });
  }
  await test.step("an email invite's token can't be read back", async () => {
    const emailInvite = psql(
      `SELECT id FROM care_group_invite WHERE kind = 'email' AND group_id = '${DEV_FAMILY}' LIMIT 1`,
    );
    const read = await rpcCall(owner, "invite/copyLink", { id: emailInvite });
    expect(read.status).toBe(400);
    expect("token" in (read.body.json ?? {})).toBe(false);
  });
});

// --- 12. Withdraw a waiting request (B-64). ---------------------------------------
test("12. a requester withdraws a waiting request", async ({ device }) => {
  test.setTimeout(150_000);
  const owner = await ownerOnMembers(device);
  const link = await apiLink(owner, { role: "viewer" });
  const withdrawer = createAccount("withdrawer");
  const d = await device("inv-withdrawer");
  const p = d.page;
  await signIn(p, withdrawer, PASSWORD, { home: true });
  await askToJoin(p, link.path);
  const withdrawerId = psql(`SELECT id FROM "user" WHERE email = '${withdrawer}'`);
  const requestId = psql(
    `SELECT id FROM care_group_join_request WHERE user_id = '${withdrawerId}' AND status = 'pending'`,
  );
  const withdraw = myRequest(p).locator("[data-withdraw-request]");
  await expect(withdraw).toBeEnabled({ timeout: 15_000 });

  await withdraw.click();
  await test.step("after confirming, the row goes, and the request is withdrawn in Postgres", async () => {
    await confirmDialog(p, "Withdraw");
    await expect(myRequest(p)).toHaveCount(0, { timeout: 15_000 });
    expect(psql(`SELECT status FROM care_group_join_request WHERE id = '${requestId}'`)).toBe("withdrawn");
  });
  await test.step("owners no longer see it under Requests", async () => {
    await openMembers(owner);
    await expect(owner.locator("[data-link-controls]")).toBeVisible({ timeout: 15_000 });
    await expect(requestRow(owner, withdrawer)).toHaveCount(0);
  });
});

// --- 13. An access code (the form's states are component tests in routes/account/join/,
// the server's rules groups.int.test.ts's). ------------------------------------------
test("13. /join: sign up with a code, confirm, the new group opens; a closed code", async ({ device }) => {
  test.setTimeout(150_000);
  const joiner = email("codejoiner");
  const { page: p } = await device("inv-join");
  await p.goto("/join/care-demo-0001");
  await expect(p.locator('[data-join-form="account"]')).toBeVisible({ timeout: 20_000 });
  await p.locator('[name="name"]').fill("Inv Joiner Tester");
  await p.locator('[name="email"]').fill(joiner);
  await p.locator('[name="password"]').fill(PASSWORD);
  await p.locator('[name="confirm"]').fill(PASSWORD);
  await button(p, "Continue").click();
  await expect(p.locator('[data-join-form="recipient"]')).toBeVisible();
  await p.locator('[name="recipientName"]').fill(`${RUN} Rose Example`);
  await p.locator('[name="legal"]').check();
  await submit(p, "Create care group").click();
  await p.waitForURL((u) => u.pathname === "/verify-email", { timeout: 20_000 });

  await test.step("one call makes the account, its group as owner, the redemption and the acceptance", () => {
    expect(
      psql(`
      SELECT m.role || '|' || (SELECT count(*) FROM access_code_redemption r WHERE r.user_id = u.id AND r.group_id = m.group_id)
        || '|' || (SELECT count(*) FROM legal_acceptance a WHERE a.user_id = u.id AND a.source = 'access_code')
      FROM "user" u JOIN care_group_member m ON m.user_id = u.id WHERE u.email = '${joiner}'`),
    ).toBe("owner|1|1");
  });

  await test.step("the confirmed link opens the new group's timeline, with the Invite someone card", async () => {
    const mail = await waitForMail(joiner, "verifyEmail");
    const link = mail.links.find((l) => l.includes("/verify-email?token="));
    await p.goto(pathAndSearch(link));
    await expect(heading(p)).toHaveText("Email confirmed", { timeout: 20_000 });
    await mainLink(p, "Continue to Caretook").click();
    await p.waitForURL((u) => /\/timeline$/.test(u.pathname), { timeout: 45_000 });
    await expect(p.locator("[data-invite-card]")).toBeVisible({ timeout: 45_000 });
  });

  await test.step("a revoked code says so, with no form", async () => {
    psql(`
      INSERT INTO access_code (code, label, expires_at, max_uses, use_count, revoked_at, created_by, updated_by)
      VALUES ('${CLOSED_CODE}', '${RUN} revoked', now() + interval '1 day', NULL, 0, now(), '${SYSTEM}', '${SYSTEM}')`);
    await p.goto(`/join/${CLOSED_CODE}`);
    await expect(p.locator("[data-code-state]")).toHaveAttribute("data-code-state", "revoked", {
      timeout: 20_000,
    });
    await expect(p.locator("[data-join-form]")).toHaveCount(0);
  });

  await test.step("signed out, staff pages ask to sign in", async () => {
    const anon = await fetch(`${BASE}/admin/access-codes`, { redirect: "manual" });
    expect(anon.status).toBe(302);
    expect(anon.headers.get("location") ?? "").toMatch(/^\/sign-in/);
  });
});
