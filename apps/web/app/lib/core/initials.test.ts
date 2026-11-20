import { describe, expect, it } from "vitest";
import { initials, userInitials } from "./initials";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Maria Lopez")).toBe("ML");
    expect(initials("ana maria de la cruz")).toBe("AM");
  });
  it("uses one letter for a single name", () => {
    expect(initials("Sam")).toBe("S");
  });
  it("ignores extra whitespace", () => {
    expect(initials("  Lee   Park ")).toBe("LP");
  });
  it("is ? for an empty name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("userInitials", () => {
  it("prefers the name", () => {
    expect(userInitials({ name: "Maria Lopez", email: "zed@example.com" })).toBe("ML");
    expect(userInitials({ name: "Sam", email: "zed@example.com" })).toBe("S");
  });
  it("falls back to the email's first letter", () => {
    expect(userInitials({ name: null, email: "member@example.com" })).toBe("M");
    expect(userInitials({ name: "  ", email: "viewer@example.com" })).toBe("V");
  });
  it("is ? with neither", () => {
    expect(userInitials({})).toBe("?");
    expect(userInitials({ name: "", email: "" })).toBe("?");
  });
});
