import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { loadTodo } from "./loadTodo";

import { CalendarClock, Pill } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { ContactActions, ProviderTypeIcon } from "~/components/providers";
import { Badge, Section, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { quickActions } from "~/lib/providers/contactActions";
import { formatDate, medicationTitle } from "~/lib/medications/medicationDisplay";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { useLiveQuery } from "~/lib/sync";
import { medicationQuery, toMedication } from "~/lib/medications/medications.sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";
import { linkedEventsQuery } from "~/lib/todos/todos.sync";
import { toTimelineEntries } from "~/lib/timeline/timeline.sync";
import { linkLabel } from "~/lib/todos/todoDisplay";
import { cancelledLabel, timeRange, upcomingTitle } from "~/lib/appointments/upcomingLabels";

type Loaded = Awaited<ReturnType<typeof loadTodo>>["linkRows"];

const NO_ROWS: never[] = [];

/** The loader's rows when they're for this id (stable), else none. */
const rowsFor = <R extends { id: string }>(rows: R[], id: string | null): R[] =>
  id && rows[0]?.id === id ? rows : NO_ROWS;

const ROW = "hover:bg-base-200/50 relative isolate flex items-center gap-3 px-3 py-2.5";
const STRETCHED =
  "block truncate font-medium outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2";

function IconDot({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-full"
    >
      {children}
    </span>
  );
}

/** The provider: its name linking to its page, and its quick contact actions; greyed "(removed)" once deleted. */
function ProviderLink({
  groupId,
  id,
  loaded,
  linked,
}: {
  groupId: string;
  id: string;
  loaded: ProviderRow[];
  linked: boolean;
}) {
  const q = providerQuery(id);
  const rows = useLiveQuery<ProviderRow>(q.sql, q.params, loaded);
  const provider = rows[0] ? toProvider(rows[0]) : null;
  if (!provider || provider.groupId !== groupId) return null;
  const removed = !!provider.deletedAt;
  return (
    <li className={ROW} data-todo-link="provider">
      <ProviderTypeIcon type={provider.type} past={removed || provider.status === "past"} />
      <div className="min-w-0 flex-1">
        <p className="text-muted text-sm">Provider</p>
        {removed ? (
          <p className="text-faint truncate" data-todo-link-name>
            {linkLabel(provider.name, true)}
          </p>
        ) : !linked ? (
          <p className="truncate font-medium" data-todo-link-name>
            {provider.name}
          </p>
        ) : (
          <Link to={appUrls.provider(groupId, provider.id)} className={STRETCHED} data-todo-link-name>
            {provider.name}
          </Link>
        )}
      </div>
      {!removed && <ContactActions actions={quickActions(provider)} />}
    </li>
  );
}

type LinkedEvent = ReturnType<typeof toTimelineEntries>[number];

/**
 * An appointment: its title linking to its page, and when it is; struck
 * through and labelled when cancelled. A deleted one isn't shown (the
 * query reads live events only).
 */
function EventLink({ groupId, event }: { groupId: string; event: LinkedEvent }) {
  const cancelled = cancelledLabel(event);
  // Its day where it happens (an all-day one's own zone), with the time.
  const zone = event.allDay ? event.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(new Date(event.occurredAt));
  return (
    <li className={ROW} data-todo-link="event" data-cancelled={cancelled ? "" : undefined}>
      <IconDot>
        <CalendarClock className="size-4" />
      </IconDot>
      <div className="min-w-0 flex-1">
        <p className="text-muted text-sm">Event</p>
        <Link
          to={appUrls.entry(groupId, event.id)}
          className={`${STRETCHED} ${cancelled ? "text-faint line-through" : ""}`}
          data-todo-link-name
        >
          {upcomingTitle(event)}
        </Link>
        <p className="text-muted text-sm" data-todo-link-when>
          <span className={cancelled ? "line-through" : ""}>{`${day} · ${timeRange(event)}`}</span>
          {cancelled && (
            <Badge tone={STATUS_TONE.past} className="ms-2 no-underline">
              {cancelled}
            </Badge>
          )}
        </p>
      </div>
    </li>
  );
}

/** The medication: its name linking to its page; greyed "(removed)" once deleted. */
function MedicationLink({
  groupId,
  id,
  loaded,
  linked,
}: {
  groupId: string;
  id: string;
  loaded: MedicationRow[];
  linked: boolean;
}) {
  const q = medicationQuery(id);
  const rows = useLiveQuery<MedicationRow>(q.sql, q.params, loaded);
  const medication = rows[0] ? toMedication(rows[0]) : null;
  const linkState = useMedicationLinkState();
  if (!medication || medication.groupId !== groupId) return null;
  const removed = !!medication.deletedAt;
  const title = medicationTitle(medication);
  return (
    <li className={ROW} data-todo-link="medication">
      <IconDot>
        <Pill className="size-4" />
      </IconDot>
      <div className="min-w-0 flex-1">
        <p className="text-muted text-sm">Medication</p>
        {removed ? (
          <p className="text-faint truncate" data-todo-link-name>
            {linkLabel(title, true)}
          </p>
        ) : !linked ? (
          <p className="font-medium break-words" data-todo-link-name>
            {title}
          </p>
        ) : (
          <Link
            to={appUrls.medication(groupId, medication.id)}
            state={linkState}
            className={STRETCHED}
            data-todo-link-name
          >
            {title}
          </Link>
        )}
        {medication.status !== "current" && medication.stoppedOn && !removed && (
          <p className="text-muted text-sm">Stopped {formatDate(medication.stoppedOn)}</p>
        )}
      </div>
    </li>
  );
}

/**
 * What the todo is about: its provider (with call and map actions), its
 * appointment and its medication, each opening its page (the provider and
 * medication as plain names without `linkPages`: the easy roles can't
 * open their pages). Nothing when it has no links. Live: a provider deleted or an appointment cancelled on
 * another device shows at once.
 */
export function TodoLinks({
  groupId,
  todo,
  loaded,
  linkPages = true,
}: {
  groupId: string;
  todo: Pick<LocalTodo, "id" | "providerId" | "medicationId">;
  /** The loader's rows for the links (stable). */
  loaded: Loaded;
  /** Whether the provider and medication link to their pages. */
  linkPages?: boolean;
}) {
  const { providerId, medicationId } = todo;
  const initial = useMemo(
    () => ({
      provider: rowsFor(loaded.provider, providerId),
      medication: rowsFor(loaded.medication, medicationId),
    }),
    [loaded, providerId, medicationId],
  );
  // Its events are link rows: one live query for them all.
  const eq = linkedEventsQuery(todo.id);
  const eventRows = useLiveQuery<EntryRow>(eq.sql, eq.params, loaded.event);
  const events = useMemo(
    () => toTimelineEntries(eventRows).filter((e) => e.groupId === groupId),
    [eventRows, groupId],
  );
  if (!providerId && !events.length && !medicationId) return null;
  return (
    <Section title="Linked to" id="links" data-todo-links="">
      <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border">
        {providerId && (
          <ProviderLink
            key={providerId}
            groupId={groupId}
            id={providerId}
            loaded={initial.provider}
            linked={linkPages}
          />
        )}
        {events.map((event) => (
          <EventLink key={event.id} groupId={groupId} event={event} />
        ))}
        {medicationId && (
          <MedicationLink
            key={medicationId}
            groupId={groupId}
            id={medicationId}
            loaded={initial.medication}
            linked={linkPages}
          />
        )}
      </ul>
    </Section>
  );
}
