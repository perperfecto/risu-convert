// SPDX-License-Identifier: AGPL-3.0-only
//
// A RisuAI module's lorebook and regex scripts in other front ends' formats:
//   SillyTavern   World Info (lorebook) and regex scripts
//   Character Card V3 `character_book` (read by Chub, RisuAI and most card tools)
//   Agnai         memory book
// Lua / trigger scripts have no equivalent elsewhere and are reported, not converted.
// Node-only (node:crypto for script ids); the worker never loads it.

import { randomUUID } from "node:crypto";

const keys = text => String(text ?? "").split(",").map(key => key.trim()).filter(Boolean);

/** Entries that hold text (Risu folders only group other entries). */
function textEntries(lorebook) {
  return (Array.isArray(lorebook) ? lorebook : []).filter(entry => entry && entry.mode !== "folder");
}

/** Risu insert order; 0 is a real order, only a missing value falls back to 100. */
function order(entry) {
  const value = Number(entry.insertorder);
  return Number.isFinite(value) ? value : 100;
}

function constant(entry) {
  return entry.alwaysActive === true || entry.mode === "constant";
}

// ---- SillyTavern ----

export function toSillyTavernWorldInfo(lorebook, name = "") {
  const entries = {};
  textEntries(lorebook).forEach((entry, uid) => {
    entries[uid] = {
      uid,
      key: keys(entry.key),
      keysecondary: keys(entry.secondkey),
      comment: String(entry.comment ?? ""),
      content: String(entry.content ?? ""),
      constant: constant(entry),
      selective: entry.selective === true,
      selectiveLogic: 0,
      order: order(entry),
      position: 0,
      disable: false,
      excludeRecursion: false,
      probability: typeof entry.activationPercent === "number" ? entry.activationPercent : 100,
      useProbability: typeof entry.activationPercent === "number",
      depth: 4,
      caseSensitive: entry.caseSensitive === true ? true : null,
      displayIndex: uid,
    };
  });
  return { name, entries };
}

/** Risu stage → SillyTavern placement and flags (1 = user input, 2 = AI output). */
const STAGES = {
  editinput: { placement: [1] },
  editoutput: { placement: [2] },
  editdisplay: { placement: [1, 2], markdownOnly: true },
  editprocess: { placement: [1, 2], promptOnly: true },
  disabled: { placement: [2], disabled: true },
};

/** Returns `{ scripts, skipped }`; translation-stage scripts have no SillyTavern stage. */
export function toSillyTavernRegex(regex) {
  const scripts = [];
  const skipped = [];
  (Array.isArray(regex) ? regex : []).forEach((script, index) => {
    const stage = STAGES[script?.type];
    if (!stage) { skipped.push(script?.comment || `#${index + 1}`); return; }
    const flags = script.ableFlag && script.flag ? String(script.flag).replace(/<[^>]*>/g, "").replace(/[^dgimsuvy]/g, "") : "g";
    scripts.push({
      id: randomUUID(),
      scriptName: String(script.comment || `Risu regex ${index + 1}`),
      findRegex: `/${String(script.in ?? "")}/${flags || "g"}`,
      // `$&` (whole match) is written {{match}} in SillyTavern.
      replaceString: String(script.out ?? "").replace(/\$&/g, "{{match}}"),
      trimStrings: [],
      placement: stage.placement,
      disabled: stage.disabled === true,
      markdownOnly: stage.markdownOnly === true,
      promptOnly: stage.promptOnly === true,
      runOnEdit: true,
      substituteRegex: 0,
      minDepth: null,
      maxDepth: null,
    });
  });
  return { scripts, skipped };
}

// ---- Character Card V3 ----

export function toCharacterBook(lorebook, name = "") {
  return {
    name,
    description: "",
    scan_depth: 7,
    token_budget: 999999,
    recursive_scanning: false,
    extensions: {},
    entries: textEntries(lorebook).map((entry, id) => ({
      id,
      keys: keys(entry.key),
      secondary_keys: keys(entry.secondkey),
      content: String(entry.content ?? ""),
      comment: String(entry.comment ?? ""),
      name: String(entry.comment ?? ""),
      enabled: true,
      constant: constant(entry),
      selective: entry.selective === true,
      insertion_order: order(entry),
      case_sensitive: entry.caseSensitive === true,
      use_regex: entry.useRegex === true,
      position: "before_char",
      extensions: {},
    })),
  };
}

// ---- Agnai ----

export function toAgnaiMemoryBook(lorebook, name = "") {
  return {
    kind: "memory",
    name,
    description: "",
    entries: textEntries(lorebook).map(entry => ({
      name: String(entry.comment ?? ""),
      entry: String(entry.content ?? ""),
      keywords: keys(entry.key),
      priority: order(entry),
      weight: 1,
      enabled: true,
    })),
  };
}

/**
 * What a module carries that a target cannot hold, as readable notes.
 * `target` is "sillytavern", "card" or "agnai"; without it, only what no target keeps.
 */
export function conversionNotes(module, target) {
  const lorebook = Array.isArray(module?.lorebook) ? module.lorebook : [];
  const entries = textEntries(lorebook);
  const count = test => entries.filter(test).length;
  const notes = [];
  const add = (number, text) => { if (number) notes.push(`${number} ${text}`); };
  if (!target) {
    add(Array.isArray(module?.trigger) ? module.trigger.length : 0, "trigger script(s) (Lua / blocks): RisuAI only");
    add(lorebook.length - entries.length, "lorebook folder(s): dropped, their entries are kept");
    if (module?.backgroundEmbedding) notes.push("background HTML: RisuAI only");
    return notes;
  }
  if (target === "sillytavern" || target === "agnai") add(count(entry => entry.useRegex === true), "entry key(s) meant as regular expressions, written as plain keys");
  if (target === "card" || target === "agnai") add(count(entry => typeof entry.activationPercent === "number"), "entry activation chance(s) not kept");
  if (target === "agnai") {
    add(count(constant), "always-active entr(ies) become keyword entries");
    add(count(entry => keys(entry.secondkey).length > 0), "entr(ies) lose their secondary keys");
  }
  add(count(entry => /@@/.test(String(entry.content ?? ""))), "entr(ies) with RisuAI @@decorators, kept as text");
  return notes;
}
