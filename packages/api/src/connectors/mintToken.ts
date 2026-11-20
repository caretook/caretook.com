// Test-only (browser checks): connect an assistant for a seeded member, as the
// OAuth dance would, with no browser, and print its access token. roundtrip.mjs
// runs it (from packages/data, for tsx):
//   tsx ../api/src/connectors/mintToken.ts <email> <groupId> [clientName]
import { join } from "node:path";
import { endClient } from "../../../data/src/db/client";
import { loadEnv } from "../../../data/src/utils/loadEnv";

loadEnv(join(import.meta.dirname, "../../../../apps/web"));
loadEnv(join(import.meta.dirname, "../../../data"));

// After the env: testing.ts reads BETTER_AUTH_URL when it loads.
const { connectAssistant } = await import("./testing");

const [email, groupId, clientName] = process.argv.slice(2);
if (!email || !groupId) throw new Error("usage: mintToken <email> <groupId> [clientName]");
const { tokens } = await connectAssistant({
  email,
  groupId,
  clientName,
  password: process.env.SEED_USER_PASSWORD ?? "caretook-dev-password",
});
console.log(tokens.access_token);
await endClient();
