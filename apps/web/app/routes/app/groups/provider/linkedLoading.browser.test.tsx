import { PowerSyncDatabase } from "@powersync/web";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { page } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, todo, TEST_GROUP } from "../../../../../test/fixtures";
import * as providerRoute from "./route";

// The provider page's linked lists before their first answer (B-319): "not
// answered yet" shows neither the empty line nor the fallback name.

type Handler = { onResult: (result: unknown) => void; onError?: (error: unknown) => void };
type Watch = (sql: string, params: unknown[], handler: Handler, options: unknown) => unknown;

/**
 * Keeps the answers of watches whose SQL contains `sqlPart` from the screen
 * until the returned function is called. It sits above the test device's
 * tracking, so `settle` still sees those queries as answered.
 */
const holdAnswers = (sqlPart: string) => {
  const proto = PowerSyncDatabase.prototype as unknown as { watch: Watch };
  const real = proto.watch;
  let held: (() => void)[] | null = [];
  const spy = vi.spyOn(proto, "watch").mockImplementation(function (
    this: unknown,
    sql,
    params,
    handler,
    options,
  ) {
    if (!sql.includes(sqlPart)) return real.call(this, sql, params, handler, options);
    const onResult = (result: unknown) => {
      if (held) held.push(() => handler.onResult(result));
      else handler.onResult(result);
    };
    return real.call(this, sql, params, { ...handler, onResult }, options);
  });
  onTestFinished(() => spy.mockRestore());
  return () => {
    const answers = held ?? [];
    held = null;
    for (const answer of answers) answer();
  };
};

const LARK = fx.provider({ id: "8f2d0b51-3c7e-4a4f-9b26-1daf5e3ab101", name: "Dr. Mira Lark" });
const SAM_ID = "8f2d0b51-3c7e-4a4f-9b26-1daf5e3ab002";
const GONE_ID = "8f2d0b51-3c7e-4a4f-9b26-1daf5e3ab003";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });

const open = (fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"]) =>
  renderWithDevice({
    route: { path: "/app/groups/:groupId/providers/:providerId", module: providerRoute },
    url: `/app/groups/${TEST_GROUP.id}/providers/${LARK.id}`,
    fixtures,
  });

const EMPTY = /No notes or events yet/;

describe("linked lists before the first answer", () => {
  test("Linked entries: no empty line until the query answers empty", async () => {
    const release = holdAnswers("FROM timeline_entry_provider l JOIN timeline_entry");
    const device = await open([LARK]);
    await expect.element(page.getByRole("heading", { name: "Linked entries" })).toBeInTheDocument();
    expect(page.getByText(EMPTY).query()).toBeNull();

    release();
    await device.settle();
    await expect.element(page.getByText(EMPTY)).toBeInTheDocument();
  });

  test("Linked todos: no fallback name until the members answer, then the real names", async () => {
    const release = holdAnswers('FROM care_group_member m LEFT JOIN "user"');
    const device = await open([
      LARK,
      SAM,
      todo({
        id: "8f2d0b51-3c7e-4a4f-9b26-1daf5e3ab401",
        title: "Call the office",
        providerId: LARK.id,
        assigneeId: SAM_ID,
      }),
      todo({
        id: "8f2d0b51-3c7e-4a4f-9b26-1daf5e3ab402",
        title: "Fax the referral",
        providerId: LARK.id,
        assigneeId: GONE_ID,
      }),
    ]);
    await expect.element(page.getByRole("heading", { name: "Linked entries" })).toBeInTheDocument();
    expect(page.getByText("Former member").query()).toBeNull();
    expect(page.getByText("Call the office").query()).toBeNull();

    release();
    await device.settle();
    const sam = page.getByRole("listitem").filter({ hasText: "Call the office" });
    await expect.element(sam.getByText("Sam Okafor")).toBeInTheDocument();
    // Someone who really has left still reads as a former member.
    const gone = page.getByRole("listitem").filter({ hasText: "Fax the referral" });
    await expect.element(gone.getByText("Former member")).toBeInTheDocument();
  });
});
