import { describe, expect, it } from "vitest";
import { devMailEnabled } from "./notifications";

const local = { NODE_ENV: "production", VITE_CHECK_BUILD: "1", APP_URL: "http://localhost:6673" } as const;

describe("devMailEnabled", () => {
  it("is on outside production", () => {
    expect(devMailEnabled({ NODE_ENV: "development" }, false)).toBe(true);
  });

  it("is off in production", () => {
    expect(devMailEnabled({ NODE_ENV: "production", APP_URL: "https://caretook.com" }, false)).toBe(false);
  });

  it("is on in a check build on this machine", () => {
    expect(devMailEnabled(local, true)).toBe(true);
  });

  it("needs the flag baked into the build as well as at run time", () => {
    expect(devMailEnabled(local, false)).toBe(false);
  });

  it("is off in a check build with a public APP_URL", () => {
    expect(devMailEnabled({ ...local, APP_URL: "https://caretook.com" }, true)).toBe(false);
  });
});
