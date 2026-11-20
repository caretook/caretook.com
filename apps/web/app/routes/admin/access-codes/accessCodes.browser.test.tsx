import type { ApiOutputs } from "~/lib/rpc";

import QRCode from "qrcode";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import * as print from "../access-codes-print/route";
import { openAdmin, postedForms } from "../adminWorld";
import * as accessCodes from "./route";

// /admin/access-codes and a code's print page (groups.mjs step 4's codes,
// on loader data): each code with its uses, expiry and state, Print and
// Revoke; a new code's form posts what was typed and shows the result; the
// print page shows the link and code in large type, and its QR code
// decodes to the link. What the server does (the code's format, its uses,
// revoking, the audit entries, staff only) is
// packages/api/src/groups.int.test.ts's and staffAdmin.int.test.ts's; the
// QR's SVG is made on the server by `qrSvg` in ~/.server/admin with the
// same `qrcode` options as here.

type AccessCodeDto = ApiOutputs["admin"]["accessCode"]["list"][number];

let n = 0;
const code = (v: Partial<AccessCodeDto> = {}): AccessCodeDto => ({
  id: `5a7d0c00-0000-4000-8000-0000000c0d${String(++n).padStart(2, "0")}`,
  code: "CARE-AB2C-DE3F",
  label: "Clinic flyer",
  expiresAt: "2027-02-10T17:30:00.000Z",
  maxUses: 25,
  useCount: 0,
  revokedAt: null,
  createdAt: "2026-11-10T17:30:00.000Z",
  state: "usable",
  ...v,
});

const row = (c: string) =>
  document.querySelector<HTMLTableRowElement>(`[data-access-codes] tr[data-code="${c}"]`);
const cells = (c: string) => [...(row(c)?.querySelectorAll("td") ?? [])].map((td) => td.textContent?.trim());

describe("/admin/access-codes", () => {
  test("lists each code with its uses, expiry and state; a revoked code has Print but no Revoke", async () => {
    const flyer = code({ useCount: 3 });
    const open = code({ code: "CARE-GH4J-KM5N", label: "Open day", maxUses: null, useCount: 7 });
    const revoked = code({ code: "CARE-PQ6R-ST7V", label: "Old flyer", state: "revoked" });
    await openAdmin({
      routes: {
        path: "/admin/access-codes",
        module: accessCodes,
        loaderData: { codes: [flyer, open, revoked] },
      },
      url: "/admin/access-codes",
    });
    await expect.element(page.getByRole("heading", { name: "Access codes" })).toBeVisible();
    expect(cells(flyer.code).slice(0, 5)).toEqual([
      "CARE-AB2C-DE3F",
      "Clinic flyer",
      "3 of 25",
      "Feb 10, 2027",
      "Active",
    ]);
    expect(cells(open.code)[2]).toBe("7");
    expect(cells(revoked.code)[4]).toBe("Revoked");
    await expect
      .element(page.getByRole("link", { name: `Print ${flyer.code}` }))
      .toHaveAttribute("href", `/admin/access-codes/${flyer.id}/print`);
    await expect.element(page.getByRole("button", { name: `Revoke ${flyer.code}` })).toBeVisible();
    expect(row(revoked.code)?.querySelector("button")).toBeNull();
  });

  test("no codes yet says so", async () => {
    await openAdmin({
      routes: { path: "/admin/access-codes", module: accessCodes, loaderData: { codes: [] } },
      url: "/admin/access-codes",
    });
    await expect.element(page.getByText("No codes yet.")).toBeVisible();
  });

  test("a new code posts its label, expiry and uses; the list shows it and the status names it", async () => {
    let codes: AccessCodeDto[] = [];
    const made = code({ code: "CARE-WX8Y-Z9AB", label: "Library flyer", maxUses: 25 });
    const posted = postedForms(() => {
      codes = [made];
      return { ok: true, message: `Created ${made.code}.` };
    });
    await openAdmin({
      routes: {
        path: "/admin/access-codes",
        module: accessCodes,
        loaderData: () => ({ codes }),
        actionResult: posted.actionResult,
      },
      url: "/admin/access-codes",
    });
    await expect.element(page.getByLabelText("Expires in (days)")).toHaveValue(90);
    await userEvent.fill(page.getByLabelText("Label"), "Library flyer");
    await userEvent.fill(page.getByLabelText("Maximum uses"), "25");
    await userEvent.click(page.getByRole("button", { name: "Create code" }));
    await expect.element(page.getByRole("status")).toHaveTextContent("Created CARE-WX8Y-Z9AB.");
    expect(posted.posts).toEqual([
      { intent: "create", label: "Library flyer", expiresInDays: "90", maxUses: "25" },
    ]);
    expect(cells(made.code)[2]).toBe("0 of 25");
  });

  test("a refused code shows the field's problem", async () => {
    await openAdmin({
      routes: {
        path: "/admin/access-codes",
        module: accessCodes,
        loaderData: { codes: [] },
        actionResult: {
          ok: false,
          error: "Check the form and try again.",
          issues: [{ path: "expiresInDays", message: "At most 730 days" }],
        },
      },
      url: "/admin/access-codes",
    });
    await userEvent.fill(page.getByLabelText("Label"), "Too long");
    await userEvent.click(page.getByRole("button", { name: "Create code" }));
    await expect.element(page.getByText("At most 730 days")).toBeVisible();
  });

  test("Revoke posts the code's id and the row turns revoked", async () => {
    let codes = [code({ code: "CARE-CD2E-FG3H" })];
    const posted = postedForms(() => {
      codes = codes.map((c) => ({ ...c, state: "revoked", revokedAt: "2026-11-20T17:30:00.000Z" }));
      return { ok: true, message: "CARE-CD2E-FG3H is revoked." };
    });
    await openAdmin({
      routes: {
        path: "/admin/access-codes",
        module: accessCodes,
        loaderData: () => ({ codes }),
        actionResult: posted.actionResult,
      },
      url: "/admin/access-codes",
    });
    await userEvent.click(page.getByRole("button", { name: "Revoke CARE-CD2E-FG3H" }));
    await expect.poll(() => row("CARE-CD2E-FG3H")?.dataset.state).toBe("revoked");
    expect(posted.posts).toEqual([{ intent: "revoke", id: codes[0]!.id }]);
    expect(row("CARE-CD2E-FG3H")?.querySelector("button")).toBeNull();
  });
});

describe("a code's print page", () => {
  const URL_FOR = "http://localhost:5173/join/CARE-AB2C-DE3F";
  /** The server's SVG (`qrSvg` in ~/.server/admin), made with the same options. */
  const svgFor = (text: string) =>
    QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  const openPrint = async (state = "usable") =>
    renderWithDevice({
      route: {
        path: "/admin/access-codes/:id/print",
        module: print,
        loaderData: {
          code: "CARE-AB2C-DE3F",
          label: "Clinic flyer",
          state,
          url: URL_FOR,
          svg: await svgFor(URL_FOR),
        },
      },
      url: "/admin/access-codes/5a7d0c00-0000-4000-8000-0000000c0d01/print",
      role: null,
      width: 900,
      height: 1200,
    });

  test("shows the link and the code, and its QR code decodes to the link", async () => {
    await openPrint();
    await expect.element(page.getByRole("img", { name: `QR code for ${URL_FOR}` })).toBeVisible();
    expect(document.querySelector("[data-access-code-url]")?.textContent).toBe(URL_FOR);
    expect(document.querySelector("[data-access-code]")?.textContent).toBe("CARE-AB2C-DE3F");
    expect(document.querySelector("[role=alert]")).toBeNull();
    await expect
      .element(page.getByRole("link", { name: "Back" }))
      .toHaveAttribute("href", "/admin/access-codes");

    const svg = document.querySelector("[data-access-code-qr] svg")!.outerHTML;
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 600, 600);
    ctx.drawImage(img, 0, 0, 600, 600);
    expect("BarcodeDetector" in window).toBe(true);
    const detector = new (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector({
      formats: ["qr_code"],
    });
    const found = await detector.detect(canvas);
    expect(found[0]?.rawValue).toBe(URL_FOR);
  });

  test("a code that can't be used any more warns, off the printed page", async () => {
    await openPrint("revoked");
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("This code can't be used any more (revoked).");
  });
});

type BarcodeDetectorCtor = new (options: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
