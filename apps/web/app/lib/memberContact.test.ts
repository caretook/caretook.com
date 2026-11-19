import { describe, expect, it } from "vitest";
import {
  memberContactLines,
  memberShare,
  parsePhones,
  parseSharedFields,
  sharedSummary,
  sharingFromForm,
  sharingOptions,
} from "./memberContact";

const contact = {
  phones: [
    { label: "Mobile", number: "(555) 010-1234" },
    { label: "", number: "555 010 9999 x12" },
  ],
  contactEmail: "sam@example.com",
  address: "1 Elm St\nSpringfield",
};

describe("parseSharedFields", () => {
  it("reads the known fields in their usual order", () => {
    expect(parseSharedFields('["address","phones","fax"]')).toEqual(["phones", "address"]);
  });
  it("is empty for nothing or bad JSON", () => {
    expect(parseSharedFields(null)).toEqual([]);
    expect(parseSharedFields("not json")).toEqual([]);
    expect(parseSharedFields('{"phones":true}')).toEqual([]);
  });
});

describe("parsePhones", () => {
  it("keeps numbers with something in them", () => {
    expect(
      parsePhones('[{"label":"Mobile","number":"555"},{"number":" "},{"label":3,"number":"1"},7]'),
    ).toEqual([
      { label: "Mobile", number: "555" },
      { label: "", number: "1" },
    ]);
  });
});

describe("memberShare", () => {
  it("reads a share row; missing values are not shared", () => {
    expect(
      memberShare({
        share_phones: '[{"label":"Mobile","number":"555"}]',
        share_email: null,
        share_address: " ",
      }),
    ).toEqual({ phones: [{ label: "Mobile", number: "555" }], email: null, address: null });
  });
  it("shares nothing without a row", () => {
    expect(memberShare({ share_phones: null, share_email: null, share_address: null })).toEqual({
      phones: null,
      email: null,
      address: null,
    });
  });
});

describe("memberContactLines", () => {
  it("lists each number with call and text, then email, then the address on one line", () => {
    const lines = memberContactLines("Sam", {
      phones: contact.phones,
      email: contact.contactEmail,
      address: contact.address,
    });
    expect(lines.map((l) => [l.field, l.action.kind, l.text, l.caption, l.sms?.href ?? null])).toEqual([
      ["phones", "call", "(555) 010-1234", "Mobile", "sms:5550101234"],
      ["phones", "call", "555 010 9999 x12", null, "sms:5550109999"],
      ["email", "email", "sam@example.com", null, null],
      ["address", "map", "1 Elm St, Springfield", null, null],
    ]);
    expect(lines[0]?.action.label).toBe("Call Sam, mobile");
    expect(lines[0]?.sms?.label).toBe("Text Sam, mobile");
    expect(lines[1]?.action.href).toBe("tel:5550109999,12");
  });

  it("shows only what's shared", () => {
    expect(memberContactLines("Sam", { phones: null, email: null, address: null })).toEqual([]);
    expect(
      memberContactLines("Sam", { phones: null, email: "sam@example.com", address: null }).map(
        (l) => l.field,
      ),
    ).toEqual(["email"]);
  });
});

describe("sharingOptions", () => {
  it("offers only the fields filled in, ticked when the group already sees them", () => {
    expect(
      sharingOptions({ ...contact, contactEmail: null }, ["phones"]).map((o) => [
        o.field,
        o.checked,
        o.preview,
      ]),
    ).toEqual([
      ["phones", true, "(555) 010-1234, 555 010 9999 x12"],
      ["address", false, "1 Elm St, Springfield"],
    ]);
  });

  it("ticks nothing until you choose", () => {
    expect(sharingOptions(contact, []).every((o) => !o.checked)).toBe(true);
  });

  it("offers nothing when no contact details are saved", () => {
    expect(sharingOptions({ phones: [], contactEmail: " ", address: null }, ["phones"])).toEqual([]);
  });
});

describe("sharingFromForm", () => {
  it("reads the ticked fields in order, and the relationship", () => {
    const form = new FormData();
    form.append("share", "address");
    form.append("share", "phones");
    form.append("share", "bogus");
    form.append("relationship", "Son");
    expect(sharingFromForm(form)).toEqual({ sharedFields: ["phones", "address"], relationship: "Son" });
  });
  it("sends nothing ticked as nothing shared", () => {
    expect(sharingFromForm(new FormData())).toEqual({ sharedFields: [], relationship: "" });
  });
});

describe("sharedSummary", () => {
  it("names what's shared", () => {
    expect(sharedSummary([])).toBe("You share nothing with this group.");
    expect(sharedSummary(["phones"])).toBe("You share your phone numbers with this group.");
    expect(sharedSummary(["phones", "email", "address"])).toBe(
      "You share your phone numbers, contact email and address with this group.",
    );
  });
});
