import type { RecipientProfile } from "~/lib/profiles/profile.sync";

import { Section } from "~/components/ui";
import { basicLines } from "~/lib/profiles/recipientDisplay";

// The profile's sections every member sees: the medical basics, and the note
// for helpers. Each is a titled band (`Section`, `data-section`), like the
// writers' sections after them.

/** Code status, blood type, language and pronouns: each only when set. */
export function BasicsCard({ profile }: { profile: RecipientProfile }) {
  const lines = basicLines(profile);
  return (
    <Section id="basics" title="Basics">
      {lines.length ? (
        <dl className="grid grid-cols-2 gap-3">
          {lines.map((line) => (
            <div key={line.id} data-basic={line.id}>
              <dt className="text-base-content/70 text-sm">{line.label}</dt>
              <dd className="font-medium">
                {line.spoken ? (
                  <>
                    <span aria-hidden="true">{line.value}</span>
                    <span className="sr-only">{line.spoken}</span>
                  </>
                ) : (
                  line.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-base-content/70 text-sm">Nothing added yet.</p>
      )}
    </Section>
  );
}

/** The note for helpers ("hard of hearing on the left; uses a walker"), as written. */
export function NoteCard({ profile, canEdit }: { profile: RecipientProfile; canEdit: boolean }) {
  if (!profile.notes && !canEdit) return null;
  return (
    <Section id="note" title="Note for helpers">
      {profile.notes ? (
        <p className="whitespace-pre-line" data-note="">
          {profile.notes}
        </p>
      ) : (
        <p className="text-base-content/70 text-sm">
          No note yet. Add what anyone helping should know, such as how they hear or get around.
        </p>
      )}
    </Section>
  );
}
