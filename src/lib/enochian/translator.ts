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
  letterNameCluster,
  type GlyphChar,
} from "./glyphs";

// ---------- English word set (for spelling disambiguation) ----------

/**
 * A Set of lowercase English words loaded from `an-array-of-english-words`.
 * Null until loadDictionary() has been called on the client.
 */
let englishWordSet: Set<string> | null = null;

/**
 * Cartesian product of per-position letter options.
 * The first element of each options array is always the canonical (cluster[0])
 * letter, so spellings[0] is always the canonical reconstruction.
 */
function generateSpellings(positions: string[][]): string[] {
  let results: string[] = [""];
  for (const options of positions) {
    const next: string[] = [];
    for (const prefix of results) {
      for (const letter of options) {
        next.push(prefix + letter);
      }
    }
    results = next;
  }
  return results;
}

/**
 * Given an array of spoken Enochian letter-name tokens (e.g. ["Veh","Gon","Drux","Gal","Un"]),
 * return the best English spelling by:
 *   1. Building the per-position cluster alternatives.
 *   2. If no ambiguity exists, return the canonical form immediately.
 *   3. Otherwise generate all variant spellings (canonical first) and return
 *      the first one found in the English word set.
 *   4. Fall back to the canonical form if no variant is a known word.
 *
 * This disambiguates C/K, I/Y, U/V/W, G/J without requiring a custom database.
 */
function findBestSpelling(nameTokens: string[]): string {
  return findBestSpellingWithScore(nameTokens).spelling;
}

/**
 * Like findBestSpelling but also returns a penalty score: the number of
 * non-canonical letter substitutions used (i.e. positions where a non-first
 * cluster member was chosen).  A lower score means a more "natural" spelling.
 *
 * Used by the penalty-aware DP in segmentLetterNameTokens so that the
 * globally cheapest partition is preferred over the locally first-found one.
 *
 * Example:
 *   "shy"  [Fam,Na,Gon] → Gon→Y (non-canonical, canonical is I) → penalty 1
 *   "shit" [Fam,Na,Gon,Gis] → Gon→I (canonical)                 → penalty 0
 */
function findBestSpellingWithScore(
  nameTokens: string[]
): { spelling: string; penalty: number } {
  const positions: string[][] = nameTokens.map((name) => {
    const cluster = letterNameCluster(name);
    return cluster.length > 0 ? cluster : [letterNameToLetter(name) ?? "?"];
  });

  const canonical = positions.map((opts) => opts[0]).join("");

  if (!englishWordSet || positions.every((opts) => opts.length === 1)) {
    return { spelling: canonical, penalty: 0 };
  }

  const hasAmbiguity = positions.some((opts) => opts.length > 1);
  if (!hasAmbiguity) return { spelling: canonical, penalty: 0 };

  const spellings = generateSpellings(positions);
  for (const spelling of spellings) {
    if (englishWordSet.has(spelling)) {
      // Count how many letters deviate from the canonical (cluster[0]) choice.
      let penalty = 0;
      for (let k = 0; k < spelling.length; k++) {
        if (spelling[k] !== positions[k][0]) penalty++;
      }
      return { spelling, penalty };
    }
  }

  return { spelling: canonical, penalty: 0 };
}

/**
 * Word-Break DP: given a flat array of consecutive spoken letter-name tokens,
 * partition them into groups where each group's best spelling is a word in the
 * English word set.
 *
 * Uses a PENALTY-AWARE DP: rather than taking the first valid partition found,
 * it scores every candidate partition by the total number of non-canonical
 * letter substitutions across all word segments and picks the minimum-penalty
 * complete partition.  This ensures that "shit" (penalty 0, Gon→I canonical)
 * beats "shy" (penalty 1, Gon→Y non-canonical) even though "shy" appears at
 * an earlier position in the token stream.
 *
 * Example:
 *   ["Fam","Na","Gon","Gis","Gon","Gis","Van","Med","Don","Veh","Fam"]
 *   "shy tit works" = penalty 1+0+2 = 3
 *   "shit it works" = penalty 0+0+2 = 2  ← chosen
 *
 * Falls back to [[...allTokens]] (one big group) when the word set is not
 * loaded or no valid partition exists.
 */
function segmentLetterNameTokens(nameTokens: string[]): string[][] {
  const n = nameTokens.length;
  if (n === 0) return [];

  if (!englishWordSet) {
    return [nameTokens];
  }

  // Composite score per segment (lower = better):
  //   10 000  — flat cost per word (strongly prefer fewer words)
  //   × 100   — each non-canonical letter substitution (e.g. Gon→Y instead of I)
  //   + max(0, 3 − segLength) — brevity penalty: words shorter than 3 letters
  //                              are mildly penalised so that "shit" beats "sh"
  //                              even when both have penalty 0.
  //
  // Example:
  //   "sh  i  tit  u  orcs" = 5×10000 + 0×100 + (1+2+0+2+0) = 50 005
  //   "sh  it  works"        = 3×10000 + 2×100 + (1+1+0)     = 30 202
  //   "shit  it  works"      = 3×10000 + 2×100 + (0+1+0)     = 30 201  ← chosen
  const SEG_COST = 10_000;
  const PENALTY_WEIGHT = 100;

  // dp[i] = { from: j, score: cumulative } for the min-score way to reach i.
  const dp: ({ from: number; score: number } | undefined)[] = new Array(
    n + 1
  ).fill(undefined);
  dp[0] = { from: -1, score: 0 };

  for (let i = 1; i <= n; i++) {
    for (let j = 0; j < i; j++) {
      const prev = dp[j];
      if (!prev) continue;
      const segment = nameTokens.slice(j, i);
      const { spelling, penalty: segPenalty } = findBestSpellingWithScore(segment);
      if (englishWordSet.has(spelling)) {
        const brevity = Math.max(0, 3 - segment.length);
        const segScore = SEG_COST + segPenalty * PENALTY_WEIGHT + brevity;
        const totalScore = prev.score + segScore;
        if (!dp[i] || totalScore < dp[i].score) {
          dp[i] = { from: j, score: totalScore };
        }
      }
    }
  }

  if (!dp[n]) {
    return [nameTokens]; // no valid partition — fall back to one big group
  }

  // Reconstruct the optimal segmentation by following predecessor links
  const segments: string[][] = [];
  let i = n;
  while (i > 0) {
    const { from: j } = dp[i]!;
    segments.unshift(nameTokens.slice(j, i));
    i = j;
  }
  return segments;
}

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
  /**
   * For en->eo direction only: the Golden Dawn pronunciation string.
   */
  pronunciation?: string;
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
  /** Pronunciation output (only for en->eo) */
  pronunciationOutput?: string;
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
    let pronunciation: string;

    if (dictValue !== undefined) {
      // Dictionary hit — use the JSON's enochian value verbatim.
      enochianWord = dictValue.enochian.toUpperCase();
      pronunciation = dictValue.pronunciation;
      glyphChars = latinToGlyphs(enochianWord);
      glyphs = latinToGlyphString(enochianWord);
      fromDictionary = true;
      dictionaryHits++;
    } else {
      // FALLBACK: spell out using spoken Enochian letter names.
      // E.g. "sent" -> "Fam Graph Drux Gis"
      const names = letterNames(span);
      enochianWord = names; // keep title-case names (e.g. "Fam Graph Drux Gis")
      
      // The pronunciation must evaluate the translated Enochian string (Step 1 output).
      // Split it into individual letter names, check the dictionary for each.
      const nameParts = names.split(" ");
      const namePronunciations = nameParts.map(part => {
        const pDict = lookupEnglish(part.toLowerCase());
        if (pDict && pDict.pronunciation) {
          return pDict.pronunciation;
        }
        return part; // Return the word itself if not found
      });
      pronunciation = namePronunciations.join(" ");
      
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
      pronunciation,
      glyphs,
      glyphChars,
      fromDictionary,
      note,
    });
  }

  // Use "/" as a word-boundary separator in the latin output so that the
  // reverse translator can tell where one phonetic-fallback word ends and
  // the next begins.  Dictionary words don't need it but we include it
  // uniformly so the separator is always present between words.
  const latinOutput = words.map((w) => w.enochian).join(" ");
  const pronunciationOutput = words.map((w) => w.pronunciation).join(" ");

  return {
    direction: "en->eo",
    input,
    words,
    latinOutput,
    glyphOutput: words.map((w) => w.glyphs).join(`<span style="display:inline-block; width:25.6px;"></span>`),
    pronunciationOutput,
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

    // --- Step B: collect consecutive letter-name tokens, then segment ---
    // Collect the entire run of consecutive letter names, then use DP word
    // segmentation (segmentLetterNameTokens) to split the run into groups
    // that each decode to a valid English word.  This replaces the old
    // "/"-separator approach — no separator in the output is needed.
    if (isLetterName(rawTok)) {
      const allNameTokens: string[] = [];
      const allRawTokens: string[] = [];
      while (i < tokens.length && isLetterName(tokens[i])) {
        allNameTokens.push(tokens[i].replace(/[^A-Za-z]/g, ""));
        allRawTokens.push(tokens[i]);
        i++;
      }

      // Segment the run into word-sized groups
      const segments = segmentLetterNameTokens(allNameTokens);

      let rawIdx = 0;
      for (const segment of segments) {
        const reconstructed = findBestSpelling(segment);
        const segRawTokens = allRawTokens.slice(rawIdx, rawIdx + segment.length);
        rawIdx += segment.length;

        const namesStr = segment
          .map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
          .join(" ");
        const glyphChars = namesToGlyphs(namesStr);
        const glyphStr = namesToGlyphString(namesStr);
        const sourceSpan = segRawTokens.join(" ");

        words.push({
          source: sourceSpan,
          enochian: segRawTokens.join(" "),
          glyphs: glyphStr,
          glyphChars,
          fromDictionary: false,
          english: reconstructed,
          note: `phonetic reconstruction — ${segment.length} letter name${segment.length === 1 ? "" : "s"} collapsed`,
        });
        englishPieces.push(reconstructed);
        fallbacks++;
      }
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

/** Ensure the JSON dictionary and English word list have been loaded (client-side). */
export async function loadDictionary(): Promise<void> {
  await ensureDictionaryLoaded();
  // Also load the English word list for spelling disambiguation in eo->en.
  // Dynamic import keeps it out of the SSR bundle.
  if (!englishWordSet) {
    try {
      const mod = await import("an-array-of-english-words");
      const arr: string[] = mod.default ?? mod;
      englishWordSet = new Set<string>(arr);
    } catch {
      // Graceful degradation: word set unavailable, canonical spelling is used.
      englishWordSet = new Set<string>();
    }
  }
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
