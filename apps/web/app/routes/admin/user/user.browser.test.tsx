import type { ApiOutputs } from "~/lib/core/rpc";

import { describe, expect, test } from "vitest";
import { formString } from "~/lib/core/form";
import { page, userEvent } from "vitest/browser";
import { ADMIN_STAFF, adminFx } from "../../../../test/adminFixtures";
import { openAdmin, postedForms } from "../adminWorld";
import { accountActionDoneMessage } from "./accountActions";
import { helpDoneMessage } from "./helpActions";
import * as user from "./route";

// An account's staff page (admin.mjs steps 5, 11 and 12, on loader data):
// what it shows, the help actions and the admin-only access controls, each
// behind a reason, and who gets which. What the actions do on the server
// (sessions gone, the email queued, the audit entry, the refusals) is in
// packages/api/src/usersAdmin.int.test.ts, accountDisable.int.test.ts and
// packages/data/src/services/accountAdmin.int.test.ts.

type UserPage = ApiOutputs["admin"]["users"]["get"];

const ID = "5a7d0c00-cccc-4000-8000-000000000001";
const USER_URL = `/admin/users/${ID}`;
const phone = adminFx.session({
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
});
const laptop = adminFx.session();
const group = adminFx.membership({
  displayName: "Grandma June",
  groupName: "Lindqvist Family",
  role: "owner",
});

type Options = {
  page?: (current: UserPage) => UserPage;
  canHelp?: boolean;
  canDisable?: boolean;
  canSetRole?: boolean;
  isSelf?: boolean;
  staff?: "admin" | "support";
  answer?: (form: FormData) => unknown;
};

/** The account page, as admin by default; posts are recorded and answered by `answer` (ok by default). */
const openUser = async ({
  page: change = (p) => p,
  canHelp = true,
  canDisable = true,
  canSetRole = true,
  isSelf = false,
  staff = "admin",
  answer = () => ({ ok: true, message: "Done." }),
}: Options = {}) => {
  let current = adminFx.userPage({
    account: { id: ID },
    signIn: { lastSignInAt: laptop.createdAt },
    sessions: [phone, laptop],
    groups: [group],
    mail: [adminFx.mail({ template: "verifyEmail", status: "failed", attempts: 3, errorCode: "bounced" })],
  });
  current = change(current);
  const posted = postedForms((form) => {
    const result = answer(form);
    // The server's change, seen on the next load.
    if (form.get("intent") === "revokeSession")
      current = { ...current, sessions: current.sessions.filter((s) => s.id !== form.get("sessionId")) };
    return result;
  });
  const device = await openAdmin({
    staff,
    routes: {
      path: "/admin/users/:userId",
      module: user,
      loaderData: () => ({
        page: current,
        canHelp,
        canDisable,
        canSetRole,
        isSelf,
        history: {
          count: 1,
          entries: [
            adminFx.auditEntry({ action: "user.view", targetUser: { id: ID, name: null, email: null } }),
          ],
        },
      }),
      actionResult: posted.actionResult,
    },
    url: USER_URL,
  });
  return { device, posts: posted.posts };
};

const section = (id: string) => document.querySelector(`[data-user-section="${id}"]`);
const openDialog = () => document.querySelector("dialog[open]");
const dialogButton = (name: string) => page.getByRole("dialog").getByRole("button", { name, exact: true });

/** Opens an action's confirm, checks it waits for a reason, gives one and confirms. */
const confirmWithReason = async (
  button: ReturnType<typeof page.getByRole>,
  confirm: string,
  reason: string,
) => {
  await userEvent.click(button);
  await expect.poll(() => openDialog()).not.toBeNull();
  await expect.element(dialogButton(confirm)).toBeDisabled();
  await userEvent.fill(page.getByRole("dialog").getByRole("textbox", { name: /Reason/ }), reason);
  await expect.element(dialogButton(confirm)).toBeEnabled();
  await userEvent.click(dialogButton(confirm));
};

describe("an account's page", () => {
  test("its account, how it signs in, sessions by device, groups (to the group's staff page), mail and audit entries", async () => {
    const { device } = await openUser();
    const { screen } = device;
    await expect.element(screen.getByRole("heading", { name: "Pat Lindqvist", level: 1 })).toBeVisible();
    expect(section("account")!.textContent).toContain("Password, Emailed link or code");

    const sessions = [...document.querySelectorAll("[data-sessions] li")].map(
      (li) => li.querySelector("p")!.textContent,
    );
    expect(sessions).toEqual(["Safari on iPhone", "Chrome on macOS"]);

    await expect
      .element(screen.getByRole("link", { name: "Grandma June" }))
      .toHaveAttribute("href", `/admin/groups/${group.groupId}`);
    expect(section("groups")!.textContent).toContain("Lindqvist Family");
    expect(section("groups")!.textContent).toContain("Owner");

    const mail = document.querySelector('[data-mail] tr[data-mail-row="verifyEmail"]')!;
    expect(mail.textContent).toContain("Failed (3 tries)");
    expect(mail.textContent).toContain("bounced");

    expect(section("history")!.querySelector('[data-action="user.view"]')).not.toBeNull();
  });

  test("signing one session out takes a reason, posts that session, and the page loses it", async () => {
    const { device, posts } = await openUser({
      answer: () => ({ ok: true, message: helpDoneMessage("revokeSession") }),
    });
    await confirmWithReason(
      device.screen.getByRole("button", { name: /^Sign out Safari on iPhone/ }),
      "Sign out",
      "Lost phone",
    );
    await expect.poll(() => document.querySelector(`[data-session="${phone.id}"]`)).toBeNull();
    expect(document.querySelector(`[data-session="${laptop.id}"]`)).not.toBeNull();
    expect(posts).toEqual([{ intent: "revokeSession", reason: "Lost phone", sessionId: phone.id }]);
  });

  test("a password reset: the dialog closes with a status; a refusal stays in the dialog", async () => {
    let refuse = false;
    const { device, posts } = await openUser({
      answer: () =>
        refuse
          ? { ok: false, error: "That account is disabled.", issues: [] }
          : { ok: true, message: helpDoneMessage("sendReset") },
    });
    const send = device.screen.getByRole("button", { name: "Send password reset" });
    await confirmWithReason(send, "Send it", "Locked out");
    await expect
      .element(device.screen.getByRole("status"))
      .toHaveTextContent("A password reset email is on its way.");
    await expect.poll(openDialog).toBeNull();
    expect(posts.at(-1)).toEqual({ intent: "sendReset", reason: "Locked out" });

    refuse = true;
    await confirmWithReason(send, "Send it", "Asked again");
    await expect
      .element(page.getByRole("dialog").getByRole("alert"))
      .toHaveTextContent("That account is disabled.");
    expect(openDialog()).not.toBeNull();
  });

  test("an unconfirmed account also gets Resend confirmation email", async () => {
    const { device } = await openUser({
      page: (p) => ({ ...p, account: { ...p.account, emailVerified: false } }),
    });
    await expect
      .element(device.screen.getByRole("button", { name: "Resend confirmation email" }))
      .toBeVisible();
    await expect.element(device.screen.getByText("Not confirmed")).toBeVisible();
  });

  test("admin: Disable takes a reason and says how many sessions it signed out", async () => {
    const { device, posts } = await openUser({
      answer: () => ({ ok: true, message: accountActionDoneMessage("disable", { revoked: 2 }) }),
    });
    await confirmWithReason(
      device.screen.getByRole("button", { name: "Disable account" }),
      "Disable",
      "Compromised",
    );
    await expect
      .element(device.screen.getByRole("status"))
      .toHaveTextContent("Disabled. Signed out of 2 sessions.");
    expect(posts).toEqual([{ intent: "disable", reason: "Compromised" }]);
  });

  test("a disabled account: who, when and why, the Disabled badge, Re-enable, and no emails to send", async () => {
    const { device, posts } = await openUser({
      page: (p) => ({
        ...p,
        account: {
          ...p.account,
          disabledAt: "2026-11-12T09:15:00.000Z",
          disabledBy: ADMIN_STAFF,
          disabledReason: "Reported as compromised",
        },
      }),
      answer: () => ({ ok: true, message: accountActionDoneMessage("enable") }),
    });
    await expect.element(device.screen.getByRole("button", { name: "Re-enable account" })).toBeVisible();
    const account = section("account")!.textContent;
    expect(account).toContain("Disabled");
    expect(account).toContain(
      `Nov 12, 2026, 9:15 AM UTC by ${ADMIN_STAFF.name} (${ADMIN_STAFF.email}): Reported as compromised`,
    );
    expect(document.querySelector('[data-user-section="account"] [data-badge="disabled"]')).not.toBeNull();
    expect(document.querySelector("[data-help-actions]")).toBeNull();

    await confirmWithReason(
      device.screen.getByRole("button", { name: "Re-enable account" }),
      "Re-enable",
      "A mistake",
    );
    await expect
      .element(device.screen.getByRole("status"))
      .toHaveTextContent("Re-enabled. They can sign in again.");
    expect(posts).toEqual([{ intent: "enable", reason: "A mistake" }]);
  });

  test("admin: the staff role waits for a different choice, then confirms in the role's words", async () => {
    const { device, posts } = await openUser({
      answer: (form) => ({
        ok: true,
        message: accountActionDoneMessage("setRole", { role: formString(form, "role") }),
      }),
    });
    const change = device.screen.getByRole("button", { name: "Change role" });
    await expect.element(change).toBeDisabled();
    await userEvent.selectOptions(device.screen.getByRole("combobox", { name: /Staff role/ }), "Support");
    await confirmWithReason(change, "Make Support", "Joined support");
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("They're support now.");
    expect(posts).toEqual([{ role: "support", intent: "setRole", reason: "Joined support" }]);
  });

  test("your own page: a note, and no disable or role controls", async () => {
    await openUser({ isSelf: true });
    await expect.poll(() => section("admin")).not.toBeNull();
    expect(section("admin")!.querySelector("[data-self-note]")).not.toBeNull();
    expect(section("admin")!.querySelectorAll("button, select")).toHaveLength(0);
  });

  test("support: the help actions, but no Access card", async () => {
    const { device } = await openUser({ staff: "support", canDisable: false, canSetRole: false });
    await expect.element(device.screen.getByRole("button", { name: "Send password reset" })).toBeVisible();
    await expect.element(device.screen.getByRole("button", { name: "Sign out everywhere" })).toBeVisible();
    expect(section("admin")).toBeNull();
  });
});
