import type { DeviceRoute } from "./device";

import { useState } from "react";
import { useLocation } from "react-router";
import { Button, ConfirmDialog, Menu, Page, PageHeader, Sheet } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";

// The probe: a minimal screen inside the /app frame, for the tests of the
// frame, the test device and the primitives that aren't about any one screen
// (a timeline change shouldn't break them). Mounted at any group path, so the
// frame's section links, tab bar and group menu answer for that URL:
//
//   await renderWithDevice({ route: PROBE, url: `/app/groups/${TEST_GROUP.id}/timeline`, frame: true });
//
// What it shows: an `h1` naming where it is, the group as `useGroup()` reads
// it, a live list of the group's entries (`main ol > li`: a note's text, an
// event's title or a symptom's name, then who logged it), a writer-only Add,
// an Actions `Menu`, a `Sheet` and a `ConfirmDialog`, and an end line.

type ProbeRow = { id: string; kind: string; label: string; author: string | null };

const ROWS_SQL = `
  SELECT e.id, e.kind, u.name AS author,
    coalesce(d.text, e.title, json_extract(e.details, '$.name'), e.kind) AS label
  FROM timeline_entry e
  LEFT JOIN note_document d ON d.id = e.id
  LEFT JOIN "user" u ON u.id = e.created_by
  WHERE e.group_id = ? AND e.deleted_at IS NULL
  ORDER BY e.occurred_at DESC`;
/** One empty list for every render: `useLiveQuery` resets on a new `initial`. */
const NONE: ProbeRow[] = [];

function Probe() {
  const { pathname } = useLocation();
  const group = useGroup();
  const rows = useLiveQuery<ProbeRow>(ROWS_SQL, [group.id], NONE);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <Page>
      <PageHeader
        title="Probe"
        actions={
          <>
            {group.canWrite && <Button>Add</Button>}
            <Menu
              label="Probe actions"
              variant="ghost"
              items={[
                { id: "sheet", label: "Open the sheet", onAction: () => setSheet(true) },
                { id: "confirm", label: "Delete", tone: "danger", onAction: () => setConfirm(true) },
              ]}
            >
              ⋯
            </Menu>
          </>
        }
      />
      <p data-probe-path>{pathname}</p>
      <p data-probe-group>
        {group.displayName} · {group.role} · {group.canWrite ? "writer" : "reader"}
      </p>
      <ol>
        {rows.map((r) => (
          <li key={r.id} data-kind={r.kind}>
            <span>{r.label}</span>
            {r.author && <span> · by {r.author}</span>}
          </li>
        ))}
      </ol>
      <p role="status" data-probe-end>
        End of the probe
      </p>
      <Sheet isOpen={sheet} onOpenChange={setSheet} title="Probe sheet">
        <form onSubmit={(e) => e.preventDefault()}>
          <Button type="submit">Save</Button>
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="Delete the probe?"
        confirmLabel="Delete"
        onConfirm={() => setConfirm(false)}
        onClose={() => setConfirm(false)}
      />
    </Page>
  );
}

/** The probe at every group path (`/app/groups/:groupId/*`). */
export const PROBE: DeviceRoute = { path: "/app/groups/:groupId/*", id: "probe", module: { default: Probe } };
