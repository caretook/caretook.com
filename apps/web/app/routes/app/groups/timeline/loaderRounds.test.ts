import { describe, expect, it } from "vitest";
import { inRounds } from "./loaderRounds";

/** A promise resolved by hand, so a test can see what has started before it settles. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

/** Lets every settled promise's continuations run. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/** The three reads, each logging when it starts and settling only when the test says. */
const world = (tagFilter: boolean) => {
  const started: string[] = [];
  const first = deferred<string>();
  const tags = deferred<string[]>();
  const second = deferred<string>();
  let secondArgs: [string, string[] | null] | null = null;
  const result = inRounds({
    tagFilter,
    first: () => (started.push("first"), first.promise),
    tags: () => (started.push("tags"), tags.promise),
    second: (f, t) => ((secondArgs = [f, t]), started.push("second"), second.promise),
  });
  return { started, first, tags, second, result, secondArgs: () => secondArgs };
};

describe("the timeline loader's rounds", () => {
  it("without ?tag=, the tags read starts with the second round, not before it", async () => {
    const w = world(false);
    await flush();
    expect(w.started).toEqual(["first"]);
    w.first.resolve("status");
    await flush();
    expect(w.started).toEqual(["first", "tags", "second"]);
    expect(w.secondArgs()).toEqual(["status", null]);
    w.second.resolve("rows");
    w.tags.resolve(["t1"]);
    await expect(w.result).resolves.toEqual({ first: "status", tags: ["t1"], second: "rows" });
  });

  it("with ?tag=, the tags resolve before the entries read starts", async () => {
    const w = world(true);
    await flush();
    expect(w.started).toEqual(["first", "tags"]);
    w.first.resolve("status");
    await flush();
    expect(w.started).toEqual(["first", "tags"]);
    w.tags.resolve(["t1"]);
    await flush();
    expect(w.started).toEqual(["first", "tags", "second"]);
    expect(w.secondArgs()).toEqual(["status", ["t1"]]);
    w.second.resolve("rows");
    await expect(w.result).resolves.toEqual({ first: "status", tags: ["t1"], second: "rows" });
  });
});
