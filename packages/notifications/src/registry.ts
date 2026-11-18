import { testMessage } from "./templates/testMessage";

// Every notification Caretook sends, by name. Append new ones at the end.
// Typed as the literal object (never Record<string, …>), so a name picks its
// data type and an unknown name doesn't compile.
export const NOTIFICATIONS = {
  testMessage,
} as const;

export type Notifications = typeof NOTIFICATIONS;
export type NotificationName = keyof Notifications;
