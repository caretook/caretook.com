import {
  careRecipientDetailsService,
  careRecipientDetailsUpdateZSchema,
  emergencyContactService,
  emergencyOrderZSchema,
  memberSharingService,
  memberSharingZSchema,
  outsideContactsZSchema,
  userContactService,
  userContactUpdateZSchema,
} from "@caretook/data";
import { z } from "zod";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";

// Profiles: the recipient's sensitive details, the emergency list, and each
// member's own contact details and what they share with each group. Every
// write is online; devices read what syncs to them. A non-member gets a 404,
// the wrong role a 403. Nothing here returns a sign-in email.

const id = z.uuid();

/** The recipient's details as the API returns them: no audit fields. */
const toDetails = (details: {
  groupId: string;
  recipientId: string;
  phones: { label: string; number: string }[];
  email: string | null;
  address: string | null;
  insurance: unknown[];
  outsideContacts: unknown[];
}) => ({
  groupId: details.groupId,
  recipientId: details.recipientId,
  phones: details.phones,
  email: details.email,
  address: details.address,
  insurance: details.insurance,
  outsideContacts: details.outsideContacts,
});

const groupInput = z.object({ groupId: id });

export const profileCareGroup = {
  /** The recipient's phones, email, address, insurance and outside contacts (owners, admins, caretakers). */
  recipientDetails: authedProcedure.input(groupInput).handler(async ({ context, input }) => {
    return toDetails(unwrap(await careRecipientDetailsService.get(context, input.groupId)));
  }),

  /** Save the recipient's phones, email, address or insurance. Fields left out keep their value. */
  updateRecipientDetails: authedProcedure
    .input(careRecipientDetailsUpdateZSchema.extend({ groupId: id }))
    .handler(async ({ context, input }) => {
      const { groupId, ...data } = input;
      unwrap(await careRecipientDetailsService.update(context, groupId, data));
      return toDetails(unwrap(await careRecipientDetailsService.get(context, groupId)));
    }),

  /** Replace the outside emergency contacts (owners and admins). */
  updateOutsideContacts: authedProcedure
    .input(z.object({ groupId: id, contacts: outsideContactsZSchema }))
    .handler(async ({ context, input }) => {
      unwrap(await careRecipientDetailsService.updateOutsideContacts(context, input.groupId, input.contacts));
      return toDetails(unwrap(await careRecipientDetailsService.get(context, input.groupId)));
    }),

  /** Set the whole emergency list in order (owners and admins). Members must share a phone. */
  setEmergencyContacts: authedProcedure
    .input(z.object({ groupId: id, contacts: emergencyOrderZSchema }))
    .handler(async ({ context, input }) =>
      unwrap(await emergencyContactService.setOrder(context, input.groupId, input.contacts)),
    ),

  /** Mark one member as the primary contact, or none (owners and admins). */
  setPrimaryContact: authedProcedure
    .input(z.object({ groupId: id, userId: id.nullable() }))
    .handler(async ({ context, input }) =>
      unwrap(await emergencyContactService.setPrimary(context, input.groupId, input.userId)),
    ),

  /** What the caller shares with this group, and how they're related to the recipient. */
  updateMySharing: authedProcedure
    .input(memberSharingZSchema.extend({ groupId: id }))
    .handler(async ({ context, input }) => {
      const { groupId, ...data } = input;
      return unwrap(await memberSharingService.update(context, groupId, data));
    }),
};

export const profileMe = {
  /** The caller's own contact details (phones, contact email, address). Never shared by this. */
  contact: authedProcedure.handler(async ({ context }) => unwrap(await userContactService.get(context))),

  /** Save the caller's contact details. Each group sees only what the caller shares with it. */
  updateContact: authedProcedure
    .input(userContactUpdateZSchema)
    .handler(async ({ context, input }) => unwrap(await userContactService.update(context, input))),
};
