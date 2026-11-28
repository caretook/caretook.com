import type { ProviderCreateInput } from "../db";
import type { ServiceContext } from "./types";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWorld, ok } from "../../test/fixtures";
import { withTransaction } from "../db";
import { isError, newError } from "../errors";
import { providerModel } from "../models";
import { providerService } from ".";
import { createIfAbsent } from "./upserted";

// `createIfAbsent` through the provider model: what every soft-delete
// service's `upsert` runs after parsing its input.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

/** A PUT of this provider as the actor, counting the creates it runs. */
const put = (ctx: ServiceContext, input: ProviderCreateInput & { id: string }, creates: { n: number }) =>
  withTransaction(
    (tx) =>
      createIfAbsent({
        ctx,
        tx,
        getById: providerModel.getById,
        id: input.id,
        create: () => {
          creates.n++;
          return providerService.create({ ...ctx, tx }, input);
        },
        immutable: (visible) =>
          visible.groupId !== input.groupId ? newError({ code: "providerService:immutable" }) : undefined,
      }),
    ctx,
  );

describe("createIfAbsent", () => {
  it("creates an absent row, then leaves it as it is", async () => {
    const { u, group } = await createWorld();
    const id = randomUUID();
    const input = { id, groupId: group.id, type: "clinician" as const, name: "Dr. Fictional" };
    const creates = { n: 0 };

    expect(ok(await put(u.caretaker.ctx, input, creates))).toMatchObject({
      created: true,
      row: { id, name: "Dr. Fictional" },
    });
    expect(creates.n).toBe(1);

    // The same PUT with other values: no create, and the row isn't edited.
    const replay = ok(
      await put(u.caretaker.ctx, { ...input, name: "Dr. Renamed", specialty: "Dermatology" }, creates),
    );
    expect(replay).toMatchObject({ created: false, row: { id, name: "Dr. Fictional" } });
    expect(creates.n).toBe(1);
    const stored = ok(await providerService.getById(u.caretaker.ctx, id));
    expect(stored).toMatchObject({ name: "Dr. Fictional" });
    expect(stored?.specialty).not.toBe("Dermatology");
  });

  it("refuses an id the actor can't see as it refuses one that doesn't exist", async () => {
    const { u, group } = await createWorld({ extras: ["outsider"] });
    const id = randomUUID();
    const input = { id, groupId: group.id, type: "clinician" as const, name: "Dr. Hidden" };
    ok(await put(u.caretaker.ctx, input, { n: 0 }));

    const creates = { n: 0 };
    const seen = await put(u.outsider.ctx, { ...input, name: "Dr. Probe" }, creates);
    const absent = await put(u.outsider.ctx, { ...input, id: randomUUID(), name: "Dr. Probe" }, creates);
    expect(codeOf(seen)).toBe("permissions:unauthorized");
    expect(codeOf(absent)).toBe(codeOf(seen));
    // Only the absent id got as far as a create.
    expect(creates.n).toBe(1);
  });

  it("returns the immutable error when an identity field differs", async () => {
    const { u, group } = await createWorld();
    const other = await createWorld();
    const id = randomUUID();
    const input = { id, groupId: group.id, type: "clinician" as const, name: "Dr. Settled" };
    ok(await put(u.caretaker.ctx, input, { n: 0 }));

    expect(codeOf(await put(u.caretaker.ctx, { ...input, groupId: other.group.id }, { n: 0 }))).toBe(
      "providerService:immutable",
    );
    expect(ok(await providerService.getById(u.caretaker.ctx, id))).toMatchObject({ groupId: group.id });
  });
});
