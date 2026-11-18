import { describe, expect, it } from "vitest";
import { providerContentZSchema } from "@caretook/data/schema";
import { issuesForRows, providerFromForm } from "./providerFormData";

const form = (fields: [string, string][]) => {
  const data = new FormData();
  for (const [k, v] of fields) data.append(k, v);
  return data;
};

describe("providerFromForm", () => {
  it("reads every field, dropping blank phone rows", () => {
    const { input, phoneRows } = providerFromForm(
      form([
        ["type", "clinician"],
        ["name", " Dr. Kim "],
        ["specialty", "Cardiology"],
        ["practiceId", "7d1c2b3a-0000-4000-8000-000000000001"],
        ["phoneLabel", "Office"],
        ["phoneNumber", "555 0100"],
        ["phoneLabel", ""],
        ["phoneNumber", " "],
        ["phoneLabel", "Fax"],
        ["phoneNumber", "555 0101"],
        ["email", "kim@clinic.example"],
        ["address", "1 Main St"],
        ["website", "clinic.example"],
        ["isPrimary", "on"],
      ]),
    );
    expect(input).toEqual({
      type: "clinician",
      name: " Dr. Kim ",
      specialty: "Cardiology",
      practiceId: "7d1c2b3a-0000-4000-8000-000000000001",
      phones: [
        { label: "Office", number: "555 0100" },
        { label: "Fax", number: "555 0101" },
      ],
      email: "kim@clinic.example",
      address: "1 Main St",
      website: "clinic.example",
      status: "current",
      isPrimary: true,
    });
    expect(phoneRows).toEqual([0, 2]);
    expect(providerContentZSchema.safeParse(input).success).toBe(true);
  });

  it("marks past, ignores a practice for practices and pharmacies, and defaults an unknown type", () => {
    const pharmacy = providerFromForm(
      form([
        ["type", "pharmacy"],
        ["name", "Rx"],
        ["practiceId", "7d1c2b3a-0000-4000-8000-000000000001"],
        ["past", "on"],
      ]),
    ).input;
    expect(pharmacy).toMatchObject({ type: "pharmacy", practiceId: null, status: "past", isPrimary: false });
    expect(providerFromForm(form([["type", "bogus"]])).input.type).toBe("clinician");
  });

  it("keeps a phone row with only a label, so its missing number is reported", () => {
    const { input, phoneRows } = providerFromForm(
      form([
        ["phoneLabel", ""],
        ["phoneNumber", ""],
        ["phoneLabel", "Office"],
        ["phoneNumber", ""],
      ]),
    );
    expect(input.phones).toEqual([{ label: "Office", number: "" }]);
    expect(phoneRows).toEqual([1]);
  });
});

describe("issuesForRows", () => {
  it("moves phone issues onto the form's rows and leaves others alone", () => {
    expect(
      issuesForRows(
        [
          { path: "phones.0.number", message: "a" },
          { path: "phones.1", message: "b" },
          { path: "phones", message: "c" },
          { path: "name", message: "d" },
        ],
        [1, 3],
      ),
    ).toEqual([
      { path: "phones.1.number", message: "a" },
      { path: "phones.3", message: "b" },
      { path: "phones", message: "c" },
      { path: "name", message: "d" },
    ]);
  });
});
