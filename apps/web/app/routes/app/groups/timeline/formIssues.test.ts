import type { UnitChoices } from "@caretook/data/schema";

import { BP_ORDER_MESSAGE, DEFAULT_UNITS, VITALS } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { issueFor, readingsIssue, vitalFieldIssue } from "./formIssues";

const METRIC: UnitChoices = { temperature: "c", weight: "kg", glucose: "mg/dL", volume: "mL" };
const field = (type: keyof typeof VITALS, i = 0) => VITALS[type].fields[i]!;

describe("issueFor", () => {
  it("is undefined without an issue on those paths", () => {
    expect(issueFor([], "body")).toBeUndefined();
    expect(issueFor([{ path: "title", message: "x" }], "body")).toBeUndefined();
  });

  it("uses plain words for the fields people most often miss", () => {
    expect(issueFor([{ path: "details.name", message: "Too small" }], "details.name", "details")).toBe(
      "Name the symptom.",
    );
    expect(issueFor([{ path: "details", message: "Invalid input" }], "details.name", "details")).toBe(
      "Name the symptom.",
    );
    expect(issueFor([{ path: "occurredAt", message: "Invalid" }], "occurredAt")).toBe(
      "Enter a date and time.",
    );
  });

  it("passes other messages through", () => {
    expect(issueFor([{ path: "body", message: "Too long" }], "body")).toBe("Too long");
  });
});

describe("readingsIssue", () => {
  it("names the list problem, or nothing", () => {
    expect(readingsIssue([])).toBeUndefined();
    expect(readingsIssue([{ path: "details.readings.0.value", message: "x" }])).toBeUndefined();
    expect(readingsIssue([{ path: "details.readings", message: "x" }])).toBe(
      "Add at least one reading, each type once.",
    );
    expect(readingsIssue([{ path: "details", message: "x" }])).toBeDefined();
  });
});

describe("vitalFieldIssue", () => {
  it("is undefined for another reading or field", () => {
    const issues = [{ path: "details.readings.1.value", message: "x" }];
    expect(vitalFieldIssue(issues, 0, field("heartRate"), DEFAULT_UNITS)).toBeUndefined();
    expect(
      vitalFieldIssue(
        [{ path: "details.readings.0.diastolic", message: "x" }],
        0,
        field("bloodPressure", 0),
        DEFAULT_UNITS,
      ),
    ).toBeUndefined();
  });

  it("names the range in the user's units", () => {
    const issues = [{ path: "details.readings.0.value", message: "Too big" }];
    expect(vitalFieldIssue(issues, 0, field("temperature"), DEFAULT_UNITS)).toBe(
      "Enter a number from 77 to 113 °F.",
    );
    expect(vitalFieldIssue(issues, 0, field("temperature"), METRIC)).toBe("Enter a number from 25 to 45 °C.");
    expect(vitalFieldIssue(issues, 0, field("heartRate"), DEFAULT_UNITS)).toBe(
      "Enter a whole number from 20 to 300 bpm.",
    );
  });

  it("says an optional field may be left blank", () => {
    const issues = [{ path: "details.readings.2.value", message: "x" }];
    expect(vitalFieldIssue(issues, 2, field("urineOutput"), METRIC)).toBe(
      "Leave it blank or enter a number from 0 to 5,000 mL.",
    );
  });

  it("counts an issue on the whole reading for each of its fields", () => {
    const issues = [{ path: "details.readings.0", message: "Invalid" }];
    expect(vitalFieldIssue(issues, 0, field("bloodPressure", 1), DEFAULT_UNITS)).toBe(
      "Enter a whole number from 20 to 200 mmHg.",
    );
  });

  it("shows blood pressure's order rule as it is", () => {
    const issues = [{ path: "details.readings.0.diastolic", message: BP_ORDER_MESSAGE }];
    expect(vitalFieldIssue(issues, 0, field("bloodPressure", 1), DEFAULT_UNITS)).toBe(BP_ORDER_MESSAGE);
  });
});
