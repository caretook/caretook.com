import { describe, expect, it } from "vitest";
import {
  AVATAR_COLORS,
  AVATAR_ICONS,
  avatarChoiceZSchema,
  readAvatarChoice,
  readAvatarColor,
  readAvatarIcon,
} from "./avatar";

describe("the avatar catalog", () => {
  it("has ten colors and sixteen icons, each id once", () => {
    expect(new Set(AVATAR_COLORS).size).toBe(10);
    expect(new Set(AVATAR_ICONS).size).toBe(16);
  });

  it("accepts ids from the set, and null to clear", () => {
    expect(avatarChoiceZSchema.safeParse({ color: "jade", icon: "bird" }).success).toBe(true);
    expect(avatarChoiceZSchema.safeParse({ color: null, icon: null }).success).toBe(true);
  });

  it.each([
    ["an unknown color", { color: "red", icon: null }],
    ["an unknown icon", { color: null, icon: "pill" }],
    ["free text", { color: "my favourite", icon: null }],
    ["a URL", { color: null, icon: "https://example.com/me.png" }],
    ["a field left out", { color: "jade" }],
    ["an extra field", { color: null, icon: null, image: "https://example.com/me.png" }],
  ])("refuses %s", (_name, input) => {
    expect(avatarChoiceZSchema.safeParse(input).success).toBe(false);
  });

  it("reads an unknown id as unset, and keeps a known one", () => {
    expect(readAvatarColor("ultraviolet")).toBeNull();
    expect(readAvatarIcon("unicorn")).toBeNull();
    expect(readAvatarColor(7)).toBeNull();
    expect(readAvatarColor("sky")).toBe("sky");
    expect(readAvatarIcon("cat")).toBe("cat");
    expect(readAvatarChoice({ color: "ultraviolet", icon: "cat" })).toEqual({ color: null, icon: "cat" });
    expect(readAvatarChoice(undefined)).toEqual({ color: null, icon: null });
  });
});
