import type { Tx } from "../db";
import type { LegalAcceptanceSource } from "../db/schema";
import type { ServiceContext, ServiceSelectArgs } from "./types";

import { DEFAULT_PAGE_SIZE, SYSTEM_USER } from "../constants";
import { LEGAL_VERSIONS } from "../db/schema";
import { isError, newError } from "../errors";
import { legalAcceptanceModel } from "../models";

export const serviceName = "legalAcceptance";
export const schemaName = legalAcceptanceModel.schemaName;

type K = typeof schemaName;

const currentVersions = {
  termsVersion: LEGAL_VERSIONS.terms,
  privacyVersion: LEGAL_VERSIONS.privacy,
  healthDataPrivacyVersion: LEGAL_VERSIONS.healthDataPrivacy,
  wordingVersion: LEGAL_VERSIONS.wording,
};

/** Record one acceptance of the current versions, as the system. Append-only. */
export const record = async (
  tx: Tx | undefined,
  { userId, source }: { userId: string; source: LegalAcceptanceSource },
) => {
  const row = await legalAcceptanceModel.create({
    authUser: SYSTEM_USER,
    tx,
    data: { userId, source, ...currentVersions },
  });
  if (isError(row)) return row;
  return row ?? newError({ code: "baseModel:create:nothingCreated" });
};

/** Whether this person has accepted every current version. */
export const hasCurrent = async (userId: string, tx?: Tx) => {
  const row = await legalAcceptanceModel.get({
    authUser: SYSTEM_USER,
    tx,
    filter: {
      userId: { type: "eq", value: userId },
      termsVersion: { type: "eq", value: currentVersions.termsVersion },
      privacyVersion: { type: "eq", value: currentVersions.privacyVersion },
      healthDataPrivacyVersion: { type: "eq", value: currentVersions.healthDataPrivacyVersion },
      wordingVersion: { type: "eq", value: currentVersions.wordingVersion },
    },
  });
  return isError(row) ? row : row !== null;
};

/** The actor's own rows (the permission map scopes them). */
export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  legalAcceptanceModel.list({
    ...ctx,
    ...opts,
    paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
  });
