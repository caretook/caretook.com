import type { SimpleModeSetting } from "@caretook/data/schema";
import type { DeviceToggle } from "./simpleMode";

import { describe, expect, it } from "vitest";
import { resolveSimpleMode } from "./simpleMode";

const ROLES = ["owner", "admin", "caretaker", "viewer", null] as const;
const SETTINGS: SimpleModeSetting[] = ["group", "simple", "full"];
const TOGGLES: DeviceToggle[] = [null, "simple", "full"];

describe("resolveSimpleMode", () => {
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
        ? inputs.deviceToggle === "simple"
        : inputs.ownSetting === "group"
          ? inputs.ownerDefault
          : inputs.ownSetting === "simple";
    expect(resolveSimpleMode(inputs)).toEqual({
      simple: expected,
      canToggle: !inputs.locked,
      locked: inputs.locked,
      inputs: inputs.role !== null && inputs.role !== "viewer",
    });
  });

  it("follows the toggle, then your own setting, then the group's default", () => {
    const base = { role: "caretaker", ownerDefault: true, locked: false } as const;
    expect(resolveSimpleMode({ ...base, ownSetting: "group", deviceToggle: null }).simple).toBe(true);
    expect(resolveSimpleMode({ ...base, ownSetting: "full", deviceToggle: null }).simple).toBe(false);
    expect(resolveSimpleMode({ ...base, ownSetting: "full", deviceToggle: "simple" }).simple).toBe(true);
    expect(resolveSimpleMode({ ...base, ownSetting: "simple", deviceToggle: "full" }).simple).toBe(false);
  });

  it("keeps a locked member in simple mode whatever they chose, with no toggle", () => {
    expect(
      resolveSimpleMode({
        role: "caretaker",
        ownerDefault: false,
        locked: true,
        ownSetting: "full",
        deviceToggle: "full",
      }),
    ).toEqual({ simple: true, canToggle: false, locked: true, inputs: true });
  });

  it("gives viewers no inputs", () => {
    const viewer = resolveSimpleMode({
      role: "viewer",
      ownerDefault: true,
      locked: false,
      ownSetting: "group",
      deviceToggle: null,
    });
    expect(viewer).toMatchObject({ simple: true, inputs: false });
  });
});
