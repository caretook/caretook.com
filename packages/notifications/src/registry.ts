import { accessCodeExistingAccount } from "./templates/accessCodeExistingAccount";
import { assistantsRequested } from "./templates/assistantsRequested";
import { contactMessage } from "./templates/contactMessage";
import { groupInvite } from "./templates/groupInvite";
import { joinApproved, joinDeclined, joinRequested } from "./templates/joinRequests";
import { ownerInvite } from "./templates/ownerInvite";
import { appointmentReminder, todoDue } from "./templates/reminders";
import { resetPassword } from "./templates/resetPassword";
import { signInEmail } from "./templates/signInEmail";
import { staffGroupChange } from "./templates/staffGroupChange";
import { testMessage } from "./templates/testMessage";
import { verifyEmail } from "./templates/verifyEmail";

// Every notification Caretook sends, by name. Append new ones at the end.
// Typed as the literal object (never Record<string, …>), so a name picks its
// data type and an unknown name doesn't compile.
export const NOTIFICATIONS = {
  testMessage,
  verifyEmail,
  resetPassword,
  groupInvite,
  joinRequested,
  joinApproved,
  joinDeclined,
  ownerInvite,
  contactMessage,
  accessCodeExistingAccount,
  signInEmail,
  appointmentReminder,
  todoDue,
  assistantsRequested,
  staffGroupChange,
} as const;

export type Notifications = typeof NOTIFICATIONS;
export type NotificationName = keyof Notifications;
