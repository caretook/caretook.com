import { getDbConfig } from "../../config";
import { newError } from "../../errors";
import { dbMayFail } from "../client";
import * as accessCodes from "./accessCodes";
import * as accounts from "./accounts";
import * as appointments from "./appointments";
import * as careGroups from "./careGroups";
import * as carePeriods from "./carePeriods";
import * as connectors from "./connectors";
import { seedRefusal } from "./guard";
import * as invites from "./invites";
import * as medicationPasses from "./medicationPasses";
import * as medications from "./medications";
import * as moreGroups from "./moreGroups";
import * as profiles from "./profiles";
import * as providers from "./providers";
import * as secondGroup from "./secondGroup";
import * as staff from "./staff";
import * as tasks from "./tasks";
import * as timelineEntries from "./timelineEntries";
import * as users from "./users";
import * as conditions from "./conditions";
import * as medicationConditions from "./medicationConditions";

/**
 * Insert development data. Each seed must be idempotent (safe to re-run).
 * Seeds write straight to the tables (no models), so they also work before
 * any users exist. Order matters once tables reference each other.
 *
 * Refuses production, a non-local database (unless `APP_ENV=staging`), and
 * staging without a secret `SEED_USER_PASSWORD` (`seedRefusal`, guard.ts).
 * On staging it also moves seeded accounts to the current
 * `SEED_USER_PASSWORD` (`accounts.rotateStagingPasswords`).
 */
export const seed = async () => {
  const refusal = seedRefusal({ ...process.env, DATABASE_URL: getDbConfig().url });
  if (refusal) return newError({ code: refusal });

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
    await carePeriods.seed();
    await moreGroups.seed();
    await staff.seed();
    await tasks.seed();
    await connectors.seed();
    await conditions.seed();
    await medicationConditions.seed();
    // Last, once every seed has made its accounts.
    const { updated } = await accounts.rotateStagingPasswords();
    if (updated) console.log(`Set ${updated} seeded account(s) to the current SEED_USER_PASSWORD`);
  }, "db:seed");
};
