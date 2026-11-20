/**
 * A short message with one action, fixed at the bottom of the screen above the
 * tab bar (`--tab-bar-height`; from `sm` there's no bar). It's a live status,
 * so screen readers announce it when it appears. The update notice uses it.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  busy = false,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  /** The action has started: its button is disabled. */
  busy?: boolean;
}) {
  return (
    <div className="toast toast-center z-40 mb-(--tab-bar-height) sm:mb-0 print:hidden">
      <div role="status" className="alert border-base-300 bg-base-100 text-base-content shadow-lg">
        <span>{message}</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={onAction} disabled={busy}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
