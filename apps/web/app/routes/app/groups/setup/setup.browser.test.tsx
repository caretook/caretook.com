import type { DeviceOptions } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, recordTag, tag, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import * as profileAllergies from "../profile/allergies/route";
import * as profileNewCondition from "../profile/conditions/new/route";
import * as profile from "../profile/route";
import * as timeline from "../timeline/route";
import { GROUP_SETUP_STEPS, groupSetupFinished } from "~/lib/app-shell/groupSetup";
import { readSetupFacts } from "~/lib/app-shell/gettingStarted.sync";
import * as layout from "./layout/route";
import * as medications from "./medications/route";
import * as period from "./period/route";
import * as setupProfile from "./profile/route";
import * as providers from "./providers/route";
import * as step from "./step/route";

// The setup pages on the test device (offline): the providers step adds and
// lists (with tags), the whole flow (no known allergies and a condition, a
// medication prescribed by the provider just added, a period at a new place,
// then Next to the Timeline, finished), Later lands on the Timeline with
// `opened` pending, an unknown step goes to the first, and anyone who doesn't
// set the group up is sent to the Timeline. All names are fictional.

const ROUTES = [
  {
    path: "/app/groups/:groupId/setup",
    module: layout,
    children: [
      { path: "/app/groups/:groupId/setup/providers", module: providers },
      { path: "/app/groups/:groupId/setup/profile", module: setupProfile },
      { path: "/app/groups/:groupId/setup/medications", module: medications },
      { path: "/app/groups/:groupId/setup/period", module: period },
      { path: "/app/groups/:groupId/setup/:step?", module: step },
    ],
  },
  {
    path: "/app/groups/:groupId/profile",
    module: profile,
    children: [
      { path: "/app/groups/:groupId/profile/allergies", module: profileAllergies },
      { path: "/app/groups/:groupId/profile/conditions/new", module: profileNewCondition },
    ],
  },
  { path: "/app/groups/:groupId/timeline", module: timeline },
];
const BASE = `/app/groups/${TEST_GROUP.id}`;
const SETUP = `${BASE}/setup/providers`;
const TIMELINE = `${BASE}/timeline`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const OTHER_ID = "5d3e2f1a-7b6c-4d8e-9f0a-000000000042";

/** This user joined an hour ago with `role`; with `after`, another owner joined the day before. */
const membership = (role: GroupRole, { after = false } = {}) => [
  fx.member({ userId: TEST_USER.id, role, createdAt: hoursAgo(1) }),
  after && [
    fx.user({ id: OTHER_ID, name: "Rosa Lindqvist" }),
    fx.member({ userId: OTHER_ID, role: "owner", createdAt: hoursAgo(24) }),
  ],
];

const open = (url: string, role: GroupRole, options: Partial<DeviceOptions> & { after?: boolean } = {}) =>
  renderWithDevice({
    route: ROUTES,
    url,
    role: null,
    noSetupRecord: true,
    ...options,
    fixtures: [membership(role, { after: options.after }), options.fixtures],
  });

const pending = () =>
  JSON.parse(localStorage.getItem(`caretook:settings-pending:${TEST_USER.id}`) ?? "null") as {
    groupSetup?: Record<string, { opened?: boolean }>;
  } | null;
const setupPage = () => document.querySelector("[data-setup-page]");
const addedList = () => document.querySelector("[data-setup-added]");

beforeEach(() => localStorage.clear());

describe("the providers step", () => {
  test("the creator adds a provider on the page and sees it listed, with a fresh form", async () => {
    const device = await open(SETUP, "owner");
    await expect
      .element(page.getByRole("heading", { name: "Who helps with their care?", level: 1 }))
      .toBeVisible();
    expect(addedList()).toBeNull();
    const name = page.getByRole("textbox", { name: "Name" });
    await userEvent.fill(name, "Dr. Imani Castellanos");
    await userEvent.click(page.getByRole("button", { name: "Add provider" }));
    await expect.poll(addedList).not.toBeNull();
    await expect.element(page.getByRole("link", { name: "Dr. Imani Castellanos" })).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: "Name" })).toHaveValue("");
    const rows = await device.query<{ name: string }>("SELECT name FROM provider WHERE group_id = ?", [
      TEST_GROUP.id,
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Dr. Imani Castellanos"]);
    await expect
      .poll(() => document.querySelector('[data-setup-step="providers"]')?.hasAttribute("data-done"))
      .toBe(true);
  });

  test("has no Cancel: the form stays on its page", async () => {
    await open(SETUP, "owner");
    await expect.element(page.getByRole("button", { name: "Add provider" })).toBeVisible();
    expect(document.querySelector("[data-form-cancel]")).toBeNull();
  });

  test("Next goes to the profile step", async () => {
    const device = await open(SETUP, "owner");
    await userEvent.click(page.getByRole("link", { name: "Next" }));
    await expect.poll(device.location).toBe(`${BASE}/setup/profile`);
  });

  test("lists each added provider with its tags (B-1007)", async () => {
    const provider = fx.provider({ name: "Dr. Imani Castellanos" });
    const team = tag("Cardiology team");
    await open(SETUP, "owner", { fixtures: [provider, team, recordTag(team.id, provider.id, "providerId")] });
    await expect.poll(() => addedList()?.textContent).toContain("Cardiology team");
  });
});

const stepDone = (id: string) =>
  document.querySelector(`[data-setup-step="${id}"]`)?.hasAttribute("data-done");
const form = (hook: string) => document.querySelector<HTMLFormElement>(`[data-setup-page] [${hook}]`);
const option = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (o) => o.firstElementChild?.textContent === text,
  );
const next = () => userEvent.click(page.getByRole("link", { name: "Next" }));

describe("the whole flow", () => {
  test("no known allergies and a condition, a medication by the provider just added, a period at a new place; each step done, and Next finishes on the Timeline", async () => {
    const device = await open(SETUP, "owner");

    // 1. Providers.
    await userEvent.fill(page.getByRole("textbox", { name: "Name" }), "Dr. Imani Castellanos");
    await userEvent.click(page.getByRole("button", { name: "Add provider" }));
    await expect.poll(() => stepDone("providers")).toBe(true);
    await next();

    // 2. Allergies and conditions, as on the Profile.
    await expect.poll(device.location).toBe(`${BASE}/setup/profile`);
    await expect
      .element(page.getByRole("heading", { name: "Allergies and conditions", level: 1 }))
      .toBeVisible();
    expect(stepDone("profile")).toBe(false);
    await userEvent.click(await found(() => document.querySelector("[data-record-no-known]")));
    await expect.poll(() => document.querySelector("[data-no-known-allergies]")).not.toBeNull();
    await userEvent.click(await found(() => document.querySelector("a[data-add-condition]")));
    const conditionName = () =>
      document.querySelector<HTMLInputElement>(
        '[role=dialog] [data-condition-name-field] input[role="combobox"]',
      );
    await userEvent.fill(await found(conditionName), "Long COVID");
    // Off the name's suggestions (a popover), as on the Profile.
    await userEvent.click(
      await found(() =>
        document.querySelector(
          '[role=dialog] form[data-condition-form] input[name="status"][value="active"]',
        ),
      ),
    );
    await userEvent.click(page.getByRole("button", { name: "Add condition" }));
    // The sheet closes back to the setup page.
    await expect.poll(device.location).toBe(`${BASE}/setup/profile`);
    await expect
      .poll(() => document.querySelector("[data-setup-page] [data-condition-name]")?.textContent)
      .toBe("Long COVID");
    await expect.poll(() => stepDone("profile")).toBe(true);
    await next();

    // 3. Medications: the prescriber picker has the provider from step 1.
    await expect.poll(device.location).toBe(`${BASE}/setup/medications`);
    const medForm = () => form("data-medication-form");
    await userEvent.fill(
      await found(() => medForm()?.querySelector<HTMLInputElement>('[name="name"]')),
      "Sertraline",
    );
    await userEvent.click(
      await found(() =>
        medForm()?.querySelector<HTMLInputElement>(
          '[data-provider-picker="prescriber"] input[role="combobox"]',
        ),
      ),
    );
    await userEvent.keyboard("Imani");
    await userEvent.click(await found(() => option("Dr. Imani Castellanos")));
    expect(document.querySelector("[data-form-cancel]")).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Add medication" }));
    await expect.poll(() => stepDone("medications")).toBe(true);
    await expect.element(page.getByRole("link", { name: "Sertraline" })).toBeVisible();
    const [med] = await device.query<{ prescriber: string }>(
      "SELECT p.name AS prescriber FROM medication m JOIN provider p ON p.id = m.prescriber_id WHERE m.name = 'Sertraline'",
    );
    expect(med?.prescriber).toBe("Dr. Imani Castellanos");
    await next();

    // 4. A care period at a new place (the step starts on Home, date only).
    await expect.poll(device.location).toBe(`${BASE}/setup/period`);
    const periodForm = () => form("data-period-form");
    await expect
      .poll(() => periodForm()?.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value)
      .toBe("home");
    await userEvent.click(
      await found(() =>
        periodForm()?.querySelector<HTMLInputElement>('input[name="type"][aria-label="Hospital"]'),
      ),
    );
    await userEvent.click(
      await found(() =>
        periodForm()?.querySelector<HTMLInputElement>('[data-place-picker] input[role="combobox"]'),
      ),
    );
    await userEvent.keyboard("Lakeview Medical");
    await userEvent.click(await found(() => option('Add "Lakeview Medical" as a new place')));
    expect(document.querySelector("[data-form-cancel]")).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Save period" }));
    await expect.poll(() => stepDone("period")).toBe(true);
    const [made] = await device.query<{ type: string; place: string }>(
      "SELECT c.type, p.name AS place FROM care_period c JOIN provider p ON p.id = c.place_provider_id",
    );
    expect(made).toEqual({ type: "hospital", place: "Lakeview Medical" });
    expect(GROUP_SETUP_STEPS.map(stepDone)).toEqual([true, true, true, true]);

    // The last step's Next finishes on the Timeline, with the flow finished.
    await next();
    await expect.poll(device.location).toBe(TIMELINE);
    const { setup } = await readSetupFacts(device.db, TEST_GROUP.id, TEST_USER.id);
    expect(groupSetupFinished(setup)).toBe(true);
  });
});

describe("Later", () => {
  test("lands on the Timeline, with opened saved pending", async () => {
    const device = await open(SETUP, "owner");
    await expect.poll(setupPage).not.toBeNull();
    await expect.poll(() => pending()?.groupSetup?.[TEST_GROUP.id]?.opened).toBe(true);
    await userEvent.click(page.getByRole("link", { name: "Later, take me to Caretook!" }));
    await expect.poll(device.location).toBe(TIMELINE);
    expect(pending()?.groupSetup?.[TEST_GROUP.id]?.opened).toBe(true);
  });
});

describe("who gets the pages", () => {
  test("an unknown step goes to the first", async () => {
    const device = await open(`${BASE}/setup/bogus`, "owner");
    await expect.poll(device.location).toBe(SETUP);
    await expect.poll(setupPage).not.toBeNull();
  });

  test.each([
    ["an invited caretaker", "caretaker"],
    ["a second owner", "owner"],
    ["a viewer", "viewer"],
  ] as const)("%s opening the URL lands on the Timeline, recording nothing", async (_, role) => {
    const device = await open(SETUP, role, { after: true });
    await expect.poll(device.location).toBe(TIMELINE);
    expect(setupPage()).toBeNull();
    expect(pending()).toBeNull();
  });

  test("a first member who can't write lands on the Timeline", async () => {
    const device = await open(SETUP, "viewer");
    await expect.poll(device.location).toBe(TIMELINE);
    expect(setupPage()).toBeNull();
  });
});
