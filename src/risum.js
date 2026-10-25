// SPDX-License-Identifier: AGPL-3.0-only
//
// RisuAI module files (.risum):
//   byte 111, version 0, u32le length, rpack(JSON { type: "risuModule", module })
//   then for each module.assets[i] = [name, path, ext]: byte 1, u32le length, rpack(bytes)
//   and a closing byte 0.
// Reading works on any random-access source so files of hundreds of MB never
// have to be held in memory at once. There is no size cap: a length that runs
// past the end of the file is reported as damage instead.

import { decode, encode } from "./rpack.js";

const u32 = (bytes, at) => new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, true);

function u32Bytes(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

/** A source over bytes already in memory. */
export function memorySource(bytes) {
  return { size: bytes.length, read: async (position, length) => bytes.subarray(position, position + length) };
}

/**
 * Opens a .risum. `source` is `{ size, read(position, length) }`.
 * Returns the decoded main object (`{ type, module }`, as stored) and an async
 * iterator over the embedded files in order.
 */
export async function openRisum(source) {
  const head = await source.read(0, 6);
  if (head.length < 6 || head[0] !== 111 || head[1] !== 0) throw new Error("Not a RisuAI module (.risum) file.");
  const mainLength = u32(head, 2);
  if (6 + mainLength > source.size) throw new Error("The module header is damaged.");
  const main = JSON.parse(new TextDecoder().decode(decode(await source.read(6, mainLength))));
  if (main?.type !== "risuModule" || !main.module) throw new Error("The module data could not be read.");
  const list = Array.isArray(main.module.assets) ? main.module.assets : [];

  async function* assets() {
    let position = 6 + mainLength;
    for (let index = 0; ; index += 1) {
      if (position >= source.size) throw new Error("The module file is cut short (no end mark).");
      const mark = await source.read(position, 5);
      if (mark[0] === 0) {
        if (index !== list.length) throw new Error(`The module lists ${list.length} files but holds ${index}.`);
        return;
      }
      if (mark[0] !== 1 || mark.length < 5) throw new Error(`The file area after asset ${index} is damaged.`);
      const length = u32(mark, 1);
      if (position + 5 + length > source.size) throw new Error("The module file is cut short.");
      const [name = "", , ext = ""] = list[index] ?? [];
      yield { index, name: String(name), ext: String(ext), bytes: decode(await source.read(position + 5, length)) };
      position += 5 + length;
    }
  }
  return { main, assetCount: list.length, assets };
}

/**
 * Builds a .risum piece by piece. `main` is the stored object (`{ type, module }`);
 * `files` yields the bytes for module.assets in the same order.
 */
export async function* packRisum(main, files) {
  if (main?.type !== "risuModule" || !main.module) throw new Error("module.json must hold { type: \"risuModule\", module }.");
  // RisuAI writes the main JSON with two-space indentation; matching it keeps round trips byte-identical.
  const body = encode(new TextEncoder().encode(JSON.stringify(main, null, 2)));
  yield new Uint8Array([111, 0]);
  yield u32Bytes(body.length);
  yield body;
  for await (const bytes of files) {
    yield new Uint8Array([1]);
    yield u32Bytes(bytes.length);
    yield encode(bytes);
  }
  yield new Uint8Array([0]);
}
