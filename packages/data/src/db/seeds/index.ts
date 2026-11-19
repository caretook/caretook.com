import { newError } from "../../errors";
import { dbMayFail } from "../client";
import * as accessCodes from "./accessCodes";
import * as accounts from "./accounts";
import * as appointments from "./appointments";
import * as careGroups from "./careGroups";
import * as invites from "./invites";
import * as medicationPasses from "./medicationPasses";
import * as medications from "./medications";
import * as profiles from "./profiles";
import * as providers from "./providers";
import * as secondGroup from "./secondGroup";
import * as timelineEntries from "./timelineEntries";
import * as users from "./users";

/**
 * Insert development data. Each seed must be idempotent (safe to re-run).
 * Seeds write straight to the tables (no models), so they also work before
 * any users exist. Order matters once tables reference each other.
 */
export const seed = async () => {
  if (process.env.NODE_ENV === "production") return newError({ code: "db:seed:production" });

  return dbMayFail(async () => {
    await users.seed();
    await accounts.seed();
    await careGroups.seed();
    await timelineEntries.seed();
    await secondGroup.seed();
    await providers.seed();
    await invites.seed();
    await accessCodes.seed();
    await medicationPasses.seed();
    await medications.seed();
    await appointments.seed();
    await profiles.seed();
  }, "db:seed");
};
