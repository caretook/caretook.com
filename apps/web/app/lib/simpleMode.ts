import type { SimpleModeSetting } from "@caretook/data/schema";

// Which timeline a member sees (assistant PRD, simple mode). Pure: the
// inputs come from the membership (synced: the managers' default and lock),
// the user's own setting (`user.preferences.simpleMode`) and this device's
// toggle for the group (`lib/simpleModeToggle.ts`).

/** This device's choice for one group, from the timeline's toggle; null when never toggled. */
export type DeviceToggle = "simple" | "full" | null;

export type SimpleModeInputs = {
  /** Your role in the group (null for one this build doesn't know). */
  role: string | null;
  /** The managers' default for you (`care_group_member.simple_mode`). */
  ownerDefault: boolean;
  /** Locked in simple mode by a manager (`simple_mode_locked`). */
  locked: boolean;
  ownSetting: SimpleModeSetting;
  deviceToggle: DeviceToggle;
};

export type SimpleMode = {
  /** Show the simple view. */
  simple: boolean;
  /** The toggle may switch between simple and full (not while locked). */
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
export const resolveSimpleMode = ({
  role,
  ownerDefault,
  locked,
  ownSetting,
  deviceToggle,
}: SimpleModeInputs): SimpleMode => {
  const inputs = !!role && WRITERS.includes(role);
  if (locked) return { simple: true, canToggle: false, locked: true, inputs };
  const simple = deviceToggle
    ? deviceToggle === "simple"
    : ownSetting !== "group"
      ? ownSetting === "simple"
      : ownerDefault;
  return { simple, canToggle: true, locked: false, inputs };
};
