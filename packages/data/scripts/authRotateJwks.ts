import { authKeysService } from "../src/services";
import { parseRotateJwksArgs, ROTATE_JWKS_USAGE } from "../src/utils/rotateJwksArgs";
import { run } from "./run";

// pnpm auth:rotate-jwks [--reason "why"] (hosting slice 9): retire the JWT
// signing key, so the app makes a new one (encrypted with the current
// secret) on the next token, recorded in the audit log with no actor (the
// system). An ordinary write: DATABASE_URL, never BETTER_AUTH_SECRET.
// ops/runbook.md, _Rotation_, says when.

const args = parseRotateJwksArgs(process.argv.slice(2));
if ("error" in args) {
  console.error(`${args.error}\n${ROTATE_JWKS_USAGE}`);
  process.exit(1);
}

await run("Rotate the JWT signing keys", async () => {
  const res = await authKeysService.rotate(args);
  if ("retired" in res) {
    console.log(
      res.retired.length
        ? `Retired ${res.retired.join(", ")}: the next token makes a new key.`
        : "No live key: the next token makes one.",
    );
    if (res.deleted.length) console.log(`Deleted keys retired over an hour ago: ${res.deleted.join(", ")}.`);
  }
  return res;
});
