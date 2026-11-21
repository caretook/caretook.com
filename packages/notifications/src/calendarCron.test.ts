import { newError } from "@caretook/data";
import { describe, expect, it, vi } from "vitest";
import { type CronStep, runCronSteps } from "./calendarCron";

const NOW = new Date("2026-11-18T18:00:00.000Z");

describe("runCronSteps", () => {
  it("runs the steps in order, with the clock, and returns each result", async () => {
    const order: string[] = [];
    const step = (name: string, result: unknown): CronStep => ({
      name,
      run: ({ now }) => {
        order.push(`${name}@${now.toISOString()}`);
        return result;
      },
    });
    const results = await runCronSteps([step("a", { n: 1 }), step("b", 2), step("c", null)], { now: NOW });
    expect(order).toEqual([`a@${NOW.toISOString()}`, `b@${NOW.toISOString()}`, `c@${NOW.toISOString()}`]);
    expect(results).toEqual([
      { name: "a", ok: true, result: { n: 1 } },
      { name: "b", ok: true, result: 2 },
      { name: "c", ok: true, result: null },
    ]);
  });

  it("catches a thrown or returned failure and still runs the next step", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const after = vi.fn(() => "done");
    const results = await runCronSteps(
      [
        {
          name: "throws",
          run: () => {
            throw new Error("boom: secret detail");
          },
        },
        { name: "returns", run: () => newError({ code: "notify:send" }) },
        { name: "after", run: after },
      ],
      { now: NOW },
    );
    expect(after).toHaveBeenCalledOnce();
    expect(results).toEqual([
      { name: "throws", ok: false, error: "Error" },
      { name: "returns", ok: false, error: "notify:send" },
      { name: "after", ok: true, result: "done" },
    ]);
    vi.restoreAllMocks();
  });
});
