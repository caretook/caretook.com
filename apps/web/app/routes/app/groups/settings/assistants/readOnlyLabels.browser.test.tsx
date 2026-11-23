import type { DeviceRoute } from "../../../../../../test/device";

import { CONNECTOR_READ_ONLY_BY_OWNER_LABEL } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import * as settingsLayout from "../layout/route";
import * as assistants from "./route";
import { apiCalls } from "../../../../../../test/api";
import { renderWithDevice } from "../../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../../test/fixtures";

// Group settings → Assistants (B-599): another owner's read-only change
// arrives by sync, and the connection rows follow it with no navigation.
// All names are made up.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/assistants`, module: assistants }] },
];
const URL = `/app/groups/${TEST_GROUP.id}/settings/assistants`;
const WRITE_LABEL = "Read and add entries · Connected";
const OWNER_LABEL = `${CONNECTOR_READ_ONLY_BY_OWNER_LABEL} · Connected`;

const row = () => document.querySelector("li[data-connection]")?.textContent.trim() ?? "";

describe("group settings → Assistants' connection labels", () => {
  test("follow a synced read-only change with no navigation", async () => {
    let readOnlyByOwner = false;
    const calls = apiCalls();
    const device = await renderWithDevice({
      route: ROUTES,
      url: URL,
      role: "owner",
      fixtures: [fx.group({ connectorsEnabled: 1, connectorsReadOnly: 0 })],
      api: calls.record({
        "connector.listForGroup": () => [
          {
            id: "g1",
            userId: "user-g1",
            groupId: TEST_GROUP.id,
            memberName: "Ann Lee",
            clientName: "Claude",
            redirectHost: "assistant.example.com",
            scope: "readWrite",
            consentedAt: new Date(Date.now() - 86_400_000).toISOString(),
            lastUsedAt: null,
            readOnlyByOwner,
          },
        ],
        "connector.myRequest": () => null,
      }),
    });
    await expect.poll(row).toContain(WRITE_LABEL);
    const before = device.location();

    readOnlyByOwner = true;
    await device.sync(fx.group({ connectorsEnabled: 1, connectorsReadOnly: 1 }));
    await expect.poll(row).toContain(OWNER_LABEL);

    readOnlyByOwner = false;
    await device.sync(fx.group({ connectorsEnabled: 1, connectorsReadOnly: 0 }));
    await expect.poll(row).toContain(WRITE_LABEL);
    expect(device.location()).toEqual(before);
  });
});
