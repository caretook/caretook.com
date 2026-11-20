import { describe, expect, it } from "vitest";
import {
  connectorClientName,
  CONNECTOR_CONSENT_TEXT,
  CONNECTOR_CONSENT_VERSION,
  effectiveScope,
  oauthScopesFor,
  scopesForRole,
} from "./connectorRules";

describe("connector rules", () => {
  it("let writers grant read or read and write, and viewers read only", () => {
    expect(scopesForRole("owner")).toEqual(["read", "readWrite"]);
    expect(scopesForRole("admin")).toEqual(["read", "readWrite"]);
    expect(scopesForRole("caretaker")).toEqual(["read", "readWrite"]);
    expect(scopesForRole("viewer")).toEqual(["read"]);
    expect(scopesForRole(null)).toEqual([]);
  });

  it("narrow a grant to the member's current role", () => {
    expect(effectiveScope("readWrite", "caretaker")).toBe("readWrite");
    expect(effectiveScope("readWrite", "viewer")).toBe("read");
    expect(effectiveScope("read", "owner")).toBe("read");
    expect(effectiveScope("readWrite", null)).toBeNull();
  });

  it("put the grant's scope on its tokens, with a refresh token", () => {
    expect(oauthScopesFor("read")).toEqual(["group:read", "offline_access"]);
    expect(oauthScopesFor("readWrite")).toEqual(["group:read", "group:write", "offline_access"]);
  });

  it("keep a client's name short and never empty", () => {
    expect(connectorClientName("  Claude  ")).toBe("Claude");
    expect(connectorClientName("x".repeat(60))).toHaveLength(40);
    expect(connectorClientName("")).toBe("AI assistant");
    expect(connectorClientName(null)).toBe("AI assistant");
  });

  it("say where the data goes, and are versioned", () => {
    expect(CONNECTOR_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CONNECTOR_CONSENT_TEXT).toMatch(/AI assistant I chose/);
    expect(CONNECTOR_CONSENT_TEXT).toMatch(/no one's contact details/);
  });
});
