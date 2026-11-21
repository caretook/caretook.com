import type { EasyModeSetting } from "@caretook/data/schema";

// Which timeline a member sees (assistant PRD, easy mode). Pure: the
// inputs come from the membership (synced: the managers' default and lock),
// the user's own setting (`user.preferences.easyMode`) and this device's
// toggle for the group (`lib/assistant/easyModeToggle.ts`).

/** This device's choice for one group, from the timeline's toggle; null when never toggled. */
export type DeviceToggle = "easy" | "full" | null;

export type EasyModeInputs = {
  /** Your role in the group (null for one this build doesn't know). */
  role: string | null;
  /** The managers' default for you (`care_group_member.simple_mode`). */
  ownerDefault: boolean;
  /** Locked in easy mode by a manager (`simple_mode_locked`). */
  locked: boolean;
  ownSetting: EasyModeSetting;
  deviceToggle: DeviceToggle;
};

export type EasyMode = {
  /** Show the easy view. */
  easy: boolean;
  /** The toggle may switch between easy and full (not while locked). */
  canToggle: boolean;
  locked: boolean;
  /** The view offers ways to add (the box, tiles, Now actions): writers only. */
  inputs: boolean;
};

const WRITERS = ["owner", "admin", "caretaker"];

/**
 * A lock wins over everything; otherwise this device's toggle, then your own
 * setting (unless it follows the group), then the managers' default.
 */
export const resolveEasyMode = ({
  role,
  ownerDefault,
  locked,
  ownSetting,
  deviceToggle,
}: EasyModeInputs): EasyMode => {
  const inputs = !!role && WRITERS.includes(role);
  if (locked) return { easy: true, canToggle: false, locked: true, inputs };
  const easy = deviceToggle
    ? deviceToggle === "easy"
    : ownSetting !== "group"
      ? ownSetting === "easy"
      : ownerDefault;
  return { easy, canToggle: true, locked: false, inputs };
};
