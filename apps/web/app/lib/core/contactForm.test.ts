import { describe, expect, it } from "vitest";
import { contactFromForm, issuesForRows, phonesFromForm } from "./contactForm";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
};

describe("phonesFromForm", () => {
  it("keeps rows in order and drops blank ones, remembering each phone's row", () => {
    const result = phonesFromForm(
      form([
        ["phoneLabel", "Mobile"],
        ["phoneNumber", "(555) 010-1234"],
        ["phoneLabel", ""],
        ["phoneNumber", "  "],
        ["phoneLabel", ""],
        ["phoneNumber", "555 010 9999"],
      ]),
    );
    expect(result.phones).toEqual([
      { label: "Mobile", number: "(555) 010-1234" },
      { label: "", number: "555 010 9999" },
    ]);
    expect(result.phoneRows).toEqual([0, 2]);
  });

  it("keeps a labelled row with no number, so the save can say what's missing", () => {
    expect(
      phonesFromForm(
        form([
          ["phoneLabel", "Home"],
          ["phoneNumber", ""],
        ]),
      ).phones,
    ).toEqual([{ label: "Home", number: "" }]);
  });
});

describe("issuesForRows", () => {
  it("moves phone issues onto the form's rows and leaves others alone", () => {
    expect(
      issuesForRows(
        [
          { path: "phones.1.number", message: "Enter a phone number" },
          { path: "contactEmail", message: "Enter an email address" },
        ],
        [0, 3],
      ),
    ).toEqual([
      { path: "phones.3.number", message: "Enter a phone number" },
      { path: "contactEmail", message: "Enter an email address" },
    ]);
  });
});

describe("contactFromForm", () => {
  it("reads the phones, contact email and address as typed", () => {
    const { input } = contactFromForm(
      form([
        ["phoneLabel", "Mobile"],
        ["phoneNumber", "(555) 010-1234"],
        ["contactEmail", "sam@example.com"],
        ["address", "1 Elm St\nSpringfield"],
      ]),
    );
    expect(input).toEqual({
      phones: [{ label: "Mobile", number: "(555) 010-1234" }],
      contactEmail: "sam@example.com",
      address: "1 Elm St\nSpringfield",
    });
  });

  it("sends empty fields as empty, which clears them", () => {
    expect(contactFromForm(form([])).input).toEqual({ phones: [], contactEmail: "", address: "" });
  });
});
