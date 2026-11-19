import { describe, expect, it } from "vitest";
import { accountUrls, parseSignInMethod } from "./accountUrls";

describe("parseSignInMethod", () => {
  it("knows the three methods and falls back to the password", () => {
    expect(parseSignInMethod("link")).toBe("link");
    expect(parseSignInMethod("code")).toBe("code");
    expect(parseSignInMethod("password")).toBe("password");
    expect(parseSignInMethod(null)).toBe("password");
    expect(parseSignInMethod("sms")).toBe("password");
  });
});

describe("accountUrls", () => {
  it("builds sign-in links that keep a safe return path", () => {
    expect(accountUrls.signIn()).toBe("/sign-in");
    expect(accountUrls.signIn("link")).toBe("/sign-in?with=link");
    expect(accountUrls.signIn("code", "/app/settings")).toBe(
      "/sign-in?with=code&redirectTo=%2Fapp%2Fsettings",
    );
    expect(accountUrls.signIn("password", "/app")).toBe("/sign-in");
    expect(accountUrls.signIn("link", "https://evil.example")).toBe("/sign-in?with=link");
    expect(accountUrls.signIn("link", "//evil.example")).toBe("/sign-in?with=link");
  });

  it("builds the verify page with the address and where to go next", () => {
    expect(accountUrls.verifyEmail()).toBe("/verify-email");
    expect(accountUrls.verifyEmail(" a+b@example.com ", "/app/settings")).toBe(
      "/verify-email?email=a%2Bb%40example.com&next=%2Fapp%2Fsettings",
    );
    expect(accountUrls.verifyEmail("a@example.com", "//evil.example")).toBe(
      "/verify-email?email=a%40example.com",
    );
  });

  it("builds an invite's page", () => {
    expect(accountUrls.invite("abc_DEF-123")).toBe("/invite/abc_DEF-123");
  });
});

describe("accountUrls.join", () => {
  it("builds an access code's page", () => {
    expect(accountUrls.join("CARE-DEMO-0001")).toBe("/join/CARE-DEMO-0001");
    expect(accountUrls.join("a b/c")).toBe("/join/a%20b%2Fc");
  });
});
