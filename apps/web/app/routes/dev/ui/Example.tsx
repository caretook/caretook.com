import type { ReactNode } from "react";

/** One labelled example in a gallery section: a small heading, then the primitive. */
export function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base-content/70 text-sm font-semibold">{label}</h3>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
