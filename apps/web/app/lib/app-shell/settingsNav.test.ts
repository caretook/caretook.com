import type { SettingsItem } from "./settingsNav";

import { Settings } from "lucide-react";
import { describe, expect, it } from "vitest";
import { appUrls } from "./appUrls";
import { isSettingsList, settingsCurrent } from "./settingsNav";

const item = (id: "units" | "timeline" | "account"): SettingsItem => ({
  id,
  label: id,
  description: "",
  icon: Settings,
  path: appUrls.settings(id),
});
const units = item("units");
const timeline = item("timeline");

describe("settingsCurrent", () => {
  it('is "page" on the subpage itself, with or without a trailing slash', () => {
    expect(settingsCurrent(units, "/app/settings/units")).toBe("page");
    expect(settingsCurrent(units, "/app/settings/units/")).toBe("page");
  });
  it('is "true" on a page inside the subpage', () => {
    expect(settingsCurrent(units, "/app/settings/units/more")).toBe("true");
  });
  it("is undefined on the list, another subpage, or a path that only starts the same", () => {
    expect(settingsCurrent(units, "/app/settings")).toBeUndefined();
    expect(settingsCurrent(units, "/app/settings/timeline")).toBeUndefined();
    expect(settingsCurrent(timeline, "/app/settings/units")).toBeUndefined();
    expect(settingsCurrent(units, "/app/settings/unitsx")).toBeUndefined();
  });
});

describe("isSettingsList", () => {
  it("is true only on the list itself", () => {
    expect(isSettingsList("/app/settings", appUrls.settings())).toBe(true);
    expect(isSettingsList("/app/settings/", appUrls.settings())).toBe(true);
    expect(isSettingsList("/app/settings/units", appUrls.settings())).toBe(false);
    expect(isSettingsList("/app", appUrls.settings())).toBe(false);
  });
});
