import type { CareGroupInvite } from "../../db";
import type { QueryCreateArgs } from "../base/queryHelpers";

import { createHash } from "node:crypto";
import * as baseModel from "../base";
import { normalizeEmail } from "../user";

export const schemaName = "careGroupInviteSchema";

/** Invites are looked up by the SHA-256 of their token; the token is never stored. */
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

// The token hash never leaves the model layer.
export const dbToModel = ({ tokenHash: _tokenHash, ...row }: CareGroupInvite) => ({
  ...row,
  isExpired: new Date(row.expiresAt).getTime() <= Date.now(),
});

const base = baseModel.getFunctions({ schemaName, dbToModel });

// No upsert: invites are created by the service (which makes the token) and
// otherwise only change status.
export const { get, getById, list, remove, update } = base;

// Emails are stored lowercased so they match user.email.
export const create = (args: QueryCreateArgs<typeof schemaName>) =>
  base.create({ ...args, data: { ...args.data, email: normalizeEmail(args.data.email) } });
