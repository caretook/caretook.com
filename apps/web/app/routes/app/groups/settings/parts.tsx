import type { ReactNode } from "react";

import { WifiOff } from "lucide-react";
import { useEffect, useId } from "react";
import { useRevalidator } from "react-router";
import { NEEDS_CONNECTION } from "./groupSettings";

// What the group's settings subpages (`details`, `members`) share: the page
// with its heading and offline notice, its cards, and read-only details.

/**
 * One subpage: its heading, then "Needs a connection to edit" while the
 * loader couldn't reach the server. Back online, the loader runs again (and
 * the forms come back). `id` names the page as a whole (`data-section`) when
 * it is one part rather than several cards.
 */
export function SettingsPage({
  id,
  title,
  online,
  children,
}: {
  id?: string;
  title: string;
  online: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  useRevalidateWhenOnline(online);
  return (
    <section aria-labelledby={headingId} data-section={id} className="space-y-4">
      <h1 id={headingId} className="text-2xl font-semibold">
        {title}
      </h1>
      {!online && (
        <p role="status" data-needs-connection="" className="alert text-sm">
          <WifiOff aria-hidden="true" className="size-4" />
          {NEEDS_CONNECTION}
        </p>
      )}
      {children}
    </section>
  );
}

/** Back online: load again, for the date of birth and the forms. */
function useRevalidateWhenOnline(online: boolean) {
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (online) return;
    const retry = () => void revalidate();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [online, revalidate]);
}

/** One part of a page: a card with a heading that names its region. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} data-section={id} className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 id={`${id}-heading`} className="card-title text-lg">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function Details({ children }: { children: ReactNode }) {
  return <dl className="space-y-3">{children}</dl>;
}

export function Detail({
  label,
  value,
  empty = "Not set",
}: {
  label: string;
  value?: string | null;
  empty?: string;
}) {
  return (
    <div>
      <dt className="text-base-content/70 text-sm">{label}</dt>
      <dd className={value ? "" : "text-base-content/70"}>{value || empty}</dd>
    </div>
  );
}
