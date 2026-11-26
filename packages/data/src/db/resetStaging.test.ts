import { describe, expect, it } from "vitest";

import { deleteOrder, KEPT_TABLES, resetRefusal } from "./resetStaging";

const HOSTED = "postgresql://caretook_app:pw@ep-fictional-123.us-east-2.aws.neon.tech/caretook";
const LOCAL = "postgresql://caretook:password@localhost:5434/caretook";
const SECRET = "a-long-fictional-staging-password";

describe("resetRefusal", () => {
  it("allows only staging with a secret seed password and the link key", () => {
    const staging = { APP_ENV: "staging", DATABASE_URL: HOSTED, SEED_USER_PASSWORD: SECRET };
    expect(resetRefusal({ ...staging, INVITE_LINK_KEY: "a-fictional-invite-link-key" })).toBeNull();
    expect(resetRefusal({ APP_ENV: "staging", DATABASE_URL: HOSTED })).toBe("db:seed:password");
    // Refused before the wipe, so staging isn't left empty (B-830).
    expect(resetRefusal(staging)).toBe("db:seed:linkKey");
  });

  it("refuses production, dev and an unset APP_ENV, whatever the database", () => {
    for (const url of [HOSTED, LOCAL]) {
      const env = { DATABASE_URL: url, SEED_USER_PASSWORD: SECRET };
      expect(resetRefusal({ ...env, APP_ENV: "production" })).toBe("db:reset:notStaging");
      expect(resetRefusal({ ...env, APP_ENV: "development" })).toBe("db:reset:notStaging");
      expect(resetRefusal(env)).toBe("db:reset:notStaging");
    }
  });
});

describe("deleteOrder", () => {
  it("puts a table before every table it references", () => {
    const order = deleteOrder(
      ["care_group", "timeline_entry", "note_update", "care_group_member"],
      [
        { child: "timeline_entry", parent: "care_group" },
        { child: "note_update", parent: "timeline_entry" },
        { child: "care_group_member", parent: "care_group" },
        // A kept table's reference and a self-reference don't hold anything back.
        { child: "session", parent: "care_group" },
        { child: "timeline_entry", parent: "timeline_entry" },
      ],
    );
    expect(order).toEqual(["care_group_member", "note_update", "timeline_entry", "care_group"]);
  });

  it("returns null for a cycle", () => {
    expect(
      deleteOrder(
        ["a", "b"],
        [
          { child: "a", parent: "b" },
          { child: "b", parent: "a" },
        ],
      ),
    ).toBeNull();
  });
});

describe("KEPT_TABLES", () => {
  it("keeps sign-ins and configuration, never care data", () => {
    expect([...KEPT_TABLES].sort()).toEqual(
      ["account", "app_setting", "email_suppression", "jwks", "oauth_resource", "session", "user"].sort(),
    );
  });
});
