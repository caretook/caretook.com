import { admin as accessCodeAdmin } from "../care-groups/groups";
import { auditAdmin } from "./auditAdmin";
import { groupsAdmin } from "./groupsAdmin";
import { settingsAdmin } from "./settingsAdmin";
import { suppressionsAdmin } from "./suppressionsAdmin";
import { usersAdmin } from "./usersAdmin";
import { waitlistAdmin } from "./waitlistAdmin";

/** `admin.*`: the access-code tools (care-groups/groups.ts) and each staff page's procedures. */
export const admin = {
  ...accessCodeAdmin,
  waitlist: waitlistAdmin,
  audit: auditAdmin,
  users: usersAdmin,
  groups: groupsAdmin,
  settings: settingsAdmin,
  suppressions: suppressionsAdmin,
};
