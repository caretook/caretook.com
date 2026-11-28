import type { CaringFor, WaitlistSource } from "@caretook/data/domain";
import { CARING_FOR_LABELS } from "@caretook/data/domain";

// The waitlist's rows: what each visitor typed, and when they joined.

type Entry = {
  id: string;
  email: string;
  firstName: string | null;
  caringFor: CaringFor | null;
  heardFrom: string | null;
  source: WaitlistSource | null;
  createdAt: string;
};

const joined = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) +
  " UTC";

/** The page, then any UTM values, as one line. */
const sourceText = (source: WaitlistSource | null) =>
  source
    ? [source.page, source.utmSource, source.utmMedium, source.utmCampaign, source.utmTerm, source.utmContent]
        .filter(Boolean)
        .join(" · ")
    : "";

export function WaitlistTable({ entries }: { entries: readonly Entry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table" data-waitlist="">
        <thead>
          <tr>
            <th>Joined</th>
            <th>Email</th>
            <th>First name</th>
            <th>Cares for</th>
            <th>How they heard</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} data-entry={e.email}>
              <td className="whitespace-nowrap">{joined(e.createdAt)}</td>
              <td className="break-all">{e.email}</td>
              <td>{e.firstName}</td>
              <td>{e.caringFor ? CARING_FOR_LABELS[e.caringFor] : ""}</td>
              <td className="whitespace-pre-line">{e.heardFrom}</td>
              <td>{sourceText(e.source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
