import {
  isError,
  medicationPassService,
  medicationService,
  medicationTitle,
  normalizeSchedule,
  providerService,
  scheduleText,
  stoppedText,
} from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { LIST_PAGE_MAX, pageOf, pagingInput } from "./readSupport";
import { asMember, loadGroup } from "./shared";
import { medicationTypeLabel } from "@caretook/data/domain";

const input = z.object({
  includePast: z
    .boolean()
    .optional()
    .describe("Also completed and discontinued medications (with when and why). Default: current only."),
  ...pagingInput,
});

/** The group's medications: current ones, or with the completed and discontinued, by name. */
export const listMedications = defineTool({
  name: "list_medications",
  title: "List medications",
  description: `The care recipient's medications by name: strength, form, type (prescription, otc, supplement, other, or null when not set), dose, directions, why, the schedule as it reads ("Morning and Evening", "As needed, up to 4 a day"), prescriber and pharmacy. Current ones by default; includePast adds completed and discontinued. At most ${LIST_PAGE_MAX} a page; pass nextCursor back for more.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const meds = await medicationService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(meds)) return meds;
    // Deleted passes too: an old schedule keeps its names.
    const passes = await medicationPassService.list(asMember(ctx), {
      groupId: ctx.groupId,
      includeDeleted: true,
    });
    if (isError(passes)) return passes;
    const providers = await providerService.list(asMember(ctx), {
      groupId: ctx.groupId,
      includeDeleted: true,
    });
    if (isError(providers)) return providers;
    const providerName = (id: string | null) =>
      id ? { id, name: providers.data.find((p) => p.id === id)?.name ?? null } : null;

    const wanted = meds.data
      .filter((m) => args.includePast || m.status === "current")
      .sort(
        (a, b) =>
          Number(a.status !== "current") - Number(b.status !== "current") ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
          a.id.localeCompare(b.id),
      );
    const page = pageOf(wanted, args);

    const medications = page.items.map((m) => {
      const schedule = normalizeSchedule(m.schedule);
      return {
        id: m.id,
        title: medicationTitle(m),
        name: m.name,
        strength: m.strength,
        form: m.form,
        type: m.type ?? null,
        dose: m.dose,
        directions: m.directions,
        reason: m.reason,
        schedule: schedule ? scheduleText(schedule, passes.data, m.dose) : null,
        asNeeded: schedule?.type === "asNeeded",
        maxPerDay: schedule?.type === "asNeeded" ? (schedule.maxPerDay ?? null) : null,
        status: m.status,
        startedOn: m.startedOn,
        stoppedOn: m.stoppedOn,
        stopReason: m.stopReason,
        stopNote: m.stopNote,
        stopped: stoppedText(m),
        prescriber: providerName(m.prescriberId),
        pharmacy: providerName(m.pharmacyId),
        lastFilledOn: m.lastFilledOn,
        refillsLeft: m.refillsLeft,
      };
    });

    const line = (m: (typeof medications)[number]) =>
      `- ${[m.title, m.type ? medicationTypeLabel(m.type) : null, m.dose, m.schedule, m.stopped].filter(Boolean).join(" · ")}${m.reason ? ` (for ${m.reason})` : ""}`;
    const text = medications.length
      ? [
          `${medications.length} medication${medications.length === 1 ? "" : "s"}:`,
          ...medications.map(line),
          ...(page.nextCursor ? ["More: call again with nextCursor."] : []),
        ].join("\n")
      : "No medications.";
    return { text, structured: { medications, nextCursor: page.nextCursor } };
  },
});
