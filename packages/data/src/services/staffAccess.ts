import type { StaffCapability } from "../db/schema";
import type { ServiceContext } from "./types";

import { staffCan } from "../db/schema";
import { newError } from "../errors";
import { isSystemUser } from "../permissions";

// The capability check every staff service makes first (admin PRD). The
// API's staffProcedure checks the same table; services check again so a
// worker or a script can't skip it. The system passes.

/** Null when `ctx` may use `capability`, else `staff:notAllowed` (a 403). */
export const staffRefusal = (ctx: ServiceContext, capability: StaffCapability) =>
  isSystemUser(ctx.authUser) || staffCan(ctx.authUser?.roleNames, capability)
    ? null
    : newError({ code: "staff:notAllowed", meta: { capability } });

/** Who an audit entry names as the actor: the staff member, or null for the system. */
export const auditActorId = (ctx: ServiceContext) =>
  !ctx.authUser || isSystemUser(ctx.authUser) ? null : ctx.authUser.id;
