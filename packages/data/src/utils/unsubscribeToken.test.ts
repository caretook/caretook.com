import { describe, expect, it } from "vitest";
import { readReminderUnsubscribeToken, reminderUnsubscribeToken } from "./unsubscribeToken";

const USER = "0b7a4c2e-0000-4000-8000-0000000000a1";
const GROUP = "0b7a4c2e-0000-4000-8000-0000000000aa";
const OTHER = "0b7a4c2e-0000-4000-8000-0000000000bb";
const DEV = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
const PROD = {
  NODE_ENV: "production",
  INVITE_LINK_KEY: "a-long-production-secret-for-tests-only",
} as NodeJS.ProcessEnv;

describe("reminder unsubscribe tokens", () => {
  it("opens to the user and group it was made for, and the same every time", () => {
    const token = reminderUnsubscribeToken(USER, GROUP, DEV)!;
    expect(token).toBe(reminderUnsubscribeToken(USER, GROUP, DEV));
    expect(token).toMatch(/^[0-9a-f-]+\.[0-9a-f-]+\.[A-Za-z0-9_-]+$/);
    expect(readReminderUnsubscribeToken(token, DEV)).toEqual({ userId: USER, groupId: GROUP });
  });

  it("refuses a changed group, a forged signature, another key and junk", () => {
    const token = reminderUnsubscribeToken(USER, GROUP, DEV)!;
    const sig = token.split(".")[2]!;
    expect(readReminderUnsubscribeToken(`${USER}.${OTHER}.${sig}`, DEV)).toBeNull();
    expect(readReminderUnsubscribeToken(`${USER}.${GROUP}.${sig.slice(1)}x`, DEV)).toBeNull();
    expect(readReminderUnsubscribeToken(token, PROD)).toBeNull();
    for (const junk of ["", "a.b.c", `${USER}.${GROUP}`, `${token}.x`]) {
      expect(readReminderUnsubscribeToken(junk, DEV)).toBeNull();
    }
  });

  it("can't be made in production without INVITE_LINK_KEY", () => {
    expect(reminderUnsubscribeToken(USER, GROUP, { NODE_ENV: "production" })).toBeNull();
  });
});
