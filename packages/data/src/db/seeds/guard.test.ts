import { describe, expect, it } from "vitest";

import { DEV_SEED_PASSWORD, seedRefusal } from "./guard";

const LOCAL = "postgresql://caretook:password@localhost:5434/caretook";
const HOSTED = "postgresql://caretook_migrations:pw@ep-fictional-123.us-east-2.aws.neon.tech/caretook";
const SECRET = "a-long-fictional-staging-password";
const KEY = "a-fictional-invite-link-key";

describe("seedRefusal", () => {
  it("seeds a local database in dev and tests", () => {
    expect(seedRefusal({ DATABASE_URL: LOCAL })).toBeNull();
    expect(seedRefusal({ NODE_ENV: "test", DATABASE_URL: LOCAL })).toBeNull();
    expect(seedRefusal({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5435/caretook_test_x" })).toBeNull();
  });

  it("never seeds production", () => {
    expect(seedRefusal({ APP_ENV: "production", DATABASE_URL: LOCAL, SEED_USER_PASSWORD: SECRET })).toBe(
      "db:seed:production",
    );
    expect(seedRefusal({ APP_ENV: "production", DATABASE_URL: HOSTED })).toBe("db:seed:production");
    expect(seedRefusal({ NODE_ENV: "production", DATABASE_URL: LOCAL })).toBe("db:seed:production");
  });

  it("refuses a hosted database unless it's staging", () => {
    expect(seedRefusal({ DATABASE_URL: HOSTED, SEED_USER_PASSWORD: SECRET })).toBe("db:seed:notLocal");
    expect(seedRefusal({ DATABASE_URL: "postgresql://u:p@localhost.evil.com/db" })).toBe("db:seed:notLocal");
    expect(seedRefusal({})).toBe("db:seed:notLocal");
    expect(
      seedRefusal({
        APP_ENV: "staging",
        DATABASE_URL: HOSTED,
        SEED_USER_PASSWORD: SECRET,
        INVITE_LINK_KEY: KEY,
      }),
    ).toBeNull();
    // Staging builds run with NODE_ENV=production; APP_ENV decides.
    expect(
      seedRefusal({
        APP_ENV: "staging",
        NODE_ENV: "production",
        DATABASE_URL: HOSTED,
        SEED_USER_PASSWORD: SECRET,
        INVITE_LINK_KEY: KEY,
      }),
    ).toBeNull();
  });

  it("needs the server's INVITE_LINK_KEY on staging, so seeded links open there (B-830)", () => {
    const staging = { APP_ENV: "staging", DATABASE_URL: HOSTED, SEED_USER_PASSWORD: SECRET };
    expect(seedRefusal(staging)).toBe("db:seed:linkKey");
    expect(seedRefusal({ ...staging, INVITE_LINK_KEY: " " })).toBe("db:seed:linkKey");
    expect(seedRefusal({ ...staging, INVITE_LINK_KEY: KEY })).toBeNull();
    // Local dev and tests seal with the dev key.
    expect(seedRefusal({ DATABASE_URL: LOCAL })).toBeNull();
  });

  it("needs a secret password on staging", () => {
    expect(seedRefusal({ APP_ENV: "staging", DATABASE_URL: HOSTED })).toBe("db:seed:password");
    expect(seedRefusal({ APP_ENV: "staging", DATABASE_URL: HOSTED, SEED_USER_PASSWORD: " " })).toBe(
      "db:seed:password",
    );
    expect(
      seedRefusal({ APP_ENV: "staging", DATABASE_URL: HOSTED, SEED_USER_PASSWORD: DEV_SEED_PASSWORD }),
    ).toBe("db:seed:password");
  });

  it("refuses an APP_ENV it doesn't know", () => {
    expect(seedRefusal({ APP_ENV: "prod", DATABASE_URL: LOCAL })).toBe("db:seed:appEnv");
  });
});
