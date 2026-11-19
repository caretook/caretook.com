import { STAFF_CAPABILITY_NAMES, staffCapabilities } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, adminSections, adminStartPath } from "./adminSections";

const ids = (sections: readonly { id: string }[]) => sections.map((s) => s.id);
const built = ADMIN_SECTIONS.filter((s) => s.built);

describe("adminSections", () => {
  it("lists every section in the PRD's order", () => {
    expect(ADMIN_SECTIONS.map((s) => s.label)).toEqual([
      "Users",
      "Groups",
      "Access codes",
      "New group",
      "Waitlist",
      "Audit",
      "Settings",
    ]);
  });

  it("shows admins and support every built section", () => {
    expect(ids(adminSections(staffCapabilities(["admin"])))).toEqual(ids(built));
    expect(ids(adminSections(staffCapabilities(["support"])))).toEqual(ids(built));
  });

  it("shows members nothing", () => {
    expect(adminSections(staffCapabilities(["member"]))).toEqual([]);
    expect(adminStartPath([])).toBeNull();
  });

  it("hides a section without its capability", () => {
    const withoutAudit = STAFF_CAPABILITY_NAMES.filter((c) => c !== "audit.read");
    expect(ids(adminSections(withoutAudit))).not.toContain("audit");
  });

  it("opens /admin on the first section the viewer sees", () => {
    expect(adminStartPath(staffCapabilities(["support"]))).toBe(built[0]?.path());
  });
});
