import type { MenuEntry } from "~/components/ui";
import type { LocalPass } from "~/lib/medications/medicationPasses.sync";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Clock, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { ConfirmDialog, EmptyState, LINK, Menu, SEPARATOR } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { clockTime, medicationTitle } from "~/lib/medications/medicationDisplay";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { PASS_FIELD } from "./passActions";

export type PassWithMedications = { pass: LocalPass; medications: LocalMedication[] };

/**
 * The passes in the day's order (by time, then name): each one's name and
 * time and the current medications in it (links to their pages). Writers get
 * a ⋯ menu on each: Edit and Delete (after a confirm that says the
 * medications keep the time). The writes are local, so they work offline.
 */
export function PassList({
  groupId,
  passes,
  canWrite,
  onEdit,
}: {
  groupId: string;
  passes: readonly PassWithMedications[];
  canWrite: boolean;
  onEdit: (pass: LocalPass) => void;
}) {
  const fetcher = useFetcher();
  const [deleting, setDeleting] = useState<LocalPass | null>(null);
  const post = (fields: Record<string, string>) => void fetcher.submit(fields, { method: "post" });
  const { easyRole } = useGroup();
  const linkState = useMedicationLinkState();

  if (!passes.length)
    return (
      <EmptyState {...sectionAccent("medications", { easy: easyRole })} data-passes-empty="">
        No passes yet.
      </EmptyState>
    );

  const actions = (pass: LocalPass): MenuEntry[] => [
    { id: "edit", label: "Edit", icon: Pencil, onAction: () => onEdit(pass) },
    SEPARATOR,
    { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: () => setDeleting(pass) },
  ];

  return (
    <>
      <ol className="divide-base-300 border-base-300 rounded-box divide-y border" data-passes>
        {passes.map(({ pass, medications }) => (
          <li key={pass.id} className="flex items-start gap-3 px-3 py-2.5" data-pass={pass.id}>
            <span
              aria-hidden="true"
              className="bg-primary/15 text-primary mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
            >
              <Clock className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium wrap-break-word">
                <span data-pass-name>{pass.name}</span>
                <span className="text-muted font-normal">
                  {" · "}
                  <time data-pass-time dateTime={pass.time}>
                    {clockTime(pass.time)}
                  </time>
                </span>
              </p>
              {medications.length ? (
                <ul className="text-sm" aria-label={`Medications in ${pass.name}`} data-pass-medications>
                  {medications.map((m) => (
                    <li key={m.id} className="inline after:content-[',_'] last:after:content-none">
                      <Link
                        to={appUrls.medication(groupId, m.id)}
                        state={linkState}
                        className={LINK}
                        data-pass-medication={m.id}
                      >
                        {medicationTitle(m)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm" data-pass-medications-none>
                  No medications yet
                </p>
              )}
            </div>
            {canWrite && (
              <Menu
                label={`Actions for ${pass.name}`}
                items={actions(pass)}
                variant="ghost"
                size="sm"
                shape="square"
                className="shrink-0"
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </Menu>
            )}
          </li>
        ))}
      </ol>
      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `Delete ${deleting.name}?` : "Delete pass?"}
        message={
          deleting
            ? `Its medications keep ${clockTime(deleting.time)} as a time of their own. Nothing else changes.`
            : null
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) post({ [PASS_FIELD.intent]: "remove", [PASS_FIELD.passId]: deleting.id });
          setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
