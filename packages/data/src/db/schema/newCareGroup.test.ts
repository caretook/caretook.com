import { describe, expect, it } from "vitest";
import { defaultGroupName, newCareGroupZSchema, resolveNewCareGroup } from "./newCareGroup";

describe("defaultGroupName", () => {
  it("uses the preferred name, else the first name", () => {
    expect(defaultGroupName({ recipientName: "Pat Example", preferredName: "Grandma Pat" })).toBe(
      "Grandma Pat's care",
    );
    expect(defaultGroupName({ recipientName: "  Pat   Example " })).toBe("Pat's care");
    expect(defaultGroupName({ recipientName: "Pat Example", preferredName: "  " })).toBe("Pat's care");
    expect(defaultGroupName({ recipientName: "" })).toBe("Our care group");
  });
});

describe("resolveNewCareGroup", () => {
  it("fills the group name and drops empty optional names", () => {
    const input = newCareGroupZSchema.parse({
      recipientName: " Lou Example ",
      preferredName: "",
      groupName: "",
    });
    expect(resolveNewCareGroup(input)).toEqual({
      name: "Lou's care",
      recipient: { name: "Lou Example", preferredName: null },
    });
    expect(
      resolveNewCareGroup(newCareGroupZSchema.parse({ recipientName: "Lou", groupName: " The Examples " }))
        .name,
    ).toBe("The Examples");
  });
  it("needs the recipient's name", () => {
    const parsed = newCareGroupZSchema.safeParse({ recipientName: "  " });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Enter their name");
  });
});
