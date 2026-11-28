import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allowedOrigins,
  clientIpHeader,
  clientIpKey,
  clientIpOf,
  DEV_CLIENT_IP_KEY,
  NATIVE_APP_ORIGINS,
  nativeAppOrigins,
} from "./host";

describe("nativeAppOrigins", () => {
  it("is empty unless NATIVE_APP_ORIGINS is 1", () => {
    for (const value of [undefined, "", "0", "true", "yes", "11"]) {
      expect(nativeAppOrigins({ NATIVE_APP_ORIGINS: value }), String(value)).toEqual([]);
    }
    expect(nativeAppOrigins({ NATIVE_APP_ORIGINS: "1" })).toEqual([
      "capacitor://localhost",
      "https://localhost",
    ]);
    expect(nativeAppOrigins({ NATIVE_APP_ORIGINS: " 1 " })).toEqual([...NATIVE_APP_ORIGINS]);
  });
});

describe("allowedOrigins", () => {
  it("is AUTH_TRUSTED_ORIGINS alone with the flag unset", () => {
    expect(allowedOrigins({ AUTH_TRUSTED_ORIGINS: "https://a.example, https://b.example" })).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
    expect(allowedOrigins({})).toEqual([]);
  });

  it("adds the native app's origins with the flag set", () => {
    expect(allowedOrigins({ NATIVE_APP_ORIGINS: "1", AUTH_TRUSTED_ORIGINS: "https://a.example" })).toEqual([
      ...NATIVE_APP_ORIGINS,
      "https://a.example",
    ]);
  });
});

describe("clientIpOf", () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it("defaults to the first x-forwarded-for entry, else x-real-ip", () => {
    expect(clientIpOf(headers({ "x-forwarded-for": " 10.1.2.3 , 10.9.9.9" }), {})).toBe("10.1.2.3");
    expect(clientIpOf(headers({ "x-real-ip": " 10.4.5.6 " }), {})).toBe("10.4.5.6");
    expect(clientIpOf(headers({ "x-forwarded-for": "10.1.2.3", "x-real-ip": "10.4.5.6" }), {})).toBe(
      "10.1.2.3",
    );
    expect(clientIpOf(headers({}), {})).toBeNull();
  });

  it("reads only CLIENT_IP_HEADER when it's set: a spoofed x-forwarded-for is ignored", () => {
    const env = { CLIENT_IP_HEADER: "X-Vercel-Forwarded-For" };
    const request = headers({
      "x-forwarded-for": "6.6.6.6",
      "x-real-ip": "6.6.6.7",
      "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1",
    });
    expect(clientIpOf(request, env)).toBe("203.0.113.7");
  });

  it("is null when CLIENT_IP_HEADER is set and the header is missing", () => {
    const env = { CLIENT_IP_HEADER: "x-vercel-forwarded-for" };
    expect(clientIpOf(headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.7" }), env)).toBeNull();
    expect(clientIpOf(headers({ "x-vercel-forwarded-for": " " }), env)).toBeNull();
  });
});

describe("clientIpHeader", () => {
  it("is the header's name, lower-cased, or undefined", () => {
    expect(clientIpHeader({ CLIENT_IP_HEADER: " X-Vercel-Forwarded-For " })).toBe("x-vercel-forwarded-for");
    expect(clientIpHeader({ CLIENT_IP_HEADER: "" })).toBeUndefined();
    expect(clientIpHeader({})).toBeUndefined();
  });
});

describe("clientIpKey", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is the client IP, trimmed, wherever it runs", () => {
    expect(clientIpKey(" 203.0.113.7 ", "mcp", { NODE_ENV: "production" })).toBe("203.0.113.7");
    expect(clientIpKey("203.0.113.7", "mcp", { NODE_ENV: "development" })).toBe("203.0.113.7");
  });

  it("with no client IP, production refuses (null) and logs it", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const missing of [null, undefined, "", "  "]) {
      expect(clientIpKey(missing, "calendar.feed", { NODE_ENV: "production" }), String(missing)).toBeNull();
    }
    expect(logged).toHaveBeenCalledTimes(4);
    expect(String(logged.mock.calls[0]?.[0])).toMatch(/no client IP.*procedure=calendar\.feed/);
  });

  it("with no client IP, dev and tests key on the fixed dev key, never 'unknown'", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const NODE_ENV of ["development", "test", undefined]) {
      expect(clientIpKey(null, "mcp", { NODE_ENV }), String(NODE_ENV)).toBe(DEV_CLIENT_IP_KEY);
    }
    expect(DEV_CLIENT_IP_KEY).not.toBe("unknown");
    expect(logged).not.toHaveBeenCalled();
  });
});
