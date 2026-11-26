import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { seed } from ".";
import { getDb } from "../client";
import { userSchema } from "../schema";
import { isError } from "../../errors";
import { DEV_SEED_PASSWORD } from "./guard";

// The seed guard (hosting slice 1), through seed() itself against the test
// database: each refusal returns before anything is written.

const seededAdmin = () => getDb().select().from(userSchema).where(eq(userSchema.email, "admin@example.com"));

describe("seed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses APP_ENV=production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SEED_USER_PASSWORD", "a-long-fictional-staging-password");
    const res = await seed();
    expect(isError(res) && res.code).toBe("db:seed:production");
    expect(await seededAdmin()).toEqual([]);
  });

  it("refuses staging with the dev password, or none", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("SEED_USER_PASSWORD", DEV_SEED_PASSWORD);
    let res = await seed();
    expect(isError(res) && res.code).toBe("db:seed:password");

    vi.stubEnv("SEED_USER_PASSWORD", "");
    res = await seed();
    expect(isError(res) && res.code).toBe("db:seed:password");
    expect(await seededAdmin()).toEqual([]);
  });

  it("refuses staging without INVITE_LINK_KEY (B-830)", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("SEED_USER_PASSWORD", "a-long-fictional-staging-password");
    vi.stubEnv("INVITE_LINK_KEY", "");
    const res = await seed();
    expect(isError(res) && res.code).toBe("db:seed:linkKey");
    expect(await seededAdmin()).toEqual([]);
  });
});
