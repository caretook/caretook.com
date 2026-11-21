// Tables, relations, row types and Zod schemas. Client-safe: imports only
// drizzle-orm/pg-core, zod and yjs, never the pg driver.
//
// Naming: tables are `<name>Schema` (the key used by db.query.<name>Schema
// and by the permissions map); Zod schemas are `<name><Select|Insert|Update>ZSchema`.
// One folder per area (a new table goes in its area's folder and index), and `core/` for
// the shared column helpers.
export * from "./admin";
export * from "./app-shell";
export * from "./appointments";
export * from "./assistant";
export * from "./auth";
export * from "./calendars";
export * from "./care-groups";
export * from "./care-periods";
export * from "./connectors";
export * from "./core";
export * from "./live-notes";
export * from "./marketing";
export * from "./medications";
export * from "./notifications";
export * from "./profiles";
export * from "./providers";
export * from "./search";
export * from "./tasks";
export * from "./timeline";
