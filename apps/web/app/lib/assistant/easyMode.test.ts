import type { EasyModeSetting } from "@caretook/data/schema";
import type { DeviceToggle } from "./easyMode";

import { describe, expect, it } from "vitest";
import { resolveEasyMode } from "./easyMode";

const REGULAR = ["owner", "admin", "caretaker", "viewer", null] as const;
const EASY = ["easy_helper", "easy_viewer"] as const;
const SETTINGS: EasyModeSetting[] = ["easy", "full"];
const TOGGLES: DeviceToggle[] = [null, "easy", "full"];

const combos = (roles: readonly (string | null)[]) =>
  roles.flatMap((role) =>
    SETTINGS.flatMap((ownSetting) => TOGGLES.map((deviceToggle) => ({ role, ownSetting, deviceToggle }))),
  );

describe("resolveEasyMode", () => {
  it.each(combos(REGULAR))("a regular role follows the toggle, then the own setting: %o", (inputs) => {
    const easy = inputs.deviceToggle ? inputs.deviceToggle === "easy" : inputs.ownSetting === "easy";
    expect(resolveEasyMode(inputs)).toEqual({
      easy,
      canToggle: true,
      easyRole: false,
      inputs: inputs.role !== null && inputs.role !== "viewer",
    });
  });

  it.each(combos(EASY))("an easy role is always easy, with no toggle: %o", (inputs) => {
    expect(resolveEasyMode(inputs)).toEqual({
      easy: true,
      canToggle: false,
      easyRole: true,
      inputs: inputs.role === "easy_helper",
    });
  });

  it("is full by default, and the toggle wins over the own setting", () => {
    const caretaker = { role: "caretaker" } as const;
    expect(resolveEasyMode({ ...caretaker, ownSetting: "full", deviceToggle: null }).easy).toBe(false);
    expect(resolveEasyMode({ ...caretaker, ownSetting: "easy", deviceToggle: null }).easy).toBe(true);
    expect(resolveEasyMode({ ...caretaker, ownSetting: "full", deviceToggle: "easy" }).easy).toBe(true);
    expect(resolveEasyMode({ ...caretaker, ownSetting: "easy", deviceToggle: "full" }).easy).toBe(false);
  });

  it("gives an Easy helper inputs and an Easy viewer or a viewer none", () => {
    const view = (role: string) => resolveEasyMode({ role, ownSetting: "easy", deviceToggle: null });
    expect(view("easy_helper")).toMatchObject({ easy: true, inputs: true });
    expect(view("easy_viewer")).toMatchObject({ easy: true, inputs: false });
    expect(view("viewer")).toMatchObject({ easy: true, inputs: false });
  });
});
