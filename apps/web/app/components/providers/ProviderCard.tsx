import type { ReactNode } from "react";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { ContactActions } from "./ContactActions";
import { ProviderTypeIcon } from "./ProviderTypeIcon";
import { QuickTags } from "~/components/tags";
import { Badge, ListRow, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { quickActions } from "~/lib/providers/contactActions";
import { REMOVED_PROVIDER } from "~/lib/providers/entryProviders";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { ROW_CHIPS } from "~/lib/tags/tagPicker";

type DataHooks = { [attr: `data-${string}`]: string | undefined };
type CardTag = { id: string; name: string; color?: string | null };

const STRETCHED =
  "outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2";
const NO_TAGS: readonly CardTag[] = [];

export type ProviderCardProps = {
  provider: LocalProvider;
  /** Full: what they are, the contact line and the tags under the name. Condensed: one dense line. */
  look: "full" | "condensed";
  /** Full's details line: its practice's name, after the type and specialty. */
  practiceName?: string | null;
  /** Full's details line in place of "type · specialty · practice" (search's, marked). */
  details?: ReactNode;
  /** The name as shown (search's, marked); the provider's name when left out. */
  title?: ReactNode;
  /** Left out, the name links to their page; a callback, it's a button (an easy role's sheet); null, plain text. */
  open?: (() => void) | null;
  /** Deleted since: greyed "Removed provider" (never its name or `title`), with no link, badges, tags, contact or actions. */
  removed?: boolean;
  /** A quiet line above the name ("Prescriber", "Pharmacy"). */
  label?: ReactNode;
  /** Full's contact line under the details (the directory's `ProviderRowContact`). */
  contact?: ReactNode;
  /** Contact actions at the row's end; condensed's default is `quickActions`' first. */
  actions?: ReactNode;
  /** A control at the very end, above the stretched link (a todo link's Remove). */
  trailing?: ReactNode;
  /** Its tags, from the list's one `useGroupRecordTags` query. */
  tags?: readonly CardTag[];
  /** Chips only, whoever's looking (the easy roles' search). */
  tagsReadOnly?: boolean;
  /** Full's extra lines under the contact line (search's notes snippet). */
  children?: ReactNode;
} & DataHooks;

/**
 * One provider as a row of a list, the same in the directory, search and on
 * a medication's page (shared-displays): the type icon, the name stretched
 * over the row so the whole row opens them, the Primary and Past badges, and
 * their tags as `QuickTags` (two chips, then "+N"; × and Add tag for whoever
 * may tag it). Everything that acts (contact, tags, `trailing`) sits above
 * the stretched name. A past or removed provider is muted.
 */
export function ProviderCard({
  provider,
  look,
  practiceName,
  details,
  title,
  open,
  removed = false,
  label,
  contact,
  actions,
  trailing,
  tags,
  tagsReadOnly,
  children,
  ...data
}: ProviderCardProps) {
  const past = provider.status === "past";
  const muted = past || removed;
  const name = <Name provider={provider} title={title} open={open} removed={removed} muted={muted} />;
  const badges = !removed && <Badges provider={provider} past={past} />;
  const rowTags = !removed && (
    <QuickTags
      target="provider"
      recordId={provider.id}
      label={provider.name}
      createdBy={provider.createdBy}
      max={ROW_CHIPS}
      tags={tags ?? NO_TAGS}
      readOnly={tagsReadOnly}
      className={look === "full" ? "mt-0.5" : "shrink-0"}
    />
  );
  const labelLine = label && <p className="text-muted text-sm">{label}</p>;
  const end = (
    <>
      {!removed && actions}
      {trailing && <div className="relative z-10 flex shrink-0 items-center gap-1">{trailing}</div>}
    </>
  );

  if (look === "condensed") {
    const main = quickActions(provider)[0];
    const line = (
      <p className="flex min-w-0 flex-1 items-baseline gap-1.5">
        {name}
        {!removed && provider.specialty && (
          <span className="text-muted min-w-0 shrink-[2] truncate text-sm">{provider.specialty}</span>
        )}
      </p>
    );
    return (
      <ListRow
        className="hover:bg-base-200/50 relative isolate flex items-center gap-2"
        data-provider-id={provider.id}
        data-condensed=""
        {...data}
      >
        <ProviderTypeIcon type={provider.type} past={muted} className="size-8" />
        {labelLine ? (
          <div className="min-w-0 flex-1">
            {labelLine}
            {line}
          </div>
        ) : (
          line
        )}
        {badges}
        {rowTags}
        {actions === undefined && !removed && main ? <ContactActions actions={[main]} /> : null}
        {end}
      </ListRow>
    );
  }

  const detailText = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, practiceName]
    .filter(Boolean)
    .join(" · ");
  return (
    <ListRow
      className="hover:bg-base-200/50 relative isolate flex items-start gap-3"
      data-provider-id={provider.id}
      {...data}
    >
      <ProviderTypeIcon type={provider.type} past={muted} />
      <div className="min-w-0 flex-1">
        {labelLine}
        <p className="flex min-w-0 items-center gap-1.5">
          {name}
          {badges}
        </p>
        <p className="text-muted truncate text-sm">
          {removed ? PROVIDER_TYPE_META[provider.type].label : (details ?? detailText)}
        </p>
        {!removed && contact}
        {children}
        {rowTags}
      </div>
      {end}
    </ListRow>
  );
}

function Name({
  provider,
  title,
  open,
  removed,
  muted,
}: {
  provider: LocalProvider;
  title: ReactNode;
  open: (() => void) | null | undefined;
  removed: boolean;
  muted: boolean;
}) {
  const text = title ?? provider.name;
  const className = `min-w-0 shrink truncate font-medium ${muted ? "text-muted" : ""}`;
  if (removed)
    return (
      <span className="text-faint min-w-0 shrink truncate" data-provider-name>
        {REMOVED_PROVIDER}
      </span>
    );
  if (open === null)
    return (
      <span className={className} data-provider-name>
        {text}
      </span>
    );
  if (open)
    return (
      <button
        type="button"
        onClick={open}
        className={`cursor-pointer text-left ${STRETCHED} ${className}`}
        data-provider-name
        data-opens-sheet
      >
        {text}
      </button>
    );
  return (
    <Link
      to={appUrls.provider(provider.groupId, provider.id)}
      className={`${STRETCHED} ${className}`}
      data-provider-name
    >
      {text}
    </Link>
  );
}

function Badges({ provider, past }: { provider: LocalProvider; past: boolean }) {
  return (
    <>
      {provider.isPrimary && !past && (
        <Badge tone={STATUS_TONE.current} className="shrink-0" data-marker="">
          Primary
        </Badge>
      )}
      {past && (
        <Badge tone={STATUS_TONE.past} className="shrink-0" data-marker="">
          Past
        </Badge>
      )}
    </>
  );
}
