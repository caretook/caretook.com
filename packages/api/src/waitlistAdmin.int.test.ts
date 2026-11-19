import type { AuthUser } from "@caretook/data";

import { getDb, isError, waitlistEntryModel } from "@caretook/data";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { router } from ".";

// admin.waitlist.* (marketing slice 5): staff only, filtered, newest first,
// and the export holds exactly the filtered rows.

const clientFor = (authUser: AuthUser | null) => createRouterClient(router, { context: { authUser } });

const codeOf = async (call: Promise<unknown>) => {
  try {
    await call;
    return "ok";
  } catch (e) {
    if (e instanceof ORPCError) return String(e.code);
    throw e;
  }
};

const tag = `wl${randomUUID().slice(0, 8)}`;

/** An entry joined at `createdAt`, tagged by its campaign so these tests see only their own rows. */
const join = async (
  label: string,
  createdAt: string,
  fields: { caringFor?: "parent" | "spouse"; page?: string; utmSource?: string } = {},
) => {
  const entry = await waitlistEntryModel.upsertByEmail({
    email: `${tag}-${label}@example.com`,
    firstName: label,
    caringFor: fields.caringFor ?? null,
    heardFrom: `Heard, "${label}"\non a walk`,
    source: { page: fields.page ?? "/", utmSource: fields.utmSource, utmCampaign: tag },
  });
  if (isError(entry)) throw new Error(String(entry.code));
  await getDb().$client.query("UPDATE waitlist_entry SET created_at = $1 WHERE id = $2", [
    createdAt,
    entry.id,
  ]);
  return entry;
};

let staff: ReturnType<typeof clientFor>;

beforeAll(async () => {
  staff = clientFor((await createUser("wl-staff", "admin")).ctx.authUser);
  await join("ann", "2026-10-01T12:00:00Z", { caringFor: "parent", utmSource: "newsletter" });
  await join("bea", "2026-10-15T23:59:59Z", { caringFor: "spouse", page: "/features" });
  await join("cal", "2026-10-16T00:00:00Z");
  await join("dee", "2026-11-02T08:00:00Z", { caringFor: "parent", utmSource: "NewsLetter" });
});

const emails = (rows: { email: string }[]) => rows.map((r) => r.email.split("-")[1]?.split("@")[0]);

describe("admin.waitlist access", () => {
  it("refuses anyone but staff: signed out, a member, and a group's owner", async () => {
    const member = await createUser("wl-member");
    const owner = await createUser("wl-owner");
    await createGroup(owner, [{ user: member.user, role: "caretaker" }]);
    expect(await codeOf(clientFor(null).admin.waitlist.list({}))).toBe("UNAUTHORIZED");
    expect(await codeOf(clientFor(null).admin.waitlist.export({}))).toBe("UNAUTHORIZED");
    for (const who of [member, owner]) {
      expect(await codeOf(clientFor(who.ctx.authUser).admin.waitlist.list({}))).toBe("FORBIDDEN");
      expect(await codeOf(clientFor(who.ctx.authUser).admin.waitlist.export({}))).toBe("FORBIDDEN");
    }
  });

  it("shows staff only what visitors typed, and when they joined", async () => {
    const { entries } = await staff.admin.waitlist.list({ source: tag });
    expect(Object.keys(entries[0] ?? {}).sort()).toEqual(
      ["caringFor", "createdAt", "email", "firstName", "heardFrom", "id", "source"].sort(),
    );
  });
});

describe("admin.waitlist filters", () => {
  it("lists newest first with the matching count", async () => {
    const res = await staff.admin.waitlist.list({ source: tag });
    expect(res.count).toBe(4);
    expect(emails(res.entries)).toEqual(["dee", "cal", "bea", "ann"]);
    expect(res.entries[0]?.createdAt).toBe("2026-11-02T08:00:00.000Z");
  });

  it("filters by whole days, both ends included (UTC)", async () => {
    const res = await staff.admin.waitlist.list({ source: tag, from: "2026-10-15", to: "2026-10-15" });
    expect(emails(res.entries)).toEqual(["bea"]);
    const later = await staff.admin.waitlist.list({ source: tag, from: "2026-10-16" });
    expect(emails(later.entries)).toEqual(["dee", "cal"]);
  });

  it("filters by who they care for, or by none given", async () => {
    expect(emails((await staff.admin.waitlist.list({ source: tag, caringFor: "parent" })).entries)).toEqual([
      "dee",
      "ann",
    ]);
    expect(emails((await staff.admin.waitlist.list({ source: tag, caringFor: "none" })).entries)).toEqual([
      "cal",
    ]);
  });

  it("matches a source in any page or UTM value, case ignored, with LIKE characters taken literally", async () => {
    const byCampaign = await staff.admin.waitlist.list({ source: tag.toUpperCase() });
    expect(byCampaign.count).toBe(4);
    const news = await staff.admin.waitlist.export({ source: "newsletter" });
    expect(emails(news.filter((e) => e.email.startsWith(tag)))).toEqual(["dee", "ann"]);
    expect((await staff.admin.waitlist.list({ source: `${tag.slice(0, 3)}%` })).count).toBe(0);
    expect((await staff.admin.waitlist.list({ source: "/feat_res" })).count).toBe(0);
  });

  it("pages through, and the export holds exactly the filtered rows", async () => {
    const filter = { source: tag, from: "2026-10-02" };
    const page = await staff.admin.waitlist.list({ ...filter, page: 1 });
    const rows = await staff.admin.waitlist.export(filter);
    expect(rows).toHaveLength(page.count);
    expect(emails(rows)).toEqual(["dee", "cal", "bea"]);
    expect(rows[0]?.heardFrom).toBe('Heard, "dee"\non a walk');
    expect((await staff.admin.waitlist.list({ ...filter, page: 2 })).entries).toEqual([]);
  });

  it("refuses a filter that isn't valid", async () => {
    expect(await codeOf(staff.admin.waitlist.list({ from: "yesterday" }))).toBe("BAD_REQUEST");
    expect(await codeOf(staff.admin.waitlist.list({ caringFor: "cousin" as never }))).toBe("BAD_REQUEST");
  });
});
