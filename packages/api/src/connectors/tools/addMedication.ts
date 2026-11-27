import type { MedicationScheduleInput, NewMedicationDraft } from "@caretook/data";

import {
  foldSearchText,
  isError,
  MEDICATION_FORMS,
  MEDICATION_LIMITS,
  MEDICATION_PASS_LIMITS,
  medicationPassService,
  medicationService,
  medicationTitle,
  medicationTypeZSchema,
  newError,
  newItemPreview,
  normalizeSchedule,
  passNameKey,
  scheduleText,
  scheduleTimeZSchema,
  sortPasses,
} from "@caretook/data";
import { z } from "zod";
import { linkTo, medicationPath } from "../links";
import { defineTool, WRITE_ANNOTATIONS } from "../registry";
import { asMember } from "./shared";

// add_medication (connectors-3): a member's assistant adds a current
// medication with its type and schedule through the Add medication sheet's
// schemas and service (`medicationService.create` as the member, with the
// client's name as `via` on its "started" entry). Med times come by name and
// become the group's passes; the schedule's own rules (1 to 8 distinct
// slots) are `medicationScheduleZSchema`'s. A current medication of the same
// name and strength is answered, not added again. No refills or Rx number:
// those stay the sheet's.

const text = (max: number, what: string) => z.string().trim().max(max).optional().describe(what);

const slotInput = z
  .object({
    medTime: z
      .string()
      .trim()
      .min(1)
      .max(MEDICATION_PASS_LIMITS.name)
      .optional()
      .describe(
        'One of the care group\'s med times by name, as todays_doses and dose_schedule name them ("Morning").',
      ),
    time: scheduleTimeZSchema
      .optional()
      .describe('A time of its own, 24-hour "HH:MM" in the care recipient\'s time zone ("14:00").'),
    amount: text(
      MEDICATION_LIMITS.doseAmount,
      'How much at this time, when it differs from the usual dose ("2 tablets").',
    ),
  })
  .superRefine((slot, ctx) => {
    if ((slot.medTime === undefined) === (slot.time === undefined))
      ctx.addIssue({ code: "custom", message: "Give either medTime or time, not both" });
  });

const scheduleInput = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("asNeeded"),
      maxPerDay: z
        .int()
        .min(1)
        .max(MEDICATION_LIMITS.maxPerDay)
        .optional()
        .describe("At most this many a day, when the prescriber set a limit."),
    }),
    z.object({
      type: z.literal("scheduled"),
      slots: z
        .array(slotInput)
        .min(1)
        .max(MEDICATION_LIMITS.scheduleTimes)
        .describe(
          `When it's given each day: 1 to ${MEDICATION_LIMITS.scheduleTimes} slots, each a med time or a time of its own.`,
        ),
    }),
  ])
  .describe('Required. { "type": "asNeeded", "maxPerDay"? } or { "type": "scheduled", "slots": [...] }.');

const input = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(MEDICATION_LIMITS.name)
    .describe('The medication\'s name, as on the label: "Lisinopril", "Vitamin D3".'),
  type: medicationTypeZSchema.describe(
    "Required: prescription, otc (over the counter), supplement or other. Ask the member when it isn't clear.",
  ),
  strength: text(MEDICATION_LIMITS.strength, 'The strength: "10 mg", "500 mg/5 mL".'),
  form: z.enum(MEDICATION_FORMS).optional().describe("Its form."),
  dose: text(MEDICATION_LIMITS.dose, 'The usual dose each time: "1 tablet", "5 mL".'),
  directions: text(MEDICATION_LIMITS.directions, 'How to take it: "With food".'),
  reason: text(MEDICATION_LIMITS.reason, 'What it\'s for: "Blood pressure".'),
  startedOn: z.iso.date().optional().describe('The day it was started, "YYYY-MM-DD".'),
  prescriberId: z
    .uuid()
    .optional()
    .describe("Who prescribed it: a clinician's or practice's id from list_providers."),
  pharmacyId: z.uuid().optional().describe("Where it's filled: a pharmacy's id from list_providers."),
  schedule: scheduleInput,
});

/** Text as the duplicate check compares it: folded, its spacing collapsed (none is ""). */
const textKey = (value: string | null | undefined) =>
  foldSearchText(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

export const addMedication = defineTool({
  name: "add_medication",
  title: "Add a medication",
  description:
    "Add a current medication to the care recipient's medication list. type and schedule are required: ask the member for them, never guess. A schedule is as needed (with an optional most a day) or scheduled, each slot either one of the group's med times by name (as todays_doses and dose_schedule name them) or a time of its own (HH:MM). prescriberId and pharmacyId are ids from list_providers. One already on the list with the same name and strength isn't added twice. Ask the member before calling.",
  scope: "readWrite",
  input,
  annotations: WRITE_ANNOTATIONS,
  handler: async (args, ctx) => {
    const passes = await medicationPassService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(passes)) return passes;

    // Med times by name, any case; every unknown one is an issue naming the group's.
    let schedule: MedicationScheduleInput;
    if (args.schedule.type === "scheduled") {
      const known = sortPasses(passes.data);
      const named = (name: string) => known.find((p) => passNameKey(p.name) === passNameKey(name));
      const listed = known.length
        ? `Med times: ${known.map((p) => `${p.name} (${p.time})`).join(", ")}.`
        : "This care group has no med times.";
      const issues = args.schedule.slots.flatMap((slot, n) =>
        slot.medTime !== undefined && !named(slot.medTime)
          ? [
              {
                path: `schedule.slots.${n}.medTime`,
                message: `No med time called ${slot.medTime}. ${listed}`,
              },
            ]
          : [],
      );
      if (issues.length) return newError({ code: "connectorTool:invalid", meta: { issues } });
      schedule = {
        type: "scheduled",
        slots: args.schedule.slots.map((slot) => {
          const at = slot.medTime !== undefined ? { passId: named(slot.medTime)!.id } : { time: slot.time! };
          return slot.amount ? { ...at, amount: slot.amount } : at;
        }),
      };
    } else {
      schedule = args.schedule;
    }

    const medicationUrl = (id: string) => linkTo(ctx.origin, medicationPath(ctx.groupId, id));
    const meds = await medicationService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(meds)) return meds;
    const same = meds.data.find(
      (m) =>
        m.status === "current" &&
        textKey(m.name) === textKey(args.name) &&
        textKey(m.strength) === textKey(args.strength),
    );
    if (same) {
      const url = medicationUrl(same.id);
      return {
        text: [`Already on the medication list, nothing added: ${medicationTitle(same)}`, url].join("\n"),
        structured: { medicationId: same.id, alreadyThere: true, url },
      };
    }

    const medication = await medicationService.create(
      asMember(ctx),
      {
        groupId: ctx.groupId,
        status: "current",
        name: args.name,
        type: args.type,
        strength: args.strength,
        form: args.form,
        dose: args.dose,
        directions: args.directions,
        reason: args.reason,
        startedOn: args.startedOn,
        prescriberId: args.prescriberId,
        pharmacyId: args.pharmacyId,
        schedule,
      },
      { via: ctx.clientName },
    );
    if (isError(medication)) return medication;
    if (!medication) return newError({ code: "medicationService:notFound" });

    const draft: NewMedicationDraft = {
      kind: "medication",
      name: medication.name,
      strength: medication.strength,
      form: medication.form,
      directions: medication.directions,
    };
    const preview = newItemPreview(draft);
    const stored = normalizeSchedule(medication.schedule);
    const scheduleLine = stored ? scheduleText(stored, passes.data, medication.dose) : null;
    const url = medicationUrl(medication.id);
    const line = [preview.title, preview.detail].filter(Boolean).join(" · ");
    return {
      text: [
        `Added medication: ${line}`,
        ...(scheduleLine ? [`Schedule: ${scheduleLine}`] : []),
        url,
        `Shown as "via ${ctx.clientName}" on its started entry.`,
      ].join("\n"),
      structured: { medicationId: medication.id, preview, schedule: scheduleLine, url, via: ctx.clientName },
    };
  },
});
