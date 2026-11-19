import { describe, expect, it } from "vitest";
import {
  APP_SETTING_KEYS,
  APP_SETTINGS,
  isAppSettingKey,
  linkLimits,
  parseAppSetting,
  storedOrDefault,
} from "./appSettings";

// The settings registry (admin slice 5): each key's schema (valid, invalid,
// default).

const valid = (key: Parameters<typeof parseAppSetting>[0], value: unknown) => parseAppSetting(key, value).ok;

describe("APP_SETTINGS", () => {
  it("has a default every key's schema accepts", () => {
    for (const key of APP_SETTING_KEYS) {
      expect(parseAppSetting(key, APP_SETTINGS[key].default)).toEqual({
        ok: true,
        value: APP_SETTINGS[key].default,
      });
      expect(APP_SETTINGS[key].label.length).toBeGreaterThan(0);
    }
  });

  it("makes only the announcement public", () => {
    expect(APP_SETTING_KEYS.filter((key) => APP_SETTINGS[key].public)).toEqual(["announcement"]);
  });

  it("checks the sign-up switches", () => {
    for (const key of ["signup.accessCodes", "signup.linkInvites", "signup.emailInvites"] as const) {
      expect(APP_SETTINGS[key].default).toBe(true);
      expect(valid(key, false)).toBe(true);
      expect(valid(key, "off")).toBe(false);
      expect(valid(key, null)).toBe(false);
    }
  });

  it("checks the announcement", () => {
    expect(APP_SETTINGS.announcement.default).toBeNull();
    expect(valid("announcement", null)).toBe(true);
    expect(valid("announcement", { text: "Maintenance at 9", tone: "warning" })).toBe(true);
    expect(valid("announcement", { text: "Hi", tone: "info", endsAt: "2026-11-20T18:00:00.000Z" })).toBe(
      true,
    );
    expect(valid("announcement", { text: "  ", tone: "info" })).toBe(false);
    expect(valid("announcement", { text: "x".repeat(281), tone: "info" })).toBe(false);
    expect(valid("announcement", { text: "Hi", tone: "loud" })).toBe(false);
    expect(valid("announcement", { text: "Hi", tone: "info", endsAt: "tomorrow" })).toBe(false);
    expect(parseAppSetting("announcement", { text: "  Hi  ", tone: "info" })).toMatchObject({
      ok: true,
      value: { text: "Hi" },
    });
  });

  it("checks the email allowlist, lowercasing it", () => {
    expect(APP_SETTINGS["mail.allowlist"].default).toBeNull();
    expect(parseAppSetting("mail.allowlist", [" Dev@Example.com ", "@QA.example.com"])).toEqual({
      ok: true,
      value: ["dev@example.com", "@qa.example.com"],
    });
    expect(valid("mail.allowlist", [])).toBe(true);
    expect(valid("mail.allowlist", ["not an address"])).toBe(false);
    expect(valid("mail.allowlist", ["@nodot"])).toBe(false);
    expect(valid("mail.allowlist", "dev@example.com")).toBe(false);
  });

  it("checks the link limits and the forms' rate as whole numbers in range", () => {
    expect(APP_SETTINGS["invites.linkDefaultDays"].default).toBe(7);
    expect(APP_SETTINGS["invites.linkMaxDays"].default).toBe(90);
    expect(APP_SETTINGS["invites.linkMaxUses"].default).toBe(100);
    expect(APP_SETTINGS["publicForms.perMinute"].default).toBe(10);
    expect(valid("invites.linkMaxDays", 1)).toBe(true);
    expect(valid("invites.linkMaxDays", 0)).toBe(false);
    expect(valid("invites.linkMaxDays", 91)).toBe(false);
    expect(valid("invites.linkDefaultDays", 2.5)).toBe(false);
    expect(valid("invites.linkMaxUses", 101)).toBe(false);
    expect(valid("publicForms.perMinute", 1000)).toBe(true);
    expect(valid("publicForms.perMinute", "10")).toBe(false);
  });

  it("knows its keys", () => {
    expect(isAppSettingKey("signup.accessCodes")).toBe(true);
    expect(isAppSettingKey("toString")).toBe(false);
    expect(isAppSettingKey(1)).toBe(false);
  });

  it("uses the default for a missing or no-longer-valid stored value", () => {
    expect(storedOrDefault("invites.linkMaxDays", undefined)).toBe(90);
    expect(storedOrDefault("invites.linkMaxDays", 30)).toBe(30);
    expect(storedOrDefault("invites.linkMaxDays", "thirty")).toBe(90);
  });

  it("never lets the default days pass the longest", () => {
    expect(linkLimits({ defaultDays: 14, maxDays: 10, maxUses: 3 })).toEqual({
      defaultDays: 10,
      maxDays: 10,
      maxUses: 3,
    });
  });
});
