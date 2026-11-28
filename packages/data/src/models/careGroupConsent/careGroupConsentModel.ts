import type { CareGroupConsent, CareGroupInvite } from "../../db";

import * as baseModel from "../base";

export const schemaName = "careGroupConsentSchema";

export const dbToModel = (row: CareGroupConsent) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Append-only: created by careGroupInviteService.accept and
// joinRequestService.requestWithLink (as the system), never changed.
export const { create, get, getById, list } = base;

/**
 * The inviter's attestation, copied from the invite onto the consent row so
 * it outlives the invite (data-rights PRD). A link may carry none: all null.
 */
export const attestationOf = (
  invite: Pick<CareGroupInvite, "consentAttestedBy" | "consentAttestedAt" | "consentVersion">,
) => ({
  consentAttestedBy: invite.consentAttestedBy,
  consentAttestedAt: invite.consentAttestedAt,
  consentAttestedVersion: invite.consentVersion,
});
