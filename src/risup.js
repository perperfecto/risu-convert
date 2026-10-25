// SPDX-License-Identifier: AGPL-3.0-only
//
// RisuAI preset files:
//   .risup       = rpack(gzip(msgpack({ presetVersion, type: "preset", preset: sealed })))
//   .risupreset  = the same without rpack
// `sealed` is AES-GCM(msgpack(preset)) under SHA-256("risupreset") with a zero IV.
// RisuAI uses that fixed public passphrase for every export; it is a format
// step, not a secret. Node-only (uses node:zlib); the worker never loads it.

import { webcrypto } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { decodeMsgpack } from "./msgpack.js";
import { decode } from "./rpack.js";

const PASSPHRASE = "risupreset";

function envelope(bytes) {
  // Try the plain gzip form first, then the rpack-wrapped one.
  for (const candidate of [bytes, decode(bytes)]) {
    try {
      const value = decodeMsgpack(new Uint8Array(gunzipSync(candidate)));
      if (value && typeof value === "object" && value.type === "preset") return value;
    } catch { /* try the next form */ }
  }
  throw new Error("Not a RisuAI preset (.risup / .risupreset) file.");
}

/** The preset object inside a .risup or .risupreset file. */
export async function unpackPreset(bytes) {
  const outer = envelope(bytes);
  const sealed = outer.preset ?? outer.pres;
  if ((outer.presetVersion !== 0 && outer.presetVersion !== 2) || !(sealed instanceof Uint8Array)) {
    throw new Error(`Unsupported RisuAI preset version: ${outer.presetVersion}`);
  }
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(PASSPHRASE));
  const key = await webcrypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
  const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(12) }, key, sealed);
  return decodeMsgpack(new Uint8Array(plain));
}
