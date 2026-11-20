import { describe, expect, it } from "vitest";
import { careRecipientProfileZSchema, RECIPIENT_LIMITS } from "./careRecipient";
import {
  careRecipientDetailsUpdateZSchema,
  DETAILS_LIMITS,
  insurancePlansZSchema,
  outsideContactsZSchema,
} from "./careRecipientDetails";
import { CONTACT_LIMITS } from "./contactFields";
import { memberSharingZSchema } from "./memberContactShare";
import { userContactUpdateZSchema } from "./userContact";

/** The fields with issues, each once. */
const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : [...new Set((result.error?.issues ?? []).map((i) => i.path.join(".")))];

const plan = (extra: Record<string, unknown> = {}) => ({
  insurer: "Medicare",
  memberId: "1EG4-TE5-MK72",
  ...extra,
});

describe("recipient profile", () => {
  it("takes the basics and clears empty text", () => {
    const parsed = careRecipientProfileZSchema.parse({
      codeStatus: "dnr",
      bloodType: "AB-",
      primaryLanguage: "  Spanish ",
      pronouns: "",
      notes: "Uses a walker",
    });
    expect(parsed).toEqual({
      codeStatus: "dnr",
      bloodType: "AB-",
      primaryLanguage: "Spanish",
      pronouns: null,
      notes: "Uses a walker",
    });
  });

  it("leaves out fields that weren't sent, and clears a code status with null", () => {
    expect(careRecipientProfileZSchema.parse({ codeStatus: null })).toEqual({ codeStatus: null });
    expect(careRecipientProfileZSchema.parse({})).toEqual({});
  });

  it("refuses unknown code statuses and blood types", () => {
    expect(issuePaths(careRecipientProfileZSchema.safeParse({ codeStatus: "DNR" }))).toEqual(["codeStatus"]);
    expect(issuePaths(careRecipientProfileZSchema.safeParse({ bloodType: "C+" }))).toEqual(["bloodType"]);
  });

  it("limits lengths", () => {
    const long = (n: number) => "x".repeat(n + 1);
    expect(
      issuePaths(
        careRecipientProfileZSchema.safeParse({
          notes: long(RECIPIENT_LIMITS.notes),
          pronouns: long(RECIPIENT_LIMITS.pronouns),
          primaryLanguage: long(RECIPIENT_LIMITS.primaryLanguage),
          name: "",
        }),
      ).sort(),
    ).toEqual(["name", "notes", "primaryLanguage", "pronouns"]);
  });
});

describe("recipient details", () => {
  it("checks phones like providers' and limits them", () => {
    expect(
      issuePaths(
        careRecipientDetailsUpdateZSchema.safeParse({ phones: [{ label: "Home", number: "call me" }] }),
      ),
    ).toEqual(["phones.0.number"]);
    const many = Array.from({ length: CONTACT_LIMITS.phones + 1 }, () => ({ label: "", number: "555 0100" }));
    expect(issuePaths(careRecipientDetailsUpdateZSchema.safeParse({ phones: many }))).toEqual(["phones"]);
  });

  it("checks the email and clears empty text", () => {
    expect(issuePaths(careRecipientDetailsUpdateZSchema.safeParse({ email: "pat" }))).toEqual(["email"]);
    expect(careRecipientDetailsUpdateZSchema.parse({ email: "", address: " " })).toEqual({
      email: null,
      address: null,
    });
  });

  it("requires an insurer and member ID, and fills in an id and rank", () => {
    expect(issuePaths(insurancePlansZSchema.safeParse([{ insurer: "", memberId: " " }])).sort()).toEqual([
      "0.insurer",
      "0.memberId",
    ]);
    const [parsed] = insurancePlansZSchema.parse([plan({ phone: "" })]);
    expect(parsed).toMatchObject({ rank: "primary", planName: null, groupNumber: null, phone: null });
    expect(parsed?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("allows one primary and one secondary plan", () => {
    expect(
      issuePaths(insurancePlansZSchema.safeParse([plan(), plan({ rank: "primary", memberId: "2" })])),
    ).toEqual(["1.rank"]);
    expect(
      insurancePlansZSchema.safeParse([
        plan(),
        plan({ rank: "secondary" }),
        plan({ rank: "other" }),
        plan({ rank: "other" }),
      ]).success,
    ).toBe(true);
    expect(issuePaths(insurancePlansZSchema.safeParse([plan({ rank: "tertiary" })]))).toEqual(["0.rank"]);
  });

  it("limits insurance plans and checks their phone", () => {
    const many = Array.from({ length: DETAILS_LIMITS.insurance + 1 }, () => plan({ rank: "other" }));
    expect(issuePaths(insurancePlansZSchema.safeParse(many))).toEqual([""]);
    expect(issuePaths(insurancePlansZSchema.safeParse([plan({ phone: "none" })]))).toEqual(["0.phone"]);
  });
});

describe("outside contacts", () => {
  it("need a name and a phone", () => {
    expect(issuePaths(outsideContactsZSchema.safeParse([{ name: " ", phone: "" }])).sort()).toEqual([
      "0.name",
      "0.phone",
    ]);
    const [parsed] = outsideContactsZSchema.parse([
      { name: "Rosa", phone: "555 010 4410", relationship: "" },
    ]);
    expect(parsed).toMatchObject({ name: "Rosa", relationship: null });
  });

  it("take no emergency rank (set with the order) and refuse unknown fields", () => {
    expect(
      outsideContactsZSchema.safeParse([{ name: "Rosa", phone: "555 010 4410", emergencyRank: 1 }]).success,
    ).toBe(false);
  });

  it("are limited, with unique ids", () => {
    const id = "0b6f3c1e-0000-4000-8000-000000000001";
    expect(
      issuePaths(
        outsideContactsZSchema.safeParse([
          { id, name: "A", phone: "5550100" },
          { id, name: "B", phone: "5550101" },
        ]),
      ),
    ).toEqual(["1.id"]);
    const many = Array.from({ length: DETAILS_LIMITS.outsideContacts + 1 }, (_, i) => ({
      name: `C${i}`,
      phone: "5550100",
    }));
    expect(issuePaths(outsideContactsZSchema.safeParse(many))).toEqual([""]);
  });
});

describe("a member's contact details and sharing", () => {
  it("checks contact details like the recipient's", () => {
    expect(issuePaths(userContactUpdateZSchema.safeParse({ contactEmail: "nope" }))).toEqual([
      "contactEmail",
    ]);
    expect(userContactUpdateZSchema.parse({ contactEmail: "", address: "" })).toEqual({
      contactEmail: null,
      address: null,
    });
    expect(userContactUpdateZSchema.safeParse({ email: "x@example.com" }).success).toBe(false);
  });

  it("takes known fields only, in a fixed order, and a short relationship", () => {
    expect(memberSharingZSchema.parse({ sharedFields: ["address", "phones", "phones"] })).toEqual({
      sharedFields: ["phones", "address"],
    });
    expect(memberSharingZSchema.safeParse({ sharedFields: ["birthday"] }).success).toBe(false);
    expect(
      issuePaths(
        memberSharingZSchema.safeParse({ relationship: "x".repeat(CONTACT_LIMITS.relationship + 1) }),
      ),
    ).toEqual(["relationship"]);
    expect(memberSharingZSchema.parse({ relationship: " " })).toEqual({ relationship: null });
  });
});
