import { describe, expect, it } from "vitest";
import { readsLiveSession } from "./liveSession";

describe("readsLiveSession", () => {
  it("matches PowerSync's /token exactly", () => {
    expect(readsLiveSession("/token")).toBe(true);
  });

  it("leaves other token paths alone, the oauth-provider's included", () => {
    for (const path of ["/oauth2/token", "/oauth2/authorize", "/oauth2/register", "/oauth2/revoke"])
      expect([path, readsLiveSession(path)]).toEqual([path, false]);
    for (const path of ["/token/", "/tokens", "/api/auth/token", "/get-session", ""])
      expect([path, readsLiveSession(path)]).toEqual([path, false]);
  });
});
