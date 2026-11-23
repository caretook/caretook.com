import type { OutsideContact } from "@caretook/data/schema";
import type { EmergencyMemberRow } from "~/lib/profiles/emergencyList";

import { ContactLines } from "~/components/contact";
import { Badge, EmptyState, Notice, Section, STATUS_TONE } from "~/components/ui";
import { droppedNotes, emergencyEntries, emergencyPhoneLines } from "~/lib/profiles/emergencyList";
import { EditSheetLink } from "./DetailsSections";

// The writers' Emergency contacts section (profiles slice 5): the group's one
// ordered list across members (the phones they share) and outside contacts,
// the primary contact marked. Owners and admins get Edit (the
// `profile/emergency` sheet) and a note when someone fell off the list by
// no longer sharing a phone.

export function EmergencySection({
  groupId,
  members,
  outside,
  canManage,
}: {
  groupId: string;
  members: readonly EmergencyMemberRow[];
  outside: readonly OutsideContact[];
  canManage: boolean;
}) {
  const entries = emergencyEntries(members, outside);
  const notes = canManage ? droppedNotes(members) : [];
  return (
    <Section
      id="emergency"
      title="Emergency contacts"
      actions={
        canManage && <EditSheetLink groupId={groupId} sheet="emergency" label="Edit emergency contacts" />
      }
    >
      {notes.map((note) => (
        <Notice key={note} tone="warning" data-emergency-dropped="">
          {note}
        </Notice>
      ))}
      {entries.length ? (
        <ol className="divide-base-300 divide-y" data-emergency-list="">
          {entries.map((entry, i) => (
            <li
              key={entry.key}
              className="flex gap-3 py-3 first:pt-0 last:pb-0"
              data-emergency-entry={entry.key}
              data-primary={entry.isPrimary ? "" : undefined}
            >
              <span className="text-muted w-5 shrink-0 pt-0.5 text-right text-sm tabular-nums">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium" data-emergency-name="">
                    {entry.name}
                  </span>
                  {entry.isPrimary && (
                    <Badge tone={STATUS_TONE.current} data-badge="primary">
                      Primary contact
                    </Badge>
                  )}
                </p>
                {entry.relationship && <p className="text-sm">{entry.relationship}</p>}
                <ContactLines lines={emergencyPhoneLines(entry)} data-emergency-phones="" />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState>No emergency contacts yet.</EmptyState>
      )}
    </Section>
  );
}
