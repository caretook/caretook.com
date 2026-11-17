/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the web server, for the native app. Empty on the web (same origin). */
  readonly VITE_API_ORIGIN?: string;
}
