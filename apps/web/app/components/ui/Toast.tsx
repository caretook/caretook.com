import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "./Button";

/**
 * A short message with one action, fixed at the bottom of the screen above the
 * tab bar (`--tab-bar-height`; from `sm` there's no bar). It's a live status,
 * so screen readers announce it when it appears. The update notice and the
 * timeline's added-medication notice use it.
 *
 * `open` shows it; turning it false fades it out (`--motion`) and then
 * unmounts it, at once under "reduce motion". While it fades it is inert, so
 * its action can't run again. Callers keep passing the same message until it
 * has gone.
 */
export function Toast({
  open,
  message,
  actionLabel,
  onAction,
  busy = false,
}: {
  open: boolean;
  message: string;
  actionLabel: string;
  onAction: () => void;
  /** The action has started: its button is disabled. */
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const exiting = mounted && !open;

  // Unmount once the exit's animations have finished (none under reduced motion).
  useLayoutEffect(() => {
    if (!exiting) return;
    const animations = ref.current?.getAnimations?.() ?? [];
    if (animations.length === 0) {
      setMounted(false);
      return;
    }
    let live = true;
    void Promise.all(animations.map((a) => a.finished))
      .catch(() => undefined)
      .then(() => live && setMounted(false));
    return () => {
      live = false;
    };
  }, [exiting]);

  if (!mounted) return null;
  return (
    <div
      ref={ref}
      data-toast=""
      data-exiting={exiting || undefined}
      inert={exiting}
      className="toast toast-center z-40 mb-(--tab-bar-height) sm:mb-0 print:hidden"
    >
      <div role="status" className="alert border-base-300 bg-base-100 text-base-content shadow-lg">
        <span>{message}</span>
        <Button variant="primary" size="sm" onClick={onAction} disabled={busy}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
