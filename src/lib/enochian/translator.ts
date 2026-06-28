/**
 * Enochian Translator — JSON-backed, v3
 * =====================================
 *
 * Reads EXCLUSIVELY from /public/complete_enochian_dictionary.json.
 *
 * Pipeline (English -> Enochian):
 *   1. Normalize input: lowercase, strip punctuation (keep spaces + apostrophes).
 *   2. PHRASE MATCHING FIRST: greedily match the longest known multi-word
 *      phrase at each cursor position (e.g. "the voices" beats "the"+"voices").
 *   3. For each remaining single word, look up the JSON dictionary.
 *   4. FALLBACK: if a word is NOT in the dictionary, transliterate it by
 *      spelling it out using spoken Enochian letter names (per user spec):
 *      "sent" -> "Fam Graph Drux Gis".
 *
 * Two-step output:
 *   Step 1: Latinised Enochian string (the dictionary values + the
 *           space-separated letter-name fallbacks, joined with spaces).
 *   Step 2: Unicode Enochian glyphs (U+10480 – U+104A9). For dictionary
 *           hits, map each letter of the enochian value to its glyph.
 *           For fallback hits, map each spoken name to its glyph (the
 *           same glyph that name always produces).
 */

import {
  lookupEnglish,
  lookupEnochian,
  multiWordEnglishKeys,
  ensureDictionaryLoaded,
  isDictionaryLoaded,
} from "./dictionary";
import {
  latinToGlyphs,
  latinToGlyphString,
  letterNames,
  namesToGlyphs,
  namesToGlyphString,
  glyphsToLatin,
  isLetterName,
  letterNameToLetter,
  type GlyphChar,
} from "./glyphs";

// ---------- Types ----------

export interface TranslatedWord {
  /** Original source text (may be a multi-word phrase) */
  source: string;
  /** Latinised Enochian output for this word/phrase (uppercase) */
  enochian: string;
  /** Enochian Unicode glyph string for this word */
  glyphs: string;
  /** Per-character glyph breakdown */
  glyphChars: GlyphChar[];
  /** True if a dictionary match was used; false if fallback transliteration */
  fromDictionary: boolean;
  /**
   * For eo->en direction only: the English translation of this word
   * (or the reconstructed word from spelled-out letter names).
   */
  english?: string;
  /** Optional grammatical note */
  note?: string;
}

export interface TranslationResult {
  direction: "en->eo" | "eo->en";
  input: string;
  words: TranslatedWord[];
  /** Full Latinised output (Step 1) */
  latinOutput: string;
  /** Full glyph output (Step 2) */
  glyphOutput: string;
  /** English output (only for eo->en) */
  englishOutput?: string;
  dictionaryHits: number;
  fallbacks: number;
}

// ---------- Normalization ----------

/**
 * Lowercase + strip punctuation per user spec.
 * Apostrophes inside words (e.g. "don't") are preserved so the
 * dictionary can be queried on "don't" if desired. Whitespace collapsed.
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    // Replace any run of non-alphanumeric/non-apostrophe/non-space with space
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Phrase-matching-first tokenizer (EN -> EO) ----------

/**
 * Walk the normalized input left-to-right, greedily matching the longest
 * known multi-word English phrase at each position. Single tokens that
 * don't begin a known phrase are kept as single words.
 *
 * Returns a list of "spans" — each span is a phrase (one or more words)
 * that will be looked up as a unit.
 */
function extractSpans(input: string): string[] {
  const normalized = normalize(input);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const multiKeys = multiWordEnglishKeys(); // sorted longest-first

  const spans: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // Try to match the longest possible phrase starting at position i.
    let matched: string | null = null;
    for (const key of multiKeys) {
      const keyTokens = key.split(" ");
      if (i + keyTokens.length > tokens.length) continue;
      const candidate = tokens.slice(i, i + keyTokens.length).join(" ");
      if (candidate === key) {
        matched = key;
        break;
      }
    }

    if (matched) {
      spans.push(matched);
      i += matched.split(" ").length;
    } else {
      spans.push(tokens[i]);
      i++;
    }
  }
  return spans;
}

// ---------- Render glyphs for a fallback (space-separated names) ----------

/**
 * Convert a fallback string like "Fam Graph Drux Gis" to inline SVG glyphs.
 * Each name maps to one SVG glyph (the same glyph that name produces when
 * transliterating letters).
 *
 * Delegates to namesToGlyphs/namesToGlyphString in glyphs.ts.
 */
function fallbackNamesToGlyphs(namesStr: string): {
  glyphs: string;
  glyphChars: GlyphChar[];
} {
  return {
    glyphs: namesToGlyphString(namesStr),
    glyphChars: namesToGlyphs(namesStr),
  };
}

// ---------- English -> Enochian ----------

export function translateEnglishToEnochian(input: string): TranslationResult {
  const spans = extractSpans(input);

  const words: TranslatedWord[] = [];
  let dictionaryHits = 0;
  let fallbacks = 0;

  for (const span of spans) {
    if (!span) continue;

    const dictValue = lookupEnglish(span);

    let enochianWord: string;
    let glyphs: string;
    let glyphChars: GlyphChar[];
    let fromDictionary: boolean;
    let note: string | undefined;

    if (dictValue !== undefined) {
      // Dictionary hit — use the JSON's enochian value verbatim.
      enochianWord = dictValue.toUpperCase();
      glyphChars = latinToGlyphs(enochianWord);
      glyphs = latinToGlyphString(enochianWord);
      fromDictionary = true;
      dictionaryHits++;
    } else {
      // FALLBACK: spell out using spoken Enochian letter names.
      // E.g. "sent" -> "Fam Graph Drux Gis"
      const names = letterNames(span);
      enochianWord = names; // keep title-case names (e.g. "Fam Graph Drux Gis")
      const g = fallbackNamesToGlyphs(names);
      glyphs = g.glyphs;
      glyphChars = g.glyphChars;
      fromDictionary = false;
      fallbacks++;
      note = "phonetic fallback — letter-by-letter spoken-name mapping";
    }

    words.push({
      source: span,
      enochian: enochianWord,
      glyphs,
      glyphChars,
      fromDictionary,
      note,
    });
  }

  return {
    direction: "en->eo",
    input,
    words,
    latinOutput: words.map((w) => w.enochian).join(" "),
    glyphOutput: words.map((w) => w.glyphs).join(`<span style="display:inline-block; width:25.6px;"></span>`),
    dictionaryHits,
    fallbacks,
  };
}

// ---------- Enochian -> English ----------
//
// REVERSE TRANSLATION RULES (per user spec v4):
//
//   1. Reverse dictionary lookup must pull the PRIMARY FULL English phrase
//      from the JSON file — not a partial match. So:
//        BIALO   -> "the voices"
//        GOHULIM -> "are saying"
//        THIL    -> "to talk"
//        NONCI   -> "to you"
//      (lookupEnochian returns the exact English key stored in the JSON,
//      which is the full phrase, so this is automatically correct.)
//
//   2. PHONETIC RECONSTRUCTION: when consecutive Enochian tokens are
//      spoken letter names (e.g. "Gal Graph Drux Gon Fam Un"), they
//      MUST be collapsed back into a single reconstructed English word
//      using the exact reverse map:
//        un->a, pe->b, veh->c, gal->d, graph->e, or->f, ged->g,
//        na->h, gon->i, ur->l, tal->m, drux->n, med->o, mals->p,
//        ger->q, don->r, fam->s, gis->t, van->u, pal->x
//      Example: "Un Ur Gon Veh Graph" -> "alice"
//               "Veh Graph Graph Mals"      -> "ceep"
//
//   3. If a token is neither a dictionary word nor a letter name,
//      fall back to literal glyph-to-Latin transliteration as a
//      last resort.
//
//   4. NO auto-capitalization of the output. The user's expected test
//      output starts with lowercase "alice", so we preserve case as
//      emitted by the rules above (dictionary phrases come from the
//      JSON in their stored case; reconstructed words are lowercase).

export function translateEnochianToEnglish(input: string): TranslationResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const words: TranslatedWord[] = [];
  let dictionaryHits = 0;
  let fallbacks = 0;
  const englishPieces: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const rawTok = tokens[i];
    const upper = rawTok.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (!upper) {
      i++;
      continue;
    }

    // --- Step A: try reverse dictionary lookup (Enochian -> English) ---
    const dictEnglish = lookupEnochian(upper);
    if (dictEnglish !== undefined) {
      // PRIMARY FULL PHRASE from JSON. e.g. BIALO -> "the voices".
      const glyphChars = latinToGlyphs(upper);
      const glyphStr = latinToGlyphString(upper);
      words.push({
        source: rawTok,
        enochian: upper,
        glyphs: glyphStr,
        glyphChars,
        fromDictionary: true,
        english: dictEnglish,
      });
      englishPieces.push(dictEnglish);
      dictionaryHits++;
      i++;
      continue;
    }

    // --- Step B: detect consecutive spoken letter names and collapse ---
    if (isLetterName(rawTok)) {
      // Collect the longest run of consecutive letter-name tokens.
      const nameTokens: string[] = [];
      const rawTokens: string[] = [];
      while (i < tokens.length && isLetterName(tokens[i])) {
        nameTokens.push(tokens[i].replace(/[^A-Za-z]/g, ""));
        rawTokens.push(tokens[i]);
        i++;
      }

      // Collapse each name to its Latin letter (lowercase) using the
      // exact reverse map. Skip any name that doesn't resolve (shouldn't
      // happen because isLetterName already validated them, but guard).
      let reconstructed = "";
      for (const name of nameTokens) {
        const letter = letterNameToLetter(name);
        if (letter) reconstructed += letter;
      }

      // Build SVG glyphs for the whole run (concatenate the inline SVGs
      // that each spoken name produces — same as the forward fallback does).
      const namesStr = nameTokens
        .map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
        .join(" ");
      const glyphChars = namesToGlyphs(namesStr);
      const glyphStr = namesToGlyphString(namesStr);

      const sourceSpan = rawTokens.join(" ");
      words.push({
        source: sourceSpan,
        enochian: rawTokens.join(" "),
        glyphs: glyphStr,
        glyphChars,
        fromDictionary: false,
        english: reconstructed,
        note: `phonetic reconstruction — ${nameTokens.length} letter name${nameTokens.length === 1 ? "" : "s"} collapsed`,
      });
      englishPieces.push(reconstructed);
      fallbacks++;
      // i has already advanced past the run in the inner while loop above.
      continue;
    }

    // --- Step C: last resort — literal glyph transliteration ---
    const literal = glyphsToLatin(upper);
    const glyphChars = latinToGlyphs(upper);
    const glyphStr = latinToGlyphString(upper);
    words.push({
      source: rawTok,
      enochian: upper,
      glyphs: glyphStr,
      glyphChars,
      fromDictionary: false,
      english: literal,
      note: "no dictionary match — literal transliteration",
    });
    englishPieces.push(literal);
    fallbacks++;
    i++;
  }

  // NOTE: no auto-capitalization — user spec test expects lowercase "alice".
  // Dictionary phrase translations are preserved in their exact JSON case.
  const englishOutput = englishPieces.join(" ");

  return {
    direction: "eo->en",
    input,
    words,
    latinOutput: words.map((w) => w.enochian).join(" "),
    glyphOutput: words.map((w) => w.glyphs).join(`<span style="display:inline-block; width:25.6px;"></span>`),
    englishOutput,
    dictionaryHits,
    fallbacks,
  };
}

// ---------- Convenience ----------

export function translate(
  input: string,
  direction: "en->eo" | "eo->en"
): TranslationResult {
  return direction === "en->eo"
    ? translateEnglishToEnochian(input)
    : translateEnochianToEnglish(input);
}

/** Ensure the JSON dictionary has been loaded (client-side). */
export async function loadDictionary(): Promise<void> {
  return ensureDictionaryLoaded();
}

/** True once the JSON dictionary has been loaded. */
export function dictionaryReady(): boolean {
  return isDictionaryLoaded();
}

// ---------- Self-test ----------

/**
 * Test run — proves both JSON phrase-matching AND phonetic fallback work
 * in the forward direction, AND that the reverse direction correctly
 * reconstructs English words from spelled-out letter names AND pulls
 * the primary full phrase from the JSON.
 *
 * Forward Test 1: "Alice, the angels gather out of the highest god"
 *   - "Alice"     -> NOT in dictionary -> fallback -> "Un Ur Gon Veh Graph"
 *   - "the"       -> dictionary word -> "A"
 *   - "angels"    -> dictionary word -> "C"
 *   - "gather"    -> dictionary word -> "COMSELHA"
 *   - "out of"    -> dictionary phrase -> "HE"
 *   - "the highest god" -> dictionary phrase -> "IAIDA"
 *   Expected Step 1: "Un Ur Gon Veh Graph A C COMSELHA HE IAIDA"
 *
 * Forward Test 2: "I am the one who god sent"
 *   - "i"    -> "OL"
 *   - "am"   -> "ZIR"
 *   - "the"  -> "A"
 *   - "one"  -> "L"
 *   - "who"  -> "DS"
 *   - "god"  -> "IAD"
 *   - "sent" -> "DRIX" (yes, "sent" IS in the JSON dictionary -> "drix",
 *              so no fallback needed for this specific test phrase)
 *   Expected Step 1: "OL ZIR A L DS IAD DRIX"
 *
 * REVERSE Test 3 (per user spec v4):
 *   Input:  "Un Ur Gon Veh Graph A C COMSELHA HE IAIDA Veh Graph Graph Mals"
 *   - "Un Ur Gon Veh Graph"         -> 5 consecutive letter names -> "alice"
 *   - "A"                           -> dictionary reverse lookup -> "the"
 *   - "C"                           -> dictionary reverse lookup -> "angels"
 *   - "COMSELHA"                    -> dictionary reverse lookup -> "gather"
 *   - "HE"                          -> dictionary reverse lookup -> "out of"
 *   - "IAIDA"                       -> dictionary reverse lookup -> "the highest god"
 *   - "Veh Graph Graph Mals"        -> 4 consecutive letter names -> "ceep"
 *   Expected English output: "alice the angels gather out of the highest god ceep"
 */
export function runSelfTest(): {
  test1: TranslationResult;
  test2: TranslationResult;
  test3Reverse: TranslationResult;
} {
  return {
    test1: translateEnglishToEnochian(
      "Alice, the angels gather out of the highest god"
    ),
    test2: translateEnglishToEnochian("I am the one who god sent"),
    test3Reverse: translateEnochianToEnglish(
      "Un Ur Gon Veh Graph A C COMSELHA HE IAIDA Veh Graph Graph Mals"
    ),
  };
}
