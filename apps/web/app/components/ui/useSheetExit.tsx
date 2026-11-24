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

/** Each open sheet's "would this lose changes?": a path change takes the sheets under the top one too. */
const sheetChanges = new Map<string, () => boolean>();
const changedUnder = (id: string) =>
  openSheets.some((sheet) => sheet !== id && sheetChanges.get(sheet)?.() === true);

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
  hasChanges,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelRef: RefObject<HTMLElement | null>;
  /** Asked before a dismissal or a held navigation: true opens "Discard changes?". */
  hasChanges?: () => boolean;
}) {
  const id = useId();
  const [phase, setPhaseState] = useState<Phase>("open");
  const phaseRef = useRef<Phase>("open");
  const discarded = useRef(false);
  const setPhase = useCallback((next: Phase) => {
    if (next === "open") discarded.current = false;
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const held = useRef<Blocker | null>(null);
  const latest = useRef({ isOpen, onOpenChange, hasChanges });
  useEffect(() => {
    latest.current = { isOpen, onOpenChange, hasChanges };
  });
  const [asking, setAskingState] = useState(false);
  const askingRef = useRef(false);
  const setAsking = useCallback((next: boolean) => {
    askingRef.current = next;
    setAskingState(next);
  }, []);
  const wouldAsk = useCallback(() => !discarded.current && (latest.current.hasChanges?.() ?? false), []);
  const leavingLoses = useCallback(
    () => wouldAsk() || (!discarded.current && changedUnder(id)),
    [wouldAsk, id],
  );

  useEffect(() => {
    if (!isOpen) return;
    sheetChanges.set(id, wouldAsk);
    setOpenSheets([...openSheets, id]);
    return () => {
      sheetChanges.delete(id);
      setOpenSheets(openSheets.filter((sheet) => sheet !== id));
    };
  }, [isOpen, id, wouldAsk]);

  // Opened again after an exit.
  useEffect(() => {
    if (isOpen && phaseRef.current === "gone") setPhase("open");
    // Closed with no exit (reduced motion), so the phase never left "open".
    if (!isOpen) discarded.current = false;
    if (!isOpen && askingRef.current) setAsking(false);
  }, [isOpen, setPhase, setAsking]);

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
      if (open) return latest.current.onOpenChange(open);
      if (phaseRef.current === "open" && wouldAsk()) return setAsking(true);
      if (!animates()) return latest.current.onOpenChange(open);
      if (phaseRef.current === "open") setPhase("exiting");
    },
    [setPhase, setAsking, wouldAsk],
  );
  const shouldHold = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      phaseRef.current !== "gone" &&
      currentLocation.pathname !== nextLocation.pathname &&
      (animates() || leavingLoses()),
    [leavingLoses],
  );
  const onHeld = useCallback(
    (blocker: Blocker) => {
      held.current = blocker;
      if (askingRef.current) {
        if (leavingLoses()) return;
        // What it asked about is gone (the record was deleted elsewhere).
        setAsking(false);
      }
      if (phaseRef.current === "open" && leavingLoses()) return setAsking(true);
      if (!animates()) {
        held.current = null;
        if (blocker.state === "blocked") blocker.proceed();
        return;
      }
      if (phaseRef.current === "open") setPhase("exiting");
    },
    [setPhase, setAsking, leavingLoses],
  );

  // "Keep editing": the sheet stays and a held navigation is called off.
  const keepEditing = useCallback(() => {
    if (!askingRef.current) return;
    setAsking(false);
    const blocker = held.current;
    held.current = null;
    if (blocker?.state === "blocked") blocker.reset();
  }, [setAsking]);

  // "Discard": the close that was asked about goes ahead, with its exit.
  const discard = useCallback(() => {
    setAsking(false);
    discarded.current = true;
    if (animates()) return setPhase("exiting");
    const blocker = held.current;
    held.current = null;
    if (blocker?.state === "blocked") blocker.proceed();
    else latest.current.onOpenChange(false);
  }, [setAsking, setPhase]);

  // Whatever removed the hold (the caller closing the sheet) took the exit with it.
  const onReleased = useCallback(() => {
    held.current = null;
    if (askingRef.current) setAsking(false);
  }, [setAsking]);

  const inDataRouter = useContext(UNSAFE_DataRouterContext) !== null;
  const isTopmost = useSyncExternalStore(subscribe, topmost, noSheet) === id;
  return {
    closing: phase !== "open",
    dismiss,
    asking,
    keepEditing,
    discard,
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
