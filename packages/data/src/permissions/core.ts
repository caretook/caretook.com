import type { PartialPermissions } from "./types";

import { SYSTEM_ONLY_SCHEMA } from "./blocks";

export const CORE_PERMISSIONS = {
  // Shared rate limits (hosting PRD): our limiter's hits and Better Auth's
  // counters. Written directly (rateLimitService, Better Auth's adapter),
  // never through a model.
  rateLimitHitSchema: SYSTEM_ONLY_SCHEMA,

  rateLimitSchema: SYSTEM_ONLY_SCHEMA,
} as const satisfies PartialPermissions;
