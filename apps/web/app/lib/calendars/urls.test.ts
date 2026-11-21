import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

describe("calendar URLs", () => {
  it("puts Calendar & reminders under the group's settings", () => {
    expect(appUrls.calendarSettings("g 1")).toBe("/app/groups/g%201/settings/calendar");
  });
});
