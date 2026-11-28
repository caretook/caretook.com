import type { Tx } from "./types";

import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createWorld } from "../../test/fixtures";
import { isError, newError } from "../errors";
import { providerService } from "../services";
import { afterCommit, getDb, withTransaction } from "./client";
import { providerSchema } from "./schema";

// sync-safety-3 slice 1: `withTransaction` given a `tx` runs in a savepoint,
// so a nested call's failure undoes only its own writes, and `afterCommit`
// inside it waits for the outermost commit.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const { u, groupId } = await createWorld({ members: ["caretaker"] });
  const ctx = u.caretaker.ctx;
  /** One provider upsert (an upload service, as the sync registry's PUT calls it) inside `tx`. */
  const put = (tx: Tx, name: string) => {
    const id = randomUUID();
    return providerService
      .upsert({ ...ctx, tx }, { id, groupId, type: "clinician", name })
      .then((res) => (isError(res) ? res : id));
  };
  const stored = async (ids: string[]) =>
    (
      await getDb()
        .select({ id: providerSchema.id })
        .from(providerSchema)
        .where(inArray(providerSchema.id, ids))
    )
      .map((r) => r.id)
      .sort();
  return { put, stored };
};

const refused = () => newError({ code: "permissions:unauthorized" });

describe("withTransaction: nested calls", () => {
  it("rolls a service write back with an outer transaction that returns an AppError", async () => {
    const { put, stored } = await setup();
    let id = "";
    const res = await withTransaction(async (tx) => {
      const written = await put(tx, "Dr. Rollback");
      if (isError(written)) return written;
      id = written;
      return refused();
    });
    expect(codeOf(res)).toBe("permissions:unauthorized");
    expect(id).not.toBe("");
    expect(await stored([id])).toEqual([]);
  });

  it("rolls back only a nested call that returns an AppError; the outer commits the rest", async () => {
    const { put, stored } = await setup();
    const ids: string[] = [];
    let inner = "";
    const res = await withTransaction(async (tx) => {
      const before = await put(tx, "Dr. Before");
      if (isError(before)) return before;
      ids.push(before);
      const nested = await withTransaction(
        async (sp) => {
          const written = await put(sp, "Dr. Nested");
          if (isError(written)) return written;
          inner = written;
          return refused();
        },
        { tx },
      );
      expect(codeOf(nested)).toBe("permissions:unauthorized");
      const after = await put(tx, "Dr. After");
      if (isError(after)) return after;
      ids.push(after);
      return "done";
    });
    expect(res).toBe("done");
    expect(inner).not.toBe("");
    expect(await stored([...ids, inner])).toEqual([...ids].sort());
  });

  it("keeps the outer transaction usable after a nested query throws (a unique violation)", async () => {
    const { put, stored } = await setup();
    const ids: string[] = [];
    const res = await withTransaction(async (tx) => {
      const first = await put(tx, "Dr. First");
      if (isError(first)) return first;
      ids.push(first);
      const nested = await withTransaction(
        async (sp) => {
          // The same primary key again: Postgres refuses it, and the savepoint rolls back.
          await sp.execute(sql`INSERT INTO provider SELECT * FROM provider WHERE id = ${first}::uuid`);
          return "unreachable";
        },
        { tx },
      );
      expect(codeOf(nested)).toBe("db:transaction");
      // The outer transaction's next query works (an aborted one would refuse it).
      const [row] = await tx
        .select({ id: providerSchema.id })
        .from(providerSchema)
        .where(eq(providerSchema.id, first));
      expect(row?.id).toBe(first);
      const second = await put(tx, "Dr. Second");
      if (isError(second)) return second;
      ids.push(second);
      return "done";
    });
    expect(res).toBe("done");
    expect(await stored(ids)).toEqual([...ids].sort());
  });

  it("runs afterCommit from a nested call once, after the outer commit", async () => {
    let runs = 0;
    let committed = false;
    let sawCommit: boolean | undefined;
    const res = await withTransaction(async (tx) => {
      const nested = await withTransaction(
        async (sp) => {
          afterCommit(sp, () => {
            runs++;
            sawCommit = committed;
          });
          await sp.execute(sql`SELECT 1`);
          return "inner";
        },
        { tx },
      );
      expect(nested).toBe("inner");
      // Released, not committed: nothing has run yet.
      expect(runs).toBe(0);
      committed = true;
      return "outer";
    });
    expect(res).toBe("outer");
    expect(runs).toBe(1);
    expect(sawCommit).toBe(true);
  });

  it("never runs afterCommit from a nested call that rolls back, though the outer commits", async () => {
    let runs = 0;
    const res = await withTransaction(async (tx) => {
      const nested = await withTransaction(
        async (sp) => {
          afterCommit(sp, () => runs++);
          await sp.execute(sql`SELECT 1`);
          return refused();
        },
        { tx },
      );
      expect(codeOf(nested)).toBe("permissions:unauthorized");
      const thrown = await withTransaction(
        async (sp) => {
          afterCommit(sp, () => runs++);
          await sp.execute(sql`SELECT 1`);
          throw new Error("a fictional failure");
        },
        { tx },
      );
      expect(codeOf(thrown)).toBe("db:transaction");
      return "outer";
    });
    expect(res).toBe("outer");
    expect(runs).toBe(0);
  });

  it("never runs afterCommit from a nested call when the outer transaction rolls back", async () => {
    let runs = 0;
    const res = await withTransaction(async (tx) => {
      const nested = await withTransaction(
        async (sp) => {
          afterCommit(sp, () => runs++);
          // Two levels down: queued on the outermost transaction too.
          return withTransaction(
            async (deeper) => {
              afterCommit(deeper, () => runs++);
              await deeper.execute(sql`SELECT 1`);
              return "deeper";
            },
            { tx: sp },
          );
        },
        { tx },
      );
      expect(nested).toBe("deeper");
      return refused();
    });
    expect(codeOf(res)).toBe("permissions:unauthorized");
    expect(runs).toBe(0);
  });
});
