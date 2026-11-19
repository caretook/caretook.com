import { describe, expect, it } from "vitest";
import { parseAdminGrantArgs } from "./adminGrantArgs";

describe("parseAdminGrantArgs", () => {
  it("defaults to admin", () => {
    expect(parseAdminGrantArgs(["sam@example.com"])).toEqual({ email: "sam@example.com", role: "admin" });
  });

  it("takes --role in either form, before or after the email", () => {
    expect(parseAdminGrantArgs(["--role", "support", "sam@example.com"])).toEqual({
      email: "sam@example.com",
      role: "support",
    });
    expect(parseAdminGrantArgs(["sam@example.com", "--role=admin"])).toEqual({
      email: "sam@example.com",
      role: "admin",
    });
    expect(parseAdminGrantArgs(["--", "sam@example.com"])).toEqual({
      email: "sam@example.com",
      role: "admin",
    });
  });

  it("refuses a missing email, another role, a second email and unknown options", () => {
    expect(parseAdminGrantArgs([])).toHaveProperty("error");
    expect(parseAdminGrantArgs(["sam@example.com", "--role", "member"])).toHaveProperty("error");
    expect(parseAdminGrantArgs(["sam@example.com", "--role"])).toHaveProperty("error");
    expect(parseAdminGrantArgs(["a@example.com", "b@example.com"])).toHaveProperty("error");
    expect(parseAdminGrantArgs(["a@example.com", "--force"])).toHaveProperty("error");
  });
});
