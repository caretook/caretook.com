import type { PartialPermissions } from "./types";

import { SYSTEM_ONLY_SCHEMA } from "./blocks";

export const NOTIFICATIONS_PERMISSIONS = {
  // @caretook/notifications' outbox and the dev mailbox: the system's only.
  notificationOutboxSchema: SYSTEM_ONLY_SCHEMA,

  devMailSchema: SYSTEM_ONLY_SCHEMA,

  // Suppressed email addresses (hosting PRD, slice 4). Written and read
  // directly by emailSuppressionService (after the staff capability check
  // for staff reads and clears), never through a model.
  emailSuppressionSchema: SYSTEM_ONLY_SCHEMA,
} as const satisfies PartialPermissions;
