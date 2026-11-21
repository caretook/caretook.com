import { describe, expect, it } from "vitest";
import {
  CONNECT_RETURN_DELAY_MS,
  CONNECT_SUCCESS_EXAMPLES,
  connectedTitle,
  returningNote,
  returnLabel,
} from "./connectSuccess";

describe("the connect success step's wording", () => {
  it("names the group and the client", () => {
    expect(connectedTitle("Dev Family")).toBe("Connected to Dev Family");
    expect(returnLabel("Claude")).toBe("Return to Claude");
  });

  it("has three example questions", () => {
    expect(CONNECT_SUCCESS_EXAMPLES).toHaveLength(3);
    for (const example of CONNECT_SUCCESS_EXAMPLES) expect(example.length).toBeGreaterThan(0);
  });

  it("says it returns on its own, in whole seconds", () => {
    expect(CONNECT_RETURN_DELAY_MS).toBe(5000);
    expect(returningNote("ChatGPT")).toBe("Taking you back to ChatGPT in 5 seconds.");
    expect(returningNote("Claude", 3000)).toBe("Taking you back to Claude in 3 seconds.");
  });
});
