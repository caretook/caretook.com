import {
  formatReading,
  isError,
  isKnownReading,
  resolveUnits,
  SYSTEM_USER,
  timelineEntryService,
  userModel,
  VITALS,
} from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso } from "../time";
import { asMember, loadGroup } from "./shared";

/**
 * The newest reading of each kind of vital, most recent first: blood
 * pressure, heart rate, temperature and so on, each with when it was taken.
 */
export const latestVitals = defineTool({
  name: "latest_vitals",
  title: "Latest vitals",
  description:
    "The newest reading of each kind of vital sign (blood pressure, heart rate, temperature, SpO2, weight, blood glucose and so on), most recent first, with when it was taken. `text` is in the member's preferred units; `reading` holds the stored values (temperature in °C, weight in kg, glucose in mg/dL, volume in mL).",
  scope: "read",
  input: z.object({}),
  annotations: READ_ANNOTATIONS,
  handler: async (_input, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const me = await userModel.getWholeById(ctx.authUser.id, { authUser: SYSTEM_USER });
    if (isError(me)) return me;
    const units = resolveUnits(me?.preferences);
    const rows = await timelineEntryService.latestVitals(asMember(ctx), { groupId: ctx.groupId });
    if (isError(rows)) return rows;

    const vitals = rows
      .filter((row) => isKnownReading(row.reading))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .map((row) => {
        const reading = row.reading as Parameters<typeof formatReading>[0];
        return {
          type: reading.type,
          label: VITALS[reading.type].label,
          text: formatReading(reading, units),
          reading,
          takenAt: zonedIso(row.occurredAt, loaded.timeZone),
          entryId: row.entryId,
        };
      });

    const text = vitals.length
      ? [`Latest vitals (${loaded.timeZone}):`, ...vitals.map((v) => `- ${v.takenAt} ${v.text}`)].join("\n")
      : "No vitals have been logged.";
    return { text, structured: { timeZone: loaded.timeZone, vitals } };
  },
});
