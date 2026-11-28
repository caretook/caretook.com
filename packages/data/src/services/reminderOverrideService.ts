import type { ReminderLead, ReminderOverrideMode, Tx } from "../db";
import type { ServiceContext } from "./types";

import { withTransaction } from "../db";
import { reminderLeadsZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, reminderOverrideModel, timelineEntryModel } from "../models";

// A member's "Remind me" choice for one appointment or reminder
// (appointments-2 slice 8): their own only, any role (viewers included). The
// choice is `default` (no row: their settings apply), `mute` (no reminders
// for this one) or `extra` (their leads plus these). `set` checks they're in
// the group and the entry is a live event or note there; the model's `owned`
// scope keeps every row theirs.

export const schemaName = reminderOverrideModel.schemaName;

export type ReminderChoice =
  { mode: "default" } | { mode: "mute" } | { mode: "extra"; leads: ReminderLead[] };

const notFound = () => newError({ code: "reminderOverrideService:notFound" });

const checkEntry = async (ctx: ServiceContext, groupId: string, entryId: string, tx: Tx) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  if (!role) return notFound();
  const entry = await timelineEntryModel.getById(entryId, { ...ctx, tx });
  if (isError(entry)) return entry;
  if (!entry || entry.groupId !== groupId || (entry.kind !== "event" && entry.kind !== "note"))
    return notFound();
  return null;
};

const ownRow = (ctx: ServiceContext, groupId: string, entryId: string, tx?: Tx) =>
  reminderOverrideModel.get({
    ...ctx,
    tx,
    filter: {
      groupId: { type: "eq", value: groupId },
      entryId: { type: "eq", value: entryId },
      userId: { type: "eq", value: ctx.authUser!.id },
    },
  });

const toChoice = (
  row: { mode: ReminderOverrideMode; leads: ReminderLead[] | null } | null,
): ReminderChoice =>
  !row
    ? { mode: "default" }
    : row.mode === "mute"
      ? { mode: "mute" }
      : { mode: "extra", leads: row.leads ?? [] };

/** The actor's own choice for an entry (`default` until they make one). */
export const get = (ctx: ServiceContext, groupId: string, entryId: string) =>
  withTransaction(async (tx) => {
    const checked = await checkEntry(ctx, groupId, entryId, tx);
    if (isError(checked)) return checked;
    const row = await ownRow(ctx, groupId, entryId, tx);
    if (isError(row)) return row;
    return toChoice(row);
  }, ctx);

/**
 * Save the actor's own choice. `default` deletes the row; `extra` needs one
 * to three leads (`invalid` otherwise).
 */
export const set = (ctx: ServiceContext, groupId: string, entryId: string, choice: ReminderChoice) =>
  withTransaction(async (tx) => {
    const checked = await checkEntry(ctx, groupId, entryId, tx);
    if (isError(checked)) return checked;
    let leads: ReminderLead[] | null = null;
    if (choice.mode === "extra") {
      const parsed = reminderLeadsZSchema.safeParse(choice.leads);
      if (!parsed.success || !parsed.data.length)
        return newError({ code: "reminderOverrideService:invalid" });
      leads = parsed.data;
    }
    const existing = await ownRow(ctx, groupId, entryId, tx);
    if (isError(existing)) return existing;
    if (choice.mode === "default") {
      if (existing) {
        const removed = await reminderOverrideModel.remove({
          ...ctx,
          tx,
          filter: { id: { type: "eq", value: existing.id } },
        });
        if (isError(removed)) return removed;
      }
      return toChoice(null);
    }
    if (existing) {
      const updated = await reminderOverrideModel.update({
        ...ctx,
        tx,
        filter: { id: { type: "eq", value: existing.id } },
        data: { mode: choice.mode, leads },
      });
      if (isError(updated)) return updated;
      return toChoice(updated[0] ?? { mode: choice.mode, leads });
    }
    const created = await reminderOverrideModel.create({
      ...ctx,
      tx,
      data: { userId: ctx.authUser!.id, groupId, entryId, mode: choice.mode, leads },
    });
    if (isError(created)) return created;
    return toChoice(created);
  }, ctx);
