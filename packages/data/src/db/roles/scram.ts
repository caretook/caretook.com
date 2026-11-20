import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

// A Postgres SCRAM-SHA-256 password verifier (RFC 5802/7677, as Postgres
// stores it in pg_authid), so `CREATE ROLE … PASSWORD '<verifier>'` never
// sends the password itself: a server that logs DDL logs only the verifier.

const ITERATIONS = 4096;

const hmac = (key: Buffer, text: string) => createHmac("sha256", key).update(text).digest();

/** `SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>`, base64 throughout. */
export const scramVerifier = (password: string, salt = randomBytes(16), iterations = ITERATIONS) => {
  // Postgres SASLprep-normalizes the password; NFKC is that for the ASCII
  // passwords randomPassword makes.
  const salted = pbkdf2Sync(password.normalize("NFKC"), salt, iterations, 32, "sha256");
  const storedKey = createHash("sha256").update(hmac(salted, "Client Key")).digest();
  const serverKey = hmac(salted, "Server Key");
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
};

/** A random URL-safe password (32 bytes). */
export const randomPassword = () => randomBytes(32).toString("base64url");
