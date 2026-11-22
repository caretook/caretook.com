import type { RefObject } from "react";
import type { Blocker, BlockerFunction } from "react-router";

import { useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { UNSAFE_DataRouterContext, UNSAFE_DataRouterNavigationContext, useBlocker } from "react-router";

// A sheet's exit, owned here so none of its callers change. A dismissal
// (Close, Escape, a tap outside) plays the exit and then tells the caller; a
// navigation that changes the path is held for the exit and then let go.
// Under "reduce motion" nothing is held. The router takes one blocker at a
// time and sheets stack, so only the topmost open sheet holds.

/** `open`, the exit playing, or played and waiting for the caller or router to remove it. */
type Phase = "open" | "exiting" | "gone";

/** A sheet still here this long after its exit, with no navigation under way, comes back. */
const STILL_HERE_MS = 300;

let openSheets: readonly string[] = [];
const listeners = new Set<() => void>();
const setOpenSheets = (next: readonly string[]) => {
  openSheets = next;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const topmost = () => openSheets.at(-1) ?? null;
const noSheet = () => null;

const animates = () => window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

/** The longest transition computed on the panel, in ms. */
function exitMs(panel: Element | null) {
  if (!panel) return 0;
  const durations = getComputedStyle(panel)
    .transitionDuration.split(",")
    .map((s) => parseFloat(s) * 1000);
  return Math.max(0, ...durations);
}

/** While the exit plays, a key or a submit in the sheet can't start anything (a save runs once). */
function useInertWhileClosing(panelRef: RefObject<HTMLElement | null>, closing: boolean) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!closing || !panel) return;
    const swallow = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
    };
    panel.addEventListener("keydown", swallow, true);
    panel.addEventListener("submit", swallow, true);
    return () => {
      panel.removeEventListener("keydown", swallow, true);
      panel.removeEventListener("submit", swallow, true);
    };
  }, [panelRef, closing]);
}

export function useSheetExit({
  isOpen,
  onOpenChange,
  panelRef,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const id = useId();
  const [phase, setPhaseState] = useState<Phase>("open");
  const phaseRef = useRef<Phase>("open");
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const held = useRef<Blocker | null>(null);
  const latest = useRef({ isOpen, onOpenChange });
  useEffect(() => {
    latest.current = { isOpen, onOpenChange };
  });

  useEffect(() => {
    if (!isOpen) return;
    setOpenSheets([...openSheets, id]);
    return () => setOpenSheets(openSheets.filter((sheet) => sheet !== id));
  }, [isOpen, id]);

  // Opened again after an exit.
  useEffect(() => {
    if (isOpen && phaseRef.current === "gone") setPhase("open");
  }, [isOpen, setPhase]);

  // The exit's end: the latest held navigation goes, else the caller hears.
  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = setTimeout(() => {
      setPhase("gone");
      const blocker = held.current;
      held.current = null;
      if (blocker?.state === "blocked") blocker.proceed();
      else if (latest.current.isOpen) latest.current.onOpenChange(false);
    }, exitMs(panelRef.current));
    return () => clearTimeout(timer);
  }, [phase, panelRef, setPhase]);

  // A caller that kept the sheet open, or a navigation that left it mounted.
  const navigation = useContext(UNSAFE_DataRouterNavigationContext)?.navigation?.state ?? "idle";
  useEffect(() => {
    if (phase !== "gone" || !isOpen || navigation !== "idle") return;
    const timer = setTimeout(() => setPhase("open"), STILL_HERE_MS);
    return () => clearTimeout(timer);
  }, [phase, isOpen, navigation, setPhase]);

  useInertWhileClosing(panelRef, phase !== "open");

  const dismiss = useCallback(
    (open: boolean) => {
      if (open || !animates()) return latest.current.onOpenChange(open);
      if (phaseRef.current === "open") setPhase("exiting");
    },
    [setPhase],
  );
  const shouldHold = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      phaseRef.current !== "gone" && currentLocation.pathname !== nextLocation.pathname && animates(),
    [],
  );
  const onHeld = useCallback(
    (blocker: Blocker) => {
      held.current = blocker;
      if (phaseRef.current === "open") setPhase("exiting");
    },
    [setPhase],
  );

  // Whatever removed the hold (the caller closing the sheet) took the exit with it.
  const onReleased = useCallback(() => {
    held.current = null;
  }, []);

  const inDataRouter = useContext(UNSAFE_DataRouterContext) !== null;
  const isTopmost = useSyncExternalStore(subscribe, topmost, noSheet) === id;
  return {
    closing: phase !== "open",
    dismiss,
    hold: inDataRouter && isOpen && isTopmost ? { shouldHold, onHeld, onReleased } : null,
  };
}

/** Rendered only by the topmost open sheet: the router's one blocker. */
export function NavigationHold({
  shouldHold,
  onHeld,
  onReleased,
}: {
  shouldHold: BlockerFunction;
  onHeld: (blocker: Blocker) => void;
  onReleased: () => void;
}) {
  // A caller may navigate and close in one go: unmounting would drop the held
  // navigation, so it goes now. Declared before `useBlocker`, whose cleanup
  // unregisters the blocker, and read from the router, as this render may
  // never have seen it blocked.
  const router = useContext(UNSAFE_DataRouterContext)?.router;
  useEffect(
    () => () => {
      onReleased();
      for (const held of router?.state.blockers.values() ?? []) {
        if (held.state === "blocked") held.proceed();
      }
    },
    [router, onReleased],
  );
  const blocker = useBlocker(shouldHold);
  useEffect(() => {
    if (blocker.state === "blocked") onHeld(blocker);
  }, [blocker, onHeld]);
  return null;
}
