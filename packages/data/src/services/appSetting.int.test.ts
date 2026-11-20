import { afterEach, describe, expect, it } from "vitest";
import { getDb, withTransaction } from "../db";
import { appSettingSchema } from "../db/schema";
import { appSettingModel } from "../models";
import { createUser } from "../../test/fixtures";
import * as appSettingService from "./appSettingService";

// The settings service (admin slice 5): defaults, the per-process cache and
// its expiry, and who may change what. The router's tests cover the
// consumers (settingsAdmin.int.test.ts in @caretook/api).

const reset = async () => {
  await getDb().delete(appSettingSchema);
  appSettingService.clearSettingsCache();
};
afterEach(reset);

/** Write a row behind the service's back (as another process would). */
const storeDirectly = (key: string, value: unknown) =>
  withTransaction((tx) => appSettingModel.put(tx, key, value, null));

describe("appSettingService", () => {
  it("gives every key its default until it's set", async () => {
    await reset();
    const settings = await appSettingService.getSettings();
    expect(settings).toMatchObject({
      "signup.accessCodes": true,
      "signup.linkInvites": true,
      "signup.emailInvites": true,
      announcement: null,
      "mail.allowlist": null,
      "invites.linkDefaultDays": 7,
      "invites.linkMaxDays": 90,
      "invites.linkMaxUses": 100,
      "publicForms.perMinute": 10,
    });
  });

  it("caches for 30 s, then reads the change", async () => {
    const start = Date.now();
    expect(await appSettingService.getSetting("signup.linkInvites", { now: start })).toBe(true);
    await storeDirectly("signup.linkInvites", false);
    // Another process changed it: this one still has its copy.
    expect(await appSettingService.getSetting("signup.linkInvites", { now: start + 29_000 })).toBe(true);
    expect(
      await appSettingService.getSetting("signup.linkInvites", {
        now: start + appSettingService.SETTINGS_CACHE_MS + 1,
      }),
    ).toBe(false);
  });

  it("clears its own cache on a change, and falls back to the default for a stored value that no longer fits", async () => {
    const admin = await createUser("svc-admin", "admin");
    expect(await appSettingService.getSetting("publicForms.perMinute")).toBe(10);
    const saved = await appSettingService.setSetting(admin.ctx, {
      key: "publicForms.perMinute",
      value: 20,
      reason: "Busy launch",
    });
    expect(saved).toEqual({ key: "publicForms.perMinute", value: 20, changed: true });
    expect(await appSettingService.getSetting("publicForms.perMinute")).toBe(20);

    await storeDirectly("publicForms.perMinute", "lots");
    appSettingService.clearSettingsCache();
    expect(await appSettingService.getSetting("publicForms.perMinute")).toBe(10);
  });

  it("lets admins change settings, support only read them, and members neither", async () => {
    const support = await createUser("svc-support", "support");
    const member = await createUser("svc-member");
    const change = { key: "signup.accessCodes", value: false, reason: "Pause" };
    expect(await appSettingService.setSetting(support.ctx, change)).toMatchObject({
      code: "staff:notAllowed",
    });
    expect(await appSettingService.setSetting(member.ctx, change)).toMatchObject({
      code: "staff:notAllowed",
    });
    expect(Array.isArray(await appSettingService.list(support.ctx))).toBe(true);
    expect(await appSettingService.list(member.ctx)).toMatchObject({ code: "staff:notAllowed" });
    expect(await appSettingService.signupRefusal("accessCodes")).toBeNull();
  });

  it("refuses an invalid value, saying where", async () => {
    const admin = await createUser("svc-admin-b", "admin");
    const res = await appSettingService.setSetting(admin.ctx, {
      key: "announcement",
      value: { text: "Maintenance tonight", tone: "loud" },
      reason: "Heads up",
    });
    expect(res).toMatchObject({ code: "settings:invalid", meta: { issues: [{ path: "tone" }] } });
  });
});
