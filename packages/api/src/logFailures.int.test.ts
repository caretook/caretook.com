import type { AuthUser } from "@caretook/data";

import { newError } from "@caretook/data";
import { ORPCError, createRouterClient } from "@orpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { unwrap } from "./errors";
import { authedProcedure, publicProcedure } from "./procedures";

// Server logs carry codes and ids only (security review S-8): a 500 from a
// procedure logs its code, the procedure, the actor and the group, never
// the input, the message or the AppError's meta.

const TITLE = "Grandma refused her evening pills again";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

const router = {
  notes: {
    save: authedProcedure.input(z.object({ groupId: z.string(), title: z.string() })).handler(({ input }) =>
      unwrap(
        newError({
          code: "baseModel:create",
          message: `Couldn't save ${input.title}`,
          meta: { title: input.title },
        }),
      ),
    ),
    crash: publicProcedure.input(z.object({ title: z.string() })).handler(({ input }) => {
      throw new Error(`crashed on ${input.title}`);
    }),
    refused: authedProcedure.handler(() => unwrap(newError({ code: "baseModel:noFilter", meta: { TITLE } }))),
  },
};

const client = createRouterClient(router, {
  context: { authUser: { id: ACTOR, roleNames: ["member"] } as unknown as AuthUser },
});

afterEach(() => vi.restoreAllMocks());

const logged = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.flat().map(String).join("\n");

describe("logFailures", () => {
  it("logs a 500's code, procedure, actor and group, and no care data", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = await client.notes.save({ groupId: GROUP, title: TITLE }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).message).toBe("Something went wrong");
    expect(spy).toHaveBeenCalledTimes(1);
    const line = logged(spy);
    expect(line).not.toContain(TITLE);
    expect(line).toContain("code=baseModel:create");
    expect(line).toContain("procedure=notes.save");
    expect(line).toContain(`actor=${ACTOR}`);
    expect(line).toContain(`group=${GROUP}`);
  });

  it("logs a thrown error's class, not its message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(client.notes.crash({ title: TITLE })).rejects.toThrow();
    const line = logged(spy);
    expect(line).not.toContain(TITLE);
    expect(line).toContain("error=Error");
    expect(line).toContain("procedure=notes.crash");
  });

  it("doesn't log 4xx refusals", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(client.notes.refused()).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});
