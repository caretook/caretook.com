import type { EasyModeSetting } from "@caretook/data/schema";

import { isEasyRole, isLoggerRole } from "@caretook/data/permissions";

// Which timeline a member sees (easy mode). Pure: the inputs come from the
// membership (synced: the role), the user's own setting
// (`user.preferences.easyMode`) and this device's toggle for the group
// (`lib/assistant/easyModeToggle.ts`).

/** This device's choice for one group, from the timeline's toggle; null when never toggled. */
export type DeviceToggle = "easy" | "full" | null;

export type EasyModeInputs = {
  /** Your role in the group (null for one this build doesn't know). */
  role: string | null;
  ownSetting: EasyModeSetting;
  deviceToggle: DeviceToggle;
};

export type EasyMode = {
  /** Show the easy view. */
  easy: boolean;
  /** The toggle may switch between easy and full (never for the easy roles). */
  canToggle: boolean;
  /** Your role is an easy role (Easy helper, Easy viewer): the easy view always, and its reduced frame everywhere. */
  easyRole: boolean;
  /** The view offers ways to add (the box, tiles, Given all): the loggers (writers and an Easy helper). */
  inputs: boolean;
};

/**
 * An easy role is always easy and can't toggle; anyone else sees this
 * device's toggle, else their own setting (full by default).
 */
export const resolveEasyMode = ({ role, ownSetting, deviceToggle }: EasyModeInputs): EasyMode => {
  const inputs = isLoggerRole(role);
  if (isEasyRole(role)) return { easy: true, canToggle: false, easyRole: true, inputs };
  const easy = deviceToggle ? deviceToggle === "easy" : ownSetting === "easy";
  return { easy, canToggle: true, easyRole: false, inputs };
};
