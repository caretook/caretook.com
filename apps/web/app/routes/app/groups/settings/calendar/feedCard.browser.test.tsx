import type { DeviceRoute } from "../../../../../../test/device";
import type { GroupRole } from "../../../../../../test/fixtures";
import type { CalendarSettings } from "~/lib/calendars/calendarSettings";

import { beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { forgetCalendarSettings } from "~/lib/calendars/calendarSettings";
import * as settingsLayout from "../layout/route";
import * as calendar from "./route";
import { apiCalls, refusal } from "../../../../../../test/api";
import { renderWithDevice } from "../../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../../test/fixtures";
import { found } from "../../../../../../test/found";

// The Calendar feed card (calendars, appointments-2 slice 5): create, the
// link shown once with Copy and the Add to… links, regenerate behind a
// confirm, revoke; for a writer and a viewer; what it says at each share
// level; offline; a refused post. The server is the test's stand-in for
// `calendars.feed.*`; what it decides is in feed.int.test.ts.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/calendar`, module: calendar }] },
];
const CALENDAR = `/app/groups/${TEST_GROUP.id}/settings/calendar`;
const URL1 = "https://app.caretook.test/api/calendar/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.ics";
const URL2 = "https://app.caretook.test/api/calendar/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB.ics";
const MADE = "2026-11-18T18:00:00.000Z";

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

const feedServer = (role: GroupRole, v: Partial<CalendarSettings> = {}) => {
  const calls = apiCalls();
  const server: {
    settings: CalendarSettings;
    online: boolean;
    next: string[];
    refuse: boolean;
    calls: typeof calls;
    api: Record<string, (input: unknown) => unknown>;
  } = {
    settings: defaults(role, v),
    online: true,
    next: [URL1, URL2],
    refuse: false,
    calls,
    api: calls.record({
      "calendars.settings.get": () => {
        if (!server.online) throw new TypeError("Failed to fetch (offline)");
        return server.settings;
      },
      "calendars.feed.create": () => {
        if (server.refuse) return refusal("calendarFeedService:exists");
        server.settings = { ...server.settings, feed: { active: true, rotatedAt: MADE } };
        return { url: server.next.shift() };
      },
      "calendars.feed.rotate": () => {
        server.settings = { ...server.settings, feed: { active: true, rotatedAt: MADE } };
        return { url: server.next.shift() };
      },
      "calendars.feed.revoke": () => {
        server.settings = { ...server.settings, feed: { active: false, rotatedAt: null } };
        return { revoked: true };
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
  api?: Record<string, (i: unknown) => unknown>;
}) => renderWithDevice({ route: ROUTES, url: CALENDAR, role, fixtures: [fx.group()], api });

const feed = () => document.querySelector<HTMLElement>('main [data-section="calendar-feed"]')!;
const create = () => page.getByRole("button", { name: "Create calendar feed" });
const regenerate = () => page.getByRole("button", { name: "Regenerate" }).first();
const revoke = () => page.getByRole("button", { name: "Revoke" });
const linkField = () => page.getByRole("textbox", { name: "Your feed link" });
const linkHref = (name: string) => page.getByRole("link", { name }).element().getAttribute("href");

beforeEach(() => forgetCalendarSettings());

describe.each(["caretaker", "viewer"] as const)("Calendar feed card, a %s", (role) => {
  test("offers Create, and shows the link once with Copy and the Add to… links", async () => {
    const server = feedServer(role);
    await open({ role, api: server.api });
    await expect.element(create()).toBeVisible();
    expect(feed().textContent).toContain('It says only "Appointment for …"');

    await userEvent.click(create());
    await expect.poll(() => server.calls.of("calendars.feed.create")).toEqual([{ groupId: TEST_GROUP.id }]);
    await expect.element(linkField()).toHaveValue(URL1);
    await expect.element(page.getByText(/shown only now/)).toBeVisible();
    expect(linkHref("Add to Apple")).toBe(URL1.replace("https://", "webcal://"));
    expect(linkHref("Add to Google")).toBe(
      `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(URL1.replace("https://", "webcal://"))}`,
    );
    expect(linkHref("Add to Outlook")).toContain(
      `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(URL1)}`,
    );
    // The feed is on now, so Create is gone for Regenerate and Revoke.
    await expect.element(regenerate()).toBeVisible();
    expect(document.querySelector("[data-feed-create]")).toBeNull();
  });

  test("Copy puts the link on the clipboard", async () => {
    const written: string[] = [];
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      (text) => (written.push(text), Promise.resolve()),
    );
    const server = feedServer(role);
    await open({ role, api: server.api });
    await userEvent.click(create());
    await userEvent.click(page.getByRole("button", { name: "Copy link" }));
    await expect.element(page.getByText("Link copied.")).toBeVisible();
    expect(written).toEqual([URL1]);
  });

  test("a feed that's on but not just made says so, without the link", async () => {
    const server = feedServer(role, { feed: { active: true, rotatedAt: MADE } });
    await open({ role, api: server.api });
    await expect.element(page.getByText(/Your feed is on \(link made 18 Nov 2026\)/)).toBeVisible();
    expect(document.querySelector("[data-feed-link]")).toBeNull();
    expect(feed().querySelector("input")).toBeNull();
    await expect.element(regenerate()).toBeVisible();
    await expect.element(revoke()).toBeVisible();
    expect(document.querySelector("[data-feed-create]")).toBeNull();
  });

  test("Regenerate asks first, and the old link stops being shown", async () => {
    const server = feedServer(role);
    await open({ role, api: server.api });
    await userEvent.click(create());
    await expect.element(linkField()).toHaveValue(URL1);

    await userEvent.click(regenerate());
    const dialog = await found(() => document.querySelector<HTMLDialogElement>("dialog[open]"));
    expect(dialog.textContent).toContain("Regenerate the feed link?");
    expect(dialog.textContent).toContain("The old link stops working");
    // Cancel changes nothing.
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
    expect(server.calls.of("calendars.feed.rotate")).toEqual([]);
    await expect.element(linkField()).toHaveValue(URL1);

    await userEvent.click(regenerate());
    await found(() => document.querySelector("dialog[open]"));
    await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "Regenerate" }));
    await expect.poll(() => server.calls.of("calendars.feed.rotate")).toEqual([{ groupId: TEST_GROUP.id }]);
    await expect.element(linkField()).toHaveValue(URL2);
    expect(feed().textContent).not.toContain("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  });

  test("Revoke stops the feed and offers Create again", async () => {
    const server = feedServer(role, { feed: { active: true, rotatedAt: MADE } });
    await open({ role, api: server.api });
    await userEvent.click(revoke());
    await expect.poll(() => server.calls.of("calendars.feed.revoke")).toEqual([{ groupId: TEST_GROUP.id }]);
    await expect.element(create()).toBeVisible();
    expect(document.querySelector("[data-feed-active]")).toBeNull();
  });
});

describe("Calendar feed card", () => {
  test("says what the feed holds at the details level", async () => {
    const server = feedServer("caretaker", {
      detailsConsent: true,
      detailsConsentAt: MADE,
      shareLevel: "details",
    });
    await open({ api: server.api });
    await found(() => feed().querySelector("[data-feed-says]"));
    expect(feed().textContent).toContain("It includes titles, places and providers");
  });

  test("a refused post shows the reason and changes nothing", async () => {
    const server = feedServer("caretaker");
    server.refuse = true;
    await open({ api: server.api });
    await userEvent.click(create());
    const alert = await found(() => feed().querySelector('[role="alert"]'));
    expect(alert.textContent).toContain("You already have a calendar feed");
    expect(document.querySelector("[data-feed-link]")).toBeNull();
  });

  test("offline with nothing on the device it needs a connection", async () => {
    await open({});
    await expect.element(page.getByText("Needs a connection to show your feed.")).toBeVisible();
    expect(document.querySelector("[data-feed-create]")).toBeNull();
  });

  test("loaded offline from this device's copy, the buttons wait for a connection", async () => {
    const server = feedServer("caretaker", { feed: { active: true, rotatedAt: MADE } });
    localStorage.setItem(
      `caretook:calendar:${TEST_USER.id}:${TEST_GROUP.id}`,
      JSON.stringify(server.settings),
    );
    server.online = false;
    await open({ api: server.api });
    await expect.element(page.getByText(/Your feed is on/)).toBeVisible();
    await expect.element(regenerate()).toBeDisabled();
    await expect.element(revoke()).toBeDisabled();
  });
});
