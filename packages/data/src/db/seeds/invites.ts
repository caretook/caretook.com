import { eq } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { hashInviteToken } from "../../models/careGroupInvite/careGroupInviteModel";
import { sealLinkToken } from "../../utils/linkToken";
import { getDb } from "../client";
import {
  accountSchema,
  careGroupConsentSchema,
  careGroupInviteSchema,
  careGroupJoinRequestSchema,
  CONSENT_VERSION,
  userSchema,
} from "../schema";
import { seedPasswordHash } from "./accounts";
import { DEV_GROUP_ID } from "./careGroups";

// Invites for "Dev Family" (invites slice 4), so the Members page has
// something in each list in dev: one waiting email invite, one active
// viewer link, and a request to join through it from joiner@example.com,
// who has an account but is in no group. Own ids (…3f1d2b8f…). All
// fictional. The raw tokens are fixed, so the pages can be opened by hand:
// /invite/<EMAIL_INVITE_TOKEN> and /invite/<LINK_TOKEN>.

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

export const JOINER_EMAIL = "joiner@example.com";
const OWNER_EMAIL = "member@example.com";

export const EMAIL_INVITE_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8f0001";
export const LINK_INVITE_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8f0002";
export const JOIN_REQUEST_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8f0003";
const CONSENT_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8f0004";

export const EMAIL_INVITE_TOKEN = "DevFamilyEmailInvite-seeded-0001";
export const LINK_TOKEN = "DevFamilyViewerLink-seeded-0001";

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export const seed = async () => {
  const db = getDb();

  await db
    .insert(userSchema)
    .values({ email: JOINER_EMAIL, name: "Dev Joiner", role: "member", emailVerified: true, ...seedAudits })
    .onConflictDoNothing({ target: userSchema.email });
  const [joiner] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, JOINER_EMAIL));
  const [owner] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, OWNER_EMAIL));
  if (!joiner || !owner) return;

  const password = process.env.SEED_USER_PASSWORD;
  if (password) {
    await db
      .insert(accountSchema)
      .values({
        userId: joiner.id,
        providerId: "credential",
        accountId: joiner.id,
        password: await seedPasswordHash(password),
      })
      .onConflictDoNothing({ target: [accountSchema.providerId, accountSchema.accountId] });
  }

  const sealed = sealLinkToken(LINK_TOKEN, LINK_INVITE_ID);
  const sentBy = { createdBy: owner.id, updatedBy: owner.id };
  await db
    .insert(careGroupInviteSchema)
    .values([
      {
        id: EMAIL_INVITE_ID,
        groupId: DEV_GROUP_ID,
        kind: "email",
        email: "sam.invited@example.com",
        role: "caretaker",
        tokenHash: hashInviteToken(EMAIL_INVITE_TOKEN),
        expiresAt: daysFromNow(7),
        consentAttestedBy: owner.id,
        consentAttestedAt: new Date().toISOString(),
        consentVersion: CONSENT_VERSION,
        ...sentBy,
      },
      {
        id: LINK_INVITE_ID,
        groupId: DEV_GROUP_ID,
        kind: "link",
        role: "viewer",
        tokenHash: hashInviteToken(LINK_TOKEN),
        tokenCiphertext: sealed,
        expiresAt: daysFromNow(30),
        maxUses: 10,
        useCount: 1,
        ...sentBy,
      },
    ])
    .onConflictDoNothing({ target: careGroupInviteSchema.id });

  await db
    .insert(careGroupJoinRequestSchema)
    .values({
      id: JOIN_REQUEST_ID,
      groupId: DEV_GROUP_ID,
      userId: joiner.id,
      inviteId: LINK_INVITE_ID,
      role: "viewer",
      ...seedAudits,
    })
    .onConflictDoNothing({ target: careGroupJoinRequestSchema.id });

  await db
    .insert(careGroupConsentSchema)
    .values({
      id: CONSENT_ID,
      groupId: DEV_GROUP_ID,
      userId: joiner.id,
      consentVersion: CONSENT_VERSION,
      inviteId: LINK_INVITE_ID,
      ...seedAudits,
    })
    .onConflictDoNothing({ target: careGroupConsentSchema.id });
};
