import type { EmergencySection, EmergencySheet as Sheet, SheetPhone } from "./emergencyPrintSheet";
import type { ReactNode } from "react";

// The emergency sheet itself: whose it is and when it was printed, then each
// section with something in it, two to a row where they're short (the
// contacts and medications span the row). Compact type, so the seeded profile
// fits one printed page; long words wrap instead of widening the page. The
// print CSS in app.css makes it black on white.

/** Sections that take the whole row. */
const WIDE = new Set<EmergencySection["id"]>(["emergency", "medications"]);

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-base-content/70">{children}</span>
);

function Phone({ phone }: { phone: SheetPhone }) {
  return (
    <span className="whitespace-nowrap" data-sheet-phone="">
      {phone.number}
      {phone.label && <Muted> ({phone.label})</Muted>}
    </span>
  );
}

const Phones = ({ phones }: { phones: SheetPhone[] }) =>
  phones.length ? (
    <span className="flex flex-wrap gap-x-3">
      {phones.map((p, i) => (
        <Phone key={i} phone={p} />
      ))}
    </span>
  ) : null;

function SectionBody({ section }: { section: EmergencySection }) {
  switch (section.id) {
    case "basics":
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {section.lines.map((line) => (
            <div key={line.id} className="contents" data-sheet-basic={line.id}>
              <dt className="text-base-content/70">{line.label}</dt>
              <dd className="font-semibold">
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
      );
    case "note":
      return <p className="whitespace-pre-line">{section.text}</p>;
    case "contact":
      return (
        <div className="space-y-0.5">
          {section.address && <p className="whitespace-pre-line">{section.address}</p>}
          <Phones phones={section.phones} />
        </div>
      );
    case "insurance":
      return (
        <ul className="space-y-1">
          {section.plans.map((plan) => (
            <li key={plan.id} data-sheet-plan={plan.id}>
              <span className="font-semibold">{plan.title}</span> <Muted>({plan.rank})</Muted>
              <span className="block">
                Member ID {plan.memberId}
                {plan.groupNumber && ` · Group ${plan.groupNumber}`}
                {plan.phone && (
                  <>
                    {" · "}
                    <span className="whitespace-nowrap">{plan.phone}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      );
    case "emergency":
      return (
        <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
          {section.contacts.map((c) => (
            <li
              key={c.key}
              className="flex gap-2"
              data-sheet-contact={c.key}
              data-primary={c.isPrimary ? "" : undefined}
            >
              <span className="w-4 shrink-0 text-right tabular-nums">{c.position}.</span>
              <span className="min-w-0">
                <span className="font-semibold" data-sheet-name="">
                  {c.name}
                </span>
                {c.relationship && <Muted> · {c.relationship}</Muted>}
                {c.isPrimary && (
                  <span
                    className="ml-1.5 rounded border px-1 text-xs font-semibold"
                    data-sheet-badge="primary"
                  >
                    Primary contact
                  </span>
                )}
                <Phones phones={c.phones} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "medications":
      return (
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
          {section.medications.map((m) => (
            <li key={m.id} data-sheet-medication={m.id}>
              <span className="font-semibold" data-sheet-name="">
                {m.title}
              </span>
              <span className="block">{m.howTaken}</span>
              {m.directions && (
                <span className="block">
                  <Muted>{m.directions}</Muted>
                </span>
              )}
            </li>
          ))}
        </ul>
      );
    case "allergies":
      return section.empty ? (
        <p className="font-semibold" data-sheet-allergies-empty="">
          {section.empty}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {section.allergies.map((a) => (
            <li key={a.id} className={a.severe ? "font-semibold" : undefined} data-sheet-allergy="">
              {a.text}
            </li>
          ))}
        </ul>
      );
    case "conditions":
      return section.empty ? (
        <p className="font-semibold" data-sheet-conditions-empty="">
          {section.empty}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {section.conditions.map((c) => (
            <li key={c.id} data-sheet-condition="">
              {c.text}
            </li>
          ))}
        </ul>
      );
    case "careTeam":
      return (
        <ul className="space-y-1">
          {section.providers.map((p) => (
            <li key={p.id} data-sheet-provider={p.id}>
              <span className="font-semibold" data-sheet-name="">
                {p.name}
              </span>
              <Muted> · {p.role}</Muted>
              {p.phone && (
                <span className="block">
                  <Phone phone={p.phone} />
                </span>
              )}
            </li>
          ))}
        </ul>
      );
  }
}

export function EmergencySheet({ sheet }: { sheet: Sheet }) {
  return (
    <article
      className="rounded-box border-base-300 bg-base-100 space-y-4 border p-4 text-sm wrap-break-word sm:p-6 print:space-y-3 print:rounded-none print:border-0 print:p-0 print:text-[10.5pt] print:leading-snug"
      aria-labelledby="sheet-title"
      data-emergency-sheet=""
    >
      <header className="border-base-300 space-y-0.5 border-b-2 pb-2">
        <h1 id="sheet-title" className="text-base font-semibold tracking-wide uppercase">
          Emergency information
        </h1>
        <p className="text-xl font-semibold" data-sheet-field="name">
          {sheet.recipient.name || "Not recorded"}
        </p>
        <p className="flex flex-wrap gap-x-4">
          {(sheet.recipient.born || sheet.recipient.age) && (
            <span data-sheet-field="born">
              {[sheet.recipient.born && `Born ${sheet.recipient.born}`, sheet.recipient.age]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          <span data-sheet-field="printed">Printed {sheet.printedOn}</span>
        </p>
      </header>

      {sheet.sections.length === 0 ? (
        <p className="text-base-content/70">Nothing else is recorded yet.</p>
      ) : (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
          {sheet.sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`sheet-${section.id}`}
              className={`min-w-0 space-y-1 break-inside-avoid ${WIDE.has(section.id) ? "sm:col-span-2 print:col-span-2" : ""}`}
              data-sheet-section={section.id}
            >
              <h2
                id={`sheet-${section.id}`}
                className="border-base-300 border-b text-sm font-semibold tracking-wide uppercase"
              >
                {section.title}
              </h2>
              <SectionBody section={section} />
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
