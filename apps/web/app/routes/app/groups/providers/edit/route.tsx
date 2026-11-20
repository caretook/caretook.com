import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { ProviderRow } from "~/lib/sync/providers";

import { useEffect, useMemo, useState } from "react";
import { redirect, useFetcher } from "react-router";
import { isPracticeType } from "@caretook/data/schema";
import { formString } from "~/lib/form";
import { getGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";
import {
  deleteBlockedNote,
  providerQuery,
  removeProvider,
  toProvider,
  updateProvider,
} from "~/lib/sync/providers";
import { readRows } from "~/lib/sync/timeline";
import { ConfirmDialog, Sheet } from "~/components/ui";
import { ProviderForm } from "../ProviderForm";
import { issuesForRows, providerFromForm } from "../providerFormData";
import { useCloseProviderSheet, useProvidersOutlet } from "../providerSheet";
import { editProviderGuard } from "../providerSheetGuard";

// Shared by web + native. `providers/:providerId/edit`: the edit sheet, over
// the directory, with Delete (soft, after a confirm). A viewer, and a
// provider that's missing, deleted or in another group, land on the list.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [row] = await readRows<ProviderRow>(db, providerQuery(params.providerId));
  const decision = editProviderGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
    provider: row ? toProvider(row) : null,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return { provider: decision.sheet };
}

/** Local writes; the list's live query shows them, and PowerSync uploads them. */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  if (formString(form, "intent") === "remove") return removeProvider(db, params.providerId);
  const { input, phoneRows } = providerFromForm(form);
  const result = await updateProvider(db, params.providerId, input);
  if (!result.ok) return { ...result, issues: issuesForRows(result.issues, phoneRows) };
  return { ok: true };
}

/**
 * The sheet closes on a save or a delete, so its loader doesn't run again
 * (after a delete it would find the provider gone and redirect as well).
 */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function EditProviderSheet({ loaderData }: Route.ComponentProps) {
  const { provider } = loaderData;
  const { providers } = useProvidersOutlet();
  const close = useCloseProviderSheet();
  const remover = useFetcher<ActionResult>();
  const [confirming, setConfirming] = useState(false);
  const practices = useMemo(() => providers.filter((p) => isPracticeType(p.type)), [providers]);
  // A practice that live providers name can't be deleted (the device and the server refuse it).
  const blocked = deleteBlockedNote(
    provider.type,
    providers.filter((p) => p.practiceId === provider.id).length,
  );

  // Deleted: the list no longer has it, so close the sheet.
  useEffect(() => {
    if (remover.state === "idle" && remover.data?.ok) close();
  }, [remover.state, remover.data, close]);
  const refusal = remover.state === "idle" && remover.data && !remover.data.ok ? remover.data.error : null;

  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title={`Edit ${provider.name}`}>
      <ProviderForm
        key={provider.id}
        provider={provider}
        practices={practices}
        onDone={close}
        onCancel={close}
        onDelete={() => setConfirming(true)}
      />
      {refusal && (
        <p role="alert" className="text-error text-sm">
          {refusal}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Delete ${provider.name}?`}
        confirmLabel="Delete"
        message={blocked}
        confirmDisabled={!!blocked}
        onConfirm={() => {
          setConfirming(false);
          void remover.submit({ intent: "remove" }, { method: "post" });
        }}
        onClose={() => setConfirming(false)}
      />
    </Sheet>
  );
}
