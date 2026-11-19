import type { z } from "zod";
import type { ServiceContext } from "./types";

import { withTransaction } from "../db";
import { EMPTY_CONTACT, userContactUpdateZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { userContactModel } from "../models";
import { rebuildShares } from "./memberSharingService";

// A member's own contact details (profiles): phones, a contact email and an
// address, entered once on their account. Only they read or write them; each
// group sees what they share with it, rebuilt here in the same transaction.

export const serviceName = "userContact";
export const schemaName = userContactModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "userContactService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const toContact = (row: { phones: unknown; contactEmail: string | null; address: string | null } | null) =>
  row
    ? {
        phones: row.phones as typeof EMPTY_CONTACT.phones,
        contactEmail: row.contactEmail,
        address: row.address,
      }
    : EMPTY_CONTACT;

/** The actor's contact details: empty until they save some. */
export const get = async (ctx: ServiceContext) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const row = await userContactModel.get({
    ...ctx,
    filter: { userId: { type: "eq", value: ctx.authUser.id } },
  });
  if (isError(row)) return row;
  return toContact(row);
};

/**
 * Save the actor's contact details. Fields left out keep their value; empty
 * clears. Every group they share a field with sees the change; a group
 * where they no longer share a phone takes them off its emergency list.
 */
export const update = (ctx: ServiceContext, input: z.input<typeof userContactUpdateZSchema>) =>
  withTransaction(async (tx) => {
    const parsed = userContactUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
    const userId = ctx.authUser.id;
    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await userContactModel.get({
      ...ctx,
      tx,
      filter: { userId: { type: "eq", value: userId } },
    });
    if (isError(existing)) return existing;
    const saved = existing
      ? Object.keys(data).length
        ? await userContactModel.update({
            ...ctx,
            tx,
            filter: { id: { type: "eq", value: existing.id } },
            data,
          })
        : [existing]
      : [await userContactModel.create({ ...ctx, tx, data: { userId, ...data } })];
    if (isError(saved)) return saved;
    const row = saved[0];
    if (isError(row)) return row;

    const droppedFrom = await rebuildShares(tx, userId);
    if (isError(droppedFrom)) return droppedFrom;
    return { ...toContact(row ?? null), droppedFromEmergencyLists: droppedFrom };
  }, ctx);
