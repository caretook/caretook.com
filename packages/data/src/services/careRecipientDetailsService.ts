import type { z } from "zod";
import type { Tx } from "../db";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  canEditRecipient,
  canReadRecipient,
  careRecipientDetailsUpdateZSchema,
  outsideContactsZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careRecipientDetailsModel, careRecipientModel } from "../models";
import { actorRole, renumber } from "./emergencyContactService";

// The recipient's sensitive details (profiles): phones, email, address and
// insurance (owners, admins and caretakers), and outside emergency contacts
// (read by those, written by owners and admins). Viewers get nothing. One
// row per recipient, its id the recipient's, made on the first save.

export const serviceName = "careRecipientDetails";
export const schemaName = careRecipientDetailsModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "careRecipientDetailsService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

/**
 * The group's recipient, and the actor's role, after checking they may use
 * `group` of the details. A non-member gets not-found and learns nothing.
 */
const access = async (ctx: ServiceContext, groupId: string, tx: Tx, need: "read" | "edit" | "manage") => {
  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  if (!recipient) return newError({ code: "careRecipientService:notFound" });

  const role = await actorRole(ctx, groupId, tx);
  if (isError(role)) return role;
  if (need === "manage") {
    if (!canEditRecipient(role, "outsideContacts"))
      return newError({ code: "careRecipientDetailsService:managersOnly" });
  } else if (!(need === "read" ? canReadRecipient : canEditRecipient)(role, "details")) {
    return newError({ code: "careRecipientDetailsService:notAllowed" });
  }
  return recipient;
};

/** Empty details, for a recipient with none saved yet. */
const empty = (recipient: { id: string; groupId: string }) => ({
  id: recipient.id,
  groupId: recipient.groupId,
  recipientId: recipient.id,
  phones: [],
  email: null,
  address: null,
  insurance: [],
  outsideContacts: [],
});

/** The recipient's details (owners, admins and caretakers): empty until someone saves them. */
export const get = (ctx: ServiceContext, groupId: string) =>
  withTransaction(async (tx) => {
    const recipient = await access(ctx, groupId, tx, "read");
    if (isError(recipient)) return recipient;
    const details = await careRecipientDetailsModel.get({
      ...ctx,
      tx,
      filter: { groupId: { type: "eq", value: groupId } },
    });
    if (isError(details)) return details;
    return details ?? empty(recipient);
  }, ctx);

/**
 * Save the recipient's phones, email, address and insurance (owners, admins
 * and caretakers). Fields left out keep their value; empty text clears.
 */
export const update = (
  ctx: ServiceContext,
  groupId: string,
  input: z.input<typeof careRecipientDetailsUpdateZSchema>,
) =>
  withTransaction(async (tx) => {
    const parsed = careRecipientDetailsUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const recipient = await access(ctx, groupId, tx, "edit");
    if (isError(recipient)) return recipient;

    const existing = await careRecipientDetailsModel.lockForGroup(groupId, tx);
    if (isError(existing)) return existing;
    if (!existing) {
      return careRecipientDetailsModel.create({
        ...ctx,
        tx,
        data: { id: recipient.id, groupId, recipientId: recipient.id, ...data },
      });
    }
    if (!Object.keys(data).length) return existing;

    const updated = await careRecipientDetailsModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: existing.id } },
      data,
    });
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  }, ctx);

/**
 * Replace the outside contacts (owners and admins). A contact that stays
 * keeps its place on the emergency list; a new one isn't on it until the
 * order is set; a removed one leaves it, and the list is renumbered.
 */
export const updateOutsideContacts = (
  ctx: ServiceContext,
  groupId: string,
  input: z.input<typeof outsideContactsZSchema>,
) =>
  withTransaction(async (tx) => {
    const parsed = outsideContactsZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const recipient = await access(ctx, groupId, tx, "manage");
    if (isError(recipient)) return recipient;

    const existing = await careRecipientDetailsModel.lockForGroup(groupId, tx);
    if (isError(existing)) return existing;
    const rankOf = new Map((existing?.outsideContacts ?? []).map((c) => [c.id, c.emergencyRank]));
    const outsideContacts = parsed.data.map((c) => ({ ...c, emergencyRank: rankOf.get(c.id) ?? null }));

    // Outside contacts are the managers' (a field the permissions map keeps
    // for the system): written as the system, now the role is checked.
    const system = { authUser: SYSTEM_USER, tx };
    const saved = existing
      ? await careRecipientDetailsModel.update({
          ...system,
          filter: { id: { type: "eq", value: existing.id } },
          data: { outsideContacts },
        })
      : await careRecipientDetailsModel.create({
          ...system,
          data: { id: recipient.id, groupId, recipientId: recipient.id, outsideContacts },
        });
    if (isError(saved)) return saved;

    const renumbered = await renumber(tx, groupId);
    if (isError(renumbered)) return renumbered;

    return careRecipientDetailsModel.get({ ...ctx, tx, filter: { groupId: { type: "eq", value: groupId } } });
  }, ctx);
