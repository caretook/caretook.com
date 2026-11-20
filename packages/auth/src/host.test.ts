import { describe, expect, it } from "vitest";
import { allowedOrigins, clientIpHeader, clientIpOf, NATIVE_APP_ORIGINS, nativeAppOrigins } from "./host";

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
