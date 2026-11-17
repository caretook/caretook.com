/**
 * Which bundle we're building.
 * - "web":    SSR on Vercel. Marketing/auth routes may use server loaders.
 * - "native": static SPA bundled into Capacitor. No server code at all.
 *
 * Rule: routes under /app never export a server `loader`/`action`,
 * so they run identically in both targets.
 */
export type BuildTarget = "web" | "native";

export const buildTarget: BuildTarget =
  process.env.BUILD_TARGET === "native" ? "native" : "web";

export const isNative = buildTarget === "native";
