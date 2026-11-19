import type { InsurancePlan } from "@caretook/data/schema";

import { describe, expect, it } from "vitest";
import {
  detailsMatch,
  EMPTY_DETAILS,
  insuranceCall,
  parseInsurance,
  plansByRank,
  planTitle,
  toRecipientDetails,
} from "./recipientDetails";

const plan = (over: Partial<InsurancePlan>): InsurancePlan => ({
  id: "p",
  rank: "primary",
  insurer: "Medicare",
  planName: null,
  memberId: "M-1",
  groupNumber: null,
  phone: null,
  ...over,
});

describe("toRecipientDetails", () => {
  it("reads the device's row (JSON as text, keys in any order)", () => {
    const details = toRecipientDetails({
      id: "r",
      group_id: "g",
      phones: JSON.stringify([{ number: "(555) 010-2231", label: "Home" }]),
      email: " pat@example.com ",
      address: "",
      insurance: JSON.stringify([
        { rank: "secondary", memberId: "EM-2", insurer: "Example Mutual", id: "b", phone: "(555) 010-3310" },
        { id: "bad", insurer: "No member ID" },
      ]),
      outside_contacts: JSON.stringify([
        { id: "c", name: "Rosa", phone: "(555) 010-4410", emergencyRank: 3 },
      ]),
      updated_at: null,
    });
    expect(details).toEqual({
      phones: [{ label: "Home", number: "(555) 010-2231" }],
      email: "pat@example.com",
      address: null,
      insurance: [
        {
          id: "b",
          rank: "secondary",
          insurer: "Example Mutual",
          planName: null,
          memberId: "EM-2",
          groupNumber: null,
          phone: "(555) 010-3310",
        },
      ],
      outsideContacts: [
        { id: "c", name: "Rosa", relationship: null, phone: "(555) 010-4410", emergencyRank: 3 },
      ],
    });
  });

  it("no row (a viewer's device, or nothing saved) is empty; bad JSON is nothing", () => {
    expect(toRecipientDetails(undefined)).toEqual(EMPTY_DETAILS);
    expect(parseInsurance("{not json")).toEqual([]);
  });
});

describe("insurance display", () => {
  it("orders plans primary, secondary, other, keeping the saved order within a rank", () => {
    const plans = [
      plan({ id: "o1", rank: "other" }),
      plan({ id: "s", rank: "secondary" }),
      plan({ id: "o2", rank: "other" }),
      plan({ id: "p", rank: "primary" }),
    ];
    expect(plansByRank(plans).map((p) => p.id)).toEqual(["p", "s", "o1", "o2"]);
  });

  it("titles a plan with its name when it has one", () => {
    expect(planTitle(plan({ planName: "Part A and B" }))).toBe("Medicare · Part A and B");
    expect(planTitle(plan({}))).toBe("Medicare");
  });

  it("calls the insurer, or nothing without a number", () => {
    expect(insuranceCall(plan({ phone: "(555) 010-3300 x12" }))).toEqual({
      kind: "call",
      href: "tel:5550103300,12",
      label: "Call Medicare",
      value: "(555) 010-3300 x12",
    });
    expect(insuranceCall(plan({}))).toBeNull();
  });
});

describe("detailsMatch", () => {
  const device = {
    ...EMPTY_DETAILS,
    phones: [{ label: "Home", number: "1" }],
    email: "a@example.com",
    insurance: [plan({})],
  };
  it("checks only the fields a save set", () => {
    expect(detailsMatch(device, { email: "a@example.com" })).toBe(true);
    expect(detailsMatch(device, { email: null })).toBe(false);
    expect(detailsMatch(device, { phones: [{ label: "Home", number: "1" }], address: "" })).toBe(true);
    expect(detailsMatch(device, { insurance: [plan({ memberId: "M-2" })] })).toBe(false);
    expect(detailsMatch(device, { insurance: [plan({})] })).toBe(true);
  });
});
