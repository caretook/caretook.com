import type { ApiOutputs } from "~/lib/core/rpc";
import type { LoaderArgs } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { formString } from "~/lib/core/form";
import { page, userEvent } from "vitest/browser";
import { adminFx } from "../../../../test/adminFixtures";
import { found } from "../../../../test/found";
import { getByCss } from "../../../../test/locators";
import { openAdmin, postedForms } from "../adminWorld";
import * as group from "../group/route";
import { parseGroupSearch } from "./groupFilters";
import * as groups from "./route";

// /admin/groups and a group's staff page (admin.mjs steps 6–8, on loader
// data): the No owner filter in the URL, the page's facts and counts (never
// care data), each member's link, and the member actions and owner invite:
// admins get them behind a reason, support gets none. What the actions do on
// the server (the change, its audit entry, the owner invite email, the
// refusals) is packages/api/src/groupsAdmin.int.test.ts; viewer@'s Members
// page following a role change is the sync matrix's (roundtrip 6b,
// care_group_member) and groupSettings.browser.test.tsx's.

type GroupPage = ApiOutputs["admin"]["groups"]["get"];

const viewer = adminFx.member({ name: "Lee Park", email: "lee.park@example.com", role: "viewer" });
const ownerless = adminFx.groupRow({
  name: "Park Family",
  recipientName: "Min Park",
  recipientPreferredName: null,
  memberCount: 1,
  owners: [],
});
const owned = adminFx.groupRow({ name: "Lindqvist Family" });

const groupsData = ({ url }: LoaderArgs) => {
  const { filter, page: at } = parseGroupSearch(url.search);
  const found = [ownerless, owned].filter((g) => !filter.noOwner || g.owners.length === 0);
  return { count: found.length, page: at, pageSize: 50, groups: found, filter, pages: 1 };
};

describe("/admin/groups", () => {
  test("each group with its recipient, members and owners; No owner goes in the URL and narrows it", async () => {
    const device = await openAdmin({
      routes: { path: "/admin/groups", module: groups, loaderData: groupsData },
      url: "/admin/groups",
    });
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("2 groups.");
    const row = (id: string) => document.querySelector(`[data-group="${id}"]`)!;
    expect(row(ownerless.id).textContent).toContain("For Min Park · 1 member");
    expect(row(ownerless.id).querySelector("[data-owners]")?.textContent).toBe("No owner");
    expect(row(owned.id).textContent).toContain("For June Lindqvist (Grandma June) · 2 members");
    expect(row(owned.id).textContent).toContain("Owner: Pat Lindqvist (pat.lindqvist@example.com)");

    await userEvent.click(device.screen.getByRole("checkbox", { name: "No owner" }));
    await userEvent.click(device.screen.getByRole("button", { name: "Search" }));
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("1 group matches.");
    // A GET form: the empty search goes along.
    expect(device.location()).toBe("/admin/groups?q=&noOwner=1");
    expect([...document.querySelectorAll("[data-group]")].map((li) => li.getAttribute("data-group"))).toEqual(
      [ownerless.id],
    );
    await expect
      .element(device.screen.getByRole("link", { name: "Park Family" }))
      .toHaveAttribute("href", `/admin/groups/${ownerless.id}`);
  });
});

/** A group's page, with `current` changing as the server would after each post. */
const openGroup = async ({
  staff = "admin",
  members = [viewer],
  answer = () => ({ ok: true, message: "Done." }),
}: {
  staff?: "admin" | "support";
  members?: GroupPage["members"];
  answer?: (form: FormData) => unknown;
} = {}) => {
  let current = adminFx.groupPage({
    id: ownerless.id,
    name: "Park Family",
    recipientName: "Min Park",
    recipientPreferredName: null,
    counts: { entries: 0, providers: 1, medications: 2 },
    members,
  });
  const audit: ReturnType<typeof adminFx.auditEntry>[] = [];
  const posted = postedForms((form) => {
    if (form.get("intent") === "promoteOwner") {
      current = {
        ...current,
        members: current.members.map((m) => (m.userId === form.get("userId") ? { ...m, role: "owner" } : m)),
      };
      audit.unshift(adminFx.auditEntry({ action: "group.promoteOwner", reason: formString(form, "reason") }));
    }
    return answer(form);
  });
  const device = await openAdmin({
    staff,
    routes: {
      path: "/admin/groups/:groupId",
      module: group,
      loaderData: () => ({
        group: current,
        audit: [...audit],
        auditCount: audit.length,
        canManage: staff === "admin",
      }),
      actionResult: posted.actionResult,
    },
    url: `/admin/groups/${ownerless.id}`,
  });
  return { device, posts: posted.posts };
};

const memberRow = (email: string) => document.querySelector(`[data-admin-member="${email}"]`);
const dialog = () => page.getByRole("dialog");

describe("a group's staff page", () => {
  test("says it has no owner, shows counts (not content) and links each member to their account", async () => {
    const { device } = await openGroup();
    await expect.element(device.screen.getByRole("heading", { name: "Park Family", level: 1 })).toBeVisible();
    expect((await found(() => document.querySelector("[data-no-owner]"))).textContent).toContain(
      "Make a member an owner, or invite one.",
    );
    expect(document.querySelector("[data-counts]")?.textContent).toBe("0 entries, 1 provider, 2 medications");
    await expect
      .element(device.screen.getByRole("link", { name: "Lee Park (lee.park@example.com)" }))
      .toHaveAttribute("href", `/admin/users/${viewer.userId}`);
    await expect.element(device.screen.getByText("Nothing yet.")).toBeVisible();
  });

  test("admin: Make owner waits for a reason, then the member is an owner, the warning goes and the activity lists it", async () => {
    const { device, posts } = await openGroup({
      answer: () => ({ ok: true, message: "Lee Park is now an owner." }),
    });
    await userEvent.click(device.screen.getByRole("button", { name: /^Make owner lee\.park@example\.com/ }));
    await expect.element(dialog().getByRole("heading", { name: "Make Lee Park an owner?" })).toBeVisible();
    const confirm = dialog().getByRole("button", { name: "Make owner", exact: true });
    await expect.element(confirm).toBeDisabled();
    await userEvent.fill(dialog().getByRole("textbox", { name: /Reason/ }), "The family asked by phone");
    await userEvent.click(confirm);

    await expect.element(getByCss('[data-admin-result="ok"]')).toHaveTextContent("Lee Park is now an owner.");
    await expect.poll(() => memberRow(viewer.email)?.getAttribute("data-role")).toBe("owner");
    expect(document.querySelector("[data-no-owner]")).toBeNull();
    expect(document.querySelector('[data-action="group.promoteOwner"]')).not.toBeNull();
    expect(posts).toEqual([
      { intent: "promoteOwner", userId: viewer.userId, who: "Lee Park", reason: "The family asked by phone" },
    ]);
  });

  test("admin: Change role offers the other roles; a refusal shows as an alert", async () => {
    const { device, posts } = await openGroup({
      answer: () => ({ ok: false, error: "A group always keeps at least one owner.", issues: [] }),
    });
    await userEvent.click(device.screen.getByRole("button", { name: /^Change role lee\.park@example\.com/ }));
    const role = dialog().getByRole("combobox", { name: "New role" });
    // The dialog opens a frame later.
    await expect.element(role).toBeVisible();
    expect([...(role.element() as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
      "Admin",
      "Caretaker",
      "Easy helper",
      "Easy viewer",
    ]);
    await userEvent.selectOptions(role, "Caretaker");
    await userEvent.fill(dialog().getByRole("textbox", { name: /Reason/ }), "Helps with rides");
    await userEvent.click(dialog().getByRole("button", { name: "Change role", exact: true }));
    await expect
      .element(device.screen.getByRole("alert"))
      .toHaveTextContent("A group always keeps at least one owner.");
    expect(posts[0]).toMatchObject({ intent: "changeRole", role: "caretaker", reason: "Helps with rides" });
  });

  test("admin: Invite an owner posts the address and reason, and says it was sent", async () => {
    const { device, posts } = await openGroup({
      answer: (form) => ({ ok: true, message: `Sent an owner invite to ${formString(form, "email")}.` }),
    });
    await userEvent.fill(device.screen.getByRole("textbox", { name: "Email" }), "min.park.jr@example.com");
    await userEvent.fill(
      device.screen.getByRole("textbox", { name: /^Reason/ }),
      "Nobody suitable to promote",
    );
    await userEvent.click(device.screen.getByRole("button", { name: "Send owner invite" }));
    await expect
      .element(getByCss('[data-admin-result="ok"]'))
      .toHaveTextContent("Sent an owner invite to min.park.jr@example.com.");
    expect(posts).toEqual([
      { intent: "inviteOwner", email: "min.park.jr@example.com", reason: "Nobody suitable to promote" },
    ]);
  });

  test("support: the page without member actions or the invite form", async () => {
    const { device } = await openGroup({ staff: "support" });
    await expect.element(device.screen.getByRole("heading", { name: "Park Family", level: 1 })).toBeVisible();
    expect(document.querySelectorAll("[data-admin-members] button")).toHaveLength(0);
    expect(document.querySelector('[data-admin-form="inviteOwner"]')).toBeNull();
    expect((await found(() => document.querySelector("[data-no-owner]"))).textContent).not.toContain(
      "invite one",
    );
  });
});
