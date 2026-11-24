import { getDbConfig } from "../../config";
import { newError } from "../../errors";
import { dbMayFail } from "../client";
import * as accessCodes from "./accessCodes";
import * as accounts from "./accounts";
import * as appointments from "./appointments";
import * as appointmentSeries from "./appointmentSeries";
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
import * as realOwners from "./realOwners";
import * as secondGroup from "./secondGroup";
import * as setupDismissed from "./setupDismissed";
import * as staff from "./staff";
import * as tedderFamily from "./tedderFamily";
import * as todos from "./todos";
import * as timelineEntries from "./timelineEntries";
import * as users from "./users";
import * as conditions from "./conditions";
import * as medicationConditions from "./medicationConditions";
import * as conditionManagers from "./conditionManagers";

/**
 * Insert development data. Each seed must be idempotent (safe to re-run).
 * Seeds write straight to the tables (no models), so they also work before
 * any users exist. Order matters once tables reference each other.
 *
 * Refuses production, a non-local database (unless `APP_ENV=staging`), and
 * staging without a secret `SEED_USER_PASSWORD` (`seedRefusal`, guard.ts).
 * On staging it also moves seeded accounts to the current
 * `SEED_USER_PASSWORD` (`accounts.rotateStagingPasswords`) and makes every
 * real (not `@example.com`) account an owner of each seeded group
 * (`realOwners.seed`), so whoever tests staging sees the fictional data.
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
    await todos.seed();
    await connectors.seed();
    await conditions.seed();
    await medicationConditions.seed();
    await conditionManagers.seed();
    await appointmentSeries.seed();
    await tedderFamily.seed();
    // After every group exists.
    const { added } = await realOwners.seed();
    if (added) console.log(`Made real account(s) owners of seeded groups: ${added} membership(s) added`);
    // After every membership exists: seeded members don't get the setup card.
    await setupDismissed.seed();
    // Last, once every seed has made its accounts.
    const { updated } = await accounts.rotateStagingPasswords();
    if (updated) console.log(`Set ${updated} seeded account(s) to the current SEED_USER_PASSWORD`);
  }, "db:seed");
};
