/**
 * The theme choice (app-shell slice 2): per device, never sent to the server.
 *
 * Light and Dark set `data-theme` on `<html>`, which daisyUI reads; System
 * removes it, so daisyUI follows `prefers-color-scheme`. `THEME_SCRIPT` runs
 * inline in `<head>` (root.tsx) so the saved choice applies before first paint.
 * Storage can be missing or throw (private modes, blocked site data): every
 * access is wrapped, and the fallback is System.
 */
export const THEME_KEY = "caretook:theme";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** A stored value → a theme; anything unknown (or nothing) is System. */
export function parseTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

/** Applies the theme to `<html>` and saves it; the page still switches if saving fails. */
export function setTheme(theme: Theme) {
  applyTheme(theme);
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** The inline pre-paint script: the same rule as `readTheme` + `applyTheme`, in plain ES5. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;
