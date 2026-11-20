import type { UsablePreview } from "./invitePage";

import { describe, expect, it } from "vitest";
import { invitedLine, inviteTitle, inviteView, isLink, joinLabel, roleWithArticle } from "./invitePage";

const usable: UsablePreview = {
  state: "usable",
  kind: "email",
  role: "caretaker",
  email: "avery@example.com",
  groupName: "Grandma Example",
  inviterName: "Sam",
  expiresAt: "2026-11-25T12:00:00.000Z",
};

describe("inviteView", () => {
  it("asks someone signed out to create an account (or sign in)", () => {
    expect(inviteView(usable, null)).toEqual({ view: "signUp", invite: usable });
  });

  it("shows the consent screen to the invited address, whatever its case", () => {
    expect(inviteView(usable, { email: " Avery@Example.com" })).toEqual({ view: "consent", invite: usable });
  });

  it("tells another account the invite isn't theirs", () => {
    expect(inviteView(usable, { email: "someone@example.com" })).toEqual({
      view: "wrongAccount",
      invite: usable,
      signedInAs: "someone@example.com",
    });
  });

  it("says plainly when an invite can't be used, naming nothing", () => {
    for (const state of [
      "notFound",
      "expired",
      "revoked",
      "usedUp",
      "accepted",
      "declined",
      "unavailable",
    ] as const) {
      const view = inviteView({ state }, null);
      expect(view.view).toBe("closed");
      if (view.view !== "closed") continue;
      expect(view.title.length).toBeGreaterThan(0);
      expect(`${view.title} ${view.message}`).not.toContain("Grandma");
    }
    expect(inviteView({ state: "expired" }, null)).toMatchObject({ title: "This invitation has expired" });
    expect(inviteView({ state: "unavailable" }, null)).toMatchObject({ title: "Not available right now" });
  });
});

describe("wording", () => {
  it("names the group and the inviter", () => {
    expect(inviteTitle(usable)).toBe("Join Grandma Example's care group");
    expect(invitedLine(usable)).toBe("Sam invited you to join as a caretaker.");
    expect(invitedLine({ ...usable, inviterName: null, role: "admin" })).toBe(
      "Someone invited you to join as an admin.",
    );
    expect(roleWithArticle("mystery")).toBe("mystery");
  });
});

describe("a link's page", () => {
  const link: UsablePreview = { ...usable, kind: "link", email: null, role: "viewer" };

  it("lets any signed-in account ask to join", () => {
    expect(inviteView(link, { email: "anyone@example.com" })).toEqual({ view: "consent", invite: link });
    expect(inviteView(link, null)).toEqual({ view: "signUp", invite: link });
  });

  it("asks rather than joins", () => {
    expect(isLink(link)).toBe(true);
    expect(joinLabel(link, false)).toBe("Ask to join");
    expect(joinLabel(link, true)).toBe("Asking…");
    expect(joinLabel(usable, false)).toBe("Join the care group");
  });
});
