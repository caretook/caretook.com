/**
 * "via Claude": an entry or todo a member added through their own AI
 * assistant (connectors), named as the assistant registered itself. Nothing
 * when `via` is empty. A small ghost badge, truncated past its width; the
 * name is the client's own, so it says how it got here, not who wrote it
 * (the member did). `className` is for the outer element only.
 */
export function ViaTag({ via, className = "" }: { via: string | null | undefined; className?: string }) {
  if (!via?.trim()) return null;
  return (
    <span
      className={`badge badge-ghost badge-sm inline-block max-w-40 truncate align-middle ${className}`}
      data-via={via}
    >
      via {via}
    </span>
  );
}
