import type { EasyModeSetting } from "@caretook/data/schema";
import type { DeviceToggle } from "./easyMode";

import { describe, expect, it } from "vitest";
import { resolveEasyMode } from "./easyMode";

const ROLES = ["owner", "admin", "caretaker", "viewer", null] as const;
const SETTINGS: EasyModeSetting[] = ["group", "easy", "full"];
const TOGGLES: DeviceToggle[] = [null, "easy", "full"];

describe("resolveEasyMode", () => {
  // Every combination of role, default, lock, own setting and toggle.
  const cases = ROLES.flatMap((role) =>
    [false, true].flatMap((ownerDefault) =>
      [false, true].flatMap((locked) =>
        SETTINGS.flatMap((ownSetting) =>
          TOGGLES.map((deviceToggle) => ({ role, ownerDefault, locked, ownSetting, deviceToggle })),
        ),
      ),
    ),
  );

  it.each(cases)("%o", (inputs) => {
    const expected = inputs.locked
      ? true
      : inputs.deviceToggle
        ? inputs.deviceToggle === "easy"
        : inputs.ownSetting === "group"
          ? inputs.ownerDefault
          : inputs.ownSetting === "easy";
    expect(resolveEasyMode(inputs)).toEqual({
      easy: expected,
      canToggle: !inputs.locked,
      locked: inputs.locked,
      inputs: inputs.role !== null && inputs.role !== "viewer",
    });
  });

  it("follows the toggle, then your own setting, then the group's default", () => {
    const base = { role: "caretaker", ownerDefault: true, locked: false } as const;
    expect(resolveEasyMode({ ...base, ownSetting: "group", deviceToggle: null }).easy).toBe(true);
    expect(resolveEasyMode({ ...base, ownSetting: "full", deviceToggle: null }).easy).toBe(false);
    expect(resolveEasyMode({ ...base, ownSetting: "full", deviceToggle: "easy" }).easy).toBe(true);
    expect(resolveEasyMode({ ...base, ownSetting: "easy", deviceToggle: "full" }).easy).toBe(false);
  });

  it("keeps a locked member in easy mode whatever they chose, with no toggle", () => {
    expect(
      resolveEasyMode({
        role: "caretaker",
        ownerDefault: false,
        locked: true,
        ownSetting: "full",
        deviceToggle: "full",
      }),
    ).toEqual({ easy: true, canToggle: false, locked: true, inputs: true });
  });

  it("gives viewers no inputs", () => {
    const viewer = resolveEasyMode({
      role: "viewer",
      ownerDefault: true,
      locked: false,
      ownSetting: "group",
      deviceToggle: null,
    });
    expect(viewer).toMatchObject({ easy: true, inputs: false });
  });
});
