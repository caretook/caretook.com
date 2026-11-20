import { appSettingSchema, appSettingService, getDb } from "@caretook/data";
import { afterEach, describe, expect, it } from "vitest";
import { createUser } from "../../data/test/fixtures";
import { createMemorySender, settingsAllowlist, withAllowlist } from "./senders";

// The email allowlist (admin slice 5): outside production, real email goes
// only to the `mail.allowlist` setting's addresses, else MAIL_ALLOWLIST's.

const message = {
  name: "testMessage",
  from: "f@example.com",
  subject: "s",
  html: "<p>h</p>",
  text: "t",
  idempotencyKey: "k",
};

afterEach(async () => {
  await getDb().delete(appSettingSchema);
  appSettingService.clearSettingsCache();
});

describe("the allowlist setting", () => {
  it("filters a non-production send by the setting, and by the environment's list when it's unset", async () => {
    const inner = createMemorySender();
    const sender = withAllowlist(inner, settingsAllowlist(["env@example.com"]));
    expect(await sender.send({ ...message, to: "env@example.com" })).toMatchObject({ status: "sent" });
    expect(await sender.send({ ...message, to: "tester@qa.example.com" })).toMatchObject({
      status: "skipped",
    });

    const admin = await createUser("allow-admin", "admin");
    await appSettingService.setSetting(admin.ctx, {
      key: "mail.allowlist",
      value: ["@QA.example.com"],
      reason: "Staging testers",
    });
    expect(await sender.send({ ...message, to: "tester@qa.example.com" })).toMatchObject({ status: "sent" });
    expect(await sender.send({ ...message, to: "env@example.com" })).toMatchObject({ status: "skipped" });
    expect(inner.sent.map((m) => m.to)).toEqual(["env@example.com", "tester@qa.example.com"]);
  });
});
