import type { DeviceRoute } from "../../../../../../test/device";
import type { GroupRole } from "../../../../../../test/fixtures";

import { ATTESTATION_TEXT } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { apiCalls, refusal } from "../../../../../../test/api";
import { renderWithDevice } from "../../../../../../test/device";
import { TEST_GROUP } from "../../../../../../test/fixtures";
import * as settingsLayout from "../layout/route";
import * as members from "./route";

// The Members page's invite controls (invites.mjs's screen steps 5, 7, 8 and
// 9, on the test device): the Invite by email sheet (the roles offered, the
// call it makes, a refusal, offline and switched off), the Pending list (each
// invite's role, sender and expiry, Resend, Revoke after a confirm) and who
// sees any of it. What the server does with a sent invite (the email, the
// link, the attestation recorded, who may invite) is
// packages/api/src/invites.int.test.ts's; the real send, mail and sign-up
// are invites.mjs's step 5, and its step 9 keeps the API's 403s.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  {
    path: BASE,
    module: settingsLayout,
    children: [{ path: `${BASE}/members`, module: members }],
  },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const sentBy = { userId: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a09", name: "Sam Okafor" };
const invite = (over: Record<string, unknown> = {}) => ({
  id: "inv-1",
  email: "avery.invited@example.com",
  role: "caretaker",
  status: "pending",
  state: "usable",
  expiresAt: "2026-11-27T20:00:00Z",
  respondedAt: null,
  sentBy,
  ...over,
});

type Api = Record<string, (input: unknown) => unknown>;
const ONLINE: Api = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
  "invite.listForGroup": () => [],
  "invite.listLinks": () => [],
  "joinRequest.list": () => [],
  "joinRequest.mine": () => [],
  "me.contact": () => null,
};

const open = ({
  role = "owner",
  online = true,
  api = {},
}: {
  role?: GroupRole;
  online?: boolean;
  api?: Api;
} = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: MEMBERS,
    role,
    api: online ? { ...ONLINE, ...api } : undefined,
  });

const inviteButton = () => page.getByRole("button", { name: "Invite by email" });
const sheet = () => document.querySelector<HTMLElement>("[data-invite-sheet]");
const row = (id = "inv-1") =>
  document.querySelector<HTMLElement>(`[data-pending-invites] li[data-invite="${id}"]`);

describe("the Invite by email sheet", () => {
  test("opens with an email, a role and the inviter's confirmation, and offers an owner every role", async () => {
    await open();
    await userEvent.click(inviteButton());
    await expect.element(page.getByRole("button", { name: "Send invitation" })).toBeVisible();
    await expect.element(page.getByLabelText("Email", { exact: true })).toHaveValue("");
    const roles = [...sheet()!.querySelectorAll<HTMLOptionElement>('select[name="role"] option')];
    expect(roles.map((o) => o.value)).toEqual(["owner", "admin", "caretaker", "viewer"]);
    expect(sheet()!.querySelector<HTMLSelectElement>('select[name="role"]')!.value).toBe("caretaker");
    await expect.element(page.getByLabelText(ATTESTATION_TEXT)).not.toBeChecked();
  });

  test("an admin can't offer the owner role", async () => {
    await open({ role: "admin" });
    await userEvent.click(inviteButton());
    const roles = [...sheet()!.querySelectorAll<HTMLOptionElement>('select[name="role"] option')];
    expect(roles.map((o) => o.value)).toEqual(["admin", "caretaker", "viewer"]);
  });

  test("Send invitation calls invite.createEmail with the role and the attestation, closes, and says to whom", async () => {
    const calls = apiCalls();
    await open({
      api: calls.record({ "invite.createEmail": () => ({ email: "avery.invited@example.com" }) }),
    });
    await userEvent.click(inviteButton());
    await userEvent.fill(page.getByLabelText("Email", { exact: true }), "  avery.invited@example.com ");
    await userEvent.selectOptions(page.getByLabelText("Role"), "viewer");
    await userEvent.click(page.getByLabelText(ATTESTATION_TEXT));
    await userEvent.click(page.getByRole("button", { name: "Send invitation" }));
    await expect
      .element(page.getByRole("status").getByText("Invitation sent to avery.invited@example.com."))
      .toBeVisible();
    expect(sheet()).toBeNull();
    expect(calls.of("invite.createEmail")).toEqual([
      {
        groupId: TEST_GROUP.id,
        email: "avery.invited@example.com",
        role: "viewer",
        attested: true,
      },
    ]);
  });

  test("a refusal from the server is shown in the sheet, which stays open", async () => {
    await open({ api: { "invite.createEmail": () => refusal("careGroupInviteService:alreadyInvited") } });
    await userEvent.click(inviteButton());
    await userEvent.fill(page.getByLabelText("Email", { exact: true }), "avery.invited@example.com");
    await userEvent.click(page.getByLabelText(ATTESTATION_TEXT));
    await userEvent.click(page.getByRole("button", { name: "Send invitation" }));
    await expect.element(page.getByRole("alert")).toBeVisible();
    expect(sheet()).not.toBeNull();
    await expect
      .element(page.getByLabelText("Email", { exact: true }))
      .toHaveValue("avery.invited@example.com");
  });

  test("offline, the button is disabled and says it needs a connection", async () => {
    await open({ online: false });
    await expect.element(inviteButton()).toBeDisabled();
    await expect.element(page.getByText("Needs a connection to invite.")).toBeVisible();
  });

  test("switched off in the admin settings, the button is disabled and says why", async () => {
    await open({
      api: {
        "invite.options": () => ({
          emailInvites: false,
          linkInvites: true,
          link: { defaultDays: 7, maxDays: 30, maxUses: 50 },
        }),
      },
    });
    await expect.element(inviteButton()).toBeDisabled();
    await expect.element(page.getByText("Email invites aren't available right now.")).toBeVisible();
  });
});

describe("who sees the invite controls", () => {
  test("owners and admins see Invite by email and Pending invitations", async () => {
    for (const role of ["owner", "admin"] as const) {
      const device = await open({ role });
      await expect.element(inviteButton()).toBeVisible();
      expect(document.querySelector("[data-pending-invites]")).not.toBeNull();
      await device.screen.unmount();
    }
  });

  test("caretakers and viewers see no invite or link controls, no Pending, no links and no requests, and make no invite calls", async () => {
    for (const role of ["caretaker", "viewer"] as const) {
      const calls = apiCalls();
      const device = await open({ role, api: calls.record({ ...ONLINE }) });
      await expect.element(page.getByRole("heading", { name: "Members", level: 1 })).toBeVisible();
      const shown = [
        "invite-controls",
        "pending-invites",
        "link-controls",
        "invite-links",
        "join-requests",
      ].map((name) => document.querySelector(`[data-${name}]`) !== null);
      expect(shown, role).toEqual([false, false, false, false, false]);
      expect(calls.of("invite.listForGroup"), role).toEqual([]);
      await device.screen.unmount();
    }
  });
});

describe("Pending invitations", () => {
  test("a waiting invite shows the address, role, who sent it and when it expires", async () => {
    await open({ api: { "invite.listForGroup": () => [invite()] } });
    await expect.element(page.getByText("avery.invited@example.com")).toBeVisible();
    expect(row()!.textContent).toMatch(/Caretaker · Sent by Sam Okafor · Expires Nov 27, 2026/);
    expect(row()!.dataset.inviteStatus).toBe("usable");
    expect(row()!.querySelectorAll("button")).toHaveLength(2);
  });

  test("an expired one says so, and can still be sent again", async () => {
    await open({
      api: { "invite.listForGroup": () => [invite({ state: "expired", expiresAt: "2026-11-17T20:00:00Z" })] },
    });
    await expect.element(page.getByText(/Expired Nov 17, 2026/)).toBeVisible();
    await expect.element(page.getByRole("button", { name: /^Resend the invitation/ })).toBeVisible();
  });

  test("a declined one says when, and has no Resend or Revoke", async () => {
    await open({
      api: {
        "invite.listForGroup": () => [
          invite({ status: "declined", state: "declined", respondedAt: "2026-11-18T20:00:00Z" }),
        ],
      },
    });
    await expect.element(page.getByText(/Declined Nov 18, 2026 · Sent by Sam Okafor/)).toBeVisible();
    expect(row()!.querySelectorAll("button")).toHaveLength(0);
  });

  test("with none waiting, it says so", async () => {
    await open();
    await expect.element(page.getByText("No invitations waiting.")).toBeVisible();
  });

  test("an admin can't resend an owner's invite, but can revoke it", async () => {
    await open({
      role: "admin",
      api: { "invite.listForGroup": () => [invite({ role: "owner" })] },
    });
    await expect.element(page.getByRole("button", { name: /^Revoke the invitation/ })).toBeVisible();
    expect(page.getByRole("button", { name: /^Resend the invitation/ }).elements()).toHaveLength(0);
  });

  test("Resend calls invite.resend and says a new link went out", async () => {
    const calls = apiCalls();
    await open({
      api: calls.record({
        "invite.listForGroup": () => [invite()],
        "invite.resend": () => ({ email: "avery.invited@example.com" }),
      }),
    });
    await userEvent.click(
      page.getByRole("button", { name: "Resend the invitation to avery.invited@example.com" }),
    );
    await expect.element(page.getByText("Sent again, with a new link.")).toBeVisible();
    expect(calls.of("invite.resend")).toEqual([{ id: "inv-1" }]);
  });

  test("Revoke asks first, naming the address; confirming calls invite.revoke, and cancelling does nothing", async () => {
    const calls = apiCalls();
    await open({
      api: calls.record({ "invite.listForGroup": () => [invite()], "invite.revoke": () => ({}) }),
    });
    const revoke = page.getByRole("button", { name: "Revoke the invitation to avery.invited@example.com" });
    await userEvent.click(revoke);
    const dialog = () => document.querySelector("dialog[open]");
    await expect
      .poll(() => dialog()?.querySelector("h2")?.textContent)
      .toBe("Withdraw the invitation to avery.invited@example.com? Its link will stop working.");
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(dialog).toBeNull();
    expect(calls.of("invite.revoke")).toEqual([]);

    await userEvent.click(revoke);
    await expect.poll(dialog).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Revoke", exact: true }));
    await expect.poll(() => calls.of("invite.revoke")).toEqual([{ id: "inv-1" }]);
  });

  test("a refused Resend shows the server's message on that invite", async () => {
    await open({
      api: {
        "invite.listForGroup": () => [invite()],
        "invite.resend": () => refusal("careGroupInviteService:notFound"),
      },
    });
    await userEvent.click(page.getByRole("button", { name: /^Resend the invitation/ }));
    await expect.element(page.getByRole("alert")).toHaveTextContent("That invitation is no longer waiting.");
  });
});
