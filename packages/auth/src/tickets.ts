import type { AppError } from "@caretook/data";

import {
  careGroupInviteService,
  emailMatches,
  isError,
  newError,
  normalizeInviteEmail,
  SYSTEM_USER,
} from "@caretook/data";
import { getAuth } from "./auth";

// Caretook is invitation-only: public sign-up stays off (`disableSignUp`),
// and an account is created only here, with a ticket. Slice 3 takes an email
// invite's token; access codes (slice 5) add their own ticket kind.

export type Ticket = { kind: "invite"; token: string };

export type SignUpWithTicketInput = {
  ticket: Ticket;
  name: string;
  email: string;
  password: string;
};

/**
 * Create an account from a ticket. For an email invite the address must be
 * the invite's, and the account is created verified (the invite's link
 * proved the address). It doesn't join the group: the person agrees to what
 * the group shares first, then accepts (careGroupInviteService.accept).
 * Returns the new user's id and email, or an AppError (`ticket:*`).
 */
export const signUpWithTicket = async ({
  ticket,
  name,
  email,
  password,
}: SignUpWithTicketInput): Promise<{ id: string; email: string } | AppError> => {
  const invite = await careGroupInviteService.ticketFor(ticket.token);
  if (isError(invite)) return invite;
  if (!emailMatches(invite, { email })) return newError({ code: "ticket:emailMismatch" });

  const ctx = await getAuth().$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    return newError({ code: "ticket:weakPassword" });
  }

  const address = normalizeInviteEmail(invite.email);
  if (await ctx.internalAdapter.findUserByEmail(address)) return newError({ code: "ticket:accountExists" });

  const hash = await ctx.password.hash(password);
  try {
    const user = await ctx.internalAdapter.createUser(
      {
        email: address,
        name: name.trim(),
        emailVerified: true,
        createdBy: SYSTEM_USER.id,
        updatedBy: SYSTEM_USER.id,
      },
      { method: "email-password" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
    return { id: user.id, email: user.email };
  } catch (e) {
    // Two sign-ups with one address at once: the unique email decides.
    if (await ctx.internalAdapter.findUserByEmail(address)) return newError({ code: "ticket:accountExists" });
    throw e;
  }
};
