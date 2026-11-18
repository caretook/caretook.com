// The web app's only door to the data layer. Living under .server/ means
// React Router fails the build if client code imports it, which keeps the
// pg driver and server-only logic out of client bundles.
//
// Client code that needs shared types/validation can import the client-safe
// subpaths directly: @caretook/data/schema, /errors, /permissions.
export * from "@caretook/data";
