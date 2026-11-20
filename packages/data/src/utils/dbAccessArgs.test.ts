import { describe, expect, it } from "vitest";
import { connectionStringFor, migrationsDatabaseUrl, parseDbAccessArgs } from "./dbAccessArgs";

describe("parseDbAccessArgs", () => {
  it("reads grant, revoke and list", () => {
    expect(parseDbAccessArgs(["grant", "sam@example.com", "--hours", "4"])).toEqual({
      command: "grant",
      email: "sam@example.com",
      hours: 4,
    });
    expect(
      parseDbAccessArgs(["--", "grant", "sam@example.com", "--hours=24", "--reason", "Case 12"]),
    ).toEqual({
      command: "grant",
      email: "sam@example.com",
      hours: 24,
      reason: "Case 12",
    });
    expect(parseDbAccessArgs(["revoke", "sam@example.com"])).toEqual({
      command: "revoke",
      email: "sam@example.com",
    });
    expect(parseDbAccessArgs(["list"])).toEqual({ command: "list" });
  });

  it("needs 1 to 24 whole hours for a grant", () => {
    for (const hours of ["0", "25", "1.5", "-1", "x"]) {
      expect(parseDbAccessArgs(["grant", "sam@example.com", "--hours", hours])).toHaveProperty("error");
    }
    expect(parseDbAccessArgs(["grant", "sam@example.com"])).toEqual({
      error: "grant needs --hours N (1–24)",
    });
  });

  it("refuses what it doesn't know", () => {
    expect(parseDbAccessArgs([])).toHaveProperty("error");
    expect(parseDbAccessArgs(["drop", "sam@example.com"])).toHaveProperty("error");
    expect(parseDbAccessArgs(["grant", "--hours", "2"])).toHaveProperty("error");
    expect(parseDbAccessArgs(["grant", "a@example.com", "b@example.com", "--hours", "2"])).toHaveProperty(
      "error",
    );
    expect(parseDbAccessArgs(["revoke", "a@example.com", "--hours", "2"])).toHaveProperty("error");
    expect(parseDbAccessArgs(["list", "a@example.com"])).toHaveProperty("error");
    expect(parseDbAccessArgs(["grant", "a@example.com", "--hours", "2", "--force"])).toHaveProperty("error");
  });
});

describe("migrationsDatabaseUrl", () => {
  it("prefers the migrations URL, and falls back to DATABASE_URL only in development", () => {
    expect(
      migrationsDatabaseUrl({ MIGRATIONS_DATABASE_URL: "postgres://m", DATABASE_URL: "postgres://a" }),
    ).toEqual({
      url: "postgres://m",
    });
    expect(migrationsDatabaseUrl({ DATABASE_URL: "postgres://a" })).toEqual({ url: "postgres://a" });
    expect(migrationsDatabaseUrl({ DATABASE_URL: "postgres://a", APP_ENV: "production" })).toHaveProperty(
      "error",
    );
    expect(migrationsDatabaseUrl({})).toHaveProperty("error");
  });
});

describe("connectionStringFor", () => {
  it("swaps in the role and password, keeping host, database and options", () => {
    const url = connectionStringFor(
      "postgresql://caretook_migrations:secret@db.example.com:5432/caretook?sslmode=verify-full",
      "staff_sam_example_com",
      "p/w+=",
    );
    const parsed = new URL(url);
    expect(parsed.username).toBe("staff_sam_example_com");
    expect(decodeURIComponent(parsed.password)).toBe("p/w+=");
    expect(parsed.host).toBe("db.example.com:5432");
    expect(parsed.pathname).toBe("/caretook");
    expect(parsed.searchParams.get("sslmode")).toBe("verify-full");
    expect(url).not.toContain("secret");
  });
});
