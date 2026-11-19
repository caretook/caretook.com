import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_ALPHABET,
  accessCodeCreateZSchema,
  codeState,
  formatAccessCode,
  normalizeAccessCode,
} from "./accessCode";

describe("normalizeAccessCode", () => {
  it("ignores case, spaces and dashes", () => {
    expect(normalizeAccessCode("CARE-7K3M-Q9TD")).toBe("CARE-7K3M-Q9TD");
    expect(normalizeAccessCode(" care 7k3m q9td ")).toBe("CARE-7K3M-Q9TD");
    expect(normalizeAccessCode("care7k3mq9td")).toBe("CARE-7K3M-Q9TD");
    expect(normalizeAccessCode("care-demo-0001")).toBe("CARE-DEMO-0001");
  });
  it("refuses anything that can't be a code", () => {
    expect(normalizeAccessCode("")).toBeNull();
    expect(normalizeAccessCode("CARE-7K3M")).toBeNull();
    expect(normalizeAccessCode("CARE-7K3M-Q9TD-XXXX")).toBeNull();
  });
});

describe("formatAccessCode", () => {
  it("makes CARE- plus eight unambiguous characters", () => {
    const code = formatAccessCode(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253]));
    expect(code).toMatch(/^CARE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    for (const ch of code.slice(5).replace("-", "")) expect(ACCESS_CODE_ALPHABET).toContain(ch);
    expect(ACCESS_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(normalizeAccessCode(code)).toBe(code);
  });
});

describe("codeState", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const base = { expiresAt: "2026-12-01T00:00:00Z", revokedAt: null, maxUses: 3, useCount: 0 };
  it("is usable until it expires, is revoked or is used up", () => {
    expect(codeState({ code: base, now })).toBe("usable");
    expect(codeState({ code: { ...base, useCount: 2 }, now })).toBe("usable");
    expect(codeState({ code: { ...base, useCount: 3 }, now })).toBe("usedUp");
    expect(codeState({ code: { ...base, expiresAt: "2026-11-18T12:00:00Z" }, now })).toBe("expired");
    expect(codeState({ code: { ...base, revokedAt: "2026-11-01T00:00:00Z" }, now })).toBe("revoked");
  });
  it("has no limit without a maximum, and revoked wins over expired and used up", () => {
    expect(codeState({ code: { ...base, maxUses: null, useCount: 999 }, now })).toBe("usable");
    expect(
      codeState({
        code: { ...base, revokedAt: now.toISOString(), expiresAt: "2020-01-01T00:00:00Z", useCount: 3 },
        now,
      }),
    ).toBe("revoked");
    expect(codeState({ code: { ...base, expiresAt: "2020-01-01T00:00:00Z", useCount: 3 }, now })).toBe(
      "expired",
    );
  });
});

describe("accessCodeCreateZSchema", () => {
  it("needs a label and 1–730 days, with optional maximum uses", () => {
    expect(
      accessCodeCreateZSchema.safeParse({ label: "Flyer", expiresInDays: "30", maxUses: "" }).success,
    ).toBe(false);
    expect(accessCodeCreateZSchema.parse({ label: " Flyer ", expiresInDays: "30" })).toEqual({
      label: "Flyer",
      expiresInDays: 30,
    });
    expect(accessCodeCreateZSchema.safeParse({ label: "", expiresInDays: 30 }).success).toBe(false);
    expect(accessCodeCreateZSchema.safeParse({ label: "x", expiresInDays: 0 }).success).toBe(false);
    expect(accessCodeCreateZSchema.safeParse({ label: "x", expiresInDays: 731 }).success).toBe(false);
  });
});
