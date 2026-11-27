import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";
import type { GoogleStatus } from "./calendar/useGoogleStatus";

import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { forgetCalendarSettings } from "~/lib/calendars/calendarSettings";
import { syncedText } from "./calendar/googleCardView";
import * as calendar from "./calendar/route";
import * as settingsLayout from "./layout/route";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { found } from "../../../../../test/found";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";

// The Google Calendar card on Calendar & reminders (calendars,
// appointments-2 slice 7): Connect (a link to the web-only Connect route),
// the connection's calendar and last sync, a refused token's Reconnect,
// Disconnect after a confirm, the callback's outcome, a viewer, and
// offline. The server is the test's stand-in for `calendars.*`; what it
// decides is in the integration tests. Its absence on the native target is
// `showsGoogleCard` (googleCardView.test.ts): the target is fixed at build.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/calendar`, module: calendar }] },
];
const CALENDAR = `/app/groups/${TEST_GROUP.id}/settings/calendar`;

const PUSHED_AT = "2026-11-18T17:05:00.000Z";
const CONNECTED: GoogleStatus = {
  connected: true,
  configured: true,
  calendarName: "Caretook: Grandma June",
  lastPushedAt: PUSHED_AT,
  lastPulledAt: null,
  error: null,
};

const googleServer = (role: GroupRole, google: GoogleStatus) => {
  const calls = apiCalls();
  const server: {
    google: GoogleStatus;
    online: boolean;
    calls: typeof calls;
    api: Record<string, (input: unknown) => unknown>;
  } = {
    google,
    online: true,
    calls,
    api: calls.record({
      "calendars.settings.get": () => {
        if (!server.online) throw new TypeError("Failed to fetch (offline)");
        return {
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
        };
      },
      "calendars.google.status": () => {
        if (!server.online) throw new TypeError("Failed to fetch (offline)");
        return server.google;
      },
      "calendars.google.disconnect": () => {
        server.google = { connected: false, configured: true };
        return { groupId: TEST_GROUP.id, connected: false };
      },
    }),
  };
  return server;
};

const open = ({
  url = CALENDAR,
  role = "caretaker",
  api,
}: {
  url?: string;
  role?: GroupRole;
  api?: Record<string, (input: unknown) => unknown>;
}) => renderWithDevice({ route: ROUTES, url, role, fixtures: [fx.group()], api });

const card = () => document.querySelector<HTMLElement>(`main [data-section="google-calendar"]`);
const disconnectButton = () => page.getByRole("button", { name: "Disconnect", exact: true }).first();

beforeEach(() => forgetCalendarSettings());

describe("the Google Calendar card", () => {
  test("offers Connect, a link to the web-only Connect route", async () => {
    await open({ api: googleServer("caretaker", { connected: false, configured: true }).api });
    const connect = page.getByRole("link", { name: "Connect Google Calendar" });
    await expect.element(connect).toBeVisible();
    expect(connect.element().getAttribute("href")).toBe(`/api/google/connect?groupId=${TEST_GROUP.id}`);
    await expect.poll(() => card()?.textContent).toContain("Your other calendars are never read or changed.");
  });

  test("says when Google isn't set up here", async () => {
    await open({ api: googleServer("caretaker", { connected: false, configured: false }).api });
    await expect.element(page.getByText("Google Calendar isn't set up here yet.")).toBeVisible();
    await expect.poll(() => card()?.querySelector("a")).toBeNull();
  });

  test("shows the connected calendar and when it last synced, to a viewer too", async () => {
    await open({ role: "viewer", api: googleServer("viewer", CONNECTED).api });
    await expect.element(page.getByText("Caretook: Grandma June")).toBeVisible();
    // In the viewer's zone (9:05 in Los Angeles, 12:05 in New York); the wording
    // itself is pinned in googleCardView.test.ts.
    const synced = syncedText(PUSHED_AT);
    await expect.element(page.getByText(`Last synced ${synced}.`)).toBeVisible();
    await expect.element(disconnectButton()).toBeVisible();
    await expect.poll(() => card()?.querySelector("[data-google-error]")).toBeNull();
  });

  test("after a refused token, says so and offers Reconnect Google", async () => {
    await open({ api: googleServer("caretaker", { ...CONNECTED, error: "revoked" }).api });
    const error = await found(() => card()?.querySelector("[data-google-error]"));
    expect(error.textContent).toContain("Google stopped Caretook's access");
    const reconnect = page.getByRole("link", { name: "Reconnect Google" });
    expect(reconnect.element().getAttribute("href")).toBe(`/api/google/connect?groupId=${TEST_GROUP.id}`);
  });

  test("disconnects after a confirm that the calendar stays in Google", async () => {
    const server = googleServer("caretaker", CONNECTED);
    await open({ api: server.api });
    await userEvent.click(disconnectButton());
    const dialog = await found(() => document.querySelector<HTMLDialogElement>("dialog[open]"));
    expect(dialog.textContent).toContain("Disconnect Google Calendar?");
    expect(dialog.textContent).toContain("The calendar stays in Google but stops updating.");

    // Cancel keeps it.
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
    expect(server.calls.of("calendars.google.disconnect")).toEqual([]);

    await userEvent.click(disconnectButton());
    await found(() => document.querySelector("dialog[open]"));
    await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "Disconnect" }));
    await expect
      .poll(() => server.calls.of("calendars.google.disconnect"))
      .toEqual([{ groupId: TEST_GROUP.id }]);
    await expect.element(page.getByRole("link", { name: "Connect Google Calendar" })).toBeVisible();
  });

  test("says how Connect went when Google sends the member back", async () => {
    await open({ url: `${CALENDAR}?google=connected`, api: googleServer("caretaker", CONNECTED).api });
    await expect.element(page.getByText(/^Google Calendar is connected\./)).toBeVisible();
  });

  test("says when the sign-in at Google expired", async () => {
    await open({
      url: `${CALENDAR}?google=expired`,
      api: googleServer("caretaker", { connected: false, configured: true }).api,
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("That Google sign-in expired. Try Connect again.");
  });

  test("needs a connection", async () => {
    const server = googleServer("caretaker", CONNECTED);
    server.online = false;
    await open({ api: server.api });
    await expect.element(page.getByText("Needs a connection to show Google Calendar.")).toBeVisible();
    await expect.poll(() => card()?.querySelector("button, a")).toBeNull();
  });
});
