// Our limiter (`createRateLimiter` and its stores) lives in @caretook/data,
// so @caretook/auth's limits share it; the API's limiters import it from here.
export type { RateLimiter, RateLimitStore } from "@caretook/data";
export { createRateLimiter, defaultStore, memoryStore, postgresStore } from "@caretook/data";
