import type { DeviceRoute } from "../../../../../test/device";
import type { Fixtures, GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as home from "~/routes/app/home/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import * as timelineSettings from "~/routes/app/settings/timeline/route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as newSheet from "./new/route";
import * as timeline from "./route";
import { TIMELINE_URL, waitUntil } from "./timelineWorld";

// Simple mode's lock, viewers and "Remove my last entry" (assistant slice
// 6), in the real /app frame on the test device: a locked member is kept to
// the timeline and their notes' and events' pages (by the group route, on
// navigation and when a lock syncs in), reaches account settings, sign-out
// and their other groups; a viewer gets the next appointment as text and no
// inputs; and you can remove your own entry from the last 30 minutes only.
// The route rule itself is lib/assistant/simpleModeLock.test.ts.

/** Stand-ins for group pages a lock closes, and the entry page it keeps. */
const probe = (name: string) => ({ default: () => <h1>{name}</h1> });

const GROUP = "/app/groups/:groupId";
const ROUTES: DeviceRoute[] = [
  {
    path: `${GROUP}/timeline`,
    module: timeline,
    children: [{ path: `${GROUP}/timeline/new/:kind`, module: newSheet }],
  },
  { path: `${GROUP}/entries/:entryId`, module: probe("Entry page") },
  { path: `${GROUP}/providers`, module: probe("Providers") },
  { path: `${GROUP}/settings/members`, module: probe("Members") },
  { path: "/app", id: "home", module: home },
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: "/app/settings/timeline", module: timelineSettings }],
  },
];
const base = `/app/groups/${TEST_GROUP.id}`;

/** Your membership, with a known id so another device's change replaces it. */
const MEMBERSHIP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a01";
const membership = (role: GroupRole, locked: number, simpleMode = locked) =>
  fx.member({ id: MEMBERSHIP, userId: TEST_USER.id, role, simpleMode, simpleModeLocked: locked });

const open = ({
  role = "caretaker",
  locked = 1,
  simpleMode,
  url = TIMELINE_URL,
  fixtures = [],
}: {
  role?: GroupRole;
  locked?: number;
  simpleMode?: number;
  url?: string;
  fixtures?: Fixtures;
} = {}) =>
  renderWithDevice({
    route: ROUTES,
    url,
    role: null,
    frame: true,
    fixtures: [membership(role, locked, simpleMode ?? locked), fixtures],
  });

const isSimple = () => !!document.querySelector("[data-simple-timeline]");
const userButton = () => page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
const menuItems = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((el) => el.textContent?.trim());
const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));

describe("a locked member", () => {
  test("is sent to the timeline from other group pages", async () => {
    const device = await open({ url: `${base}/providers` });
    await expect.poll(device.location).toBe(TIMELINE_URL);
    await waitUntil(isSimple, 4000, "the simple view");
    expect(page.getByRole("heading", { name: "Providers" }).elements()).toHaveLength(0);
  });

  test("keeps their notes' and events' pages, in the reduced header", async () => {
    const note = fx.note({ text: "Lunch went well" });
    const device = await open({ url: `${base}/entries/${note.id}`, fixtures: [note] });
    await expect.element(page.getByRole("heading", { name: "Entry page" })).toBeVisible();
    expect(device.location()).toBe(`${base}/entries/${note.id}`);
    // No group menu, sections, search or tab bar to wander off through.
    expect(page.getByRole("button", { name: /switch care group$/ }).elements()).toHaveLength(0);
    expect(document.querySelector('body header [data-region="search"]')).toBeNull();
  });

  test("is sent to the timeline when a lock syncs in while they're elsewhere", async () => {
    const device = await open({ locked: 0, url: `${base}/settings/members` });
    await expect.element(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await device.sync(membership("caretaker", 1));
    await expect.poll(device.location).toBe(TIMELINE_URL);
    await waitUntil(isSimple, 4000, "the simple view");
  });

  test("reaches account settings from the user menu", async () => {
    const device = await open();
    await waitUntil(isSimple, 4000, "the simple view");
    await userEvent.click(userButton());
    await expect.poll(menuItems).toEqual(["Settings", "Sign out"]);
    await userEvent.click(page.getByRole("menuitem", { name: "Settings" }));
    await expect.poll(device.location).toMatch(/^\/app\/settings/);
  });

  test("with several groups, chooses one from /app's list", async () => {
    const OTHER = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7b02";
    const device = await open({
      fixtures: [
        fx.group({ id: OTHER, name: "Okafor Family" }),
        fx.recipient({
          id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c02",
          groupId: OTHER,
          name: "Lou Okafor",
          preferredName: null,
        }),
        fx.member({ userId: TEST_USER.id, groupId: OTHER, role: "caretaker" }),
      ],
    });
    await waitUntil(isSimple, 4000, "the simple view");
    await userEvent.click(userButton());
    await expect.poll(menuItems).toEqual(["Settings", "Your care groups", "Sign out"]);
    await userEvent.click(page.getByRole("menuitem", { name: "Your care groups" }));
    await expect.poll(device.location).toBe("/app?groups=1");
    await expect.element(page.getByRole("heading", { name: "Your care groups" })).toBeVisible();
    await userEvent.click(page.getByRole("link", { name: /Lou Okafor/ }));
    await expect.poll(device.location).toBe(`/app/groups/${OTHER}/timeline`);
  });
});

describe("a viewer in simple mode", () => {
  test("gets the bigger rows and the next appointment as text, and no box, tiles or removing", async () => {
    const visit = fx.event({
      title: "Visit with Dr. Lark",
      occurredAt: at(new Date(Date.now() + 26 * 3_600_000)),
    });
    await open({
      role: "viewer",
      locked: 0,
      simpleMode: 1,
      fixtures: [
        visit,
        fx.symptom({ name: "Sore knee", occurredAt: minutesAgo(5), createdAt: minutesAgo(5) }),
      ],
    });
    await waitUntil(isSimple, 4000, "the simple view");
    await waitUntil(() => !!document.querySelector("[data-simple-next]"), 4000, "the next appointment");
    expect(document.querySelector("[data-simple-next]")!.textContent).toMatch(
      /^Next: Visit with Dr\. Lark · /,
    );
    await waitUntil(
      () => document.querySelectorAll("[data-simple-list] ol > li").length === 1,
      4000,
      "the rows",
    );
    expect(page.getByRole("textbox", { name: "What happened?" }).elements()).toHaveLength(0);
    expect(document.querySelector("[data-simple-tiles]")).toBeNull();
    expect(page.getByRole("button", { name: "Remove my last entry" }).elements()).toHaveLength(0);
  });
});

describe("Remove my last entry", () => {
  const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
  const mine = (name: string, minutes: number) =>
    fx.symptom({ name, occurredAt: minutesAgo(minutes), createdAt: minutesAgo(minutes) });

  test("removes your latest entry from the last 30 minutes, after a confirm; then nothing older", async () => {
    const recent = mine("Dizzy", 10);
    const older = mine("Tired", 45);
    const samsNewer = fx.symptom({
      name: "Cough",
      occurredAt: minutesAgo(2),
      createdAt: minutesAgo(2),
      createdBy: SAM.id,
    });
    const device = await open({ locked: 0, simpleMode: 1, fixtures: [SAM, recent, older, samsNewer] });
    await waitUntil(isSimple, 4000, "the simple view");
    const remove = page.getByRole("button", { name: "Remove my last entry" });
    await expect.element(remove).toBeVisible();

    await userEvent.click(remove);
    const dialogText = () => document.querySelector("dialog[open]")?.textContent ?? "";
    await expect.poll(dialogText).toContain("Remove your last entry?");
    expect(dialogText()).toContain("Symptom: Dizzy.");
    await userEvent.click(page.getByRole("button", { name: "Remove", exact: true }));

    await expect
      .poll(async () => (await device.queued()).map((w) => [w.op, w.id, !!w.data?.deleted_at]))
      .toEqual([["PATCH", recent.id, true]]);
    await expect
      .element(page.getByRole("status").filter({ hasText: "Removed Symptom: Dizzy." }))
      .toBeVisible();
    // The one before it is older than 30 minutes, and Sam's isn't yours.
    await expect.element(remove).not.toBeInTheDocument();
    const [left] = await device.query<{ n: number }>(
      "SELECT count(*) AS n FROM timeline_entry WHERE deleted_at IS NULL",
    );
    expect(left!.n).toBe(2);
  });

  test("offers nothing when your latest is older than 30 minutes", async () => {
    await open({ locked: 0, simpleMode: 1, fixtures: [mine("Tired", 31)] });
    await waitUntil(isSimple, 4000, "the simple view");
    await waitUntil(() => !!document.querySelector("[data-simple-tiles]"), 4000, "the tiles");
    expect(page.getByRole("button", { name: "Remove my last entry" }).elements()).toHaveLength(0);
  });
});
