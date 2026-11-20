import type { MenuEntry } from "~/components/ui";
import type { LocalPass } from "~/lib/sync/medicationPasses";
import type { LocalMedication } from "~/lib/sync/medications";

import { ArrowDown, ArrowUp, Clock, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { ConfirmDialog, Menu, SEPARATOR } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { clockTime, medicationTitle } from "~/lib/medicationDisplay";
import { PASS_FIELD } from "./passActions";

export type PassWithMedications = { pass: LocalPass; medications: LocalMedication[] };

/**
 * The passes in the day's order: each one's name and time and the current
 * medications in it (links to their pages). Writers get a ⋯ menu on each:
 * Edit, Move up, Move down and Delete (after a confirm that says the
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

  if (!passes.length)
    return (
      <p className="text-base-content/70 py-6 text-center" data-passes-empty>
        No passes yet.
      </p>
    );

  const actions = (pass: LocalPass, index: number): MenuEntry[] => [
    { id: "edit", label: "Edit", icon: Pencil, onAction: () => onEdit(pass) },
    {
      id: "up",
      label: "Move up",
      icon: ArrowUp,
      isDisabled: index === 0,
      onAction: () => post({ [PASS_FIELD.intent]: "move", [PASS_FIELD.passId]: pass.id, direction: "up" }),
    },
    {
      id: "down",
      label: "Move down",
      icon: ArrowDown,
      isDisabled: index === passes.length - 1,
      onAction: () => post({ [PASS_FIELD.intent]: "move", [PASS_FIELD.passId]: pass.id, direction: "down" }),
    },
    SEPARATOR,
    { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: () => setDeleting(pass) },
  ];

  return (
    <>
      <ol className="divide-base-300 border-base-300 rounded-box divide-y border" data-passes>
        {passes.map(({ pass, medications }, index) => (
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
                <span className="text-base-content/70 font-normal">
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
                        className="link link-hover"
                        data-pass-medication={m.id}
                      >
                        {medicationTitle(m)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base-content/70 text-sm" data-pass-medications-none>
                  No medications yet
                </p>
              )}
            </div>
            {canWrite && (
              <Menu
                label={`Actions for ${pass.name}`}
                items={actions(pass, index)}
                className="btn btn-ghost btn-sm btn-square shrink-0"
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
