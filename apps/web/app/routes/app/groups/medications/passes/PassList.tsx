import type { MenuEntry } from "~/components/ui";
import type { DuePass } from "~/lib/medications/duePasses";
import type { LocalPass } from "~/lib/medications/medicationPasses.sync";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { CheckCheck, Clock, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { PASS_TONE, PassExtraDoseWarnings, PassUndoStatus, usePassLog } from "~/components/medications";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  LINK,
  List,
  ListRow,
  Menu,
  Message,
  SEPARATOR,
} from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import {
  clockTime,
  givenAllLabel,
  medicationTitle,
  passLoggedText,
  passStateText,
} from "~/lib/medications/medicationDisplay";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { PASS_FIELD } from "./passActions";

export type PassWithMedications = { pass: LocalPass; medications: LocalMedication[] };

/** Where the Passes tab's Undo is shown (`PassUndoStatus`'s `place`), so Schedule's line doesn't offer it. */
export const PASSES_UNDO = "passes";

/**
 * The passes in the day's order (by time, then name), each a card in the
 * medication card's style (`MedicationCard`): its name and time, today's
 * state (`today`, by pass id: Schedule's `DuePass`), who logged it so far,
 * and the current medications in it (links to their pages). The card itself
 * opens nothing. Writers get, as on Schedule's `PassCard`, **Given all**
 * while any medication in it is open today (every open one, given now;
 * then Undo here), and a ⋯ menu: Edit and Delete (after a confirm that says
 * the medications keep the time). Viewers see the state with no controls.
 * The writes are local, so they work offline.
 */
export function PassList({
  groupId,
  passes,
  today,
  timeZone,
  canWrite,
  nameOf,
  onEdit,
}: {
  groupId: string;
  passes: readonly PassWithMedications[];
  /** Today's state of each pass, by pass id (none when nothing in it falls today). */
  today: ReadonlyMap<string, DuePass>;
  /** The recipient's zone, which today's dose times read in. */
  timeZone: string;
  canWrite: boolean;
  /** A user's name as it reads here ("you" for the viewer). */
  nameOf: (userId: string) => string;
  onEdit: (pass: LocalPass) => void;
}) {
  const fetcher = useFetcher();
  const [deleting, setDeleting] = useState<LocalPass | null>(null);
  const post = (fields: Record<string, string>) => void fetcher.submit(fields, { method: "post" });
  const { easyRole } = useGroup();

  if (!passes.length)
    return (
      <EmptyState {...sectionAccent("medications", { easy: easyRole })} data-passes-empty="">
        No med times yet.
      </EmptyState>
    );

  return (
    <>
      {canWrite && <PassUndoStatus groupId={groupId} place={PASSES_UNDO} />}
      <List data-passes="">
        {passes.map(({ pass, medications }) => (
          <PassRow
            key={pass.id}
            groupId={groupId}
            pass={pass}
            medications={medications}
            today={today.get(pass.id) ?? null}
            timeZone={timeZone}
            canWrite={canWrite}
            nameOf={nameOf}
            onEdit={onEdit}
            onDelete={setDeleting}
          />
        ))}
      </List>
      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `Delete ${deleting.name}?` : "Delete med time?"}
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

function PassRow({
  groupId,
  pass,
  medications,
  today,
  timeZone,
  canWrite,
  nameOf,
  onEdit,
  onDelete,
}: {
  groupId: string;
  pass: LocalPass;
  medications: readonly LocalMedication[];
  today: DuePass | null;
  timeZone: string;
  canWrite: boolean;
  nameOf: (userId: string) => string;
  onEdit: (pass: LocalPass) => void;
  onDelete: (pass: LocalPass) => void;
}) {
  const { givenAll, busy, error } = usePassLog(groupId);
  const linkState = useMedicationLinkState();
  const logged = today && passLoggedText(today, nameOf);
  const menu: MenuEntry[] = [
    { id: "edit", label: "Edit", icon: Pencil, onAction: () => onEdit(pass) },
    SEPARATOR,
    { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: () => onDelete(pass) },
  ];

  return (
    <ListRow
      className="flex flex-wrap items-start gap-x-3 gap-y-1"
      data-pass={pass.id}
      data-pass-state={today?.state}
    >
      <span
        aria-hidden="true"
        className="bg-primary/15 text-primary mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
      >
        <Clock className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 font-medium wrap-break-word">
            <span data-pass-name>{pass.name}</span>
            <span className="text-muted font-normal">
              {" · "}
              <time data-pass-time dateTime={pass.time}>
                {clockTime(pass.time)}
              </time>
            </span>
          </span>
          {today && (
            <Badge tone={PASS_TONE[today.state]} className="shrink-0" data-pass-badge="">
              {passStateText(today)}
            </Badge>
          )}
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
        {logged && (
          <p className="text-muted text-sm" data-pass-logged>
            {logged}
          </p>
        )}
        {today && <PassExtraDoseWarnings pass={today} timeZone={timeZone} className="mt-1" />}
      </div>
      {canWrite && (
        <div className="flex shrink-0 items-center gap-1 self-center">
          {today && today.open.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={CheckCheck}
              disabled={busy}
              aria-label={givenAllLabel(today)}
              data-given-all=""
              onClick={() => void givenAll(today, { place: PASSES_UNDO })}
            >
              Given all
            </Button>
          )}
          <Menu
            label={`Actions for ${pass.name}`}
            items={menu}
            variant="ghost"
            size="sm"
            shape="square"
            className="shrink-0"
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </Menu>
        </div>
      )}
      {error && (
        <Message tone="error" className="w-full pl-11">
          {error}
        </Message>
      )}
    </ListRow>
  );
}
