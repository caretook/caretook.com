import type * as Data from "@caretook/data";
import type { AuthUser } from "@caretook/data";

import { getDb, isError, newError, providerService } from "@caretook/data";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, patchOp, putOp, upload } from "./testing";

// A failing op can't block the queue (sync-safety slice 3, B-286): the
// server stops at an op it couldn't process, answers `failed` for it with
// the results so far (a 200), and the device retries it alone. An outage
// (the database probe failing too) is a 5xx for the whole request. A NUL
// character is refused up front. Each test makes its own users and group.

const probe = vi.hoisted(() => ({ down: false }));

vi.mock("@caretook/data", async (importOriginal) => {
  const data = await importOriginal<typeof Data>();
  return {
    ...data,
    // The procedure's database probe; the services keep the real one.
    initClient: () =>
      probe.down ? Promise.resolve(data.newError({ code: "db:connect" })) : data.initClient(),
  };
});

afterEach(() => {
  probe.down = false;
  vi.restoreAllMocks();
});

const AT = "2026-11-17T21:45:25.229000Z";

const setup = async () => {
  const owner = await createUser("owner");
  const { group, recipient } = await createGroup(owner);
  return { group, recipient, owner: { ...owner, api: clientFor(owner.ctx.authUser) } };
};

const providerRow = (group_id: string, name: string) => ({
  group_id,
  type: "clinician",
  name,
  specialty: null,
  practice_id: null,
  phones: JSON.stringify([{ label: "Office", number: "(555) 010-3300" }]),
  email: null,
  address: null,
  website: null,
  status: "current",
  is_primary: 0,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
});

const symptomRow = (group_id: string, recipient_id: string, details: string) => ({
  group_id,
  recipient_id,
  kind: "symptom",
  occurred_at: AT,
  time_zone: "America/Los_Angeles",
  title: null,
  body: null,
  details,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
});

/** Three providers to create; the second's create is made to fail in Postgres. */
const threeProviders = (groupId: string) =>
  ["Dr. First", "Dr. Second", "Dr. Third"].map((name) =>
    putOp("provider", randomUUID(), providerRow(groupId, name)),
  );

/** The second provider's create fails: a real Postgres error, thrown as the model would. */
const failSecondCreate = (how: "throw" | "error") => {
  const real = providerService.upsert.bind(providerService);
  return vi.spyOn(providerService, "upsert").mockImplementation(async (...args) => {
    if (args[1].name !== "Dr. Second") return real(...args);
    if (how === "error") return newError({ code: "db:transaction" });
    await getDb().$client.query("SELECT 1 / 0");
    throw new Error("unreachable");
  });
};

const stored = async (ctx: { authUser: AuthUser }, id: string) => {
  const row = await providerService.getById(ctx, id);
  return !isError(row) && row !== null;
};

describe("sync.upload: an op the server can't process", () => {
  for (const how of ["throw", "error"] as const)
    it(`answers applied, then failed, then nothing, with a 200 (a ${how})`, async () => {
      const { owner, group } = await setup();
      const ops = threeProviders(group.id);
      failSecondCreate(how);
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const results = await upload(owner.api, ops);

      expect(results).toEqual([
        { id: ops[0]!.id, status: "applied" },
        { id: ops[1]!.id, status: "failed", code: "sync:failed" },
      ]);
      expect(await stored(owner.ctx, ops[0]!.id)).toBe(true);
      expect(await stored(owner.ctx, ops[1]!.id)).toBe(false);
      expect(await stored(owner.ctx, ops[2]!.id)).toBe(false);
    });

  it("is a 5xx for the whole request when the database probe fails too (an outage)", async () => {
    const { owner, group } = await setup();
    const ops = threeProviders(group.id);
    failSecondCreate("throw");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    probe.down = true;

    const error = await owner.api.sync.upload({ ops }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).status).toBe(500);
    // The op before it is already in Postgres: a replay of its create changes nothing.
    expect(await stored(owner.ctx, ops[0]!.id)).toBe(true);
    expect(await stored(owner.ctx, ops[2]!.id)).toBe(false);
  });
});

describe("sync.upload: a NUL character", () => {
  const invalid = (path: string) => ({
    status: "rejected",
    code: "sync:invalid",
    issues: [{ path, message: "Contains a character that can't be saved" }],
  });

  it("is refused as invalid in a text column, a JSON column and a note update, and the next ops run", async () => {
    const { owner, group, recipient } = await setup();
    const provider = putOp("provider", randomUUID(), providerRow(group.id, "Dr. Null\u0000"));
    const symptom = putOp(
      "timeline_entry",
      randomUUID(),
      symptomRow(group.id, recipient.id, JSON.stringify({ name: "Cough\u0000", severity: 2 })),
    );
    const noteEntry = putOp("timeline_entry", randomUUID(), {
      ...symptomRow(group.id, recipient.id, ""),
      kind: "note",
      details: null,
    });
    const document = putOp("note_document", noteEntry.id, { group_id: group.id });
    const update = putOp("note_update", randomUUID(), {
      group_id: group.id,
      document_id: noteEntry.id,
      data: "AAA\u0000=",
    });
    const fine = putOp("provider", randomUUID(), providerRow(group.id, "Dr. Fine"));
    const rename = patchOp("provider", fine.id, { name: "Dr. Renamed" });

    const results = await upload(owner.api, [provider, symptom, noteEntry, document, update, fine, rename]);

    expect(results.map(({ id: _id, ...rest }) => rest)).toEqual([
      invalid("name"),
      invalid("details.name"),
      { status: "applied" },
      { status: "applied" },
      invalid("data"),
      { status: "applied" },
      { status: "applied" },
    ]);
    expect(await stored(owner.ctx, provider.id)).toBe(false);
    expect(ok(await providerService.getById(owner.ctx, fine.id))?.name).toBe("Dr. Renamed");
  });
});
