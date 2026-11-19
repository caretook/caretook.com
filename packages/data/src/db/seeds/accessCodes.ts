import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import { accessCodeSchema } from "../schema";

// One access code for starting a new care group at /join/CARE-DEMO-0001
// (invites slice 5). Its own id; no limit on uses, so browser checks and
// developers can redeem it again and again. Expires a year after seeding.

export const DEMO_ACCESS_CODE_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2ba50001";
export const DEMO_ACCESS_CODE = "CARE-DEMO-0001";

export const seed = async () => {
  await getDb()
    .insert(accessCodeSchema)
    .values({
      id: DEMO_ACCESS_CODE_ID,
      code: DEMO_ACCESS_CODE,
      label: "Demo (seed)",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      maxUses: null,
      createdBy: SYSTEM_USER.id,
      updatedBy: SYSTEM_USER.id,
    })
    .onConflictDoNothing({ target: accessCodeSchema.id });
};
