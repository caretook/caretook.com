import type { LocalProvider } from "~/lib/providers/providers.sync";

import { chipLabel } from "~/lib/providers/entryProviders";
import { shownPlace } from "~/lib/appointments/entryPlace";
import { scheduleText } from "~/lib/appointments/entrySchedule";

/**
 * A note or event on paper: its title, when, where (events), who it was
 * with, and its text. Hidden on screen; in print it's all that shows (the
 * page's controls are `print:hidden`, and so are the app header and tab
 * bar), on the shared print styles.
 */
export function EntryPrintView({
  heading,
  kindLabel,
  entry,
  providers,
  text,
}: {
  heading: string;
  kindLabel: string;
  entry: {
    kind: string;
    occurredAt: string;
    endsAt: string | null;
    allDay: boolean;
    timeZone: string;
    place: string | null;
  };
  providers: LocalProvider[];
  text: string;
}) {
  const place = entry.kind === "event" ? shownPlace(entry.place, providers) : null;
  const when = scheduleText({ id: "", ...entry }, new Date());
  return (
    <article className="hidden space-y-3 print:block" data-print-entry="">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold" data-print="title">
          {heading}
        </h2>
        <p data-print="time">
          {kindLabel} · {when}
        </p>
        {place && (
          <p data-print="place">
            Place: {place.text}
            {place.from && ` (from ${place.from})`}
          </p>
        )}
        {providers.length > 0 && <p data-print="with">With: {providers.map(chipLabel).join(", ")}</p>}
      </header>
      <PrintText text={text} />
    </article>
  );
}

/** The document's text: a paragraph per line, runs of "• " lines as a list. */
function PrintText({ text }: { text: string }) {
  const blocks: { key: number; para?: string; bullets?: string[] }[] = [];
  for (const [i, line] of text.split("\n").entries()) {
    const last = blocks.at(-1);
    if (line.startsWith("• ")) {
      if (last?.bullets) last.bullets.push(line.slice(2));
      else blocks.push({ key: i, bullets: [line.slice(2)] });
    } else if (line.startsWith("  ") && last?.bullets) {
      last.bullets[last.bullets.length - 1] += `\n${line.trim()}`;
    } else blocks.push({ key: i, para: line });
  }
  return (
    <div className="space-y-2 whitespace-pre-wrap" data-print="text">
      {blocks.map((b) =>
        b.bullets ? (
          <ul key={b.key} className="list-disc ps-6">
            {b.bullets.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={b.key} className="min-h-[1em]">
            {b.para}
          </p>
        ),
      )}
    </div>
  );
}
