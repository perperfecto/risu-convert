// SPDX-License-Identifier: AGPL-3.0-only
//
// risu-convert server: a standalone Cloudflare Worker that turns RisuAI rpack bytes
// into plain bytes and back. It knows nothing about its callers; they send
// raw bytes and get raw bytes.
//
//   POST /decode   body: rpack bytes  -> plain bytes
//   POST /encode   body: plain bytes  -> rpack bytes
//   GET  /source   where to get this program's source code (AGPL-3.0 §13)
//
// rpack maps each byte on its own, so bodies are converted as they stream:
// memory use stays flat whatever the size (Cloudflare's own request size
// limit still applies). SOURCE_URL (wrangler var) is the public address of
// this source code.

import { decode, encode } from "./rpack.js";

function text(status, message) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

const worker = {
  async fetch(request, env) {
    const source = env.SOURCE_URL || "";
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/source") return text(200, `${source}\n`);
    const operation = pathname === "/decode" ? decode : pathname === "/encode" ? encode : null;
    if (!operation) return text(404, "not found");
    if (request.method !== "POST") return text(405, "POST only");
    const converted = request.body
      ? request.body.pipeThrough(new TransformStream({ transform: (chunk, controller) => controller.enqueue(operation(chunk)) }))
      : null;
    return new Response(converted, {
      headers: { "Content-Type": "application/octet-stream", ...(source ? { "X-Source-Code": source } : {}) },
    });
  },
};

export default worker;
