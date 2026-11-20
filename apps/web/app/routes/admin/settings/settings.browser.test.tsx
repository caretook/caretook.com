import type { AppSettingKey } from "@caretook/data/schema";
import type { SettingRow } from "./SettingCard";

import { APP_SETTING_KEYS, APP_SETTINGS } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { formString } from "~/lib/core/form";
import { page, userEvent } from "vitest/browser";
import { adminFx } from "../../../../test/adminFixtures";
import { openAdmin, postedForms } from "../adminWorld";
import * as settings from "./route";
import { settingFromForm } from "./settingForms";

// /admin/settings (admin.mjs steps 9 and 10's form, on loader data): a card
// per setting, admins' forms with a reason, the announcement's preview, and
// support's read-only view. What a change does on the server (validated,
// stored, audited once, `/join` refusing while access codes are off) is
// packages/api/src/settingsAdmin.int.test.ts and
// packages/data/src/services/appSetting.int.test.ts; the banner reaching /app
// is app-shell.mjs.

/** The settings page; a post is parsed as the server would and the next load shows it. */
const openSettings = async (staff: "admin" | "support" = "admin") => {
  const rows = new Map<AppSettingKey, SettingRow>(APP_SETTING_KEYS.map((key) => [key, adminFx.setting(key)]));
  const posted = postedForms((form) => {
    const key = formString(form, "key") as AppSettingKey;
    const parsed = settingFromForm(key, (name) => formString(form, name));
    if (!parsed.ok) return { ok: false, key, error: "Check the form and try again.", issues: parsed.issues };
    rows.set(key, adminFx.setting(key, { value: parsed.value }));
    return { ok: true, key, message: `${APP_SETTINGS[key].label} saved.` };
  });
  const device = await openAdmin({
    staff,
    routes: {
      path: "/admin/settings",
      module: settings,
      loaderData: () => ({ settings: [...rows.values()], canWrite: staff === "admin" }),
      actionResult: posted.actionResult,
    },
    url: "/admin/settings",
  });
  return { device, posts: posted.posts };
};

const card = (key: AppSettingKey) => page.getByRole("region", { name: APP_SETTINGS[key].label, exact: true });
const cardElement = (key: AppSettingKey) => document.querySelector(`[data-setting="${key}"]`)!;

describe("/admin/settings", () => {
  test("admin: every setting with its value and default, and a form for each", async () => {
    await openSettings();
    await expect.element(card("signup.accessCodes")).toBeVisible();
    expect(document.querySelectorAll("[data-setting]")).toHaveLength(APP_SETTING_KEYS.length);
    expect(document.querySelectorAll("[data-setting-form]")).toHaveLength(APP_SETTING_KEYS.length);
    expect(cardElement("signup.accessCodes").querySelector("[data-setting-value]")!.textContent).toBe("On");
    expect(cardElement("signup.accessCodes").textContent).toContain("(in use)");
  });

  test("admin: turning access-code sign-up off takes a reason, and the card shows it off", async () => {
    const { posts } = await openSettings();
    const accessCodes = card("signup.accessCodes");
    await userEvent.click(accessCodes.getByRole("radio", { name: "Off" }));
    await userEvent.fill(accessCodes.getByRole("textbox", { name: /^Reason/ }), "Pause sign-up");
    await userEvent.click(accessCodes.getByRole("button", { name: "Save" }));

    await expect.element(accessCodes.getByRole("status")).toHaveTextContent("Access-code sign-up saved.");
    expect(cardElement("signup.accessCodes").getAttribute("data-value")).toBe("false");
    expect(cardElement("signup.accessCodes").querySelector("[data-setting-value]")!.textContent).toBe("Off");
    expect(posts).toEqual([{ key: "signup.accessCodes", value: "off", reason: "Pause sign-up" }]);
  });

  test("admin: the announcement's preview follows the text and tone as typed, and saves them", async () => {
    const { posts } = await openSettings();
    const announcement = card("announcement");
    await expect.element(announcement.getByText("No banner: saving clears it.")).toBeVisible();
    await userEvent.fill(
      announcement.getByRole("textbox", { name: /^Text/ }),
      "Maintenance tonight from 22:00",
    );
    await userEvent.click(announcement.getByRole("radio", { name: "Warning" }));
    const preview = document.querySelector("[data-announcement-preview] [data-tone]")!;
    expect(preview.getAttribute("data-tone")).toBe("warning");
    expect(preview.textContent).toBe("Maintenance tonight from 22:00");
    // The preview has no Dismiss: that's the banner's in /app.
    expect(preview.querySelector("button")).toBeNull();

    await userEvent.fill(announcement.getByRole("textbox", { name: /^Reason/ }), "Maintenance notice");
    await userEvent.click(announcement.getByRole("button", { name: "Save" }));
    await expect.element(announcement.getByRole("status")).toHaveTextContent("Announcement saved.");
    expect(cardElement("announcement").querySelector("[data-setting-value]")!.textContent).toBe(
      "Warning: Maintenance tonight from 22:00",
    );
    expect(posts[0]).toMatchObject({
      key: "announcement",
      text: "Maintenance tonight from 22:00",
      tone: "warning",
    });
  });

  test("support: every setting, read-only", async () => {
    const { device } = await openSettings("support");
    await expect.element(device.screen.getByText("Only admins can change these.")).toBeVisible();
    expect(document.querySelectorAll("[data-setting]")).toHaveLength(APP_SETTING_KEYS.length);
    expect(document.querySelectorAll("[data-setting-form]")).toHaveLength(0);
  });
});
