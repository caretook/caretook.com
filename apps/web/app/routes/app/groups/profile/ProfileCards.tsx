import type { ReactNode } from "react";
import type { RecipientProfile } from "~/lib/sync/profile";

import { basicLines } from "~/lib/recipientDisplay";

// The profile's cards every member sees: the medical basics, and the note for
// helpers. Each is a titled region (`data-section`), like the writers' cards
// later slices add after them.

export function ProfileCard({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  /** Beside the title: the card's Edit, for writers. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `profile-${id}-heading`;
  const heading = (
    <h2 id={headingId} className="card-title text-base">
      {title}
    </h2>
  );
  return (
    <section aria-labelledby={headingId} data-section={id} className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        {action ? (
          <div className="flex items-start justify-between gap-3">
            {heading}
            {action}
          </div>
        ) : (
          heading
        )}
        {children}
      </div>
    </section>
  );
}

/** Code status, blood type, language and pronouns: each only when set. */
export function BasicsCard({ profile }: { profile: RecipientProfile }) {
  const lines = basicLines(profile);
  return (
    <ProfileCard id="basics" title="Basics">
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
    </ProfileCard>
  );
}

/** The note for helpers ("hard of hearing on the left; uses a walker"), as written. */
export function NoteCard({ profile, canEdit }: { profile: RecipientProfile; canEdit: boolean }) {
  if (!profile.notes && !canEdit) return null;
  return (
    <ProfileCard id="note" title="Note for helpers">
      {profile.notes ? (
        <p className="whitespace-pre-line" data-note="">
          {profile.notes}
        </p>
      ) : (
        <p className="text-base-content/70 text-sm">
          No note yet. Add what anyone helping should know, such as how they hear or get around.
        </p>
      )}
    </ProfileCard>
  );
}
