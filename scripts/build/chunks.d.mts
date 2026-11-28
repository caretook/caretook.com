// Types for chunks.mjs, which apps/web/vite.config.ts imports. Vite isn't
// resolvable from scripts/, so the config names the plugin and option types.

type ModuleInfo = { importers: readonly string[]; dynamicImporters: readonly string[] } | null;

export function routeKind(path: string): "app" | "marketing" | "public";
export function iconOf(id: string): string | null;
export function lucideNamesIn(code: string): string[];
export function barrelIcons(code: string): Map<string, string>;
export function pageKinds(id: string, getModuleInfo: (id: string) => ModuleInfo): Set<string>;
export function iconGroup(users: string[], getModuleInfo: (id: string) => ModuleInfo): string;
export function clientChunks<Plugin, CodeSplitting>(): { plugin: Plugin; codeSplitting: CodeSplitting };
