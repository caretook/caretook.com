import type { PrintSheet } from "./printSheet";
import type { ReactNode } from "react";

import { RECENTLY_STOPPED_DAYS } from "./printSheet";

// The sheet itself: a header that says whose list it is and when it was
// printed, then three tables. Fixed column widths, so the tables fit the
// page at any width (420 included) and long names wrap instead of widening
// it; rows never split across printed pages (app.css).

const TABLE = "w-full table-fixed border-collapse text-left text-xs sm:text-sm";
const TH =
  "border-base-300 border-b-2 px-1.5 py-1.5 align-bottom font-semibold wrap-break-word hyphens-auto sm:px-2";
const TD = "border-base-300 border-b px-1.5 py-1.5 align-top wrap-break-word sm:px-2";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-1.5" data-print-section={id}>
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-base-content/70 text-sm">{children}</p>
);

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-base-content/70 block">{children}</span>
);

/** `allergies` is the allergies and conditions blocks, shown first under the header. */
export function MedicationSheet({ sheet, allergies }: { sheet: PrintSheet; allergies?: ReactNode }) {
  return (
    <article
      className="rounded-box border-base-300 bg-base-100 space-y-5 border p-4 sm:p-6 print:rounded-none print:border-0 print:p-0"
      aria-labelledby="print-title"
      data-print-sheet
    >
      <header className="space-y-2">
        <h1 id="print-title" className="text-xl font-semibold">
          Medication list
        </h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="font-semibold">Name</dt>
          <dd data-print-field="name">{sheet.recipient.name || "Not recorded"}</dd>
          <dt className="font-semibold">Date of birth</dt>
          <dd data-print-field="dateOfBirth">{sheet.recipient.dateOfBirth ?? "Not recorded"}</dd>
          <dt className="font-semibold">Care group</dt>
          <dd data-print-field="group">{sheet.groupName}</dd>
          <dt className="font-semibold">Printed</dt>
          <dd data-print-field="printed">{sheet.printedOn}</dd>
        </dl>
      </header>

      {allergies}

      <Section id="print-current" title="Current medications">
        {sheet.current.length === 0 ? (
          <Empty>No current medications.</Empty>
        ) : (
          sheet.currentGroups.map((group) => (
            <div key={group.type ?? "none"} className="space-y-1" data-print-group={group.type ?? "none"}>
              <h3 className="text-sm font-semibold">{group.heading}</h3>
              <table className={TABLE}>
                <colgroup>
                  <col className="w-[27%]" />
                  <col className="w-[31%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className={TH}>
                      Medication
                    </th>
                    <th scope="col" className={TH}>
                      How it's taken
                    </th>
                    <th scope="col" className={TH}>
                      For
                    </th>
                    <th scope="col" className={TH}>
                      Prescriber
                    </th>
                    <th scope="col" className={TH}>
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((m) => (
                    <tr key={m.id} data-print-medication={m.id}>
                      <th scope="row" className={`${TD} font-semibold`} data-print-title>
                        {m.title}
                        {m.form && <Muted>{m.form}</Muted>}
                      </th>
                      <td className={TD}>
                        {[m.dose, m.schedule].filter(Boolean).join(" · ")}
                        {m.directions && <Muted>{m.directions}</Muted>}
                      </td>
                      <td className={TD}>{m.reason}</td>
                      <td className={TD} data-print-prescriber>
                        {m.prescriber}
                      </td>
                      <td className={TD}>{m.started}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </Section>

      <Section id="print-stopped" title={`Stopped in the last ${RECENTLY_STOPPED_DAYS} days`}>
        {sheet.stopped.length === 0 ? (
          <Empty>None stopped in the last {RECENTLY_STOPPED_DAYS} days.</Empty>
        ) : (
          <table className={TABLE}>
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[22%]" />
              <col className="w-[44%]" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  Medication
                </th>
                <th scope="col" className={TH}>
                  Stopped
                </th>
                <th scope="col" className={TH}>
                  Why
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.stopped.map((m) => (
                <tr key={m.id} data-print-stopped={m.id}>
                  <th scope="row" className={`${TD} font-semibold`} data-print-title>
                    {m.title}
                  </th>
                  <td className={TD} data-print-when>
                    {m.statusLabel} {m.stopped}
                  </td>
                  <td className={TD} data-print-why>
                    {m.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section id="print-contacts" title="Prescribers and pharmacies">
        {sheet.contacts.length === 0 ? (
          <Empty>No prescriber or pharmacy recorded.</Empty>
        ) : (
          <table className={TABLE}>
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[25%]" />
              <col className="w-[35%]" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  Name
                </th>
                <th scope="col" className={TH}>
                  Role
                </th>
                <th scope="col" className={TH}>
                  Phone
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.contacts.map((c) => (
                <tr key={c.id} data-print-contact={c.id}>
                  <th scope="row" className={`${TD} font-semibold`} data-print-title>
                    {c.name}
                  </th>
                  <td className={TD}>{c.role}</td>
                  <td className={TD} data-print-phone>
                    {c.phone ? (
                      <>
                        {c.phone.number}
                        {c.phone.label && <Muted>{c.phone.label}</Muted>}
                      </>
                    ) : (
                      "Not recorded"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </article>
  );
}
