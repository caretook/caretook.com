import type { LinkRow, ShareNavigator } from "./linkRules";

import { describe, expect, it } from "vitest";
import {
  copyLinkText,
  inviteLinkUrl,
  linkActive,
  linkRoles,
  linkStatusLine,
  linkUses,
  parseLinkForm,
  requesterName,
  requestRefusal,
  shareLinkText,
} from "./linkRules";

const link: LinkRow = {
  id: "l1",
  role: "viewer",
  state: "usable",
  expiresAt: "2026-11-25T18:00:00.000Z",
  createdAt: "2026-11-18T18:00:00.000Z",
  maxUses: 10,
  useCount: 1,
  sentBy: { userId: "u1", name: "Sam" },
};

describe("who may make links", () => {
  it("offers owners and admins caretaker and viewer only, others nothing", () => {
    expect(linkRoles("owner")).toEqual(["caretaker", "viewer"]);
    expect(linkRoles("admin")).toEqual(["caretaker", "viewer"]);
    expect(linkRoles("caretaker")).toEqual([]);
    expect(linkRoles(null)).toEqual([]);
  });
});

describe("a link's line", () => {
  it("says its uses and when it stops working", () => {
    expect(linkStatusLine(link, "en-US")).toBe("Used 1 of 10 times · Expires Nov 25, 2026");
    expect(linkUses({ maxUses: 1, useCount: 0 })).toBe("Used 0 of 1 time");
    expect(linkUses({ maxUses: null, useCount: 0 })).toBe("Not used yet");
    expect(linkUses({ maxUses: null, useCount: 1 })).toBe("Used 1 time");
    expect(linkStatusLine({ ...link, state: "expired" }, "en-US")).toBe(
      "Used 1 of 10 times · Expired Nov 25, 2026",
    );
    expect(linkStatusLine({ ...link, state: "usedUp", useCount: 10 }, "en-US")).toBe(
      "Used 10 of 10 times · Used up",
    );
  });

  it("can be copied only while it works", () => {
    expect(linkActive(link)).toBe(true);
    expect(linkActive({ state: "expired" })).toBe(false);
    expect(linkActive({ state: "usedUp" })).toBe(false);
  });
});

describe("the link form", () => {
  const values = { role: "viewer", expiresInDays: "", maxUses: "" };

  it("defaults to 7 days and no limit", () => {
    expect(parseLinkForm(values, "admin")).toEqual({
      ok: true,
      data: { role: "viewer", expiresInDays: 7, maxUses: null },
    });
    expect(parseLinkForm({ role: "caretaker", expiresInDays: "90", maxUses: "3" }, "owner")).toEqual({
      ok: true,
      data: { role: "caretaker", expiresInDays: 90, maxUses: 3 },
    });
  });

  it("refuses owner and admin links, days outside 1–90, and bad limits", () => {
    const paths = (v: Partial<typeof values>, role = "owner") => {
      const res = parseLinkForm({ ...values, ...v }, role);
      return res.ok ? [] : res.issues.map((i) => i.path);
    };
    expect(paths({ role: "owner" })).toEqual(["role"]);
    expect(paths({ role: "admin" })).toEqual(["role"]);
    expect(paths({}, "caretaker")).toEqual(["role"]);
    expect(paths({ expiresInDays: "0" })).toEqual(["expiresInDays"]);
    expect(paths({ expiresInDays: "91" })).toEqual(["expiresInDays"]);
    expect(paths({ expiresInDays: "2.5" })).toEqual(["expiresInDays"]);
    expect(paths({ maxUses: "0" })).toEqual(["maxUses"]);
    expect(paths({ maxUses: "101" })).toEqual(["maxUses"]);
  });

  it("follows the admin settings' limits when it has them", () => {
    const limits = { defaultDays: 3, maxDays: 14, maxUses: 5 };
    expect(parseLinkForm({ ...values, expiresInDays: "" }, "owner", limits)).toMatchObject({
      ok: true,
      data: { expiresInDays: 3 },
    });
    const res = parseLinkForm({ ...values, expiresInDays: "15", maxUses: "6" }, "owner", limits);
    expect(res.ok ? [] : res.issues).toEqual([
      { path: "expiresInDays", message: "Choose 1 to 14 days." },
      { path: "maxUses", message: "Leave it empty for no limit, or choose 1 to 5." },
    ]);
  });
});

describe("sharing a link", () => {
  const url = inviteLinkUrl("https://caretook.com", "/invite/abc_123");
  const data = { title: "Join", text: "Join us:", url };

  it("builds the web URL", () => {
    expect(url).toBe("https://caretook.com/invite/abc_123");
  });

  it("uses the share sheet when there is one, and says nothing when it's dismissed", async () => {
    const shared: unknown[] = [];
    const nav: ShareNavigator = { share: (d) => (shared.push(d), Promise.resolve()) };
    expect(await shareLinkText(nav, data)).toBe("shared");
    expect(shared).toEqual([data]);
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    expect(await shareLinkText({ share: () => Promise.reject(abort) }, data)).toBe("cancelled");
  });

  it("falls back to the clipboard, then to showing the link", async () => {
    const copied: string[] = [];
    const clipboard = { writeText: (t: string) => (copied.push(t), Promise.resolve()) };
    expect(await shareLinkText({ clipboard }, data)).toBe("copied");
    expect(await shareLinkText({ share: () => Promise.reject(new Error("no")), clipboard }, data)).toBe(
      "copied",
    );
    expect(
      await shareLinkText({ canShare: () => false, share: () => Promise.resolve(), clipboard }, data),
    ).toBe("copied");
    expect(copied).toEqual([url, url, url]);
    expect(await copyLinkText({}, url)).toBe("failed");
    expect(await copyLinkText({ clipboard: { writeText: () => Promise.reject(new Error("no")) } }, url)).toBe(
      "failed",
    );
  });
});

describe("requests", () => {
  it("names the requester, else their address", () => {
    expect(requesterName({ name: " Robin ", email: "r@example.com" })).toBe("Robin");
    expect(requesterName({ name: null, email: "r@example.com" })).toBe("r@example.com");
  });

  it("shows the service's refusals as they are", () => {
    expect(requestRefusal({ data: { code: "joinRequestService:notFound" } })).toBe(
      "That request is no longer waiting.",
    );
    expect(requestRefusal({ data: { code: "joinRequestService:notAllowed" }, message: "Only owners" })).toBe(
      "Only owners",
    );
    expect(requestRefusal({ data: { code: "other" } })).toBeNull();
  });
});
