import type { CSSProperties } from "react";
import type { QueuedToast } from "react-aria-components";
import type { ToastContent } from "./toastQueue";

import { X } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Text,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastList as AriaToastList,
  UNSTABLE_ToastRegion as AriaToastRegion,
} from "react-aria-components";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import {
  dismissToast,
  exitingKey,
  finishExit,
  markShown,
  queue,
  runToastAction,
  subscribeExit,
} from "./toastQueue";

/**
 * The toast region itself, loaded on demand by `ToastRegion` (Toast.tsx) so
 * React Aria's toast parts stay off the /app layout's first load. A fixed `region` landmark ("Notifications")
 * at the bottom, centred, above the tab bar while there is one and above the
 * on-screen keyboard while it's open (app.css, `[data-toast-region]`); hidden
 * in print. Each toast is a React Aria toast: its message an `alert`, never
 * taking focus; hovering or focusing it pauses its time. It fades in and out
 * on `--motion` (at once under "reduce motion"), inert while it fades out.
 * It renders nothing on the server and while no toast is queued.
 */
export const ToastRegionView = memo(function ToastRegionView() {
  const keyboard = useKeyboardInset();
  return (
    <AriaToastRegion
      queue={queue}
      data-toast-region=""
      className="toast toast-center z-40 print:hidden"
      style={{ "--toast-keyboard": `${keyboard}px` } as CSSProperties}
    >
      <AriaToastList<ToastContent> className="contents">
        {({ toast }) => <ToastItem toast={toast} />}
      </AriaToastList>
    </AriaToastRegion>
  );
});

function ToastItem({ toast }: { toast: QueuedToast<ToastContent> }) {
  const ref = useRef<HTMLDivElement>(null);
  const exiting = useSyncExternalStore(subscribeExit, exitingKey, () => null) === toast.key;
  const { message, actions, data } = toast.content;

  useLayoutEffect(() => {
    markShown(toast.key, true);
    return () => {
      markShown(toast.key, false);
      finishExit(toast.key);
    };
  }, [toast.key]);

  // Close for good once the fade out has finished (none under reduced motion).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!exiting || !el) return;
    el.inert = true;
    const animations = el.getAnimations?.() ?? [];
    if (animations.length === 0) {
      finishExit(toast.key);
      return;
    }
    let live = true;
    void Promise.all(animations.map((a) => a.finished))
      .catch(() => undefined)
      .then(() => live && finishExit(toast.key));
    return () => {
      live = false;
    };
  }, [exiting, toast.key]);

  return (
    <AriaToast
      toast={toast}
      ref={ref}
      {...data}
      data-toast=""
      data-exiting={exiting || undefined}
      className="alert border-base-300 bg-base-100 text-base-content flex flex-wrap items-center gap-2 py-2 pr-2 shadow-lg outline-offset-2"
    >
      <AriaToastContent className="min-w-0 grow">
        <Text slot="title">{message}</Text>
      </AriaToastContent>
      {actions.map((action) => (
        <Button key={action.label} variant="primary" size="sm" onClick={() => runToastAction(toast, action)}>
          {action.label}
        </Button>
      ))}
      <IconButton icon={X} label="Dismiss" onPress={() => dismissToast(toast.key)} />
    </AriaToast>
  );
}

/**
 * How far the on-screen keyboard covers the bottom of the layout viewport
 * (iOS and Android browsers overlay it; a web view that resizes for it, such
 * as Capacitor's, gives 0). 0 while zoomed in, where the visual viewport is
 * small for another reason.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(viewport.scale > 1.01 ? 0 : Math.max(0, Math.round(covered)));
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
