import { resetStaging } from "../src/db/resetStaging";
import { run } from "./run";

await run("Staging reset and reseeded", resetStaging);
