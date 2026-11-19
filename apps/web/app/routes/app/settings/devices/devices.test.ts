import { describe, expect, it } from "vitest";
import { deviceRows, devicesIntent } from "./devices";

const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

describe("deviceRows", () => {
  const sessions = [
    { id: "a", userAgent: MAC, createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z" },
    {
      id: "b",
      userAgent: IPHONE,
      createdAt: new Date("2026-11-15T10:00:00.000Z"),
      updatedAt: new Date("2026-11-15T10:00:00.000Z"),
    },
    {
      id: "c",
      userAgent: null,
      createdAt: "2026-11-18T10:00:00.000Z",
      updatedAt: "2026-11-18T10:00:00.000Z",
    },
  ];

  it("puts this device first, then the most recently active", () => {
    expect(deviceRows(sessions, "a").map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(deviceRows(sessions, "b").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("names each device and marks only this one", () => {
    expect(deviceRows(sessions, "b")).toEqual([
      { id: "b", label: "Safari on iPhone", lastActive: "2026-11-15T10:00:00.000Z", current: true },
      { id: "c", label: "Unknown device", lastActive: "2026-11-18T10:00:00.000Z", current: false },
      { id: "a", label: "Chrome on macOS", lastActive: "2026-11-10T10:00:00.000Z", current: false },
    ]);
  });

  it("marks none when this session isn't listed", () => {
    expect(deviceRows(sessions, null).some((r) => r.current)).toBe(false);
  });

  it("never carries a token", () => {
    const withToken = [
      { id: "a", userAgent: MAC, createdAt: "2026-11-01", updatedAt: "2026-11-10", token: "secret" },
    ];
    const rows = deviceRows(withToken, "a");
    expect(JSON.stringify(rows)).not.toContain("secret");
  });
});

describe("devicesIntent", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  it("reads one device or every other one", () => {
    expect(devicesIntent(form({ intent: "signOut", id: "x" }))).toEqual({ intent: "signOut", id: "x" });
    expect(devicesIntent(form({ intent: "signOutOthers" }))).toEqual({ intent: "signOutOthers" });
  });
  it("refuses anything else", () => {
    expect(devicesIntent(form({ intent: "signOut" }))).toBeNull();
    expect(devicesIntent(form({ intent: "bogus", id: "x" }))).toBeNull();
  });
});
