import { describe, expect, it } from "vitest";
import {
  canInvite,
  CONSENT_TEXT,
  CONSENT_VERSION,
  emailMatches,
  invitableRoles,
  inviteState,
  linkRoleAllowed,
} from "./inviteRules";

const ROLES = ["owner", "admin", "caretaker", "viewer"] as const;
const ACTORS = [...ROLES, null] as const;

describe("canInvite", () => {
  // Expected answers for every actor × target × kind.
  const allowed = (actor: string | null, target: string, kind: "email" | "link") => {
    if (actor !== "owner" && actor !== "admin") return false;
    if (kind === "link") return target === "caretaker" || target === "viewer";
    return target !== "owner" || actor === "owner";
  };

  for (const kind of ["email", "link"] as const)
    for (const actorRole of ACTORS)
      for (const targetRole of ROLES)
        it(`${actorRole ?? "a non-member"} inviting a ${targetRole} by ${kind}: ${allowed(actorRole, targetRole, kind)}`, () => {
          expect(canInvite({ actorRole, targetRole, kind })).toBe(allowed(actorRole, targetRole, kind));
        });

  it("refuses a role it doesn't know", () => {
    expect(canInvite({ actorRole: "owner", targetRole: "superuser", kind: "email" })).toBe(false);
  });

  it("lists the roles each actor may offer, highest first", () => {
    expect(invitableRoles("owner", "email")).toEqual(["owner", "admin", "caretaker", "viewer"]);
    expect(invitableRoles("admin", "email")).toEqual(["admin", "caretaker", "viewer"]);
    expect(invitableRoles("owner", "link")).toEqual(["caretaker", "viewer"]);
    expect(invitableRoles("caretaker", "email")).toEqual([]);
    expect(invitableRoles(null, "email")).toEqual([]);
  });
});

describe("linkRoleAllowed", () => {
  it("caps links at caretaker and viewer", () => {
    expect(ROLES.filter(linkRoleAllowed)).toEqual(["caretaker", "viewer"]);
  });
});

describe("inviteState", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const later = "2026-11-20T12:00:00Z";
  const earlier = "2026-11-17T12:00:00Z";

  it("is usable while pending and unexpired", () => {
    expect(inviteState({ invite: { status: "pending", expiresAt: later }, now })).toBe("usable");
  });

  it("is expired at and after the expiry", () => {
    expect(inviteState({ invite: { status: "pending", expiresAt: earlier }, now })).toBe("expired");
    expect(inviteState({ invite: { status: "pending", expiresAt: now.toISOString() }, now })).toBe("expired");
  });

  it("says revoked, accepted and declined over expired", () => {
    for (const status of ["revoked", "accepted", "declined"] as const) {
      expect(inviteState({ invite: { status, expiresAt: earlier }, now })).toBe(status);
      expect(inviteState({ invite: { status, expiresAt: later }, now })).toBe(status);
    }
  });

  it("is used up when the uses reach the limit", () => {
    const invite = { status: "pending", expiresAt: later, maxUses: 2 };
    expect(inviteState({ invite: { ...invite, useCount: 1 }, now })).toBe("usable");
    expect(inviteState({ invite: { ...invite, useCount: 2 }, now })).toBe("usedUp");
    expect(inviteState({ invite: { ...invite, maxUses: null, useCount: 99 }, now })).toBe("usable");
  });

  it("accepts Postgres's timestamp text", () => {
    expect(inviteState({ invite: { status: "pending", expiresAt: "2026-11-20 12:00:00.000+00" }, now })).toBe(
      "usable",
    );
  });
});

describe("emailMatches", () => {
  it("ignores case and surrounding spaces", () => {
    expect(emailMatches({ email: "Avery@Example.com " }, { email: " avery@example.COM" })).toBe(true);
  });

  it("refuses another address and a link (no address)", () => {
    expect(emailMatches({ email: "avery@example.com" }, { email: "avery2@example.com" })).toBe(false);
    expect(emailMatches({ email: null }, { email: "avery@example.com" })).toBe(false);
  });
});

describe("the consent text", () => {
  it("has a version and names what the group shares", () => {
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const word of ["timeline", "notes", "vitals", "medications", "providers"])
      expect(CONSENT_TEXT).toContain(word);
  });
});
