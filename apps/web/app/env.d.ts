/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the web server, for the native app. Empty on the web (same origin). */
  readonly VITE_API_ORIGIN?: string;
  /** The deploy target (`staging` | `production`), baked in at build; unset in dev, tests and check builds. */
  readonly APP_ENV?: string;
}
