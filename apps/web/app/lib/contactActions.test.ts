import { describe, expect, it } from "vitest";
import {
  allActions,
  callLabel,
  contactDetails,
  mailtoHref,
  mapsHref,
  quickActions,
  smsHref,
  telHref,
  textAction,
  websiteHref,
} from "./contactActions";

describe("smsHref", () => {
  it("texts the main number, without an extension", () => {
    expect(smsHref("(555) 010-2200")).toBe("sms:5550102200");
    expect(smsHref("+1 555 010 5500")).toBe("sms:+15550105500");
    expect(smsHref("(555) 010-2200 x214")).toBe("sms:5550102200");
  });
  it("is null without digits", () => {
    expect(smsHref("text me")).toBeNull();
  });
});

describe("textAction", () => {
  it("is named for who and which number", () => {
    expect(textAction("Sam", { label: "Mobile", number: "555 0102" })).toEqual({
      kind: "text",
      href: "sms:5550102",
      label: "Text Sam, mobile",
      value: "555 0102",
    });
    expect(textAction("Sam", { label: "", number: "555" })?.label).toBe("Text Sam");
    expect(textAction("Sam", { label: "", number: "none" })).toBeNull();
  });
});

describe("telHref", () => {
  it("keeps the digits and a leading +", () => {
    expect(telHref("(555) 010-2200")).toBe("tel:5550102200");
    expect(telHref("+1 555 010 5500")).toBe("tel:+15550105500");
    expect(telHref("555.010.2200")).toBe("tel:5550102200");
    expect(telHref(" +44 (0)20 7946 0018 ")).toBe("tel:+4402079460018");
  });

  it("dials an extension after a pause", () => {
    expect(telHref("(555) 010-2200 x214")).toBe("tel:5550102200,214");
    expect(telHref("555 0102 ext. 9")).toBe("tel:5550102,9");
    expect(telHref("555 0102 extension 12")).toBe("tel:5550102,12");
  });

  it("is null without digits", () => {
    expect(telHref("")).toBeNull();
    expect(telHref("call me")).toBeNull();
    expect(telHref("+")).toBeNull();
  });
});

describe("mailtoHref", () => {
  it("links an address, trimmed", () => {
    expect(mailtoHref(" e.alvarez@westsidefamily.example ")).toBe("mailto:e.alvarez@westsidefamily.example");
    expect(mailtoHref("a+b@clinic.example")).toBe("mailto:a+b@clinic.example");
  });
  it("is null for nothing", () => {
    expect(mailtoHref("  ")).toBeNull();
  });
});

describe("mapsHref", () => {
  it("searches the address, its lines joined with commas", () => {
    expect(mapsHref("1200 Westside Ave, Suite 300\nSpringfield, CA 90000")).toBe(
      "https://www.google.com/maps/search/?api=1&query=1200%20Westside%20Ave%2C%20Suite%20300%2C%20Springfield%2C%20CA%2090000",
    );
    expect(mapsHref(" 310 Main St \r\n\r\n Springfield ")).toBe(
      "https://www.google.com/maps/search/?api=1&query=310%20Main%20St%2C%20Springfield",
    );
  });
  it("is null for an empty address", () => {
    expect(mapsHref(" \n ")).toBeNull();
  });
});

describe("websiteHref", () => {
  it("adds https:// to a bare site", () => {
    expect(websiteHref("westsidefamily.example")).toBe("https://westsidefamily.example/");
    expect(websiteHref("harborheart.example/patel")).toBe("https://harborheart.example/patel");
  });
  it("keeps an http or https link as it is", () => {
    expect(websiteHref("https://harborheart.example/patel")).toBe("https://harborheart.example/patel");
    expect(websiteHref("http://old.example")).toBe("http://old.example/");
  });
  it("never links another scheme, or nothing", () => {
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref("ftp://files.example")).toBeNull();
    expect(websiteHref(" ")).toBeNull();
  });
});

describe("callLabel", () => {
  it("names the provider and the number's label", () => {
    expect(callLabel("Dr. Elena Alvarez", { label: "Office", number: "1" })).toBe(
      "Call Dr. Elena Alvarez, office",
    );
    expect(callLabel("Dr. Elena Alvarez", { label: " ", number: "1" })).toBe("Call Dr. Elena Alvarez");
  });
});

const alvarez = {
  name: "Dr. Elena Alvarez",
  phones: [
    { label: "Office", number: "(555) 010-2200 x214" },
    { label: "After hours", number: "(555) 010-2299" },
  ],
  email: "e.alvarez@westsidefamily.example",
  address: "1200 Westside Ave\nSpringfield, CA 90000",
  website: "westsidefamily.example",
};

describe("quickActions", () => {
  it("calls the first number, emails and maps", () => {
    expect(quickActions(alvarez).map((a) => [a.kind, a.label, a.href])).toEqual([
      ["call", "Call Dr. Elena Alvarez, office", "tel:5550102200,214"],
      ["email", "Email Dr. Elena Alvarez", "mailto:e.alvarez@westsidefamily.example"],
      [
        "map",
        "Open Dr. Elena Alvarez's address in maps",
        "https://www.google.com/maps/search/?api=1&query=1200%20Westside%20Ave%2C%20Springfield%2C%20CA%2090000",
      ],
    ]);
  });

  it("leaves out what's missing, or can't be dialled", () => {
    expect(quickActions({ name: "Aide", phones: [], email: null, address: null })).toEqual([]);
    expect(
      quickActions({
        name: "Aide",
        phones: [{ label: "", number: "ask" }],
        email: null,
        address: "Here",
      }).map((a) => a.kind),
    ).toEqual(["map"]);
  });
});

describe("allActions", () => {
  it("lists every number, then email, map and website", () => {
    expect(allActions(alvarez).map((a) => [a.kind, a.label])).toEqual([
      ["call", "Call Dr. Elena Alvarez, office"],
      ["call", "Call Dr. Elena Alvarez, after hours"],
      ["email", "Email Dr. Elena Alvarez"],
      ["map", "Open Dr. Elena Alvarez's address in maps"],
      ["website", "Open Dr. Elena Alvarez's website"],
    ]);
    expect(allActions(alvarez).at(-1)?.href).toBe("https://westsidefamily.example/");
  });
});

describe("contactDetails", () => {
  it("shows every number with its label, then the address on one line and the email", () => {
    expect(contactDetails(alvarez).map((d) => [d.action.kind, d.action.label, d.text, d.caption])).toEqual([
      ["call", "Call Dr. Elena Alvarez, office", "(555) 010-2200 x214", "Office"],
      ["call", "Call Dr. Elena Alvarez, after hours", "(555) 010-2299", "After hours"],
      ["map", "Open Dr. Elena Alvarez's address in maps", "1200 Westside Ave, Springfield, CA 90000", null],
      ["email", "Email Dr. Elena Alvarez", "e.alvarez@westsidefamily.example", null],
    ]);
  });

  it("leaves out what's missing or can't be dialled, and an unlabelled number has no caption", () => {
    expect(contactDetails({ name: "Aide", phones: [], email: null, address: null })).toEqual([]);
    expect(
      contactDetails({
        name: "Aide",
        phones: [
          { label: "", number: "555 0100" },
          { label: "Home", number: "ask" },
        ],
        email: " ",
        address: null,
      }).map((d) => [d.action.kind, d.caption]),
    ).toEqual([["call", null]]);
  });
});
