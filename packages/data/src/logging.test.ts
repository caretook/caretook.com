import { afterEach, describe, expect, it, vi } from "vitest";
import { newError } from "./errors";
import { formatErrorLog, logError } from "./logging";

const TITLE = "Mom fell in the bathroom at 3am";
const ACTOR = "11111111-1111-4111-8111-111111111111";
const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

/** A pg-style error: the message carries the failing value. */
class DatabaseError extends Error {
  code = "23505";
  detail = `Key (title)=(${TITLE}) already exists.`;
}

afterEach(() => vi.restoreAllMocks());

describe("logError", () => {
  it("never logs an AppError's meta, message or cause's message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = newError({
      code: "baseModel:create",
      message: `Couldn't save "${TITLE}"`,
      meta: { title: TITLE, issues: [{ path: ["title"], message: TITLE }] },
      cause: new DatabaseError(`duplicate key: ${TITLE}`),
    });

    logError("rpc: procedure failed", error, {
      procedure: "timeline.create",
      actorId: ACTOR,
      groupId: GROUP,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls[0]!.map(String).join(" ");
    expect(logged).not.toContain(TITLE);
    expect(logged).not.toContain("issues");
    expect(logged).toContain("[caretook] rpc: procedure failed");
    expect(logged).toContain("code=baseModel:create");
    expect(logged).toContain("procedure=timeline.create");
    expect(logged).toContain(`actor=${ACTOR}`);
    expect(logged).toContain(`group=${GROUP}`);
    expect(logged).toContain("caused by error=DatabaseError(23505)");
  });

  it("logs a thrown error's class and frames, not its message", () => {
    const line = formatErrorLog("mail: background delivery failed", new TypeError(`bad ${TITLE}`));
    expect(line).not.toContain(TITLE);
    expect(line).toContain("error=TypeError");
    expect(
      line
        .split("\n")
        .slice(1)
        .every((frame) => frame.trim().startsWith("at ")),
    ).toBe(true);
  });

  it("keeps only constant-looking codes from other errors", () => {
    expect(formatErrorLog("x", Object.assign(new Error("no"), { code: "ECONNREFUSED" }))).toContain(
      "error=Error(ECONNREFUSED)",
    );
    expect(formatErrorLog("x", Object.assign(new Error("no"), { code: TITLE }))).not.toContain(TITLE);
    expect(formatErrorLog("x", TITLE)).not.toContain(TITLE);
    expect(formatErrorLog("x", { title: TITLE })).toBe("[caretook] x error=Object");
  });

  it("leaves out empty fields", () => {
    expect(formatErrorLog("x", "boom", { actorId: null, groupId: undefined })).toBe(
      "[caretook] x error=string",
    );
  });
});
