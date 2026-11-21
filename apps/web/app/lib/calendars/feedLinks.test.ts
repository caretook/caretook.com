import { describe, expect, it } from "vitest";
import { feedLinks, webcalUrl } from "./feedLinks";

const URL_ = "https://caretook.test/api/calendar/abc_DEF-123.ics";

describe("feedLinks", () => {
  it("turns https into webcal for Apple", () => {
    expect(webcalUrl(URL_)).toBe("webcal://caretook.test/api/calendar/abc_DEF-123.ics");
    expect(webcalUrl("http://localhost:5173/api/calendar/x.ics")).toBe(
      "webcal://localhost:5173/api/calendar/x.ics",
    );
    expect(feedLinks(URL_, "Caretook: Pat").apple).toBe(webcalUrl(URL_));
  });

  it("gives Google the webcal URL as its cid", () => {
    expect(feedLinks(URL_, "Caretook: Pat").google).toBe(
      `https://calendar.google.com/calendar/render?cid=${encodeURIComponent("webcal://caretook.test/api/calendar/abc_DEF-123.ics")}`,
    );
  });

  it("gives Outlook the https URL and a name", () => {
    const outlook = new URL(feedLinks(URL_, "Caretook: Pat").outlook);
    expect(outlook.origin + outlook.pathname).toBe("https://outlook.live.com/calendar/0/addfromweb");
    expect(outlook.searchParams.get("url")).toBe(URL_);
    expect(outlook.searchParams.get("name")).toBe("Caretook: Pat");
  });
});
