import { appSettingSchema, appSettingService, getDb } from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { afterEach, describe, expect, it } from "vitest";
import { createUser } from "../../data/test/fixtures";
import { router } from ".";

// public.announcement (admin slice 6): the /app banner, open to anyone, null
// until staff post one and again once it ends; its id follows its tone and
// text, not its end time.

const anonymous = createRouterClient(router, { context: { authUser: null } });

afterEach(async () => {
  await getDb().delete(appSettingSchema);
  appSettingService.clearSettingsCache();
});

const post = async (value: unknown) => {
  const admin = await createUser("ann-admin", "admin");
  const api = createRouterClient(router, { context: { authUser: admin.ctx.authUser } });
  await api.admin.settings.set({ key: "announcement", value, reason: "Testing the banner" });
};

const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

describe("public.announcement", () => {
  it("is null until one is posted, then gives it to anyone signed out", async () => {
    expect(await anonymous.public.announcement()).toBeNull();
    await post({ text: "Maintenance tonight at 22:00", tone: "warning" });
    const shown = await anonymous.public.announcement();
    expect(shown).toMatchObject({ text: "Maintenance tonight at 22:00", tone: "warning", endsAt: null });
    expect(shown?.id).toMatch(/^[\w-]{16}$/);
  });

  it("keeps its id when only the end time changes, and gets a new one with new text", async () => {
    await post({ text: "Slow sync today", tone: "info" });
    const first = await anonymous.public.announcement();
    const endsAt = inAnHour();
    await post({ text: "Slow sync today", tone: "info", endsAt });
    const moved = await anonymous.public.announcement();
    expect(moved?.id).toBe(first?.id);
    expect(moved?.endsAt).toBe(endsAt);
    await post({ text: "Slow sync fixed", tone: "info" });
    expect((await anonymous.public.announcement())?.id).not.toBe(first?.id);
  });

  it("is null once its end time has passed, and once it's cleared", async () => {
    await post({ text: "Already over", tone: "info", endsAt: new Date(Date.now() - 1000).toISOString() });
    expect(await anonymous.public.announcement()).toBeNull();
    await post({ text: "Here for now", tone: "info" });
    expect(await anonymous.public.announcement()).not.toBeNull();
    await post(null);
    expect(await anonymous.public.announcement()).toBeNull();
  });
});
