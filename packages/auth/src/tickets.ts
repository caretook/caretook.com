import type { AppError, NewCareGroupInput } from "@caretook/data";

import {
  accessCodeService,
  accountSchema,
  careGroupInviteService,
  emailMatches,
  isError,
  legalAcceptanceService,
  logError,
  newError,
  normalizeAccessCode,
  normalizeInviteEmail,
  SYSTEM_USER,
  userModel,
  withTransaction,
} from "@caretook/data";
import { getAuth } from "./auth";
import { sendAccessCodeExistingAccount } from "./emails";

// Caretook is invitation-only: public sign-up stays off (`disableSignUp`),
// and an account is created only here, with a ticket: an email invite's
// token or an invite link's (slices 3 and 4), or a staff access code (slice 5),
// which also starts the person's own care group.

export type Ticket =
  // `legal`: the person ticked the box; the acceptance is recorded with the account.
  | { kind: "invite"; token: string; legal: true }
  | { kind: "accessCode"; code: string; group: NewCareGroupInput; legal: true };

export type SignUpWithTicketInput = {
  ticket: Ticket;
  name: string;
  email: string;
  password: string;
};

/**
 * Create an account from a ticket. For an email invite the address must be
 * the invite's, and the account is created verified (the invite's link
 * proved the address). An invite link takes any address, and the account
 * starts unverified: the person confirms it by email before they can sign
 * in, so the owners who approve their request see a real address. Creating
 * an account doesn't join the group: the person agrees to what the group
 * shares first, then accepts (careGroupInviteService.accept).
 * Returns the new user's id, email and whether it's verified, or an AppError
 * (`ticket:*`). Through a link, an address that already has an account
 * creates nothing and returns `id: null`, looking like a new account.
 */
export const signUpWithTicket = async ({
  ticket,
  name,
  email,
  password,
}: SignUpWithTicketInput): Promise<
  { id: string | null; email: string; emailVerified: boolean; groupId?: string } | AppError
> => {
  if (ticket.kind === "accessCode") return signUpWithAccessCode({ ticket, name, email, password });
  const invite = await careGroupInviteService.ticketFor(ticket.token);
  if (isError(invite)) return invite;
  const byEmail = invite.kind === "email";
  if (byEmail && !emailMatches(invite, { email })) return newError({ code: "ticket:emailMismatch" });

  const ctx = await getAuth().$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    return newError({ code: "ticket:weakPassword" });
  }

  const address = normalizeInviteEmail(byEmail && invite.email ? invite.email : email);
  if (await ctx.internalAdapter.findUserByEmail(address)) {
    // A link says the same for an address with an account as for a new one
    // ("confirm your email"), so it can't be used to find out who has one.
    return byEmail
      ? newError({ code: "ticket:accountExists" })
      : { id: null, email: address, emailVerified: false };
  }

  const hash = await ctx.password.hash(password);
  let created: { id: string; email: string; emailVerified: boolean };
  try {
    const user = await ctx.internalAdapter.createUser(
      {
        email: address,
        name: name.trim(),
        emailVerified: byEmail,
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
    created = { id: user.id, email: user.email, emailVerified: byEmail };
  } catch (e) {
    // Two sign-ups with one address at once: the unique email decides.
    if (await ctx.internalAdapter.findUserByEmail(address))
      return byEmail
        ? newError({ code: "ticket:accountExists" })
        : { id: null, email: address, emailVerified: false };
    throw e;
  }
  await recordInviteSignUp(created.id);
  return created;
};

/**
 * The account exists by now, so a failed write doesn't fail the sign-up:
 * with no current acceptance, the accept step asks again.
 */
const recordInviteSignUp = async (userId: string) => {
  try {
    const recorded = await legalAcceptanceService.record(undefined, { userId, source: "invite_signup" });
    if (isError(recorded)) logError("invite sign-up: acceptance not recorded", recorded);
  } catch (e) {
    logError("invite sign-up: acceptance not recorded", e);
  }
};

/**
 * An access code's sign-up: in one transaction, the account (not yet
 * verified: the code doesn't prove the address, so the person confirms it
 * by email before using the app), its password, and the code's redemption,
 * which creates their care group with them as its owner, and their legal
 * acceptance. Any refusal (a used-up code, a bad group) leaves nothing behind.
 *
 * An address that already has an account answers like a new one (`id:
 * null`, no `groupId`), so a code can't be used to find out who has an
 * account: nothing is created, the code's use count stays, and the account's
 * owner gets an email saying to sign in and choose New care group. A refused
 * code or group is refused the same way for both.
 */
const signUpWithAccessCode = async ({
  ticket,
  name,
  email,
  password,
}: SignUpWithTicketInput & { ticket: Extract<Ticket, { kind: "accessCode" }> }) => {
  const ctx = await getAuth().$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    return newError({ code: "ticket:weakPassword" });
  }
  const address = normalizeInviteEmail(email);
  const hash = await ctx.password.hash(password);
  const existingAccount = () => {
    sendAccessCodeExistingAccount(address, normalizeAccessCode(ticket.code) ?? ticket.code);
    return { id: null, email: address, emailVerified: false };
  };

  const result = await withTransaction(async (tx) => {
    const system = { authUser: SYSTEM_USER, tx };
    const existing = await userModel.get({ ...system, filter: { email: { type: "eq", value: address } } });
    if (isError(existing)) return existing;
    if (existing) return (await accessCodeService.refusal(ticket.code, ticket.group)) ?? EXISTING;

    const user = await userModel.create({
      ...system,
      data: { email: address, name: name.trim(), emailVerified: false },
    });
    if (isError(user)) return user;
    if (!user) return newError({ code: "baseModel:create:nothingCreated" });
    await tx
      .insert(accountSchema)
      .values({ userId: user.id, providerId: "credential", accountId: user.id, password: hash });

    const redeemed = await accessCodeService.redeem(tx, {
      code: ticket.code,
      userId: user.id,
      group: ticket.group,
    });
    if (isError(redeemed)) return redeemed;
    const accepted = await legalAcceptanceService.record(tx, { userId: user.id, source: "access_code" });
    if (isError(accepted)) return accepted;
    return { id: user.id, email: user.email, emailVerified: false, groupId: redeemed.groupId };
  });
  if (result === EXISTING) return existingAccount();
  // Two sign-ups with one address at once: the unique email decides.
  if (isError(result) && result.code === "db:transaction") {
    const taken = await userModel.get({
      authUser: SYSTEM_USER,
      filter: { email: { type: "eq", value: address } },
    });
    if (!isError(taken) && taken) return existingAccount();
  }
  return result;
};

const EXISTING = Symbol("existing account");
