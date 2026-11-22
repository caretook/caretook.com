import { describe, expect, it } from "vitest";
import { accountBadges, mailStatusLabel, staffRoleLabel } from "./accountDisplay";

describe("accountBadges", () => {
  it("says whether the address is confirmed, disabled and staff", () => {
    expect(
      accountBadges({ emailVerified: true, disabled: false, role: "member" }).map((b) => b.label),
    ).toEqual(["Confirmed"]);
    expect(accountBadges({ emailVerified: false, disabled: true, role: "support" }).map((b) => b.id)).toEqual(
      ["unverified", "disabled", "staff"],
    );
  });

  it("labels only staff roles", () => {
    expect(staffRoleLabel("admin")).toBe("Admin");
    expect(staffRoleLabel("support")).toBe("Support");
    expect(staffRoleLabel("member")).toBeNull();
  });
});

describe("mailStatusLabel", () => {
  it("reads a status, an unknown one as it is", () => {
    expect(mailStatusLabel("skipped")).toBe("Not sent");
    expect(mailStatusLabel("strange")).toBe("strange");
  });
});
