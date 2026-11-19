import { describe, expect, it } from "vitest";

import { FORM_MESSAGES, fieldErrors, formFailure, waitlistSource } from "./forms";

describe("fieldErrors", () => {
  it("names each field by its path, in either shape, keeping the first message", () => {
    expect(
      fieldErrors([
        { path: ["email"], message: "Enter an email address" },
        { path: [{ key: "source" }, { key: "page" }], message: "Too long" },
        { path: "name", message: "Enter your name" },
        { path: ["email"], message: "A second message" },
        { path: [], message: "No field" },
        { path: ["topic"] },
      ]),
    ).toEqual({ email: "Enter an email address", "source.page": "Too long", name: "Enter your name" });
  });
});

describe("formFailure", () => {
  it("shows field errors for a validation failure", () => {
    expect(
      formFailure({
        code: "BAD_REQUEST",
        data: { issues: [{ path: ["email"], message: "Enter an email" }] },
      }),
    ).toEqual({ message: FORM_MESSAGES.invalid, fields: { email: "Enter an email" } });
  });

  it("says to wait after the rate limit, and to check the connection on a network failure", () => {
    expect(formFailure({ code: "TOO_MANY_REQUESTS" }).message).toBe(FORM_MESSAGES.tooMany);
    expect(formFailure(new TypeError("Failed to fetch")).message).toBe(FORM_MESSAGES.offline);
  });

  it("falls back to a generic line for anything else", () => {
    expect(formFailure({ code: "INTERNAL_SERVER_ERROR" })).toEqual({
      message: FORM_MESSAGES.failed,
      fields: {},
    });
    expect(formFailure("odd")).toEqual({ message: FORM_MESSAGES.failed, fields: {} });
  });
});

describe("waitlistSource", () => {
  it("keeps the page and the UTM parameters, and nothing else", () => {
    expect(
      waitlistSource(
        "/",
        "?utm_source=newsletter&utm_medium=email&utm_campaign=fall&utm_term=care&utm_content=a&ref=x",
      ),
    ).toEqual({
      page: "/",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "fall",
      utmTerm: "care",
      utmContent: "a",
    });
  });

  it("is just the page without parameters, and drops blank ones", () => {
    expect(waitlistSource("/features", "")).toEqual({ page: "/features" });
    expect(waitlistSource("/", "?utm_source=%20")).toEqual({ page: "/" });
  });

  it("caps each value at 200 characters", () => {
    const long = "x".repeat(300);
    const source = waitlistSource("/", `?utm_campaign=${long}`);
    expect(source.utmCampaign).toHaveLength(200);
  });
});
