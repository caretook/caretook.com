import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";
import type { CalendarChange, CalendarSettings } from "~/lib/calendars/calendarSettings";

import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { forgetCalendarSettings, withChange } from "~/lib/calendars/calendarSettings";
import * as calendar from "./calendar/route";
import * as settingsLayout from "./layout/route";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { found } from "../../../../../test/found";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";

// The Reminders card on Calendar & reminders (calendars, appointments-2
// slice 6): turning reminder emails on, picking up to three lead times, the
// note on todos, a viewer's own, and offline with nothing on the device. The
// server is the test's stand-in for `calendars.settings.*`; what it decides
// (and what the sweep sends) is in the integration tests.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/calendar`, module: calendar }] },
];
const CALENDAR = `/app/groups/${TEST_GROUP.id}/settings/calendar`;

const defaults = (role: GroupRole, v: Partial<CalendarSettings> = {}): CalendarSettings => ({
  groupId: TEST_GROUP.id,
  role,
  remindersOn: false,
  reminderLeads: ["eveningBefore", 60],
  detailsConsent: false,
  detailsConsentAt: null,
  detailsConsentVersion: null,
  groupAllowsDetails: true,
  shareLevel: "generic",
  feed: { active: false, rotatedAt: null },
  ...v,
});

const calendarServer = (role: GroupRole, v: Partial<CalendarSettings> = {}) => {
  const calls = apiCalls();
  const server: {
    settings: CalendarSettings;
    calls: typeof calls;
    api: Record<string, (input: unknown) => unknown>;
  } = {
    settings: defaults(role, v),
    calls,
    api: calls.record({
      "calendars.settings.get": () => server.settings,
      "calendars.settings.update": (input) => {
        const { groupId: _groupId, ...change } = input as CalendarChange & { groupId: string };
        server.settings = withChange(server.settings, change);
        return server.settings;
      },
      "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
    }),
  };
  return server;
};

const open = ({
  role = "caretaker",
  api,
}: {
  role?: GroupRole;
  api?: Record<string, (input: unknown) => unknown>;
}) => renderWithDevice({ route: ROUTES, url: CALENDAR, role, fixtures: [fx.group()], api });

const card = () => document.querySelector<HTMLElement>('main [data-section="reminders"]');
const onSwitch = () => page.getByRole("checkbox", { name: "Email me reminders" });
const lead = (name: string) => page.getByRole("checkbox", { name, exact: true });
const updates = (server: ReturnType<typeof calendarServer>) => server.calls.of("calendars.settings.update");

beforeEach(() => forgetCalendarSettings());

describe("the Reminders card", () => {
  test("a caretaker turns reminders on, with the evening before and 1 h before picked", async () => {
    const server = calendarServer("caretaker");
    await open({ api: server.api });
    await expect.element(onSwitch()).not.toBeChecked();
    await expect.poll(() => card()?.querySelector("[data-reminder-leads]")).toBeNull();
    await expect
      .element(page.getByText(/Todos assigned to you remind you the morning they're due/))
      .toBeVisible();

    await userEvent.click(onSwitch());
    await expect.poll(() => updates(server)).toEqual([{ groupId: TEST_GROUP.id, remindersOn: true }]);
    await expect.element(onSwitch()).toBeChecked();
    await expect.element(lead("The evening before, at 18:00")).toBeChecked();
    await expect.element(lead("1 h before")).toBeChecked();
    for (const name of ["The morning of, at 7:00", "2 h before", "30 min before"]) {
      await expect.element(lead(name)).not.toBeChecked();
    }
    await expect.element(page.getByText("Saved.")).toBeVisible();
  });

  test("picks up to three lead times, holding the others back at three", async () => {
    const server = calendarServer("caretaker", { remindersOn: true });
    await open({ api: server.api });
    await expect.element(lead("30 min before")).toBeEnabled();

    await userEvent.click(lead("30 min before"));
    await expect
      .poll(() => updates(server))
      .toEqual([{ groupId: TEST_GROUP.id, reminderLeads: ["eveningBefore", 60, 30] }]);
    await expect.element(lead("30 min before")).toBeChecked();
    await expect.element(lead("The morning of, at 7:00")).toBeDisabled();
    await expect.element(lead("2 h before")).toBeDisabled();
    await expect.element(page.getByText("Pick up to 3.")).toBeVisible();

    // Dropping one frees the others.
    await userEvent.click(lead("The evening before, at 18:00"));
    await expect
      .poll(() => updates(server).at(-1))
      .toEqual({ groupId: TEST_GROUP.id, reminderLeads: [60, 30] });
    await expect.element(lead("The morning of, at 7:00")).toBeEnabled();
    await expect.element(lead("2 h before")).toBeEnabled();
  });

  test("a viewer sets their own reminders", async () => {
    const server = calendarServer("viewer", { remindersOn: true, reminderLeads: ["morningOf"] });
    await open({ role: "viewer", api: server.api });
    await expect.element(onSwitch()).toBeChecked();
    await expect.element(lead("The morning of, at 7:00")).toBeChecked();

    await userEvent.click(onSwitch());
    await expect.poll(() => updates(server)).toEqual([{ groupId: TEST_GROUP.id, remindersOn: false }]);
    await expect.element(onSwitch()).not.toBeChecked();
    await expect.poll(() => card()?.querySelector("[data-reminder-leads]")).toBeNull();
  });

  test("offline with nothing on the device, it needs a connection", async () => {
    await open({});
    await found(() => card()?.querySelector("[data-reminders-unknown]"));
    await expect.poll(() => card()?.textContent).toContain("Needs a connection to show your reminders.");
    await expect.poll(() => card()?.querySelector("[data-reminders-on]")).toBeNull();
  });
});
