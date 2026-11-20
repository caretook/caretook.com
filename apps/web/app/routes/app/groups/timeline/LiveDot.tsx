/**
 * A small pulsing marker on a timeline row or card whose document other
 * members are writing in now. It's not interactive: it lets taps through to
 * the row's open target. Static under `prefers-reduced-motion`, and named
 * for screen readers by its sr-only `label` ("Being written now by Maria"),
 * or hidden from them without one.
 */
export function LiveDot({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span
      data-live-dot=""
      aria-hidden={label ? undefined : true}
      className={`pointer-events-none relative inline-flex size-2.5 shrink-0 ${className}`}
    >
      <span
        aria-hidden="true"
        className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:hidden"
      />
      <span aria-hidden="true" className="bg-primary relative inline-flex size-2.5 rounded-full" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
