import { afterAll } from "vitest";
import { endClient } from "../src/db/client";
import { loadTestEnv } from "./env";

loadTestEnv();

afterAll(async () => {
  await endClient();
});
