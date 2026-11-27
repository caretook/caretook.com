import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { GROUP_ROLES } from "@caretook/data/permissions";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as timeline from "~/routes/app/groups/timeline/route";
import * as home from "~/routes/app/home/route";
import * as details from "./details/route";
import * as settingsIndex from "./index/route";
import * as settingsLayout from "./layout/route";
import * as members from "./members/route";
import { apiCalls, refusal } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";

// Group settings (app-shell.mjs's and ui.mjs's screen steps; the frame by
// width is settingsFrame.browser.test.tsx's): Details and Members by role,
// online and offline, the refusals the server sends shown as they are, and
// changes arriving from another device. The server is the
// test's `api` handlers; what the server itself decides is in the
// integration tests, and a role change or removal reaching a second device
// for real stays in app-shell.mjs.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: "/app", id: "home", module: home },
  { path: "/app/groups/:groupId/timeline", module: timeline },
  {
    path: BASE,
    module: settingsLayout,
    children: [
      { path: BASE, id: "group-settings-index", module: settingsIndex },
      { path: `${BASE}/details`, module: details },
      { path: `${BASE}/members`, module: members },
    ],
  },
];
const SETTINGS = `/app/groups/${TEST_GROUP.id}/settings`;
const DETAILS = `${SETTINGS}/details`;
const MEMBERS = `${SETTINGS}/members`;

const SAM = fx.person({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a02", name: "Sam Okafor", role: "caretaker" });
const RITA = fx.person({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a03", name: "Rita Okafor", role: "viewer" });

/** What the server answers on any settings page that's online. */
const ONLINE = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
  "invite.listForGroup": () => [],
  "invite.listLinks": () => [],
  "joinRequest.list": () => [],
  "joinRequest.mine": () => [],
  "me.contact": () => null,
};

const open = ({
  url,
  role = "owner",
  online = true,
  api = {},
}: {
  url: string;
  role?: GroupRole;
  online?: boolean;
  api?: Record<string, (input: unknown) => unknown>;
}) =>
  renderWithDevice({
    route: ROUTES,
    url,
    role,
    fixtures: [SAM, RITA],
    api: online ? { ...ONLINE, ...api } : undefined,
  });

const section = (id: string) => document.querySelector(`main [data-section="${id}"]`);
const controls = (el: Element | null) =>
  el?.querySelectorAll("input:not([type=hidden]), select, button").length;
const saveIn = (id: string) => section(id)!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const NAME = () => page.getByRole("textbox", { name: "Name" });
const ZONE = () => page.getByRole("combobox", { name: "Time zone" });

/** A control's description: the text of what `aria-describedby` names. */
const described = (el: Element) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .join(" | ");

describe("Details", () => {
  test("the owner, online: the group's name and the recipient's zone as forms, the profile linked, no notice", async () => {
    await open({ url: DETAILS });
    await expect.element(NAME()).toHaveValue(TEST_GROUP.name);
    expect(
      [...document.querySelectorAll<HTMLElement>("main [data-section]")].map((s) => s.dataset.section),
    ).toEqual(["group-details", "care-recipient", "easy-tiles", "details-outside-allowed"]);
    expect(document.querySelector("main [data-profile-note] a")?.getAttribute("href")).toBe(
      `/app/groups/${TEST_GROUP.id}/profile`,
    );
    expect(document.querySelector("[data-needs-connection]")).toBeNull();
    // Every input is labelled: the name is the only one (easy mode's tiles card and the
    // owners' details switch have their own tests).
    const labels = [...document.querySelectorAll<HTMLInputElement>("main input:not([type=hidden])")]
      .filter((i) => !i.closest("[data-section=easy-tiles], [data-section=details-outside-allowed]"))
      .map((i) => document.querySelector(`label[for="${i.id}"]`)?.textContent?.trim());
    expect(labels).toEqual(["Name"]);
  });

  test("a blank name: the field's error, described and invalid, and nothing is sent", async () => {
    const calls = apiCalls();
    await open({ url: DETAILS, api: calls.record({ "careGroup.update": () => null }) });
    await userEvent.clear(NAME());
    await userEvent.type(NAME(), "   ");
    await userEvent.click(saveIn("group-details"));
    await expect.element(NAME()).toHaveAttribute("aria-invalid", "true");
    expect(described(NAME().element())).toBe("Enter a name.");
    expect(calls.of("careGroup.update")).toEqual([]);
  });

  test("the owner renames the group: one save through the API, trimmed; a synced rename shows without a reload", async () => {
    const calls = apiCalls();
    const device = await open({ url: DETAILS, api: calls.record({ "careGroup.update": () => null }) });
    await userEvent.clear(NAME());
    await userEvent.type(NAME(), "  Moreno Family Care ");
    await userEvent.click(saveIn("group-details"));
    await expect.element(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    expect(calls.of("careGroup.update")).toEqual([{ groupId: TEST_GROUP.id, name: "Moreno Family Care" }]);

    // The rename comes back through sync; the read-only view (a caretaker's) follows it live.
    await device.screen.unmount();
    const caretaker = await open({ url: DETAILS, role: "caretaker" });
    await caretaker.sync(fx.group({ name: "Moreno Family Care" }));
    await expect.element(page.getByText("Moreno Family Care")).toBeVisible();
  });

  test("the recipient's time zone: the zone, every zone, the note; a change saves; \"Use this device's\" picks this device's", async () => {
    const calls = apiCalls();
    await open({ url: DETAILS, api: calls.record({ "careGroup.updateRecipient": () => null }) });
    await expect.element(ZONE()).toHaveValue("America/Los_Angeles");
    const zone = ZONE().element() as HTMLSelectElement;
    expect(zone.options.length).toBeGreaterThan(50);
    expect(described(zone)).toContain("Medication times follow this zone.");

    await userEvent.selectOptions(ZONE(), "America/New_York");
    const recipientCard = section("care-recipient")!;
    await userEvent.click(saveIn("care-recipient"));
    await expect
      .poll(() => calls.of("careGroup.updateRecipient"))
      .toEqual([{ groupId: TEST_GROUP.id, timeZone: "America/New_York" }]);
    await expect
      .poll(() => recipientCard.querySelector('[role="status"]')?.textContent?.trim())
      .toBe("Saved.");

    // The device is in Los Angeles (the tests' zone).
    await userEvent.selectOptions(ZONE(), "America/Chicago");
    const shortcut = page.getByRole("button", { name: "Use this device's (America/Los Angeles)" });
    await userEvent.click(shortcut);
    await expect.element(ZONE()).toHaveValue("America/Los_Angeles");
  });

  test("a caretaker: the group's name is read-only, with no controls; the profile is linked", async () => {
    await open({ url: DETAILS, role: "caretaker" });
    await expect.element(page.getByText(TEST_GROUP.name)).toBeVisible();
    expect(controls(section("group-details"))).toBe(0);
    expect(document.querySelector("main [data-profile-note] a")?.getAttribute("href")).toBe(
      `/app/groups/${TEST_GROUP.id}/profile`,
    );
  });

  test("a viewer: the time zone is read-only text", async () => {
    await open({ url: DETAILS, role: "viewer" });
    await expect.element(page.getByText("America/Los Angeles")).toBeVisible();
    expect(document.querySelectorAll("main select")).toHaveLength(0);
    expect(section("care-recipient")?.textContent).toContain("Time zone");
    expect(controls(section("group-details"))).toBe(0);
  });

  test("offline: read-only from the device, with the notice, and nothing to save with", async () => {
    await open({ url: DETAILS, online: false });
    await expect.element(page.getByText("Needs a connection to edit.")).toBeVisible();
    expect(section("group-details")?.textContent).toContain(TEST_GROUP.name);
    expect(section("care-recipient")?.textContent).toContain("America/Los Angeles");
    expect(document.querySelectorAll("main input, main select, main button, main form")).toHaveLength(0);
  });
});

describe("Members", () => {
  const LAST_OWNER = "A care group needs at least one owner. Make someone else an owner first.";
  const OWNER_ONLY = "Only an owner can add, change or remove owners";

  /** The list as shown: "name:role", "*" on a role menu, then the row's button. */
  const listed = () =>
    [...document.querySelectorAll("main [data-section='members'] li[data-member]")]
      .map((li) => {
        const select = li.querySelector("select");
        const role = select
          ? `${select.selectedOptions[0]?.textContent?.trim()}*`
          : li.querySelector("[data-role]")?.textContent?.trim();
        const button = li.querySelector("button")?.textContent?.trim();
        return `${li.querySelector("p")?.textContent?.trim()}:${role}${button ? `:${button}` : ""}`;
      })
      .join(",");
  const row = (name: string) =>
    [...document.querySelectorAll("main li[data-member]")].find((li) =>
      li.querySelector("p")?.textContent?.includes(name),
    )!;
  const alertOn = (name: string) => row(name)?.querySelector('[role="alert"]')?.textContent?.trim() ?? "";
  const ready = () => expect.poll(() => document.querySelectorAll("main li[data-member]").length).toBe(3);

  test("the owner, online: everyone by role, a role menu each (all six roles), Leave on their row and Remove on the others", async () => {
    await open({ url: MEMBERS });
    await ready();
    expect(
      [...document.querySelectorAll<HTMLElement>("main [data-section]")].map((s) => s.dataset.section),
    ).toEqual(["members"]);
    expect(listed()).toBe(
      "Alex Moreno (you):Owner*:Leave,Sam Okafor:Caretaker*:Remove,Rita Okafor:Viewer*:Remove",
    );
    const list = section("members")!;
    expect(
      [...list.querySelectorAll("li[data-member] > div > span[aria-hidden]")].map((a) =>
        a.textContent?.trim(),
      ),
    ).toEqual(["AM", "SO", "RO"]);
    expect([...(row("Rita").querySelector("select")?.options ?? [])].map((o) => o.value)).toEqual([
      "owner",
      "admin",
      "caretaker",
      "viewer",
      "easy_helper",
      "easy_viewer",
    ]);
    expect(
      [...list.querySelectorAll("li[data-member] select, li[data-member] button")].map((el) =>
        el.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Role for Alex Moreno",
      "Leave this care group",
      "Role for Sam Okafor",
      "Remove Sam Okafor",
      "Role for Rita Okafor",
      "Remove Rita Okafor",
    ]);
    // Sign-in emails never show (only shared contact details do).
    expect(list.textContent).not.toContain("@example.com");
  });

  test("the role menu groups the easy roles under Easier to use, with no per-option descriptions", async () => {
    await open({ url: MEMBERS });
    await ready();
    const select = row("Rita").querySelector("select")!;
    const groups = [...select.querySelectorAll("optgroup")].map((g) => [
      g.label,
      [...g.querySelectorAll("option")].map((o) => o.textContent),
    ]);
    expect(groups).toEqual([
      ["Regular roles", ["Owner", "Admin", "Caretaker", "Viewer"]],
      ["Easier to use", ["Easy helper", "Easy viewer"]],
    ]);
    // Phones don't show an option's title: "What can each role do?" explains them instead.
    expect([...select.options].map((o) => o.title).filter(Boolean)).toEqual([]);
  });

  test("What can each role do? (B-677): owners and admins get the link above the list, opening every role; closing returns focus", async () => {
    for (const role of ["owner", "admin"] as const) {
      const device = await open({ url: MEMBERS, role });
      await ready();
      const link = page.getByRole("button", { name: "What can each role do?" });
      await userEvent.click(link);
      const dialog = page.getByRole("dialog", { name: "What can each role do?" });
      await expect.element(dialog).toBeVisible();
      for (const known of GROUP_ROLES) {
        await expect.element(dialog.getByText(known.label, { exact: true })).toBeVisible();
        await expect.element(dialog.getByText(known.description, { exact: true })).toBeVisible();
      }
      await userEvent.click(dialog.getByRole("button", { name: "Done" }));
      await expect
        .poll(() => document.querySelector("dialog[data-role-guide]")?.hasAttribute("open"))
        .toBe(false);
      await expect.element(link).toHaveFocus();
      await device.screen.unmount();
    }
  });

  test("What can each role do? isn't offered to a caretaker, or offline", async () => {
    for (const [role, online] of [
      ["caretaker", true],
      ["owner", false],
    ] as const) {
      const device = await open({ url: MEMBERS, role, online });
      await ready();
      expect(document.querySelector("[data-role-help]")).toBeNull();
      await device.screen.unmount();
    }
  });

  test("a member with an easy role reads as Easy helper: a menu for the owner, plain text for a caretaker", async () => {
    const helper = fx.person({
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a04",
      name: "June Park",
      role: "easy_helper",
    });
    for (const [role, expected] of [
      ["owner", "Easy helper*"],
      ["caretaker", "Easy helper"],
    ] as const) {
      const device = await renderWithDevice({
        route: ROUTES,
        url: MEMBERS,
        role,
        fixtures: [SAM, RITA, helper],
        api: ONLINE,
      });
      await expect.poll(() => document.querySelectorAll("main li[data-member]").length).toBe(4);
      expect(listed().split(",").at(-1)).toMatch(new RegExp(`^June Park:${expected.replace("*", "\\*")}`));
      // The description stays with the managers' menu: never on the member's row.
      expect(row("June Park").textContent).not.toMatch(/memory|thinking/);
      await device.screen.unmount();
    }
  });

  test("the last owner: demoting themselves shows the server's reason and the menu goes back; leaving asks first, Cancel sends nothing, and a refusal keeps them here", async () => {
    const calls = apiCalls();
    const device = await open({
      url: MEMBERS,
      api: calls.record({
        "careGroup.changeRole": () => refusal("careGroupMemberService:lastOwner"),
        "careGroup.removeMember": () => refusal("careGroupMemberService:lastOwner"),
      }),
    });
    await ready();
    await userEvent.selectOptions(page.getByRole("combobox", { name: "Role for Alex Moreno" }), "viewer");
    await expect.poll(() => alertOn("Alex Moreno")).toBe(LAST_OWNER);
    await expect.element(page.getByRole("combobox", { name: "Role for Alex Moreno" })).toHaveValue("owner");

    await userEvent.click(page.getByRole("button", { name: "Leave this care group" }));
    const dialog = () => document.querySelector("dialog[open]");
    await expect.poll(() => dialog()?.querySelector("h2")?.textContent).toMatch(/^Leave this care group\?/);
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(dialog).toBeNull();
    expect(calls.of("careGroup.removeMember")).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "Leave this care group" }));
    await expect.poll(dialog).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Leave", exact: true }));
    await expect
      .poll(() => calls.of("careGroup.removeMember"))
      .toEqual([{ groupId: TEST_GROUP.id, userId: TEST_USER.id }]);
    await expect.poll(() => alertOn("Alex Moreno")).toBe(LAST_OWNER);
    expect(device.location()).toBe(MEMBERS);
  });

  test("leaving: the membership goes from the device, then /app, without the removed-member notice", async () => {
    let leave = () => {};
    const device = await open({
      url: MEMBERS,
      role: "caretaker",
      api: { "careGroup.removeMember": () => leave() },
    });
    const [mine] = await device.query<{ id: string }>("SELECT id FROM care_group_member WHERE user_id = ?", [
      TEST_USER.id,
    ]);
    // The server's answer, then the row syncing away a moment later.
    leave = () => {
      setTimeout(() => void device.unsync([{ table: "care_group_member", id: mine!.id }]), 200);
    };
    await ready();
    await userEvent.click(page.getByRole("button", { name: "Leave this care group" }));
    await userEvent.click(page.getByRole("button", { name: "Leave", exact: true }));
    await expect.poll(device.location).toBe("/app");
    await expect.element(page.getByRole("heading", { level: 1, name: "Your care groups" })).toBeVisible();
    expect(document.querySelector("[data-lost-group]")).toBeNull();
  });

  test("a caretaker: everyone and their roles, no role menus, Leave on their own row only", async () => {
    await open({ url: MEMBERS, role: "caretaker" });
    await ready();
    expect(listed()).toBe("Alex Moreno (you):Caretaker:Leave,Sam Okafor:Caretaker,Rita Okafor:Viewer");
  });

  test("made an admin on another device: role menus and Remove arrive without a reload, nothing on the owner's row, no Owner offered; a forged Owner gets the server's reason", async () => {
    const owner = fx.person({
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a04",
      name: "Olga Moreno",
      role: "owner",
    });
    const device = await renderWithDevice({
      route: ROUTES,
      url: MEMBERS,
      role: "caretaker",
      fixtures: [owner, RITA],
      api: { ...ONLINE, "careGroup.changeRole": () => refusal("careGroupMemberService:ownerOnly") },
    });
    await ready();
    expect(listed()).toBe("Olga Moreno:Owner,Alex Moreno (you):Caretaker:Leave,Rita Okafor:Viewer");
    const [mine] = await device.query<{ id: string }>("SELECT id FROM care_group_member WHERE user_id = ?", [
      TEST_USER.id,
    ]);
    await device.sync(fx.member({ id: mine!.id, userId: TEST_USER.id, role: "admin" }));
    await expect
      .poll(listed)
      .toBe("Olga Moreno:Owner,Alex Moreno (you):Admin*:Leave,Rita Okafor:Viewer*:Remove");
    const rita = row("Rita").querySelector("select")!;
    expect([...rita.options].map((o) => o.value)).toEqual([
      "admin",
      "caretaker",
      "viewer",
      "easy_helper",
      "easy_viewer",
    ]);

    // A forged request (an Owner option added by hand) gets the owner-only message, and the menu goes back.
    rita.append(Object.assign(document.createElement("option"), { value: "owner", textContent: "Owner" }));
    await userEvent.selectOptions(rita, "owner");
    await expect.poll(() => alertOn("Rita")).toBe(OWNER_ONLY);
    await expect.poll(() => rita.value).toBe("viewer");
  });

  test("the owner changes a role: it's sent, shows at once, and the synced change stays", async () => {
    const calls = apiCalls();
    const device = await open({ url: MEMBERS, api: calls.record({ "careGroup.changeRole": () => null }) });
    await ready();
    await userEvent.selectOptions(page.getByRole("combobox", { name: "Role for Sam Okafor" }), "admin");
    await expect
      .poll(() => calls.of("careGroup.changeRole"))
      .toEqual([{ groupId: TEST_GROUP.id, userId: SAM.id, role: "admin" }]);
    await expect.element(page.getByRole("combobox", { name: "Role for Sam Okafor" })).toHaveValue("admin");
    const membership = SAM.with![0]!;
    await device.sync(fx.member({ id: membership.id, userId: SAM.id, role: "admin" }));
    await device.settle();
    expect(listed()).toBe(
      "Alex Moreno (you):Owner*:Leave,Sam Okafor:Admin*:Remove,Rita Okafor:Viewer*:Remove",
    );
  });

  test("the owner removes a member: the confirm names them, Cancel sends nothing; Remove sends it, and the row goes when the sync does", async () => {
    const calls = apiCalls();
    const device = await open({ url: MEMBERS, api: calls.record({ "careGroup.removeMember": () => null }) });
    await ready();
    await userEvent.click(page.getByRole("button", { name: "Remove Sam Okafor" }));
    const dialog = () => document.querySelector("dialog[open]");
    await expect
      .poll(() => dialog()?.querySelector("h2")?.textContent)
      .toMatch(/^Remove Sam Okafor from this care group\?/);
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(dialog).toBeNull();
    expect(calls.of("careGroup.removeMember")).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "Remove Sam Okafor" }));
    await userEvent.click(page.getByRole("button", { name: "Remove", exact: true }));
    await expect
      .poll(() => calls.of("careGroup.removeMember"))
      .toEqual([{ groupId: TEST_GROUP.id, userId: SAM.id }]);
    await device.unsync([SAM.with![0]!]);
    await expect.poll(listed).toBe("Alex Moreno (you):Owner*:Leave,Rita Okafor:Viewer*:Remove");
  });

  test("a viewer: the only control is Leave; leaving asks, then lands on /app with no care group once the membership syncs away", async () => {
    let device: Awaited<ReturnType<typeof open>> | null = null;
    const calls = apiCalls();
    device = await open({
      url: MEMBERS,
      role: "viewer",
      api: calls.record({
        "careGroup.removeMember": async () => {
          // The server removes it; the device loses it on its next sync.
          const [mine] = await device!.query<{ id: string }>(
            "SELECT id FROM care_group_member WHERE user_id = ?",
            [TEST_USER.id],
          );
          setTimeout(() => void device!.unsync([{ table: "care_group_member", id: mine!.id }]), 100);
          return null;
        },
      }),
    });
    await ready();
    expect(listed()).toBe("Sam Okafor:Caretaker,Alex Moreno (you):Viewer:Leave,Rita Okafor:Viewer");
    const live = [...document.querySelectorAll("main input, main select, main button")].filter(
      (el) => !el.closest("dialog:not([open])") && !el.closest("[data-sharing-form], [data-sharing-toggle]"),
    );
    expect(live.map((el) => el.textContent?.trim())).toEqual(["Leave"]);

    await userEvent.click(page.getByRole("button", { name: "Leave this care group" }));
    await userEvent.click(page.getByRole("button", { name: "Leave", exact: true }));
    await expect.poll(device.location).toBe("/app");
    await expect.element(page.getByText(/You're not in a care group yet/)).toBeVisible();
  });

  test("demoted to viewer on another device: the timeline's writer controls go without a reload", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: `/app/groups/${TEST_GROUP.id}/timeline`,
      role: "caretaker",
      fixtures: [fx.symptom({ name: "Sore knee" })],
    });
    await expect.element(page.getByRole("button", { name: "Add to Today" })).toBeVisible();
    const [mine] = await device.query<{ id: string }>("SELECT id FROM care_group_member WHERE user_id = ?", [
      TEST_USER.id,
    ]);
    await device.sync(fx.member({ id: mine!.id, userId: TEST_USER.id, role: "viewer" }));
    await device.settle();
    await expect.element(page.getByRole("button", { name: /^Add to / })).not.toBeInTheDocument();
    expect(document.querySelectorAll('main ol [aria-label^="Edit "]')).toHaveLength(0);
    // The row's ⋯ stays (Copy link is anyone's), its writer items gone.
    await userEvent.click(page.getByRole("button", { name: /^Actions for symptom/ }));
    await expect
      .poll(() => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim()))
      .toEqual(["Copy link"]);
    await userEvent.keyboard("{Escape}");
    // No viewer note (timeline-ux-2): the missing writer controls say it.
    expect(page.getByText(/You can view/).query()).toBeNull();
  });
});
