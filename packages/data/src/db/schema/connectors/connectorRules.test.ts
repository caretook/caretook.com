import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  connectorClientName,
  CONNECTOR_READ_ONLY_BY_OWNER_LABEL,
  CONNECTOR_CONSENT_TEXT,
  CONNECTOR_CONSENT_VERSION,
  effectiveScope,
  oauthScopesFor,
  readOnlyByOwner,
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

  describe("with the group set to read only", () => {
    const writers = ["owner", "admin", "caretaker"] as const;
    const easy = ["easy_helper", "easy_viewer"] as const;

    it("narrow every role to read, and easy roles and non-members stay at none", () => {
      for (const role of [...writers, "viewer"] as const) {
        expect(scopesForRole(role, true)).toEqual(["read"]);
        expect(effectiveScope("readWrite", role, true)).toBe("read");
        expect(effectiveScope("read", role, true)).toBe("read");
      }
      for (const role of [...easy, null]) {
        expect(scopesForRole(role, true)).toEqual([]);
        expect(effectiveScope("readWrite", role, true)).toBeNull();
      }
    });

    it("change nothing with the setting off", () => {
      for (const role of writers) {
        expect(scopesForRole(role, false)).toEqual(scopesForRole(role));
        expect(effectiveScope("readWrite", role, false)).toBe("readWrite");
        expect(readOnlyByOwner("readWrite", role, false)).toBe(false);
      }
      expect(effectiveScope("readWrite", "viewer", false)).toBe("read");
    });

    it("blame the owner only for a connection that could write with the setting off", () => {
      for (const role of writers) {
        expect(readOnlyByOwner("readWrite", role, true)).toBe(true);
        expect(readOnlyByOwner("read", role, true)).toBe(false);
        expect(readOnlyByOwner("readWrite", role, true, false)).toBe(false);
      }
      for (const role of ["viewer", ...easy, null] as const) {
        expect(readOnlyByOwner("readWrite", role, true)).toBe(false);
      }
    });

    it("have one label", () => {
      expect(CONNECTOR_READ_ONLY_BY_OWNER_LABEL).toBe("Read only, set by the group owner");
    });
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

  it("name tags among what is sent (connectors-5)", () => {
    expect(CONNECTOR_CONSENT_TEXT).toMatch(/\btags\b/);
  });

  // A recorded version must mean the words that person saw: each version
  // pins its text's hash, so changing the text without a new version (and a
  // new line here) fails. Keep old lines; never edit one.
  it("move the version whenever the text changes", () => {
    const TEXT_BY_VERSION: Record<string, string> = {
      "2026-11-27": "c1296412419c83f7",
    };
    const hash = createHash("sha256").update(CONNECTOR_CONSENT_TEXT).digest("hex").slice(0, 16);
    expect(TEXT_BY_VERSION[CONNECTOR_CONSENT_VERSION]).toBe(hash);
  });
});
