import type { ComponentType } from "react";

import { memo, useEffect, useState, useSyncExternalStore } from "react";
import { queue } from "./toastQueue";

/** The region's module (ToastView.tsx): React Aria's toast parts, off the first load. */
const loadView = () => import("./ToastView").then((m) => m.ToastRegionView);

/**
 * Where every toast shows (`toast()`, `toastQueue.ts`): mount it once, in the
 * /app layout (and the gallery). It renders nothing until the first toast,
 * like React Aria's own region, and loads that region (ToastView.tsx) on the
 * first toast or once the browser is idle, whichever comes first, so React
 * Aria's toast parts stay out of the /app layout's first load (the bundle
 * budget). The queue is plain module state, so a toast added before then
 * waits and shows as soon as the region is in.
 */
export const ToastRegion = memo(function ToastRegion() {
  const [View, setView] = useState<ComponentType | null>(null);
  const queued = useSyncExternalStore(
    (listener) => queue.subscribe(listener),
    () => queue.visibleToasts.length > 0,
    () => false,
  );

  useEffect(() => {
    if (View) return;
    let live = true;
    const load = () => void loadView().then((view) => live && setView(() => view));
    if (queued) {
      load();
      return () => void (live = false);
    }
    // Safari has no requestIdleCallback: a short wait instead.
    const idle = "requestIdleCallback" in window;
    const handle = idle ? window.requestIdleCallback(load, { timeout: 5_000 }) : window.setTimeout(load, 2_000);
    return () => {
      live = false;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [View, queued]);

  return View ? <View /> : null;
});
