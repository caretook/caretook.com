import { newError } from "@caretook/data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CronStep, handleCalendarCron } from "./calendarCron";

const secret = "calendar-cron-secret";
const request = (authorization?: string) =>
  new Request("http://localhost/api/cron/calendar", { headers: authorization ? { authorization } : {} });

afterEach(() => vi.restoreAllMocks());

describe("/api/cron/calendar", () => {
  it("refuses a missing or wrong secret without running a step, and 503s when none is set", async () => {
    const run = vi.fn();
    const steps: CronStep[] = [{ name: "s", run }];
    expect((await handleCalendarCron(request(), { secret, steps })).status).toBe(401);
    expect((await handleCalendarCron(request("Bearer nope"), { secret, steps })).status).toBe(401);
    expect((await handleCalendarCron(request(secret), { secret, steps })).status).toBe(401);
    expect((await handleCalendarCron(request(`Bearer ${secret}`), { secret: "", steps })).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it("returns each step's result, and a failing step doesn't stop the next", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const steps: CronStep[] = [
      { name: "first", run: () => ({ ok: 1 }) },
      {
        name: "broken",
        run: () => {
          throw new Error("down");
        },
      },
      { name: "errored", run: () => newError({ code: "notify:send" }) },
      { name: "last", run: () => "fine" },
    ];
    const res = await handleCalendarCron(request(`Bearer ${secret}`), { secret, steps });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      steps: [
        { name: "first", ok: true, result: { ok: 1 } },
        { name: "broken", ok: false, error: "Error" },
        { name: "errored", ok: false, error: "notify:send" },
        { name: "last", ok: true, result: "fine" },
      ],
    });
  });

  it("runs the reminders first, then Google push, and the series top-up last by default", async () => {
    const res = await handleCalendarCron(request(`Bearer ${secret}`), { secret });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { steps: { name: string; ok: boolean }[] };
    expect(body.steps.map((s) => s.name)).toEqual(["reminders", "googlePush", "seriesTopUp"]);
    expect(body.steps[0]).toMatchObject({ name: "reminders", ok: true });
    expect(body.steps.at(-1)).toMatchObject({ name: "seriesTopUp", ok: true });
  });
});
