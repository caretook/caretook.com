import type { CalendarSettings } from "~/lib/calendars/calendarSettings";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { apiCalls } from "../../../../../test/api";
import { found } from "../../../../../test/found";
import { TEST_GROUP } from "../../../../../test/fixtures";
import {
  CARDIOLOGY,
  DENTIST,
  entryUrl,
  fixClock,
  itemEl,
  menuItem,
  menuItems,
  openPlanner,
  REFILL,
} from "./plannerWorld";

// "Remind me" (appointments-2 slice 8): the ⋯ item before Print on Upcoming,
// the timeline and the entry page, for a writer and a viewer; the sheet for
// each choice and the line that says what will be sent; offline. The server
// is the test's stand-in for `calendars.overrides.*`; what it decides (own
// only, the sweep) is overrides.int.test.ts's. Clock: Wed 2026-11-18, 10:00 AM.

const ACTIONS = 'button[aria-label^="Actions for"]';
const ENTRY_MENU = 'main header [data-region="actions"] button[aria-label^="Actions for"]';
const SHEET = () => document.querySelector<HTMLFormElement>("[data-remind-sheet]");
const SUMMARY = () => document.querySelector<HTMLElement>("[data-remind-summary]")?.textContent ?? "";

type Choice = { mode: "default" } | { mode: "mute" } | { mode: "extra"; leads: (string | number)[] };

const settings = (v: Partial<CalendarSettings> = {}): CalendarSettings => ({
  groupId: TEST_GROUP.id,
  role: "caretaker",
  remindersOn: true,
  reminderLeads: ["eveningBefore", 60],
  detailsConsent: false,
  detailsConsentAt: null,
  detailsConsentVersion: null,
  groupAllowsDetails: true,
  shareLevel: "generic",
  feed: { active: false, rotatedAt: null },
  ...v,
});

const server = (start: Choice = { mode: "default" }, mine: Partial<CalendarSettings> = {}) => {
  const calls = apiCalls();
  const s: {
    choice: Choice;
    online: boolean;
    calls: typeof calls;
    api: Record<string, (input: unknown) => unknown>;
  } = {
    choice: start,
    online: true,
    calls,
    api: calls.record({
      "calendars.settings.get": () => {
        if (!s.online) throw new TypeError("Failed to fetch (offline)");
        return settings(mine);
      },
      "calendars.overrides.get": () => {
        if (!s.online) throw new TypeError("Failed to fetch (offline)");
        return s.choice;
      },
      "calendars.overrides.set": (input) => {
        if (!s.online) throw new TypeError("Failed to fetch (offline)");
        s.choice = (input as { choice: Choice }).choice;
        return s.choice;
      },
    }),
  };
  return s;
};

const openMenu = async (button: Element | null | undefined) => {
  await userEvent.click(button!);
  await expect.poll(() => menuItems().length).toBeGreaterThan(0);
};
const rowMenu = async (id: string) => openMenu(await found(() => itemEl(id)?.querySelector(ACTIONS) ?? null));
const openSheet = async (id = CARDIOLOGY.id) => {
  await rowMenu(id);
  await userEvent.click(menuItem("Remind me")!);
  await found(() => document.querySelector("[data-remind-sheet], [data-remind-offline]"));
};
const radio = (name: string) => page.getByRole("radio", { name });

beforeEach(() => fixClock());
afterEach(() => vi.useRealTimers());

describe.each(["caretaker", "viewer"] as const)("Remind me, a %s", (role) => {
  test("is in the menu before Print, for an upcoming appointment or reminder only", async () => {
    await openPlanner({ role, api: server().api });
    await rowMenu(CARDIOLOGY.id);
    const items = menuItems();
    expect(items).toContain("Remind me");
    expect(items.indexOf("Remind me")).toBe(items.indexOf("Print") - 1);
    await userEvent.keyboard("{Escape}");
    await rowMenu(REFILL.id);
    expect(menuItems()).toContain("Remind me");
  });

  test("shows the member's settings on Use my settings, and saves a mute", async () => {
    const s = server({ mode: "default" });
    await openPlanner({ role, api: s.api });
    await openSheet();
    await expect.element(radio("Use my settings")).toBeChecked();
    expect(SUMMARY()).toBe("Email: The evening before, at 18:00 · 1 h before");

    await userEvent.click(radio("No reminders for this one"));
    expect(SUMMARY()).toBe("No reminders for this one.");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect
      .poll(() => s.calls.of("calendars.overrides.set"))
      .toEqual([{ groupId: TEST_GROUP.id, entryId: CARDIOLOGY.id, choice: { mode: "mute" } }]);
    await expect.poll(SHEET).toBeNull();
  });

  test("Also remind me adds leads to the settings (up to three) and saves them", async () => {
    const s = server();
    await openPlanner({ role, api: s.api });
    await openSheet();
    await userEvent.click(radio("Also remind me"));
    expect(document.querySelector("[data-remind-leads]")).not.toBeNull();
    await expect.element(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.click(page.getByRole("checkbox", { name: "30 min before" }));
    expect(SUMMARY()).toBe("Email: The evening before, at 18:00 · 1 h before · 30 min before");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect
      .poll(() => s.calls.of("calendars.overrides.set"))
      .toEqual([{ groupId: TEST_GROUP.id, entryId: CARDIOLOGY.id, choice: { mode: "extra", leads: [30] } }]);
  });

  test("opens on a saved choice, and Use my settings clears it", async () => {
    const s = server({ mode: "extra", leads: [120] });
    await openPlanner({ role, api: s.api });
    await openSheet();
    await expect.element(radio("Also remind me")).toBeChecked();
    await expect.element(page.getByRole("checkbox", { name: "2 h before" })).toBeChecked();
    await userEvent.click(radio("Use my settings"));
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect
      .poll(() => s.calls.of("calendars.overrides.set"))
      .toEqual([{ groupId: TEST_GROUP.id, entryId: CARDIOLOGY.id, choice: { mode: "default" } }]);
  });

  test("says reminders are off when the member's are", async () => {
    await openPlanner({ role, api: server({ mode: "default" }, { remindersOn: false }).api });
    await openSheet();
    expect(SUMMARY()).toContain("Your reminder emails are off");
  });

  test("offline, says it needs a connection", async () => {
    const s = server();
    s.online = false;
    await openPlanner({ role, api: s.api });
    await openSheet();
    await expect.element(page.getByText(/Needs a connection/)).toBeVisible();
    expect(SHEET()).toBeNull();
  });
});

describe("Remind me elsewhere", () => {
  test("is not offered for a cancelled appointment", async () => {
    await openPlanner({ api: server().api });
    await rowMenu(DENTIST.id);
    expect(menuItems()).not.toContain("Remind me");
  });

  test("is on the entry page's menu, before Print", async () => {
    await openPlanner({ url: entryUrl(CARDIOLOGY.id), api: server().api });
    await openMenu(await found(() => document.querySelector(ENTRY_MENU)));
    const items = menuItems();
    expect(items.indexOf("Remind me")).toBe(items.indexOf("Print") - 1);
  });
});
