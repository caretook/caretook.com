import { afterAll } from "vitest";
import { endClient } from "../src/db/client";
import { loadWorkerEnv } from "./env";

loadWorkerEnv();

afterAll(async () => {
  await endClient();
});
