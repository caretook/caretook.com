import { useSyncExternalStore } from "react";

// The app starting (B-957): which step the first load is on, for the loading
// screen's step line and bar (`brand/AppLoading`, root's HydrateFallback, and
// `shell/FirstSyncPending`). Client-only state: the startup code advances it
// (`openSync`, `waitForFirstSync` in ./index) and the screens read it with
// `useStartup`. The server's page (and the native SPA's file) render the
// first step, before any script runs.
//
// It only moves forward: a step already passed, or a smaller download
// fraction, is ignored; a step that isn't needed (a returning device's first
// sync, done long ago) is passed over by advancing straight past it.

/** The steps in order: route chunks, the device's copy, the first sync, the screen. */
export const STARTUP_STEPS = ["app", "device", "sync", "screen"] as const;
export type StartupStep = (typeof STARTUP_STEPS)[number];

export type StartupState = {
  step: StartupStep;
  /** The first sync's download, 0 to 1, when PowerSync knows it (only on the sync step). */
  download: number | null;
};

/** Each step's words: warm and short, nothing technical, nothing about being offline. */
export const STARTUP_WORDS: Record<StartupStep, string> = {
  app: "Opening Caretook…",
  device: "Getting your notes ready…",
  sync: "Syncing your care groups…",
  screen: "Almost there…",
};

/** The bar's name (its `aria-label`). */
export const STARTUP_BAR_LABEL = "Starting Caretook";

/** Where the bar stands when each step starts (of 100); the sync step fills up to the next. */
const BAR_AT: Record<StartupStep, number> = { app: 10, device: 30, sync: 40, screen: 95 };

const INITIAL: StartupState = { step: "app", download: null };

const rank = (step: StartupStep) => STARTUP_STEPS.indexOf(step);

/** A download fraction clamped to 0..1 (null and NaN: unknown). */
const fraction = (download: number | null | undefined) =>
  download == null || Number.isNaN(download) ? null : Math.min(1, Math.max(0, download));

/**
 * The state after asking for `step` (with the download so far): later steps
 * and more download only, so the bar never moves back. Pure, for the tests.
 */
export const advance = (state: StartupState, step: StartupStep, download?: number | null): StartupState => {
  const from = rank(state.step);
  const to = rank(step);
  if (to < from) return state;
  if (to > from) return { step, download: step === "sync" ? fraction(download) : null };
  if (step !== "sync") return state;
  const next = fraction(download);
  if (next === null || (state.download !== null && next <= state.download)) return state;
  return { step, download: next };
};

/** The download as a whole percentage, for the step line ("40%"); null when unknown. */
export const downloadPercent = (state: StartupState): number | null =>
  state.step === "sync" && state.download !== null ? Math.floor(state.download * 100) : null;

/** The bar's value (0..100): each step's start, the sync step moving with its download. */
export const barValue = (state: StartupState): number => {
  if (state.step !== "sync" || state.download === null) return BAR_AT[state.step];
  return Math.round(BAR_AT.sync + state.download * (BAR_AT.screen - BAR_AT.sync));
};

/** What the loading screen shows for a state: the step's words, the percentage, the bar. */
export const startupDisplay = (state: StartupState) => {
  const percent = downloadPercent(state);
  return {
    message: STARTUP_WORDS[state.step],
    detail: percent === null ? undefined : `${percent}%`,
    progress: { value: barValue(state), label: STARTUP_BAR_LABEL },
  };
};

let state = INITIAL;
const listeners = new Set<() => void>();

/** Move the startup on to `step` (never back; see `advance`). */
export const advanceStartup = (step: StartupStep, download?: number | null) => {
  const next = advance(state, step, download);
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
};

/** Back to the first step: a new start (sign-out, and tests). */
export const resetStartup = () => {
  if (state === INITIAL) return;
  state = INITIAL;
  for (const listener of listeners) listener();
};

export const startupState = (): StartupState => state;

/** Hear each change (returns the unsubscribe). */
export const subscribeStartup = (onChange: () => void) => {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
};

/**
 * The startup step for a component, at least `atLeast` (the first-sync
 * screen shows the sync step even if nothing has advanced the store yet).
 * The server's render is the first step.
 */
export const useStartup = (atLeast?: StartupStep): StartupState => {
  const current = useSyncExternalStore(subscribeStartup, startupState, () => INITIAL);
  return atLeast ? advance(current, atLeast) : current;
};
