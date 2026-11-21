import { describe, expect, it } from "vitest";
import { conditionActionFromForm } from "./conditionActions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("conditionActionFromForm", () => {
  it("reads an add with its since and status", () => {
    expect(
      conditionActionFromForm(
        form({
          intent: "create",
          name: "Gout",
          sinceYear: " 2015 ",
          sinceMonth: "3",
          note: "",
          status: "resolved",
        }),
      ),
    ).toEqual({
      intent: "create",
      name: "Gout",
      sinceYear: 2015,
      sinceMonth: 3,
      note: "",
      status: "resolved",
      diagnosedById: null,
      providers: { newManagers: [] },
    });
  });

  it("reads blanks as none, a year that isn't a number as NaN, and an unknown status as active", () => {
    expect(
      conditionActionFromForm(form({ intent: "create", name: "Gout", sinceYear: "", sinceMonth: "" })),
    ).toMatchObject({ sinceYear: null, sinceMonth: null, status: "active" });
    expect(
      conditionActionFromForm(form({ intent: "create", name: "Gout", sinceYear: "20x5", status: "cured" })),
    ).toMatchObject({ sinceYear: Number.NaN, status: "active" });
  });

  it("reads an edit, the status actions, a delete and No known conditions", () => {
    expect(conditionActionFromForm(form({ intent: "update", conditionId: "c1", name: "Gout" }))).toEqual({
      intent: "update",
      conditionId: "c1",
      name: "Gout",
      sinceYear: null,
      sinceMonth: null,
      note: "",
      diagnosedById: null,
      providers: { newManagers: [] },
    });
    for (const intent of ["resolve", "reactivate", "remove"])
      expect(conditionActionFromForm(form({ intent, conditionId: "c1" }))).toEqual({
        intent,
        conditionId: "c1",
      });
    expect(conditionActionFromForm(form({ intent: "noKnownConditions", on: "1" }))).toEqual({
      intent: "noKnownConditions",
      on: true,
    });
    expect(conditionActionFromForm(form({ intent: "noKnownConditions", on: "0" }))).toMatchObject({
      on: false,
    });
  });

  it("reads who diagnosed it and who manages it: ids, and names to add", () => {
    const data = form({
      intent: "update",
      conditionId: "c1",
      name: "Gout",
      diagnosedById: "p1",
      managers: "1",
    });
    for (const id of ["p2", "p3"]) data.append("managerId", id);
    data.append("newManager", " Dr. Ada Moss ");
    data.append("newManager", "");
    expect(conditionActionFromForm(data)).toMatchObject({
      diagnosedById: "p1",
      providers: { managerIds: ["p2", "p3"], newManagers: ["Dr. Ada Moss"] },
    });
    const none = conditionActionFromForm(
      form({ intent: "create", name: "Gout", newDiagnosedBy: " Dr. Lee ", managers: "1" }),
    );
    expect(none).toMatchObject({
      diagnosedById: null,
      providers: { managerIds: [], newDiagnosedBy: "Dr. Lee", newManagers: [] },
    });
  });

  it("is null for anything else, or a condition's action with no condition", () => {
    expect(conditionActionFromForm(form({ intent: "resolve" }))).toBeNull();
    expect(conditionActionFromForm(form({ intent: "bogus", conditionId: "c1" }))).toBeNull();
  });
});
