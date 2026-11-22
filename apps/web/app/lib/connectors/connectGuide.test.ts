import { describe, expect, test } from "vitest";
import {
  askedOn,
  canAskAgain,
  CONNECT_CLIENTS,
  guideView,
  mcpUrl,
  OFF_NOTE,
  VIEWER_NOTE,
} from "./connectGuide";

describe("mcpUrl", () => {
  test("is the page's origin plus /mcp", () => {
    expect(mcpUrl(undefined, "https://caretook.example")).toBe("https://caretook.example/mcp");
    expect(mcpUrl("", "http://localhost:5173")).toBe("http://localhost:5173/mcp");
  });

  test("prefers the configured API origin (the native app's web origin), trailing slash or not", () => {
    expect(mcpUrl("https://api.example.com", "capacitor://localhost")).toBe("https://api.example.com/mcp");
    expect(mcpUrl("https://api.example.com/", "capacitor://localhost")).toBe("https://api.example.com/mcp");
  });
});

describe("the clients", () => {
  test("Claude then ChatGPT, 3 or 4 steps each, and an https help link", () => {
    expect(CONNECT_CLIENTS.map((c) => c.name)).toEqual(["Claude", "ChatGPT"]);
    for (const c of CONNECT_CLIENTS) {
      expect(c.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.steps.length).toBeLessThanOrEqual(4);
      expect(new URL(c.help.href).protocol).toBe("https:");
    }
  });
});

describe("guideView", () => {
  const owner = { role: "owner", enabled: true };
  const viewer = { role: "viewer", enabled: true };

  test("a group with the switch on: the steps, no note", () => {
    expect(guideView("group", [owner], true)).toEqual({ show: "steps", viewerNote: null });
    expect(guideView("group", [{ role: "caretaker", enabled: true }])).toEqual({
      show: "steps",
      viewerNote: null,
    });
  });

  test("a group with the switch off: the off note, which tells an owner to turn it on", () => {
    expect(guideView("group", [{ role: "owner", enabled: false }], true)).toEqual({
      show: "off",
      note: OFF_NOTE.owner,
    });
    expect(guideView("group", [{ role: "caretaker", enabled: false }])).toEqual({
      show: "off",
      note: OFF_NOTE.member,
    });
  });

  test("the easy roles get no guide at all, and don't count on Devices", () => {
    const easy = { role: "easy_helper", enabled: true };
    expect(guideView("group", [easy])).toEqual({ show: "none" });
    expect(guideView("account", [easy, { role: "easy_viewer", enabled: false }])).toEqual({ show: "none" });
    expect(guideView("account", [easy, owner])).toEqual({ show: "steps", viewerNote: null });
    expect(guideView("account", [easy, viewer])).toEqual({ show: "steps", viewerNote: VIEWER_NOTE.account });
  });

  test("a viewer gets the steps with the read-only note", () => {
    expect(guideView("group", [viewer])).toEqual({ show: "steps", viewerNote: VIEWER_NOTE.group });
  });

  test("on Devices: off when no group allows assistants (or there are none)", () => {
    expect(guideView("account", [])).toEqual({ show: "off", note: OFF_NOTE.account });
    expect(guideView("account", [{ role: "owner", enabled: false }])).toEqual({
      show: "off",
      note: OFF_NOTE.account,
    });
    // A group not yet synced has no role: it doesn't count.
    expect(guideView("account", [{ role: null, enabled: true }])).toMatchObject({ show: "off" });
  });

  test("on Devices: the viewer note by how many of the groups that allow it have the member as a viewer", () => {
    expect(guideView("account", [owner, { role: "viewer", enabled: false }])).toEqual({
      show: "steps",
      viewerNote: null,
    });
    expect(guideView("account", [viewer])).toEqual({ show: "steps", viewerNote: VIEWER_NOTE.account });
    expect(guideView("account", [viewer, owner])).toEqual({ show: "steps", viewerNote: VIEWER_NOTE.some });
  });
});

describe("asking the owners", () => {
  const now = new Date("2026-11-21T18:00:00.000Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  test("may ask with no request, and again only once the window has passed", () => {
    expect(canAskAgain(null, now, 7)).toBe(true);
    expect(canAskAgain(daysAgo(0), now, 7)).toBe(false);
    expect(canAskAgain(daysAgo(6.9), now, 7)).toBe(false);
    expect(canAskAgain(daysAgo(7), now, 7)).toBe(true);
    expect(canAskAgain(daysAgo(30), now, 7)).toBe(true);
  });

  test("says the day of the last request, in the given zone", () => {
    expect(askedOn("2026-11-21T18:00:00.000Z", "en-US", "America/Los_Angeles")).toBe("Asked on November 21");
    expect(askedOn("2026-11-22T03:00:00.000Z", "en-US", "America/Los_Angeles")).toBe("Asked on November 21");
    expect(askedOn("2026-11-22T03:00:00.000Z", "en-US", "UTC")).toBe("Asked on November 22");
  });
});
