import type { InviteRow } from "./invites";

import { describe, expect, it } from "vitest";
import {
  emailInviteRoles,
  inviteRefusal,
  inviteStatusLine,
  mayResend,
  mayRevoke,
  memberHistory,
  parseInviteForm,
} from "./invites";

const row: InviteRow = {
  id: "i1",
  email: "sib@example.com",
  role: "caretaker",
  status: "pending",
  state: "usable",
  expiresAt: "2026-11-25T18:00:00.000Z",
  respondedAt: null,
  sentBy: { userId: "u1", name: "Sam" },
};

describe("who may invite", () => {
  it("offers owners every role, admins all but owner, others nothing", () => {
    expect(emailInviteRoles("owner")).toEqual(["owner", "admin", "caretaker", "viewer"]);
    expect(emailInviteRoles("admin")).toEqual(["admin", "caretaker", "viewer"]);
    expect(emailInviteRoles("caretaker")).toEqual([]);
    expect(emailInviteRoles("viewer")).toEqual([]);
  });

  it("lets only owners resend owner invites; managers revoke waiting ones", () => {
    expect(mayResend("admin", row)).toBe(true);
    expect(mayResend("admin", { ...row, role: "owner" })).toBe(false);
    expect(mayResend("owner", { ...row, role: "owner" })).toBe(true);
    expect(mayResend("owner", { ...row, status: "declined" })).toBe(false);
    expect(mayRevoke("admin", row)).toBe(true);
    expect(mayRevoke("caretaker", row)).toBe(false);
    expect(mayRevoke("owner", { ...row, status: "declined" })).toBe(false);
  });
});

describe("lines", () => {
  it("says who sent an invite and when it expires, expired or was declined", () => {
    expect(inviteStatusLine(row, "en-US")).toBe("Sent by Sam · Expires Nov 25, 2026");
    expect(
      inviteStatusLine({ ...row, state: "expired", expiresAt: "2026-11-17T18:00:00.000Z" }, "en-US"),
    ).toBe("Sent by Sam · Expired Nov 17, 2026");
    expect(
      inviteStatusLine(
        { ...row, status: "declined", state: "declined", respondedAt: "2026-11-18T18:00:00.000Z" },
        "en-US",
      ),
    ).toBe("Declined Nov 18, 2026 · Sent by Sam");
    expect(inviteStatusLine({ ...row, sentBy: null }, "en-US")).toBe("Expires Nov 25, 2026");
  });

  it("says who invited a member and when they joined", () => {
    const joined = "2026-11-18T18:00:00.000000Z";
    expect(memberHistory({ created_at: joined, invited_by_name: "Sam" }, "en-US")).toBe(
      "Invited by Sam · Joined Nov 18, 2026",
    );
    expect(memberHistory({ created_at: joined, invited_by_name: null }, "en-US")).toBe("Joined Nov 18, 2026");
    expect(memberHistory({ created_at: null, invited_by_name: "Sam" })).toBeNull();
  });
});

describe("parseInviteForm", () => {
  it("accepts a valid invite", () => {
    expect(parseInviteForm({ email: " sib@example.com ", role: "viewer", attested: "on" }, "admin")).toEqual({
      ok: true,
      data: { email: "sib@example.com", role: "viewer" },
    });
  });

  it("names every problem", () => {
    const res = parseInviteForm({ email: "nope", role: "owner", attested: "" }, "admin");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.map((i) => i.path)).toEqual(["email", "role", "attested"]);
  });
});

describe("inviteRefusal", () => {
  it("shows the invite rules' messages, and nothing for other errors", () => {
    expect(
      inviteRefusal({ data: { code: "careGroupInviteService:alreadyMember" }, message: "Already in" }),
    ).toBe("Already in");
    expect(inviteRefusal({ data: { code: "careGroupInviteService:notFound" }, message: "x" })).toBe(
      "That invitation is no longer waiting.",
    );
    expect(inviteRefusal({ data: { code: "other" }, message: "x" })).toBeNull();
    expect(inviteRefusal(new Error("boom"))).toBeNull();
  });
});
