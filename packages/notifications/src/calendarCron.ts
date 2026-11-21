import { appointmentSeriesService, calendarSyncService, isError, logError } from "@caretook/data";
import { hasCronSecret } from "./cron";
import { sweepReminders } from "./reminders";

// The calendar cron (`/api/cron/calendar`, every minute): a named, ordered
// list of bounded steps. Each step's failure, thrown or returned, is caught
// and logged and never stops the next. Later slices append their steps to
// CALENDAR_STEPS in the plan's order: reminders, Google push, Google pull,
// then the series top-up last, so the list reads
// [reminders, googlePush, googlePull, seriesTopUp]: insert before the top-up.

export type CronStepContext = { now: Date };

export type CronStep = {
  name: string;
  /** Does one bounded piece of work and returns its summary (any JSON). An error value counts as a failure. */
  run: (ctx: CronStepContext) => unknown;
};

export type CronStepResult = { name: string; ok: boolean; result?: unknown; error?: string };

/** Run the steps in order. Never throws: a failing step is logged and the next one runs. */
export const runCronSteps = async (
  steps: readonly CronStep[],
  ctx: CronStepContext = { now: new Date() },
): Promise<CronStepResult[]> => {
  const results: CronStepResult[] = [];
  for (const step of steps) {
    try {
      const result = await step.run(ctx);
      if (isError(result)) {
        logError(`calendar cron: ${step.name} failed`, result);
        results.push({ name: step.name, ok: false, error: String(result.code) });
      } else {
        results.push({ name: step.name, ok: true, result });
      }
    } catch (error) {
      logError(`calendar cron: ${step.name} failed`, error);
      results.push({ name: step.name, ok: false, error: error instanceof Error ? error.name : "Error" });
    }
  }
  return results;
};

/** The steps, in order. Slices 6, 7 and 9 add theirs before the top-up. */
export const CALENDAR_STEPS: readonly CronStep[] = [
  { name: "reminders", run: ({ now }) => sweepReminders(now) },
  { name: "googlePush", run: ({ now }) => calendarSyncService.sweep({ now }) },
  { name: "seriesTopUp", run: ({ now }) => appointmentSeriesService.topUp(now) },
];

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * The handler behind `/api/cron/calendar`: 503 without a configured
 * secret, 401 without the bearer, else every step's result (200, even when
 * a step failed: the failure is in its entry and the log).
 */
export const handleCalendarCron = async (
  request: Request,
  {
    secret = process.env.CRON_SECRET,
    steps = CALENDAR_STEPS,
    now = new Date(),
  }: { secret?: string; steps?: readonly CronStep[]; now?: Date } = {},
) => {
  if (!secret?.trim()) return json({ error: "CRON_SECRET is not set" }, 503);
  if (!hasCronSecret(request, secret.trim())) return json({ error: "Unauthorized" }, 401);
  return json({ steps: await runCronSteps(steps, { now }) }, 200);
};
