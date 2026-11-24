import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";
import type { CalendarSettings } from "~/lib/calendars/calendarSettings";

import { DETAILS_CONSENT_TEXT, DETAILS_CONSENT_VERSION } from "@caretook/data/schema";
import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { forgetCalendarSettings } from "~/lib/calendars/calendarSettings";
import * as calendar from "./calendar/route";
import * as details from "./details/route";
import * as settingsLayout from "./layout/route";
import { apiCalls, refusal } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { found } from "../../../../../test/found";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";

// Calendar & reminders (calendars, appointments-2 slice 4): each member's own
// page, viewers included, with its four cards in order; the details consent
// on and off; the owners keeping details private (on the device, live);
// offline, and a change made then sent once the connection is back. Then
// the owners' switch on group settings → Details. The server is the test's
// stand-ins for `calendars.*`; what it decides is in the integration tests.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  {
    path: BASE,
    module: settingsLayout,
    children: [
      { path: `${BASE}/calendar`, module: calendar },
      { path: `${BASE}/details`, module: details },
    ],
  },
];
const CALENDAR = `/app/groups/${TEST_GROUP.id}/settings/calendar`;
const DETAILS = `/app/groups/${TEST_GROUP.id}/settings/details`;
const AGREED = "2026-11-18T18:00:00.000Z";
const AGREE = { detailsConsent: true, detailsConsentVersion: DETAILS_CONSENT_VERSION };

const defaults = (role: GroupRole, v: Partial<CalendarSettings> = {}): CalendarSettings => ({
  groupId: TEST_GROUP.id,
  role,
  remindersOn: false,
  reminderLeads: ["eveningBefore", 60],
  detailsConsent: false,
  detailsConsentAt: null,
  detailsConsentVersion: null,
  detailsConsentStale: false,
  groupAllowsDetails: true,
  shareLevel: "generic",
  feed: { active: false, rotatedAt: null },
  ...v,
});

/** The server's side: the member's settings, whether it answers, and what it was asked. */
const calendarServer = (role: GroupRole, v: Partial<CalendarSettings> = {}) => {
  const calls = apiCalls();
  const server: {
    settings: CalendarSettings;
    online: boolean;
    /** The server has a newer wording than this device showed. */
    newerWording: boolean;
    calls: typeof calls;
    api: Record<string, (input: unknown) => unknown>;
  } = {
    settings: defaults(role, v),
    online: true,
    newerWording: false,
    calls,
    api: calls.record({
      "calendars.settings.get": () => {
        if (!server.online) throw new TypeError("Failed to fetch (offline)");
        return server.settings;
      },
      "calendars.settings.update": (input) => {
        if (!server.online) throw new TypeError("Failed to fetch (offline)");
        const { detailsConsent } = input as { detailsConsent?: boolean };
        if (detailsConsent && !server.settings.groupAllowsDetails)
          return refusal("calendarSettingService:detailsForbidden");
        if (detailsConsent && server.newerWording) return refusal("calendarSettingService:consentOutdated");
        if (detailsConsent !== undefined)
          server.settings = {
            ...server.settings,
            detailsConsent,
            detailsConsentAt: detailsConsent ? AGREED : null,
            detailsConsentVersion: detailsConsent ? "2026-11-20" : null,
            shareLevel: detailsConsent ? "details" : "generic",
          };
        return server.settings;
      },
      "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
      "calendars.group.setDetailsAllowed": (input) => {
        const { allowed } = input as { allowed: boolean };
        return { groupId: TEST_GROUP.id, detailsOutsideAllowed: allowed };
      },
    }),
  };
  return server;
};

const open = ({
  url = CALENDAR,
  role = "caretaker",
  api,
  allowed = true,
  width,
}: {
  url?: string;
  role?: GroupRole;
  api?: Record<string, (input: unknown) => unknown>;
  allowed?: boolean;
  width?: number;
}) =>
  renderWithDevice({
    route: ROUTES,
    url,
    role,
    width,
    fixtures: [fx.group({ detailsOutsideAllowed: allowed ? 1 : 0 })],
    api,
  });

const consent = () => page.getByRole("switch", { name: "Include titles, places and providers" });
const cardHeadings = () =>
  [...document.querySelectorAll("main section.card h2")].map((h) => h.textContent.trim());
const section = (id: string) => document.querySelector(`main [data-section="${id}"]`);

beforeEach(() => forgetCalendarSettings());

describe("Calendar & reminders", () => {
  test("is listed in group settings for a viewer, with four cards in order", async () => {
    await open({ role: "viewer", api: calendarServer("viewer").api, width: 1024 });
    await expect.element(page.getByRole("heading", { name: "Calendar & reminders", level: 1 })).toBeVisible();
    const links = [...document.querySelectorAll("nav[data-settings-nav] a")].map((a) => a.textContent.trim());
    expect(links.at(-1)).toMatch(/^Calendar & reminders/);
    await found(() => section("details-outside")?.querySelector("input"));
    expect(cardHeadings()).toEqual([
      "Reminders",
      "Calendar feed",
      "Google Calendar",
      "Details outside Caretook",
    ]);
  });

  test("says what leaves by default, with the consent's wording on the switch", async () => {
    await open({ api: calendarServer("caretaker").api });
    await expect.element(consent()).not.toBeChecked();
    expect((await found(() => section("details-outside"))).textContent).toContain(
      `say only "Event for Grandma June", the time and a link back`,
    );
    const describedBy = consent().element().getAttribute("aria-describedby")!;
    expect((await found(() => document.getElementById(describedBy))).textContent).toMatch(
      /Notes never leave Caretook\./,
    );
  });

  test("a writer turns details on, and sees when they agreed", async () => {
    const server = calendarServer("caretaker");
    await open({ api: server.api });
    await userEvent.click(consent());
    await expect
      .poll(() => server.calls.of("calendars.settings.update"))
      .toEqual([{ groupId: TEST_GROUP.id, ...AGREE }]);
    await expect.element(consent()).toBeChecked();
    await expect.element(page.getByText("Saved.")).toBeVisible();
    await expect.element(page.getByText(/^You agreed on 18 Nov 2026\.$/)).toBeVisible();
  });

  test("a viewer turns their own details off", async () => {
    const server = calendarServer("viewer", {
      detailsConsent: true,
      detailsConsentAt: AGREED,
      shareLevel: "details",
    });
    await open({ role: "viewer", api: server.api });
    await expect.element(consent()).toBeChecked();
    await userEvent.click(consent());
    await expect
      .poll(() => server.calls.of("calendars.settings.update"))
      .toEqual([{ groupId: TEST_GROUP.id, detailsConsent: false }]);
    await expect.element(consent()).not.toBeChecked();
    expect(document.querySelector("[data-details-agreed]")).toBeNull();
  });

  test("the owners keeping details private disables the switch, and allowing them again enables it", async () => {
    const server = calendarServer("caretaker", {
      detailsConsent: true,
      detailsConsentAt: AGREED,
      groupAllowsDetails: false,
    });
    const device = await open({ api: server.api, allowed: false });
    await expect.element(consent()).toBeDisabled();
    await expect.element(consent()).not.toBeChecked();
    await expect.element(page.getByText("Your group's owners keep details private.")).toBeVisible();

    // An owner allows details again: the device's copy says so, live.
    await device.sync([fx.group({ detailsOutsideAllowed: 1 })]);
    await device.settle();
    await expect.element(consent()).toBeEnabled();
    await expect.element(consent()).toBeChecked();
    expect(document.querySelector("[data-details-forbidden]")).toBeNull();
  });

  test("a refused change shows the server's reason and what's saved", async () => {
    const server = calendarServer("caretaker", { groupAllowsDetails: false });
    // The device hasn't heard yet that the owners forbade details.
    await open({ api: server.api, allowed: true });
    await userEvent.click(consent());
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Your group's owners keep details private");
    await expect.element(consent()).not.toBeChecked();
  });

  test("a consent refused for a newer wording offers a reload and records nothing (B-717)", async () => {
    const server = calendarServer("caretaker");
    server.newerWording = true;
    await open({ api: server.api });
    await userEvent.click(consent());
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("The wording of this consent has changed. Reload Caretook to read the new wording");
    await expect.element(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect.element(consent()).not.toBeChecked();
    expect(server.settings.detailsConsent).toBe(false);
    expect(server.settings.detailsConsentAt).toBeNull();
  });

  test("another refusal offers no reload (B-717)", async () => {
    const server = calendarServer("caretaker", { groupAllowsDetails: false });
    await open({ api: server.api, allowed: true });
    await userEvent.click(consent());
    await expect.element(page.getByRole("alert")).toBeVisible();
    expect(page.getByRole("button", { name: "Reload" }).query()).toBeNull();
  });

  test("offline with nothing on the device: it needs a connection", async () => {
    await open({});
    await expect.element(page.getByText(/Needs a connection to load these settings/)).toBeVisible();
    await expect.element(page.getByText("Needs a connection to show your choice.")).toBeVisible();
    expect(document.querySelector("[data-details-consent]")).toBeNull();
  });

  test("a change made offline is kept on the device and sent once the connection is back", async () => {
    const server = calendarServer("caretaker");
    await open({ api: server.api });
    await expect.element(consent()).not.toBeChecked();

    server.online = false;
    await userEvent.click(consent());
    await expect
      .element(page.getByText("Saved on this device. It's sent when you're back online."))
      .toBeVisible();
    await expect.element(consent()).toBeChecked();
    expect(server.settings.detailsConsent).toBe(false);

    server.online = true;
    window.dispatchEvent(new Event("online"));
    await expect.poll(() => server.settings.detailsConsent).toBe(true);
    await expect.element(page.getByText(/^You agreed on 18 Nov 2026\.$/)).toBeVisible();
    await expect.element(consent()).toBeChecked();
  });

  test("loaded offline, it shows this device's copy, and sends a change made then when back online", async () => {
    const server = calendarServer("caretaker");
    // An earlier visit cached the settings.
    localStorage.setItem(
      `caretook:calendar:${TEST_USER.id}:${TEST_GROUP.id}`,
      JSON.stringify(defaults("caretaker")),
    );
    server.online = false;
    await open({ api: server.api });
    await expect.element(page.getByText(/Needs a connection to load these settings/)).toBeVisible();
    await expect.element(consent()).not.toBeChecked();

    await userEvent.click(consent());
    await expect
      .element(page.getByText("Saved on this device. It's sent when you're back online."))
      .toBeVisible();

    server.online = true;
    window.dispatchEvent(new Event("online"));
    await expect
      .poll(() => server.calls.of("calendars.settings.update").at(-1))
      .toEqual({ groupId: TEST_GROUP.id, ...AGREE });
    await expect.poll(() => document.querySelector("[data-needs-connection]")).toBeNull();
    await expect.element(consent()).toBeChecked();
  });

  const expectOffWithCurrentWording = async () => {
    await expect.poll(() => document.querySelector("[data-needs-connection]")).toBeNull();
    await expect.element(consent()).not.toBeChecked();
    await expect.element(consent()).toBeEnabled();
    const describedBy = consent().element().getAttribute("aria-describedby")!;
    expect((await found(() => document.getElementById(describedBy))).textContent).toContain(
      DETAILS_CONSENT_TEXT,
    );
    expect(document.querySelector("[data-details-agreed]")).toBeNull();
  };

  test("a consent queued for an older wording is dropped: off, with the current wording (B-659)", async () => {
    const server = calendarServer("caretaker");
    const key = `${TEST_USER.id}:${TEST_GROUP.id}`;
    localStorage.setItem(`caretook:calendar:${key}`, JSON.stringify(defaults("caretaker")));
    localStorage.setItem(
      `caretook:calendar-pending:${key}`,
      JSON.stringify({ detailsConsent: true, detailsConsentVersion: "2020-01-01" }),
    );
    await open({ api: server.api });
    await expectOffWithCurrentWording();
    expect(server.calls.of("calendars.settings.update")).toEqual([]);
    expect(server.settings.detailsConsent).toBe(false);

    // Agreeing again records it.
    await userEvent.click(consent());
    await expect
      .poll(() => server.calls.of("calendars.settings.update"))
      .toEqual([{ groupId: TEST_GROUP.id, ...AGREE }]);
    await expect.element(consent()).toBeChecked();
  });

  test("a replay the server refuses for a newer wording leaves the switch off (B-659)", async () => {
    const server = calendarServer("caretaker");
    const key = `${TEST_USER.id}:${TEST_GROUP.id}`;
    server.newerWording = true;
    localStorage.setItem(`caretook:calendar:${key}`, JSON.stringify(defaults("caretaker")));
    localStorage.setItem(`caretook:calendar-pending:${key}`, JSON.stringify(AGREE));
    await open({ api: server.api });
    await expect
      .poll(() => server.calls.of("calendars.settings.update"))
      .toEqual([{ groupId: TEST_GROUP.id, ...AGREE }]);
    await expectOffWithCurrentWording();
    expect(server.settings.detailsConsent).toBe(false);
    expect(localStorage.getItem(`caretook:calendar-pending:${key}`)).toBeNull();
  });
});

describe("group settings → Details: the owners' switch", () => {
  const allowedSwitch = () => page.getByRole("switch", { name: "Let members include details" });

  test("an owner keeps details private for everyone, and allows them again", async () => {
    const server = calendarServer("owner");
    const device = await open({ url: DETAILS, role: "owner", api: server.api });
    await expect.element(allowedSwitch()).toBeChecked();
    await userEvent.click(allowedSwitch());
    await expect
      .poll(() => server.calls.of("calendars.group.setDetailsAllowed"))
      .toEqual([{ groupId: TEST_GROUP.id, allowed: false }]);
    await device.sync([fx.group({ detailsOutsideAllowed: 0 })]);
    await device.settle();
    await expect.element(allowedSwitch()).not.toBeChecked();

    await userEvent.click(allowedSwitch());
    await expect
      .poll(() => server.calls.of("calendars.group.setDetailsAllowed").at(-1))
      .toEqual({ groupId: TEST_GROUP.id, allowed: true });
  });

  test("offline, an owner sees where it stands", async () => {
    await open({ url: DETAILS, role: "owner", allowed: false });
    await expect.element(page.getByText("Details stay private for everyone.")).toBeVisible();
    expect(document.querySelector("[data-details-allowed]")).toBeNull();
  });

  test.each(["admin", "caretaker", "viewer"] as const)("a %s doesn't get it", async (role) => {
    await open({ url: DETAILS, role, api: calendarServer(role).api });
    await expect.element(page.getByRole("heading", { name: "Details", level: 1 })).toBeVisible();
    await found(() => section("care-recipient"));
    expect(section("details-outside-allowed")).toBeNull();
  });
});
