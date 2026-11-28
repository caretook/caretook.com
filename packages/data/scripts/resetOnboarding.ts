import { reset } from "../src/db/seeds/onboardingUser";
import { run } from "./run";

await run("Onboarding test account reset", reset);
