import { describe, expect, it } from "vitest";
import { editProviderGuard, newProviderGuard, onlyProviderSheetChanged } from "./providerSheetGuard";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const LIST = `/app/groups/${G}/providers`;
const P = "7d1c2b3a-0000-4000-8000-000000000001";
const live = { id: P, groupId: G, deletedAt: null };

describe("newProviderGuard", () => {
  it("opens the add sheet for a writer, as a clinician unless `type` says otherwise", () => {
    expect(newProviderGuard({ groupId: G, search: "", canWrite: true })).toEqual({
      sheet: { type: "clinician" },
    });
    expect(newProviderGuard({ groupId: G, search: "?q=x&type=pharmacy", canWrite: true })).toEqual({
      sheet: { type: "pharmacy" },
    });
    expect(newProviderGuard({ groupId: G, search: "?type=bogus", canWrite: true })).toEqual({
      sheet: { type: "clinician" },
    });
  });

  it("sends a viewer to the list, keeping its search", () => {
    expect(newProviderGuard({ groupId: G, search: "?q=cardio&type=clinician", canWrite: false })).toEqual({
      redirect: `${LIST}?q=cardio&type=clinician`,
    });
  });
});

describe("editProviderGuard", () => {
  const writer = { groupId: G, search: "?past=1", canWrite: true };

  it("opens a live provider in the group for a writer", () => {
    expect(editProviderGuard({ ...writer, provider: live })).toEqual({ sheet: live });
  });

  it("sends a viewer, and a missing, deleted or other group's provider, to the list", () => {
    const list = { redirect: `${LIST}?past=1` };
    expect(editProviderGuard({ ...writer, canWrite: false, provider: live })).toEqual(list);
    expect(editProviderGuard({ ...writer, provider: null })).toEqual(list);
    expect(
      editProviderGuard({ ...writer, provider: { ...live, deletedAt: "2026-11-18T00:00:00Z" } }),
    ).toEqual(list);
    expect(editProviderGuard({ ...writer, provider: { ...live, groupId: "other" } })).toEqual(list);
  });
});

describe("onlyProviderSheetChanged", () => {
  const url = (path: string) => new URL(`http://x${path}`);

  it("is true between the list and its sheets", () => {
    expect(onlyProviderSheetChanged(G, url(LIST), url(`${LIST}/new`))).toBe(true);
    expect(onlyProviderSheetChanged(G, url(`${LIST}/new?q=a`), url(`${LIST}?q=a`))).toBe(true);
    expect(onlyProviderSheetChanged(G, url(LIST), url(`${LIST}/${P}/edit`))).toBe(true);
    expect(onlyProviderSheetChanged(G, url(`${LIST}/${P}/edit`), url(LIST))).toBe(true);
  });

  it("is false for the same path, a provider's page, or anywhere else", () => {
    expect(onlyProviderSheetChanged(G, url(LIST), url(`${LIST}?q=a`))).toBe(false);
    expect(onlyProviderSheetChanged(G, url(LIST), url(`${LIST}/${P}`))).toBe(false);
    expect(onlyProviderSheetChanged(G, url(LIST), url(`/app/groups/${G}/timeline`))).toBe(false);
    expect(onlyProviderSheetChanged(G, url(LIST), url(`/app/groups/other/providers/new`))).toBe(false);
  });
});
