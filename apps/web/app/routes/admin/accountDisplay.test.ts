import { describe, expect, it } from "vitest";
import { accountBadges, deviceLabel, mailStatusLabel, staffRoleLabel } from "./accountDisplay";

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

describe("deviceLabel", () => {
  it("names the browser and the system", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome on Mac");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iPhone");
    expect(
      deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0"),
    ).toBe("Firefox on Windows");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      ),
    ).toBe("Edge on Windows");
    expect(
      deviceLabel(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome on Linux");
  });

  it("names the app's WebViews", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("the Caretook app on Android");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      ),
    ).toBe("the Caretook app on iPhone");
  });

  it("says what it can, or that it doesn't know", () => {
    expect(deviceLabel(null)).toBe("Unknown device");
    expect(deviceLabel("  ")).toBe("Unknown device");
    expect(deviceLabel("curl/8.4.0")).toBe("Unknown device");
    expect(deviceLabel("Something (Windows NT 10.0)")).toBe("Windows");
  });
});

describe("mailStatusLabel", () => {
  it("reads each status", () => {
    expect(mailStatusLabel("sent")).toBe("Sent");
    expect(mailStatusLabel("skipped")).toBe("Not sent");
    expect(mailStatusLabel("bounced")).toBe("Bounced");
    expect(mailStatusLabel("complained")).toBe("Marked as spam");
    expect(mailStatusLabel("strange")).toBe("strange");
  });
});
