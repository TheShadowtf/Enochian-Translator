/**
 * Enochian Dictionary — JSON-backed loader
 * ========================================
 *
 * This module reads EXCLUSIVELY from
 *   /public/complete_enochian_dictionary.json
 *
 * Per user spec:
 *   - No internal hard-coded word lists.
 *   - No external API calls.
 *   - All translations come from the uploaded JSON file.
 *
 * The JSON format is a flat { "english": "enochian" } map. Both single-
 * word entries ("i": "ol") and multi-word phrase entries
 * ("the voices": "bialo") live in the same flat map.
 *
 * IMPORTANT — Server/client split:
 *   This file is isomorphic (safe to import from both server and client).
 *   It NEVER imports `node:fs` directly. On the server, the dictionary
 *   is loaded by `loadDictionaryServer()` (which lives in
 *   `dictionary-server.ts` and uses fs.readFileSync). On the client,
 *   the dictionary is loaded via fetch('/complete_enochian_dictionary.json').
 *
 *   Calling `loadDictionary()` from anywhere triggers the appropriate
 *   loader for the current runtime.
 */

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface DictionaryEntryRaw {
  enochian: string;
  pronunciation: string;
}

export interface DictionaryEntry {
  english: string;
  enochian: string;
  pronunciation?: string;
}

// ----------------------------------------------------------------
// In-memory dictionary (populated by loadDictionary on either runtime)
// ----------------------------------------------------------------

let dict: Record<string, DictionaryEntryRaw> = {};

// Sanitize: strip any value containing non-ASCII characters (the source
// JSON has at least one corrupt entry — "sun": "r華"). Keep only entries
// whose Enochian value is plain ASCII letters.
function sanitize(d: Record<string, any>): Record<string, DictionaryEntryRaw> {
  const out: Record<string, DictionaryEntryRaw> = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === "string") {
      // Legacy flat string format
      if (/^[a-zA-Z]+$/.test(v)) {
        out[k.toLowerCase().trim()] = { enochian: v, pronunciation: "" };
      }
    } else if (v && typeof v === "object" && typeof v.enochian === "string") {
      // New format: { enochian, pronunciation }
      if (/^[a-zA-Z]+$/.test(v.enochian)) {
        out[k.toLowerCase().trim()] = {
          enochian: v.enochian,
          pronunciation: v.pronunciation || "",
        };
      }
    }
  }
  return out;
}

// ----------------------------------------------------------------
// Indexes
// ----------------------------------------------------------------

let englishIndex: Map<string, DictionaryEntryRaw> = new Map();
/**
 * Reverse index: enochian(upper) -> array of ALL english keys that map
 * to it. Multiple English keys can share the same Enochian value (e.g.
 * both "the voices" and "voices" map to "bialo"). We keep ALL of them
 * so the reverse translator can pick the PRIMARY FULL PHRASE (longest,
 * multi-word preferred) per user spec.
 */
let enochianIndex: Map<string, string[]> = new Map();
let multiWordKeys: string[] = [];

function buildIndexes() {
  englishIndex = new Map();
  enochianIndex = new Map();
  multiWordKeys = [];
  for (const [eng, entry] of Object.entries(dict)) {
    englishIndex.set(eng, entry);
    const eok = entry.enochian.toUpperCase();
    if (!enochianIndex.has(eok)) enochianIndex.set(eok, []);
    enochianIndex.get(eok)!.push(eng);
    if (eng.includes(" ")) multiWordKeys.push(eng);
  }
  // Longest-first so greedy matcher prefers "god of stretch-forth" over "god".
  multiWordKeys.sort((a, b) => b.split(" ").length - a.split(" ").length);

  // Also sort each reverse-index bucket so that the primary full phrase
  // (longest, then alphabetically) is first. lookupEnochian() returns
  // this first entry as the canonical English translation.
  for (const arr of enochianIndex.values()) {
    arr.sort((a, b) => {
      const aWords = a.split(" ").length;
      const bWords = b.split(" ").length;
      if (aWords !== bWords) return bWords - aWords; // longer phrases first
      return a.localeCompare(b); // alphabetical tiebreak
    });
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export function lookupEnglish(phrase: string): DictionaryEntryRaw | undefined {
  return englishIndex.get(phrase.toLowerCase().trim());
}

/**
 * Reverse lookup: Enochian word -> English.
 *
 * Per user spec: returns the PRIMARY FULL English phrase from the JSON,
 * not a partial match. When multiple English keys map to the same
 * Enochian value (e.g. both "the voices" and "voices" map to "bialo"),
 * the longest multi-word phrase is preferred.
 *
 * Examples (from the uploaded JSON):
 *   BIALO   -> "the voices"   (not "voices")
 *   GOHULIM -> "are saying"   (not "saying")
 *   THIL    -> "to talk"
 *   NONCI   -> "to you"
 */
export function lookupEnochian(word: string): string | undefined {
  const arr = enochianIndex.get(word.toUpperCase().trim());
  if (!arr || arr.length === 0) return undefined;
  return arr[0]; // primary full phrase (longest, multi-word preferred)
}

/**
 * Return ALL English keys that map to the given Enochian word. Useful
 * for disambiguation UIs.
 */
export function lookupEnochianAll(word: string): string[] {
  return enochianIndex.get(word.toUpperCase().trim()) ?? [];
}

export function multiWordEnglishKeys(): string[] {
  return multiWordKeys;
}

export function allEntries(): DictionaryEntry[] {
  return Object.entries(dict).map(([english, entry]) => ({
    english,
    enochian: entry.enochian,
    pronunciation: entry.pronunciation,
  }));
}

export function dictionarySize(): number {
  return Object.keys(dict).length;
}

export function isDictionaryLoaded(): boolean {
  return Object.keys(dict).length > 0;
}

// ----------------------------------------------------------------
// Loader
// ----------------------------------------------------------------

/**
 * Load (or replace) the in-memory dictionary from a raw { english: enochian }
 * plain object. Sanitises and rebuilds all indexes.
 *
 * This is called from:
 *   - server:  the synchronous init block below (via fs.readFileSync)
 *   - client:  ensureDictionaryLoaded() below (via fetch)
 */
export function setDictionary(raw: Record<string, string>): void {
  dict = sanitize(raw);
  buildIndexes();
}

// ----------------------------------------------------------------
// Server-side synchronous init
// ----------------------------------------------------------------
// On the server (Node), load the JSON dictionary at module import time
// using fs.readFileSync. On the client this block is a no-op — the
// dictionary will be loaded lazily via fetch in ensureDictionaryLoaded().
//
// IMPORTANT: We do NOT import `node:fs` at the top of this file because
// this module is imported by client components too. Instead, the server
// side-effect load happens in `dictionary-server.ts`, which is imported
// ONLY by server-only entry points (API routes). See dictionary-server.ts.

// ----------------------------------------------------------------
// Client-side async loader
// ----------------------------------------------------------------

let clientLoadPromise: Promise<void> | null = null;

/**
 * On the client, fetch the JSON dictionary from
 * /complete_enochian_dictionary.json. Returns a promise that resolves
 * once loaded. Safe to call multiple times — the fetch happens only once.
 *
 * On the server this is a no-op — the dictionary is loaded synchronously
 * by the init block above.
 */
export function ensureDictionaryLoaded(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (clientLoadPromise) return clientLoadPromise;
  // Use a cache-buster query parameter to force the browser to fetch the
  // latest version of the JSON file, ensuring the new alphabet entries are loaded.
  clientLoadPromise = fetch("/complete_enochian_dictionary.json?v=" + Date.now())
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((raw: Record<string, string>) => {
      setDictionary(raw);
    })
    .catch((err) => {
      console.error("Failed to fetch Enochian dictionary:", err);
    });
  return clientLoadPromise;
}
