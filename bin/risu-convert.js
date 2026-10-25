#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// risu-convert: unpack / pack RisuAI modules, unpack presets, and export a
// module's lorebook and regex scripts for other front ends.

import { createWriteStream } from "node:fs";
import { mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { conversionNotes, toAgnaiMemoryBook, toCharacterBook, toSillyTavernRegex, toSillyTavernWorldInfo } from "../src/convert.js";
import { decode, encode } from "../src/rpack.js";
import { openRisum, packRisum } from "../src/risum.js";
import { unpackPreset } from "../src/risup.js";

const HELP = `risu-convert — RisuAI file converter (AGPL-3.0)

  risu-convert unpack <module.risum> <folder>    module.json + assets/ (images, audio…)
  risu-convert pack <folder> <module.risum>      the reverse of unpack
  risu-convert preset <preset.risup> <out.json>  a RisuAI preset as readable JSON
  risu-convert export <module.risum|folder> <folder> [--to sillytavern,card,agnai]
                                                 lorebook / regex for other front ends
  risu-convert decode|encode <in> <out>          raw rpack bytes

Only convert modules you made or are allowed to convert by their creator.`;

const safeName = name => String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80) || "file";
const json = value => `${JSON.stringify(value, null, 2)}\n`;

/** Random-access reads from a file on disk, so large modules are never read whole. */
async function fileSource(file) {
  const handle = await open(file, "r");
  const { size } = await handle.stat();
  return {
    size,
    async read(position, length) {
      const buffer = Buffer.alloc(Math.max(0, Math.min(length, size - position)));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
    },
    close: () => handle.close(),
  };
}

async function unpack(input, folder) {
  const source = await fileSource(input);
  try {
    const { main, assetCount, assets } = await openRisum(source);
    await mkdir(path.join(folder, "assets"), { recursive: true });
    const files = [];
    for await (const asset of assets()) {
      const file = `assets/${String(asset.index).padStart(5, "0")}_${safeName(asset.name)}${asset.ext ? `.${safeName(asset.ext)}` : ""}`;
      await writeFile(path.join(folder, file), asset.bytes);
      files.push({ index: asset.index, name: asset.name, ext: asset.ext, file });
      if (files.length % 500 === 0) process.stdout.write(`  ${files.length}/${assetCount}\n`);
    }
    await writeFile(path.join(folder, "module.json"), json(main));
    await writeFile(path.join(folder, "assets.json"), json(files));
    console.log(`Unpacked "${main.module.name}": ${files.length} files → ${folder}`);
  } finally {
    await source.close();
  }
}

async function pack(folder, output) {
  const main = JSON.parse(await readFile(path.join(folder, "module.json"), "utf8"));
  const files = JSON.parse(await readFile(path.join(folder, "assets.json"), "utf8"));
  async function* bytes() {
    for (const entry of files) yield new Uint8Array(await readFile(path.join(folder, entry.file)));
  }
  const stream = createWriteStream(output);
  let failure = null;
  stream.on("error", error => { failure = error; });
  // Wait for room in the write buffer, or for a write error, then drop both listeners.
  const writable = () => new Promise(resolve => {
    const done = () => { stream.off("drain", done); stream.off("error", done); resolve(); };
    stream.on("drain", done);
    stream.on("error", done);
  });
  for await (const part of packRisum(main, bytes())) {
    if (failure) break;
    if (!stream.write(part)) await writable();
  }
  await new Promise(resolve => stream.end(resolve));
  if (failure) throw failure;
  console.log(`Packed "${main.module.name}": ${files.length} files → ${output}`);
}

async function preset(input, output) {
  const value = await unpackPreset(new Uint8Array(await readFile(input)));
  // Binary fields (rare) are written as plain number lists.
  await writeFile(output, `${JSON.stringify(value, (_key, item) => (item instanceof Uint8Array ? Array.from(item) : item), 2)}\n`);
  console.log(`Preset "${value?.name ?? ""}" → ${output}`);
}

async function readModule(input) {
  if ((await stat(input)).isDirectory()) return JSON.parse(await readFile(path.join(input, "module.json"), "utf8")).module;
  const source = await fileSource(input);
  try { return (await openRisum(source)).main.module; } finally { await source.close(); }
}

async function exportModule(input, folder, targets) {
  const risuModule = await readModule(input);
  const name = String(risuModule.name ?? "");
  const lorebook = risuModule.lorebook ?? [];
  const written = [];
  const notes = conversionNotes(risuModule);
  if (targets.has("sillytavern")) {
    const dir = path.join(folder, "sillytavern");
    await mkdir(path.join(dir, "regex"), { recursive: true });
    await writeFile(path.join(dir, "world_info.json"), json(toSillyTavernWorldInfo(lorebook, name)));
    const { scripts, skipped } = toSillyTavernRegex(risuModule.regex);
    for (const [index, script] of scripts.entries()) {
      await writeFile(path.join(dir, "regex", `${String(index + 1).padStart(3, "0")}_${safeName(script.scriptName)}.json`), json(script));
    }
    written.push(`sillytavern/world_info.json, sillytavern/regex/ (${scripts.length})`);
    if (skipped.length) notes.push(`sillytavern: ${skipped.length} regex script(s) without a SillyTavern stage (translation): ${skipped.join(", ")}`);
    for (const note of conversionNotes(risuModule, "sillytavern")) notes.push(`sillytavern: ${note}`);
  }
  if (targets.has("card")) {
    await mkdir(path.join(folder, "card"), { recursive: true });
    await writeFile(path.join(folder, "card", "character_book.json"), json(toCharacterBook(lorebook, name)));
    written.push("card/character_book.json");
    for (const note of conversionNotes(risuModule, "card")) notes.push(`card: ${note}`);
  }
  if (targets.has("agnai")) {
    await mkdir(path.join(folder, "agnai"), { recursive: true });
    await writeFile(path.join(folder, "agnai", "memory_book.json"), json(toAgnaiMemoryBook(lorebook, name)));
    written.push("agnai/memory_book.json");
    for (const note of conversionNotes(risuModule, "agnai")) notes.push(`agnai: ${note}`);
  }
  console.log(`Exported "${name}" → ${folder}\n  ${written.join("\n  ")}`);
  if (notes.length) console.log(`Not carried over:\n  - ${notes.join("\n  - ")}`);
}

async function main(args) {
  const [command, input, output, ...rest] = args;
  if (!command || command === "help" || command === "--help" || command === "-h") { console.log(HELP); return 0; }
  if (!input || !output) { console.log(HELP); return 1; }
  if (command === "unpack") await unpack(input, output);
  else if (command === "pack") await pack(input, output);
  else if (command === "preset") await preset(input, output);
  else if (command === "export") {
    const option = rest.indexOf("--to");
    const targets = new Set((option >= 0 ? rest[option + 1] ?? "" : "sillytavern,card,agnai").split(",").map(item => item.trim()));
    await exportModule(input, output, targets);
  } else if (command === "decode" || command === "encode") {
    const bytes = new Uint8Array(await readFile(input));
    await writeFile(output, command === "decode" ? decode(bytes) : encode(bytes));
  } else { console.log(HELP); return 1; }
  return 0;
}

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
  console.error(`risu-convert: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
