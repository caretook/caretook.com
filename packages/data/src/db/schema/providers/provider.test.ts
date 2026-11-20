import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  entryProviderId,
  entryProviderLinkZSchema,
  isWebsite,
  parseProviderPhones,
  PROVIDER_LIMITS,
  providerContentZSchema,
  providerCreateZSchema,
  providerUpdateZSchema,
} from "..";
import { uuidV5 } from "../core/uuidV5";

const issuesOf = (res: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  res.success ? [] : [...new Set((res.error?.issues ?? []).map((i) => i.path.join(".")))];

describe("uuidV5", () => {
  it("matches RFC 9562's example and Python's uuid5", () => {
    // uuid.uuid5(uuid.NAMESPACE_DNS, "www.example.com")
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
    // uuid.uuid5(uuid.NAMESPACE_URL, "https://caretook.example/a-longer-name-that-spans-two-sha1-blocks-0123456789")
    expect(
      uuidV5(
        "https://caretook.example/a-longer-name-that-spans-two-sha1-blocks-0123456789",
        "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      ),
    ).toBe("af6f5d35-7e84-5314-bef2-0ab6d324a538");
  });

  it("refuses a namespace that isn't a UUID", () => {
    expect(() => uuidV5("x", "not-a-uuid")).toThrow();
  });
});

describe("entryProviderId", () => {
  const entry = randomUUID();
  const provider = randomUUID();

  it("is the same for the same pair, on any device, in any case", () => {
    expect(entryProviderId(entry, provider)).toBe(entryProviderId(entry, provider));
    expect(entryProviderId(entry.toUpperCase(), provider.toUpperCase())).toBe(
      entryProviderId(entry, provider),
    );
  });

  it("differs by pair and by order", () => {
    expect(entryProviderId(entry, provider)).not.toBe(entryProviderId(entry, randomUUID()));
    expect(entryProviderId(entry, provider)).not.toBe(entryProviderId(provider, entry));
  });

  it("is a version 5 UUID", () => {
    expect(entryProviderId(entry, provider)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("is what a link's id must be", () => {
    const base = { groupId: randomUUID(), entryId: entry, providerId: provider };
    expect(entryProviderLinkZSchema.safeParse(base).success).toBe(true);
    expect(
      entryProviderLinkZSchema.safeParse({ ...base, id: entryProviderId(entry, provider) }).success,
    ).toBe(true);
    expect(issuesOf(entryProviderLinkZSchema.safeParse({ ...base, id: randomUUID() }))).toEqual(["id"]);
  });
});

describe("providerContentZSchema", () => {
  const clinician = { type: "clinician", name: "Dr. Example" } as const;

  it("fills defaults and turns empty text into null", () => {
    const res = providerContentZSchema.parse({ ...clinician, specialty: "  ", email: "", website: "" });
    expect(res).toEqual({
      type: "clinician",
      name: "Dr. Example",
      specialty: null,
      practiceId: null,
      phones: [],
      email: null,
      address: null,
      website: null,
      status: "current",
      isPrimary: false,
    });
  });

  it("needs a name and a known type", () => {
    expect(issuesOf(providerContentZSchema.safeParse({ ...clinician, name: " " }))).toEqual(["name"]);
    expect(issuesOf(providerContentZSchema.safeParse({ ...clinician, type: "dentist" }))).toEqual(["type"]);
    expect(issuesOf(providerContentZSchema.safeParse({ ...clinician, status: "former" }))).toEqual([
      "status",
    ]);
  });

  it("accepts labelled phone numbers in the usual forms, up to the limit", () => {
    const numbers = [
      "(555) 010-2200",
      "+1 555 010 2200",
      "555.010.2200",
      "555-010-2200 x214",
      "555 0102 ext. 9",
    ];
    const phones = numbers.map((number, i) => ({ label: `Line ${i}`, number }));
    expect(providerContentZSchema.parse({ ...clinician, phones }).phones).toEqual(phones);
    // A label is optional.
    expect(providerContentZSchema.parse({ ...clinician, phones: [{ number: "555 0100" }] }).phones).toEqual([
      { label: "", number: "555 0100" },
    ]);
  });

  it("refuses more than six phones, an empty or lettered number, and extra fields", () => {
    const seven = Array.from({ length: PROVIDER_LIMITS.phones + 1 }, () => ({
      label: "",
      number: "555 0100",
    }));
    expect(issuesOf(providerContentZSchema.safeParse({ ...clinician, phones: seven }))).toEqual(["phones"]);
    for (const number of ["", "call me", "555-CALL-NOW", "+"]) {
      expect(
        issuesOf(providerContentZSchema.safeParse({ ...clinician, phones: [{ label: "", number }] })),
      ).toEqual(["phones.0.number"]);
    }
    expect(
      issuesOf(providerContentZSchema.safeParse({ ...clinician, phones: [{ number: "5550100", extra: 1 }] })),
    ).toEqual(["phones.0"]);
  });

  it("checks emails and websites", () => {
    expect(issuesOf(providerContentZSchema.safeParse({ ...clinician, email: "not an email" }))).toEqual([
      "email",
    ]);
    expect(providerContentZSchema.parse({ ...clinician, email: " a@clinic.example " }).email).toBe(
      "a@clinic.example",
    );
    expect(providerContentZSchema.parse({ ...clinician, website: "clinic.example" }).website).toBe(
      "clinic.example",
    );
    expect(
      issuesOf(providerContentZSchema.safeParse({ ...clinician, website: "javascript:alert(1)" })),
    ).toEqual(["website"]);
  });

  it("lets clinicians and other contacts have a practice, but not practices or pharmacies", () => {
    const practiceId = randomUUID();
    expect(providerContentZSchema.safeParse({ ...clinician, practiceId }).success).toBe(true);
    expect(providerContentZSchema.safeParse({ type: "other", name: "Aide", practiceId }).success).toBe(true);
    for (const type of ["practice", "pharmacy"]) {
      expect(issuesOf(providerContentZSchema.safeParse({ type, name: "Clinic", practiceId }))).toEqual([
        "practiceId",
      ]);
    }
  });
});

describe("providerCreateZSchema and providerUpdateZSchema", () => {
  it("refuse a provider that's its own practice", () => {
    const id = randomUUID();
    const res = providerCreateZSchema.safeParse({
      id,
      groupId: randomUUID(),
      type: "clinician",
      name: "Dr. Example",
      practiceId: id,
    });
    expect(issuesOf(res)).toEqual(["practiceId"]);
  });

  it("only take content fields on update", () => {
    expect(providerUpdateZSchema.safeParse({ name: "New name", isPrimary: true }).success).toBe(true);
    expect(providerUpdateZSchema.safeParse({ groupId: randomUUID() }).success).toBe(false);
    expect(providerUpdateZSchema.safeParse({ deletedAt: new Date().toISOString() }).success).toBe(false);
  });
});

describe("isWebsite and parseProviderPhones", () => {
  it("assume https and need a dotted host", () => {
    expect(isWebsite("clinic.example/portal")).toBe(true);
    expect(isWebsite("http://clinic.example")).toBe(true);
    expect(isWebsite("localhost")).toBe(false);
    expect(isWebsite("ftp://clinic.example")).toBe(false);
  });

  it("read phones from jsonb or JSON text, and treat junk as none", () => {
    const phones = [{ label: "Office", number: "555 0100" }];
    expect(parseProviderPhones(phones)).toEqual(phones);
    expect(parseProviderPhones(JSON.stringify(phones))).toEqual(phones);
    expect(parseProviderPhones("{")).toEqual([]);
    expect(parseProviderPhones(null)).toEqual([]);
  });
});
