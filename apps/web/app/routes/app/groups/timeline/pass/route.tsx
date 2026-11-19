import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";
import type { DoseChoiceRow } from "~/lib/sync/medicationTimeline";
import type { PassLogDoseRow } from "~/lib/sync/passLogs";
import type { PassLogDose } from "./PassLogForm";

import { useEffect, useMemo } from "react";
import { redirect } from "react-router";
import { doseDetailsZSchema } from "@caretook/data/schema";
import { Sheet } from "~/components/ui";
import { formString } from "~/lib/form";
import { getGroup } from "~/lib/group";
import { medicationLabel } from "~/lib/medicationEntries";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import { doseChoicesQuery, toDoseChoices } from "~/lib/sync/medicationTimeline";
import { addToPassLog, passLogDosesQuery, removePassLog, updateDoses } from "~/lib/sync/passLogs";
import { fromLocalTimestamp, readRows } from "~/lib/sync/timeline";
import { useCloseSheet } from "../sheet";
import { PassLogForm } from "./PassLogForm";
import { passLogJoin, passLogPatchesFromForm, passSheetGuard } from "./passSheet";

// Shared by web + native. `timeline/pass/:passLogId/edit`: the pass sheet,
// over the timeline. One pass log's doses (the doses logged in one round),
// each with its status, amount, time and note; "Add a medication" and
// "Delete this log". A viewer, or a missing or fully deleted log, lands on
// the timeline.

const parseDetails = (value: string | null) => {
  try {
    const parsed = doseDetailsZSchema.safeParse(JSON.parse(value ?? ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The rows as the form shows them: each dose with its medication's name ("(removed)" once deleted). */
const toPassLogDoses = (rows: PassLogDoseRow[]): PassLogDose[] =>
  rows.flatMap((row) => {
    const details = parseDetails(row.details);
    if (!details || !row.occurred_at) return [];
    const name = medicationLabel(
      row.medication_name ? { name: row.medication_name, strength: row.medication_strength } : null,
    );
    return [
      {
        id: row.id,
        occurredAt: fromLocalTimestamp(row.occurred_at),
        medicationName: row.medication_deleted_at ? `${name} (removed)` : name,
        details,
      },
    ];
  });

const passNameSql = "SELECT name FROM medication_pass WHERE id = ?";

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [rows, choiceRows] = await Promise.all([
    readRows<PassLogDoseRow>(db, passLogDosesQuery(group.id, params.passLogId)),
    readRows<DoseChoiceRow>(db, doseChoicesQuery(group.id)),
  ]);
  const decision = passSheetGuard({
    groupId: group.id,
    passLogId: params.passLogId,
    liveDoses: toPassLogDoses(rows).length,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const passId = rows.map((r) => parseDetails(r.details)?.passId).find(Boolean);
  const [pass] = passId
    ? await readRows<{ name: string | null }>(db, { sql: passNameSql, params: [passId] })
    : [];
  return { rows, choices: toDoseChoices(choiceRows), passName: pass?.name ?? null };
}

/** Local writes; live queries show them at once, and PowerSync uploads them. */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const intent = formString(form, "intent");
  if (intent === "save") return updateDoses(db, passLogPatchesFromForm(form));
  if (intent === "delete") return removePassLog(db, group.id, params.passLogId);
  if (intent === "add") {
    const rows = await readRows<PassLogDoseRow>(db, passLogDosesQuery(group.id, params.passLogId));
    const join = passLogJoin(params.passLogId, toPassLogDoses(rows));
    if (!join) return { ok: false, error: "That log is gone. It may have been deleted.", issues: [] };
    const result = await addToPassLog(db, group.id, join, {
      medicationId: formString(form, "medicationId"),
      amount: formString(form, "amount").trim() || null,
    });
    return result.ok ? { ok: true } : result;
  }
  throw new Error(`Unknown intent: ${intent}`);
}

export default function PassSheet({ loaderData, params }: Route.ComponentProps) {
  const { rows, choices, passName } = loaderData;
  const close = useCloseSheet();
  const query = passLogDosesQuery(params.groupId, params.passLogId);
  const live = useLiveQuery<PassLogDoseRow>(query.sql, query.params, rows);
  const doses = useMemo(() => toPassLogDoses(live), [live]);

  // Deleted here or on another device while open: close, and show the timeline.
  const gone = doses.length === 0;
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  return (
    <Sheet
      isOpen={!gone}
      onOpenChange={(open) => !open && close()}
      title={passName ? `Edit ${passName} log` : "Edit medication log"}
    >
      <PassLogForm doses={doses} choices={choices} onDone={close} onCancel={close} />
    </Sheet>
  );
}
