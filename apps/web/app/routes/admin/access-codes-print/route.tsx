import type { Route } from "./+types/route";

import { ORPCError } from "@orpc/client";
import { Link } from "react-router";
import { joinUrl, qrSvg, requireStaff } from "~/.server/admin";
import { adminUrls } from "../adminUrls";

// /admin/access-codes/:id/print: one code for a flyer, with its QR code
// (an SVG made on the server by `qrcode`, so it never reaches a client
// bundle), the link it opens and the code in large type. Outside the admin
// frame, so it prints on its own.

export const meta = () => [
  { title: "Print access code · Caretook admin" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const { api } = await requireStaff(request);
  try {
    const code = await api.admin.accessCode.get({ id: params.id });
    const url = joinUrl(code.code);
    return { code: code.code, label: code.label, state: code.state, url, svg: await qrSvg(url) };
  } catch (e) {
    if (e instanceof ORPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST"))
      throw new Response("Not found", { status: 404 });
    throw e;
  }
}

export default function PrintAccessCode({ loaderData }: Route.ComponentProps) {
  const { code, label, state, url, svg } = loaderData;
  return (
    <div className="min-h-dvh bg-white text-black">
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex gap-2 print:hidden">
          <Link to={adminUrls.accessCodes()} className="btn btn-sm">
            Back
          </Link>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
            Print
          </button>
        </div>
        {state !== "usable" && (
          <p role="alert" className="alert alert-warning print:hidden">
            This code can't be used any more ({state}).
          </p>
        )}
        <h1 className="text-3xl font-semibold">Start your care group on Caretook</h1>
        <p className="text-lg">
          Scan the code, or go to the link, to set up a free care group for someone you care for.
        </p>
        <div
          className="w-72 max-w-full"
          data-access-code-qr={url}
          role="img"
          aria-label={`QR code for ${url}`}
          // The SVG comes from `qrcode`, built from our own URL.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="text-xl font-medium break-all" data-access-code-url="">
          {url}
        </p>
        <p className="font-mono text-5xl font-bold tracking-wider" data-access-code="">
          {code}
        </p>
        <p className="text-sm text-black/60 print:hidden">{label}</p>
      </main>
    </div>
  );
}
