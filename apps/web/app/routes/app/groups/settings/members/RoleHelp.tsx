import { GROUP_ROLES } from "@caretook/data/permissions";
import { useId, useRef, useState } from "react";
import { Button, LINK, TITLE_SUB, useShowModal } from "~/components/ui";
import { ROLE_GROUP_LABELS } from "../groupSettings";

/**
 * "What can each role do?": a link beside a role picker's label that opens
 * a native modal <dialog> listing every role (`GROUP_ROLES`), grouped as the
 * picker groups them, with what each can see and change. It lists them all
 * for understanding; the picker still offers only the roles you may give.
 * Inside a sheet it stacks above it (the top layer); Escape closes only the
 * dialog, and closing puts focus back on the link (the browser does).
 */
export function RoleHelp({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useShowModal(ref, open);

  return (
    <>
      <button
        type="button"
        className={`${LINK} text-sm ${className}`}
        aria-haspopup="dialog"
        data-role-help=""
        onClick={() => setOpen(true)}
      >
        What can each role do?
      </button>
      <dialog
        ref={ref}
        className="modal"
        aria-labelledby={titleId}
        data-role-guide=""
        onClose={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      >
        <div className="modal-box">
          <h2 id={titleId} className="text-lg font-semibold">
            What can each role do?
          </h2>
          {(["regular", "easier"] as const).map((group) => (
            <section key={group} className="mt-4" data-role-guide-group={group}>
              <h3 className={TITLE_SUB}>{ROLE_GROUP_LABELS[group]}</h3>
              <dl className="mt-2 space-y-3">
                {GROUP_ROLES.filter((role) => role.group === group).map((role) => (
                  <div key={role.name} data-role-guide-role={role.name}>
                    <dt className="font-semibold">{role.label}</dt>
                    <dd className="space-y-1 text-sm">
                      <p>{role.description}</p>
                      <p>
                        <span className="font-medium">Sees: </span>
                        {role.sees}
                      </p>
                      <p>
                        <span className="font-medium">Changes: </span>
                        {role.changes}
                      </p>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <div className="modal-action">
            {/* Closing the <dialog> runs onClose, as Escape does. */}
            <Button onClick={() => ref.current?.close()}>Done</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
