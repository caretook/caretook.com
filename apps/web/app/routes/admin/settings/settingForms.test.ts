import { describe, expect, it } from "vitest";
import {
  formIssuePath,
  localInputFromUtc,
  settingFromForm,
  settingValueText,
  utcFromLocalInput,
} from "./settingForms";

const fields = (values: Record<string, string>) => (name: string) => values[name] ?? "";

describe("settingFromForm", () => {
  it("reads a switch", () => {
    expect(settingFromForm("signup.accessCodes", fields({ value: "off" }))).toEqual({
      ok: true,
      value: false,
    });
    expect(settingFromForm("signup.accessCodes", fields({ value: "on" }))).toEqual({ ok: true, value: true });
    expect(settingFromForm("signup.accessCodes", fields({}))).toMatchObject({ ok: false });
  });

  it("reads a whole number", () => {
    expect(settingFromForm("invites.linkMaxDays", fields({ value: " 30 " }))).toEqual({
      ok: true,
      value: 30,
    });
    expect(settingFromForm("invites.linkMaxDays", fields({ value: "3.5" }))).toMatchObject({
      ok: false,
      issues: [{ path: "value" }],
    });
  });

  it("reads the allowlist by line or comma, empty meaning the environment's", () => {
    expect(
      settingFromForm(
        "mail.allowlist",
        fields({ value: "a@example.com\n @qa.example.com, b@example.com\n" }),
      ),
    ).toEqual({
      ok: true,
      value: ["a@example.com", "@qa.example.com", "b@example.com"],
    });
    expect(settingFromForm("mail.allowlist", fields({ value: "  " }))).toEqual({ ok: true, value: null });
  });

  it("reads the announcement, empty text clearing it", () => {
    expect(
      settingFromForm(
        "announcement",
        fields({ text: " Down at 9 ", tone: "warning", endsAt: "2026-11-20T18:30" }),
      ),
    ).toEqual({
      ok: true,
      value: { text: "Down at 9", tone: "warning", endsAt: "2026-11-20T18:30:00.000Z" },
    });
    expect(settingFromForm("announcement", fields({ text: "Hi", tone: "info" }))).toEqual({
      ok: true,
      value: { text: "Hi", tone: "info", endsAt: null },
    });
    expect(settingFromForm("announcement", fields({ text: "" }))).toEqual({ ok: true, value: null });
    expect(settingFromForm("announcement", fields({ text: "Hi", endsAt: "soon" }))).toMatchObject({
      ok: false,
      issues: [{ path: "endsAt" }],
    });
  });
});

describe("times in UTC", () => {
  it("round-trips a datetime-local value", () => {
    expect(utcFromLocalInput("2026-11-20T18:30")).toBe("2026-11-20T18:30:00.000Z");
    expect(utcFromLocalInput("")).toBeNull();
    expect(utcFromLocalInput("2026-13-40T99:99")).toBeUndefined();
    expect(localInputFromUtc("2026-11-20T18:30:00.000Z")).toBe("2026-11-20T18:30");
    expect(localInputFromUtc(null)).toBe("");
  });
});

describe("wording", () => {
  it("reads each kind of value", () => {
    expect(settingValueText("signup.linkInvites", false)).toBe("Off");
    expect(settingValueText("invites.linkMaxUses", 5)).toBe("5");
    expect(settingValueText("mail.allowlist", null)).toBe("From MAIL_ALLOWLIST");
    expect(settingValueText("mail.allowlist", ["a@example.com", "@qa.example.com"])).toBe(
      "a@example.com, @qa.example.com",
    );
    expect(settingValueText("announcement", null)).toBe("None");
    expect(
      settingValueText("announcement", {
        text: "Down at 9",
        tone: "warning",
        endsAt: "2026-11-20T18:30:00.000Z",
      }),
    ).toBe("Warning: Down at 9 · until 2026-11-20 18:30 UTC");
  });

  it("puts the server's issues on the form's fields", () => {
    expect(formIssuePath("invites.linkMaxDays", "")).toBe("value");
    expect(formIssuePath("mail.allowlist", "0")).toBe("value");
    expect(formIssuePath("signup.accessCodes", "reason")).toBe("reason");
    expect(formIssuePath("announcement", "tone")).toBe("tone");
    expect(formIssuePath("announcement", "")).toBe("text");
  });
});
