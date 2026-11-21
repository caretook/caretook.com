import { reminderLeadsZSchema, reminderOverrideService } from "@caretook/data";
import { z } from "zod";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";

// A member's "Remind me" choice for one appointment or reminder
// (appointments-2, slice 8): own only, any role. `default` clears it.

const target = z.object({ groupId: z.uuid(), entryId: z.uuid() });

const choice = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("default") }),
  z.object({ mode: z.literal("mute") }),
  z.object({ mode: z.literal("extra"), leads: reminderLeadsZSchema }),
]);

export const overrides = {
  /** The caller's own choice for an entry (`default` when they've made none). */
  get: authedProcedure
    .input(target)
    .handler(async ({ context, input }) =>
      unwrap(await reminderOverrideService.get(context, input.groupId, input.entryId)),
    ),
  /** Save it; `default` removes it. */
  set: authedProcedure
    .input(target.extend({ choice }))
    .handler(async ({ context, input }) =>
      unwrap(await reminderOverrideService.set(context, input.groupId, input.entryId, input.choice)),
    ),
};
