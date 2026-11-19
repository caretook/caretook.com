import type { ContactPhone, InsurancePlan, InsuranceRank } from "@caretook/data/schema";
import type { ActionResult, FieldIssue } from "~/lib/api";

import { careRecipientDetailsUpdateZSchema, INSURANCE_RANKS } from "@caretook/data/schema";
import { issuesForRows, phonesFromForm } from "../../../../lib/contactForm";

// The Contact and Insurance sheets' forms (`profile/contact`,
// `profile/insurance`): what they post, turned into a valid change for
// `careGroup.updateRecipientDetails`, or an error on each field that's
// wrong. Pure, so web:unit tests it. Both check the shared schema here, so a
// mistake shows without a round trip; the server checks it again.

type Failure = Extract<ActionResult, { ok: false }>;
const CHECK_FIELDS = "Check the highlighted fields.";

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const zodIssues = (issues: readonly { path: PropertyKey[]; message: string }[]): FieldIssue[] =>
  issues.map(({ path, message }) => ({ path: path.map(String).join("."), message }));

// ─────────────────────────── Contact ───────────────────────────

/** The Contact sheet's field names (besides the phones, which `PhoneFields` names). */
export const RECIPIENT_CONTACT_FIELD = { email: "email", address: "address" } as const;

export type RecipientContactChange = { phones: ContactPhone[]; email: string | null; address: string | null };

/**
 * A submitted Contact form: the phones (blank rows left out), the email and
 * the address. Empty email or address clears it. An issue on a phone is moved
 * to the form's row it came from (`phones.<row>.number`).
 */
export const parseRecipientContact = (
  form: FormData,
): { ok: true; data: RecipientContactChange } | Failure => {
  const { phones, phoneRows } = phonesFromForm(form);
  const parsed = careRecipientDetailsUpdateZSchema.safeParse({
    phones,
    email: text(form, RECIPIENT_CONTACT_FIELD.email),
    address: text(form, RECIPIENT_CONTACT_FIELD.address),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: CHECK_FIELDS,
      issues: issuesForRows(zodIssues(parsed.error.issues), phoneRows),
    };
  return {
    ok: true,
    data: {
      phones: parsed.data.phones ?? [],
      email: parsed.data.email ?? null,
      address: parsed.data.address ?? null,
    },
  };
};

// ─────────────────────────── Insurance ───────────────────────────

/**
 * The Insurance sheet's names. Each plan is a row with its own key (kept as
 * rows are added and removed), posted in order as `planKey`; its fields are
 * `plan.<key>.<field>`, so a radio group per plan has its own name.
 */
export const PLAN_KEY = "planKey";
export const PLAN_FIELDS = ["id", "rank", "insurer", "planName", "memberId", "groupNumber", "phone"] as const;
export type PlanField = (typeof PLAN_FIELDS)[number];
export const planFieldName = (key: string | number, field: PlanField) => `plan.${key}.${field}`;

/** A plan's typed fields: everything but the id and rank. */
const TYPED: readonly PlanField[] = ["insurer", "planName", "memberId", "groupNumber", "phone"];

/**
 * A submitted Insurance form's plans, in order, with the key of the row each
 * came from. A row with nothing typed is left out (its rank alone doesn't
 * count). A row with no id is new: the schema gives it one.
 */
export const plansFromForm = (form: FormData) => {
  const plans: Record<string, string | undefined>[] = [];
  const keys: string[] = [];
  for (const key of form.getAll(PLAN_KEY)) {
    if (typeof key !== "string") continue;
    const read = (field: PlanField) => text(form, planFieldName(key, field));
    if (TYPED.every((field) => !read(field).trim())) continue;
    plans.push({
      id: read("id") || undefined,
      rank: read("rank") || undefined,
      insurer: read("insurer"),
      planName: read("planName"),
      memberId: read("memberId"),
      groupNumber: read("groupNumber"),
      phone: read("phone"),
    });
    keys.push(key);
  }
  return { plans, keys };
};

/**
 * Issues on sent plans (`insurance.1.memberId`) moved to their rows in the
 * form (`plan.<key>.memberId`); one about the list stays `insurance`.
 */
export const issuesForPlanRows = (issues: FieldIssue[], keys: readonly string[]): FieldIssue[] =>
  issues.map((issue) => {
    const match = /^insurance\.(\d+)\.(\w+)/.exec(issue.path);
    const key = match ? keys[Number(match[1])] : undefined;
    return match && key !== undefined ? { ...issue, path: planFieldName(key, match[2] as PlanField) } : issue;
  });

/** A submitted Insurance form, as `careGroup.updateRecipientDetails` takes it (every plan). */
export const parseInsuranceForm = (form: FormData): { ok: true; data: InsurancePlan[] } | Failure => {
  const { plans, keys } = plansFromForm(form);
  const parsed = careRecipientDetailsUpdateZSchema.safeParse({ insurance: plans });
  if (!parsed.success)
    return {
      ok: false,
      error: CHECK_FIELDS,
      issues: issuesForPlanRows(zodIssues(parsed.error.issues), keys),
    };
  return { ok: true, data: parsed.data.insurance ?? [] };
};

/**
 * The rank a new plan starts with: primary while there's none, then
 * secondary, then other (one primary and one secondary at most).
 */
export const nextRank = (ranks: readonly (string | undefined)[]): InsuranceRank =>
  INSURANCE_RANKS.find((rank) => rank === "other" || !ranks.includes(rank)) ?? "other";
