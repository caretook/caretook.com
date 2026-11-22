import type { DeviceRoute } from "../../../../../test/device";
import type { Fixtures, GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as home from "~/routes/app/home/route";
import * as settingsLayout from "~/routes/app/settings/layout/route";
import * as timelineSettings from "~/routes/app/settings/timeline/route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as timeline from "./route";
import { chooseEasyMode, TIMELINE_URL, waitUntil } from "./timelineWorld";

// The easy roles, viewers and "Remove my last entry", in the real /app frame
// on the test device: an Easy helper or Easy viewer is kept to the timeline
// and their notes' and events' pages (by the group route, on navigation and
// when the role syncs in), reaches account settings, sign-out and their other
// groups; an Easy helper logs and changes only their own rows; an Easy viewer
// and a viewer get the next appointment as text and no inputs; and you can
// remove your own entry from the last 30 minutes only. The route rule itself
// is lib/assistant/easyModeLock.test.ts.

/** Stand-ins for group pages the easy roles can't use, and the entry page they keep. */
const probe = (name: string) => ({ default: () => <h1>{name}</h1> });

const GROUP = "/app/groups/:groupId";
const ROUTES: DeviceRoute[] = [
  {
    path: `${GROUP}/timeline`,
    module: timeline,
    children: [
      { path: `${GROUP}/timeline/new/:kind`, module: newSheet },
      { path: `${GROUP}/timeline/:entryId/edit`, module: editSheet },
    ],
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
const membership = (role: GroupRole) => fx.member({ id: MEMBERSHIP, userId: TEST_USER.id, role });

/** The timeline as `role` (an Easy helper by default); `easyMode` is a regular role's own setting saying Easy mode. */
const open = ({
  role = "easy_helper",
  easyMode = false,
  url = TIMELINE_URL,
  fixtures = [],
}: {
  role?: GroupRole;
  easyMode?: boolean;
  url?: string;
  fixtures?: Fixtures;
} = {}) => {
  if (easyMode) chooseEasyMode();
  return renderWithDevice({
    route: ROUTES,
    url,
    role: null,
    frame: true,
    fixtures: [membership(role), fixtures],
  });
};

const isEasy = () => !!document.querySelector("[data-easy-timeline]");
const userButton = () => page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
const menuItems = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((el) => el.textContent?.trim());
const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const rows = () => [...document.querySelectorAll("[data-easy-list] ol > li")];

describe("an easy role", () => {
  test.each(["easy_helper", "easy_viewer"] as const)(
    "%s is sent to the timeline from other group pages",
    async (role) => {
      const device = await open({ role, url: `${base}/providers` });
      await expect.poll(device.location).toBe(TIMELINE_URL);
      await waitUntil(isEasy, 4000, "the easy view");
      expect(page.getByRole("heading", { name: "Providers" }).elements()).toHaveLength(0);
    },
  );

  test("keeps their notes' and events' pages, in the reduced header", async () => {
    const note = fx.note({ text: "Lunch went well" });
    const device = await open({ url: `${base}/entries/${note.id}`, fixtures: [note] });
    await expect.element(page.getByRole("heading", { name: "Entry page" })).toBeVisible();
    expect(device.location()).toBe(`${base}/entries/${note.id}`);
    // No group menu, sections, search or tab bar to wander off through.
    expect(page.getByRole("button", { name: /switch care group$/ }).elements()).toHaveLength(0);
    expect(document.querySelector('body header [data-region="search"]')).toBeNull();
  });

  test("is sent to the timeline when the role syncs in while they're elsewhere", async () => {
    const device = await open({ role: "caretaker", url: `${base}/settings/members` });
    await expect.element(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await device.sync(membership("easy_helper"));
    await expect.poll(device.location).toBe(TIMELINE_URL);
    await waitUntil(isEasy, 4000, "the easy view");
  });

  test("reaches account settings from the user menu", async () => {
    const device = await open();
    await waitUntil(isEasy, 4000, "the easy view");
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
        // A regular role there: each group follows its own role.
        fx.member({ userId: TEST_USER.id, groupId: OTHER, role: "caretaker" }),
      ],
    });
    await waitUntil(isEasy, 4000, "the easy view");
    await userEvent.click(userButton());
    await expect.poll(menuItems).toEqual(["Settings", "Your care groups", "Sign out"]);
    await userEvent.click(page.getByRole("menuitem", { name: "Your care groups" }));
    await expect.poll(device.location).toBe("/app?groups=1");
    await expect.element(page.getByRole("heading", { name: "Your care groups" })).toBeVisible();
    await userEvent.click(page.getByRole("link", { name: /Lou Okafor/ }));
    await expect.poll(device.location).toBe(`/app/groups/${OTHER}/timeline`);
    await waitUntil(() => !isEasy(), 4000, "the full timeline there");
  });
});

describe("an Easy helper's timeline", () => {
  const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
  const mine = fx.symptom({ name: "Dizzy", occurredAt: minutesAgo(50), createdAt: minutesAgo(50) });
  const sams = fx.symptom({
    name: "Cough",
    occurredAt: minutesAgo(40),
    createdAt: minutesAgo(40),
    createdBy: SAM.id,
  });
  const actions = (li: Element) => li.querySelector<HTMLButtonElement>('button[aria-label^="Actions"]');
  const rowWith = (text: string) => rows().find((li) => li.textContent?.includes(text));

  test("logs through the box and the tiles, with no Full app", async () => {
    const device = await open({ fixtures: [SAM, mine, sams] });
    await waitUntil(isEasy, 4000, "the easy view");
    await waitUntil(() => !!document.querySelector("[data-easy-tiles]"), 4000, "the tiles");
    expect(page.getByRole("button", { name: "Full app" }).elements()).toHaveLength(0);

    await userEvent.fill(page.getByRole("textbox", { name: "What happened?" }), "Walked to the mailbox");
    await waitUntil(() => !!document.querySelector("[data-quick-card]"), 4000, "the card");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect
      .poll(async () => (await device.queued()).filter((op) => op.type === "timeline_entry").length)
      .toBe(1);
  });

  test("gets a ⋯ menu on their own row and none on another member's; Edit opens their own's sheet", async () => {
    const device = await open({ fixtures: [SAM, mine, sams] });
    await waitUntil(() => isEasy() && rows().length === 2, 4000, "the rows");
    expect(actions(rowWith("Cough")!)).toBeNull();
    expect(rowWith("Cough")!.querySelector("a[href*='/edit']")).toBeNull();

    await userEvent.click(actions(rowWith("Dizzy")!)!);
    await userEvent.click(page.getByRole("menuitem", { name: "Edit" }));
    const name = () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="symptomName"]');
    await waitUntil(() => !!name(), 4000, "the edit sheet");
    await expect.poll(() => name()?.value).toBe("Dizzy");
    expect(device.location()).toBe(`${TIMELINE_URL}/${mine.id}/edit`);
  });

  test("deletes their own row from its menu", async () => {
    const device = await open({ fixtures: [SAM, mine, sams] });
    await waitUntil(() => isEasy() && rows().length === 2, 4000, "the rows");
    await userEvent.click(actions(rowWith("Dizzy")!)!);
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    await expect
      .poll(async () => (await device.queued()).map((w) => [w.op, w.id, !!w.data?.deleted_at]))
      .toEqual([["PATCH", mine.id, true]]);
  });

  test("another member's edit sheet, typed in, goes back to the timeline", async () => {
    const device = await open({ fixtures: [SAM, mine, sams], url: `${TIMELINE_URL}/${sams.id}/edit` });
    await expect.poll(device.location).toBe(TIMELINE_URL);
    await waitUntil(isEasy, 4000, "the easy view");
  });
});

describe("an Easy viewer's timeline", () => {
  test("has no box, tiles, removing or row menus", async () => {
    const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
    await open({
      role: "easy_viewer",
      fixtures: [
        SAM,
        fx.symptom({ name: "Sore knee", occurredAt: minutesAgo(5), createdAt: minutesAgo(5) }),
        fx.symptom({ name: "Cough", occurredAt: minutesAgo(8), createdAt: minutesAgo(8), createdBy: SAM.id }),
      ],
    });
    await waitUntil(() => isEasy() && rows().length === 2, 4000, "the rows");
    expect(page.getByRole("textbox", { name: "What happened?" }).elements()).toHaveLength(0);
    expect(document.querySelector("[data-easy-tiles]")).toBeNull();
    expect(page.getByRole("button", { name: "Remove my last entry" }).elements()).toHaveLength(0);
    expect(document.querySelectorAll('[data-easy-list] button[aria-label^="Actions"]')).toHaveLength(0);
    expect(page.getByRole("button", { name: "Full app" }).elements()).toHaveLength(0);
  });
});

describe("a viewer in easy mode", () => {
  test("gets the bigger rows and the next appointment as text, and no box, tiles or removing", async () => {
    const visit = fx.event({
      title: "Visit with Dr. Lark",
      occurredAt: at(new Date(Date.now() + 26 * 3_600_000)),
    });
    await open({
      role: "viewer",
      easyMode: true,
      fixtures: [
        visit,
        fx.symptom({ name: "Sore knee", occurredAt: minutesAgo(5), createdAt: minutesAgo(5) }),
      ],
    });
    await waitUntil(isEasy, 4000, "the easy view");
    await waitUntil(() => !!document.querySelector("[data-easy-next]"), 4000, "the next appointment");
    expect(document.querySelector("[data-easy-next]")!.textContent).toMatch(/^Next: Visit with Dr\. Lark · /);
    await waitUntil(
      () => document.querySelectorAll("[data-easy-list] ol > li").length === 1,
      4000,
      "the rows",
    );
    expect(page.getByRole("textbox", { name: "What happened?" }).elements()).toHaveLength(0);
    expect(document.querySelector("[data-easy-tiles]")).toBeNull();
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
    const device = await open({
      role: "caretaker",
      easyMode: true,
      fixtures: [SAM, recent, older, samsNewer],
    });
    await waitUntil(isEasy, 4000, "the easy view");
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
    await open({ role: "caretaker", easyMode: true, fixtures: [mine("Tired", 31)] });
    await waitUntil(isEasy, 4000, "the easy view");
    await waitUntil(() => !!document.querySelector("[data-easy-tiles]"), 4000, "the tiles");
    expect(page.getByRole("button", { name: "Remove my last entry" }).elements()).toHaveLength(0);
  });
});
