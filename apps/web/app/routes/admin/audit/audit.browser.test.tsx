import type { LoaderArgs } from "../../../../test/device";
import type { AuditEntryView } from "../AuditEntryList";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ADMIN_STAFF, adminFx, SUPPORT_STAFF } from "../../../../test/adminFixtures";
import { openAdmin } from "../adminWorld";
import { parseAuditSearch } from "../auditFilters";
import * as audit from "./route";

// /admin's frame and the audit log (admin.mjs steps 1 and 2, on loader data):
// the nav each staff role gets, and the log's entries and filters (in the
// URL). Which rows a filter matches is the API's job
// (packages/api/src/auditAdmin.int.test.ts, staffAdmin.int.test.ts).

const STAFF_NAV = [
  "Users",
  "Groups",
  "Access codes",
  "New group",
  "Waitlist",
  "Audit",
  "Settings",
  "Suppressions",
];

const CODE = "CARE-7K2P-4XQM";
const created = adminFx.auditEntry({
  action: "accessCode.create",
  actor: SUPPORT_STAFF,
  changes: { code: [CODE, CODE], label: ["Clinic flyer", "Clinic flyer"] },
});
const viewed = adminFx.auditEntry({
  action: "user.view",
  actor: ADMIN_STAFF,
  targetUser: { id: "5a7d0c00-bbbb-4000-8000-000000000001", name: "Pat", email: "pat.lindqvist@example.com" },
});
const ENTRIES = [created, viewed];

/** The audit loader as the server answers: entries matching the URL's filters (by actor and action). */
const auditData = ({ url }: LoaderArgs) => {
  const { filter, page: at } = parseAuditSearch(url.search);
  const entries: AuditEntryView[] = ENTRIES.filter(
    (e) =>
      (!filter.actorId || e.actor?.id === filter.actorId) && (!filter.action || e.action === filter.action),
  );
  return {
    count: entries.length,
    page: at,
    pageSize: 50,
    entries,
    actors: [ADMIN_STAFF, SUPPORT_STAFF],
    filter,
    pages: 1,
  };
};

const openAudit = (url = "/admin/audit", staff: "admin" | "support" = "admin") =>
  openAdmin({
    staff,
    routes: { path: "/admin/audit", module: audit, loaderData: auditData },
    url,
  });

const navLabels = () =>
  [...document.querySelectorAll("[data-admin-nav] a")].map((a) => a.textContent?.trim());

describe("/admin's frame", () => {
  test.each(["admin", "support"] as const)(
    "%s sees every section in the nav, the current one marked",
    async (staff) => {
      const device = await openAudit("/admin/audit", staff);
      await expect.element(device.screen.getByRole("heading", { name: "Audit log" })).toBeVisible();
      expect(navLabels()).toEqual(STAFF_NAV);
      await expect
        .element(
          page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Audit" }),
        )
        .toHaveAttribute("aria-current", "page");
      await expect
        .element(page.getByRole("link", { name: "Back to the app" }))
        .toHaveAttribute("href", "/app");
    },
  );
});

describe("/admin/audit", () => {
  test("each entry: what, by whom, on what (a link to everything about it) and what changed", async () => {
    const device = await openAudit();
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("2 entries in the log.");
    const entry = document.querySelector(`[data-audit-entry="${created.id}"]`)!;
    expect(entry.getAttribute("data-action")).toBe("accessCode.create");
    expect(entry.getAttribute("data-actor")).toBe(SUPPORT_STAFF.email);
    expect(entry.textContent).toContain("Created an access code");
    expect(entry.textContent).toContain(`By ${SUPPORT_STAFF.name} (${SUPPORT_STAFF.email})`);
    expect(entry.textContent).toContain(`code: ${CODE}`);
    expect(entry.textContent).toContain("label: Clinic flyer");

    const view = device.screen.getByRole("link", { name: "pat.lindqvist@example.com" });
    await expect.element(view).toHaveAttribute("href", `/admin/audit?target=${viewed.targetUser!.id}`);
  });

  test("the filters are a GET form: staff member and action go in the URL and narrow the list", async () => {
    const device = await openAudit();
    await userEvent.selectOptions(
      device.screen.getByRole("combobox", { name: "Staff member" }),
      `${SUPPORT_STAFF.name} (${SUPPORT_STAFF.email})`,
    );
    await userEvent.selectOptions(
      device.screen.getByRole("combobox", { name: "Action" }),
      "Created an access code",
    );
    await userEvent.click(device.screen.getByRole("button", { name: "Filter" }));

    await expect.element(device.screen.getByRole("status")).toHaveTextContent("1 entry matches.");
    const search = new URLSearchParams(device.location().split("?")[1]);
    expect(search.get("actor")).toBe(SUPPORT_STAFF.id);
    expect(search.get("action")).toBe("accessCode.create");
    expect(
      [...document.querySelectorAll("[data-audit-entry]")].map((li) => li.getAttribute("data-actor")),
    ).toEqual([SUPPORT_STAFF.email]);
    // The form shows the filters it was opened with, and Clear goes back to everything.
    await expect
      .element(device.screen.getByRole("combobox", { name: "Action" }))
      .toHaveValue("accessCode.create");
    await userEvent.click(device.screen.getByRole("link", { name: "Clear" }));
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("2 entries in the log.");
    expect(device.location()).toBe("/admin/audit");
  });

  test("a filter nothing matches says so, with no list", async () => {
    const device = await openAudit(`/admin/audit?actor=${ADMIN_STAFF.id}&action=accessCode.revoke`);
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("0 entries match.");
    expect(document.querySelector("[data-audit-entries]")).toBeNull();
  });

  test("past 50, Older and Newer page through, keeping the filters", async () => {
    const device = await openAdmin({
      routes: {
        path: "/admin/audit",
        module: audit,
        loaderData: ({ url }: LoaderArgs) => {
          const { filter, page: at } = parseAuditSearch(url.search);
          return { count: 120, page: at, pageSize: 50, entries: [created], actors: [], filter, pages: 3 };
        },
      },
      url: "/admin/audit?action=accessCode.create",
    });
    await expect.element(device.screen.getByText("Page 1 of 3")).toBeVisible();
    await userEvent.click(device.screen.getByRole("link", { name: "Older" }));
    await expect.element(device.screen.getByText("Page 2 of 3")).toBeVisible();
    expect(device.location()).toBe("/admin/audit?action=accessCode.create&page=2");
    await expect.element(device.screen.getByRole("link", { name: "Newer" })).toBeVisible();
  });
});
