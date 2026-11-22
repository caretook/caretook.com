/**
 * A placeholder shaped like the content still coming (`lines` grey bars, the
 * last one shorter), so the page doesn't jump. Hidden from assistive tech:
 * pair it with a `Loading` (or pass `Loading` its `lines`) to say what's coming.
 */
export function Skeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" data-skeleton="" className={`space-y-2 ${className}`.trim()}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`skeleton h-4 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/**
 * Something is loading: a status named by `label` ("Loading…", "Getting your
 * care groups…"). By default a small spinner and the label; with `lines`, a
 * `Skeleton` of that many lines stands in and the label is for screen readers.
 */
export function Loading({
  label,
  lines,
  className = "",
  ...data
}: {
  label: string;
  lines?: number;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  if (lines)
    return (
      <div {...data} role="status" aria-label={label} className={className || undefined}>
        <span className="sr-only">{label}</span>
        <Skeleton lines={lines} />
      </div>
    );
  return (
    <p
      {...data}
      role="status"
      aria-label={label}
      className={`text-base-content/70 flex items-center gap-2 text-sm ${className}`.trim()}
    >
      <span className="loading loading-spinner loading-sm" aria-hidden="true" />
      {label}
    </p>
  );
}
