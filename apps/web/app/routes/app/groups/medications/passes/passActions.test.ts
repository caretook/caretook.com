import { describe, expect, it } from "vitest";
import { passActionFromForm } from "./passActions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("passActionFromForm", () => {
  it("reads each intent", () => {
    expect(passActionFromForm(form({ intent: "create", name: "Noon", time: " 12:00 " }))).toEqual({
      intent: "create",
      name: "Noon",
      time: "12:00",
    });
    expect(passActionFromForm(form({ intent: "update", passId: "p", name: "Lunch", time: "12:30" }))).toEqual(
      {
        intent: "update",
        passId: "p",
        name: "Lunch",
        time: "12:30",
      },
    );
    expect(passActionFromForm(form({ intent: "move", passId: "p", direction: "down" }))).toEqual({
      intent: "move",
      passId: "p",
      direction: "down",
    });
    expect(passActionFromForm(form({ intent: "remove", passId: "p" }))).toEqual({
      intent: "remove",
      passId: "p",
    });
  });

  it("refuses anything else", () => {
    expect(passActionFromForm(form({ intent: "remove" }))).toBeNull();
    expect(passActionFromForm(form({ intent: "move", passId: "p", direction: "sideways" }))).toBeNull();
    expect(passActionFromForm(form({ intent: "rename", passId: "p" }))).toBeNull();
    expect(passActionFromForm(form({}))).toBeNull();
  });
});
