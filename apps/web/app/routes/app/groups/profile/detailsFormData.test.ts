import { describe, expect, it } from "vitest";
import {
  issuesForPlanRows,
  nextRank,
  parseInsuranceForm,
  parseRecipientContact,
  PLAN_KEY,
  planFieldName,
  plansFromForm,
} from "./detailsFormData";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

const ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc00001";

const plan = (key: string, fields: Partial<Record<string, string>>): [string, string][] => [
  [PLAN_KEY, key],
  ...Object.entries(fields).map(([field, value]): [string, string] => [`plan.${key}.${field}`, value ?? ""]),
];

describe("parseRecipientContact", () => {
  it("reads the phones (without blank rows), email and address; empty clears", () => {
    const parsed = parseRecipientContact(
      form([
        ["phoneLabel", "Home"],
        ["phoneNumber", " (555) 010-2231 "],
        ["phoneLabel", ""],
        ["phoneNumber", ""],
        ["email", ""],
        ["address", "1 Elm St\nSpringfield"],
      ]),
    );
    expect(parsed).toEqual({
      ok: true,
      data: {
        phones: [{ label: "Home", number: "(555) 010-2231" }],
        email: null,
        address: "1 Elm St\nSpringfield",
      },
    });
  });

  it("puts a bad number on its row in the form, and a bad email on the email", () => {
    const parsed = parseRecipientContact(
      form([
        ["phoneLabel", ""],
        ["phoneNumber", ""],
        ["phoneLabel", "Home"],
        ["phoneNumber", "call me"],
        ["email", "not an email"],
        ["address", ""],
      ]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.map((i) => i.path).sort()).toEqual(["email", "phones.1.number"]);
  });
});

describe("plansFromForm and parseInsuranceForm", () => {
  it("reads plans in order, keeps ids, leaves out blank rows, and gives new plans an id", () => {
    const data = form([
      ...plan("4", { id: ID, rank: "secondary", insurer: "Medicare", memberId: "M-1", phone: "" }),
      ...plan("7", { rank: "primary", insurer: "", memberId: "", planName: "", groupNumber: "", phone: "" }),
      ...plan("9", { rank: "primary", insurer: " Example Mutual ", memberId: "EM-2", groupNumber: "G-5" }),
    ]);
    expect(plansFromForm(data).keys).toEqual(["4", "9"]);
    const parsed = parseInsuranceForm(data);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data[0]).toEqual({
      id: ID,
      rank: "secondary",
      insurer: "Medicare",
      planName: null,
      memberId: "M-1",
      groupNumber: null,
      phone: null,
    });
    expect(parsed.data[1]).toMatchObject({ rank: "primary", insurer: "Example Mutual", groupNumber: "G-5" });
    expect(parsed.data[1]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("puts errors on the plan's own fields, by its row's key", () => {
    const parsed = parseInsuranceForm(
      form([
        ...plan("3", { rank: "primary", insurer: "A", memberId: "1" }),
        ...plan("8", { rank: "primary", insurer: "B", memberId: "", phone: "no digits" }),
      ]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.map((i) => i.path).sort()).toEqual([
      planFieldName(8, "memberId"),
      planFieldName(8, "phone"),
      planFieldName(8, "rank"),
    ]);
    expect(parsed.issues.find((i) => i.path.endsWith("memberId"))?.message).toBe("Enter the member ID");
  });

  it("an issue about the whole list stays on the list", () => {
    expect(issuesForPlanRows([{ path: "insurance", message: "Too many" }], ["1"])).toEqual([
      { path: "insurance", message: "Too many" },
    ]);
    expect(issuesForPlanRows([{ path: "insurance.0.insurer", message: "x" }], ["5"])).toEqual([
      { path: "plan.5.insurer", message: "x" },
    ]);
  });
});

describe("nextRank", () => {
  it("is primary, then secondary, then other", () => {
    expect(nextRank([])).toBe("primary");
    expect(nextRank(["primary"])).toBe("secondary");
    expect(nextRank(["secondary"])).toBe("primary");
    expect(nextRank(["primary", "secondary"])).toBe("other");
  });
});
