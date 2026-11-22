import { describe, expect, it } from "vitest";
import { devUiEnabled } from "./devUi";

const local = { NODE_ENV: "production", VITE_CHECK_BUILD: "1", APP_URL: "http://localhost:6673" } as const;

describe("devUiEnabled", () => {
  it("allows the gallery in development", () => {
    expect(devUiEnabled({ NODE_ENV: "development" }, false)).toBe(true);
  });

  it("refuses it in production", () => {
    expect(devUiEnabled({ NODE_ENV: "production", APP_URL: "https://caretook.com" }, false)).toBe(false);
  });

  it("allows it in a check build on this machine", () => {
    expect(devUiEnabled(local, true)).toBe(true);
  });

  it("refuses it when the check flag is only set at run time", () => {
    expect(devUiEnabled(local, false)).toBe(false);
  });

  it("refuses it in a check build with a public APP_URL", () => {
    expect(devUiEnabled({ ...local, APP_URL: "https://caretook.com" }, true)).toBe(false);
  });
});
