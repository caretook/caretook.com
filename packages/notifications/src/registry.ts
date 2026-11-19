import { groupInvite } from "./templates/groupInvite";
import { joinApproved, joinDeclined, joinRequested } from "./templates/joinRequests";
import { magicLink } from "./templates/magicLink";
import { resetPassword } from "./templates/resetPassword";
import { signInCode } from "./templates/signInCode";
import { testMessage } from "./templates/testMessage";
import { verifyEmail } from "./templates/verifyEmail";

// Every notification Caretook sends, by name. Append new ones at the end.
// Typed as the literal object (never Record<string, …>), so a name picks its
// data type and an unknown name doesn't compile.
export const NOTIFICATIONS = {
  testMessage,
  verifyEmail,
  resetPassword,
  magicLink,
  signInCode,
  groupInvite,
  joinRequested,
  joinApproved,
  joinDeclined,
} as const;

export type Notifications = typeof NOTIFICATIONS;
export type NotificationName = keyof Notifications;
