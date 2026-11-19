// Preloaded by serve.sh --built (node --import): the check build's server adds
// the host's headers (apps/web/vercel.json) to every response that lacks them,
// as the host does for files it serves itself: prerendered marketing pages,
// assets and public/. The app's own responses already carry the full set
// (quick-fixes slice 22), so a header already set is kept.
import { readFileSync } from "node:fs";
import { ServerResponse } from "node:http";

const config = JSON.parse(readFileSync(new URL("../../apps/web/vercel.json", import.meta.url), "utf8"));
const headers = config.headers.find((h) => h.source === "/(.*)")?.headers ?? [];

const writeHead = ServerResponse.prototype.writeHead;
ServerResponse.prototype.writeHead = function (...args) {
  for (const { key, value } of headers) if (!this.hasHeader(key)) this.setHeader(key, value);
  return writeHead.apply(this, args);
};
