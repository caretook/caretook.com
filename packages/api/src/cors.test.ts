import { allowedOrigins } from "@caretook/auth";
import { describe, expect, it } from "vitest";
import { createRpcHandler } from "./handler";

// /rpc's CORS answer for the native app (hosting slice 8): its origins only
// with NATIVE_APP_ORIGINS=1. A preflight never reaches a procedure or the db.

const preflight = (env: Record<string, string | undefined>, origin: string) =>
  createRpcHandler({ prefix: "/rpc", allowedOrigins: allowedOrigins(env) })(
    new Request("http://localhost/rpc/me/get", {
      method: "OPTIONS",
      headers: { origin, "access-control-request-method": "POST" },
    }),
    null,
  );

describe("/rpc CORS for the native app", () => {
  it("refuses capacitor://localhost with the flag unset", async () => {
    const response = await preflight({}, "capacitor://localhost");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(
      (await preflight({ NATIVE_APP_ORIGINS: "0" }, "https://localhost")).headers.get(
        "access-control-allow-origin",
      ),
    ).toBeNull();
  });

  it("allows it, with credentials, with NATIVE_APP_ORIGINS=1", async () => {
    const response = await preflight({ NATIVE_APP_ORIGINS: "1" }, "capacitor://localhost");
    expect(response.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(
      (await preflight({ NATIVE_APP_ORIGINS: "1" }, "https://evil.example")).headers.get(
        "access-control-allow-origin",
      ),
    ).toBeNull();
  });
});
