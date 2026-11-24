import type { ApiContext } from "./procedures";

import { call, isProcedure, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { lazyAuthUser, publicProcedure } from "./procedures";
import { router } from "./router";

// Every procedure signed out (test-health-2 slice 2, B-373). The sweep walks
// the router tree, so a new procedure is covered with no edit here. Only the
// procedures below may answer anything but UNAUTHORIZED: adding one to this
// list is a deliberate, reviewed decision that it's open to anyone.

/** The public procedures: sign-up, invites and access codes by token or code, the marketing forms, the banner. */
const PUBLIC_PROCEDURES = [
  "invite.preview",
  "invite.signUp",
  "invite.decline",
  "accessCode.preview",
  "accessCode.signUp",
  "public.waitlist.join",
  "public.contact.send",
  "public.announcement",
];

type Tree = { readonly [key: string]: unknown };

/** Every procedure in `tree`, by its dotted path. */
const proceduresOf = (tree: unknown, path: string[] = []): [string, unknown][] =>
  isProcedure(tree)
    ? [[path.join("."), tree]]
    : Object.entries(tree as Tree).flatMap(([key, value]) => proceduresOf(value, [...path, key]));

/** Signed out as an in-process caller (no user) and as `/rpc` (a session lookup that finds none). */
const SIGNED_OUT: Record<string, () => ApiContext> = {
  "no user": () => ({ authUser: null }),
  "no session": () => ({ getAuthUser: lazyAuthUser(() => Promise.resolve(null)) }),
};

/** Each non-public procedure that didn't answer UNAUTHORIZED, with what it did instead. */
const openProcedures = async (tree: unknown, context: () => ApiContext) => {
  const open: string[] = [];
  for (const [path, procedure] of proceduresOf(tree)) {
    if (PUBLIC_PROCEDURES.includes(path)) continue;
    // No input on purpose: the session check must come before validation.
    const answer = await call(procedure as never, undefined, { context: context() }).then(
      () => "answered",
      (e: unknown) => (e instanceof ORPCError ? String(e.code) : `threw ${String(e)}`),
    );
    if (answer !== "UNAUTHORIZED") open.push(`${path}: ${answer}`);
  }
  return open;
};

describe("every procedure, signed out", () => {
  it("walks the whole router", () => {
    const paths = proceduresOf(router).map(([path]) => path);
    // Recounted 2026-11-24: 91 procedures (the PRD counted 89), 8 of them public.
    expect(paths.length).toBeGreaterThanOrEqual(91);
    expect(paths).toEqual(
      expect.arrayContaining(["me.get", "sync.upload", "admin.settings.set", "search.query"]),
    );
  });

  it("lists only public procedures that exist", () => {
    const paths = new Set(proceduresOf(router).map(([path]) => path));
    expect(PUBLIC_PROCEDURES.filter((path) => !paths.has(path))).toEqual([]);
  });

  it.each(Object.keys(SIGNED_OUT))(
    "answers UNAUTHORIZED everywhere but the public list (%s)",
    async (how) => {
      expect(await openProcedures(router, SIGNED_OUT[how]!)).toEqual([]);
    },
  );

  it("catches a procedure added to the tree without a session check", async () => {
    const standIn = {
      ...router,
      careGroup: { ...router.careGroup, standIn: publicProcedure.handler(() => "open") },
    };
    expect(await openProcedures(standIn, SIGNED_OUT["no user"]!)).toEqual(["careGroup.standIn: answered"]);
  });
});
