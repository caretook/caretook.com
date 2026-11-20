import type { ReactNode } from "react";
import type { ActionResult } from "~/lib/core/api";

import { WifiOff } from "lucide-react";
import { useEffect, useId } from "react";
import { useRevalidator } from "react-router";

// The parts every settings subpage (account and group) is made of: the page
// with its heading, its cards, read-only details, and a form's Save row.

/**
 * One subpage: its heading, then `offlineNotice` while the page loaded
 * without a connection (it loads again once the connection is back). `id`
 * names the page as a whole (`data-section`) when it is one part rather than
 * several cards; `headingId` lets a control on the page be named by the heading.
 */
export function SettingsPage({
  id,
  title,
  headingId,
  offlineNotice,
  children,
}: {
  id?: string;
  title: string;
  headingId?: string;
  offlineNotice?: string;
  children: ReactNode;
}) {
  const ownId = useId();
  const heading = headingId ?? ownId;
  useRevalidateWhenOnline(!!offlineNotice);
  return (
    <section aria-labelledby={heading} data-section={id} className="space-y-4">
      <h1 id={heading} className="text-2xl font-semibold">
        {title}
      </h1>
      {offlineNotice && (
        <p role="status" data-needs-connection="" className="alert text-sm">
          <WifiOff aria-hidden="true" className="size-4" />
          {offlineNotice}
        </p>
      )}
      {children}
    </section>
  );
}

/** Back online: load again, so the forms come back. */
function useRevalidateWhenOnline(offline: boolean) {
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (!offline) return;
    const retry = () => void revalidate();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [offline, revalidate]);
}

/**
 * A card on a settings page. With a `title` it's a region of its own (a
 * `section` named by its heading, `data-section={id}`); without, a plain card.
 */
export function SettingsCard({ id, title, children }: { id?: string; title?: string; children: ReactNode }) {
  if (!title)
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">{children}</div>
      </div>
    );
  const headingId = `${id ?? "card"}-heading`;
  return (
    <section aria-labelledby={headingId} data-section={id} className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 id={headingId} className="card-title text-lg">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

/** Read-only settings: a list of `Detail`s. */
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

/** A settings form's Save button, then "Saved." (or `savedText`) or what went wrong. */
export function SaveRow({
  busy,
  result,
  savedText = "Saved.",
}: {
  busy: boolean;
  result: ActionResult | undefined;
  savedText?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
      {result?.ok && (
        <p role="status" className="text-success text-sm">
          {savedText}
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}
    </div>
  );
}
