/**
 * Enochian Grammar Engine — REBUILT per user spec
 * ===============================================
 *
 * Rules implemented:
 *   1. SVO word order is preserved (English input is already SVO,
 *      so this is largely an identity pass — but we expose the hook
 *      so future heuristics can reorder non-SVO input).
 *   2. Adjectives are MOVED to come AFTER the noun they modify.
 *      e.g. "Holy Angel"  ->  [Angel][Holy]
 *           "the mighty lord"  ->  [the][lord][mighty]
 *   3. Plurals: if the English word ends in -s and is NOT in the
 *      dictionary, strip the -s and look up the singular root.
 *      If the root is found, we still emit the root Enochian word
 *      (Enochian plurals are irregular and often the same as the
 *      singular; explicit plural forms are handled in the dictionary).
 *   4. "To be" conjugations are pre-mapped in the dictionary
 *      (is=i, are=chis, am=zir, was/were=ged, be/been=caos).
 */

import { lookupEnglish, type PartOfSpeech } from "./dictionary";

// ---------- Tokenisation ----------

export interface Token {
  /** Lower-cased surface form (no punctuation) */
  text: string;
  /** Original surface form (preserves case + punctuation) */
  raw: string;
  /** Leading whitespace */
  leading: string;
  /** Trailing punctuation (e.g. . , ! ?) */
  trailingPunct: string;
}

/** Split a string into tokens, preserving whitespace + punctuation. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  // Match: leading whitespace, word chars (incl apostrophes for "it's"),
  // trailing punctuation.
  const re = /(\s*)([A-Za-z][A-Za-z']*)([^\sA-Za-z]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const [, leading, word, trailing] = m;
    tokens.push({
      leading: leading ?? "",
      raw: word ?? "",
      text: (word ?? "").toLowerCase(),
      trailingPunct: trailing ?? "",
    });
  }
  return tokens;
}

// ---------- Part-of-speech tagging ----------

export interface TaggedToken extends Token {
  part: PartOfSpeech | "unknown";
  /** True if dictionary contained this exact word */
  inDictionary: boolean;
  /** True if this token is the result of plural-stripping */
  strippedPlural: boolean;
  /** Original plural form (when strippedPlural is true) */
  originalPlural?: string;
}

/** English function-word back-off table (helps when word not in dict). */
const FUNCTION_WORDS: Record<string, PartOfSpeech> = {
  the: "article", a: "article", an: "article",
  of: "preposition", in: "preposition", to: "preposition",
  for: "preposition", with: "preposition", on: "preposition",
  at: "preposition", by: "preposition", from: "preposition",
  into: "preposition", upon: "preposition", under: "preposition",
  over: "preposition", above: "preposition", below: "preposition",
  before: "preposition", after: "preposition", through: "preposition",
  among: "preposition", between: "preposition",
  and: "conjunction", or: "conjunction", but: "conjunction",
  nor: "conjunction", so: "conjunction", yet: "conjunction",
  i: "pronoun", you: "pronoun", he: "pronoun", she: "pronoun",
  it: "pronoun", we: "pronoun", they: "pronoun",
  my: "pronoun", your: "pronoun", his: "pronoun", her: "pronoun",
  their: "pronoun", our: "pronoun", me: "pronoun", him: "pronoun",
  us: "pronoun", them: "pronoun", this: "pronoun", that: "pronoun",
  these: "pronoun", those: "pronoun", who: "pronoun", what: "pronoun",
  which: "pronoun",
  is: "verb", are: "verb", am: "verb", was: "verb", were: "verb",
  be: "verb", been: "verb", being: "verb",
  have: "verb", has: "verb", had: "verb",
  do: "verb", does: "verb", did: "verb",
  shall: "verb", will: "verb", would: "verb", should: "verb",
  can: "verb", could: "verb", may: "verb", might: "verb", must: "verb",
  not: "adverb", no: "adverb", yes: "adverb",
  now: "adverb", then: "adverb", here: "adverb", there: "adverb",
  always: "adverb", never: "adverb", very: "adverb",
  behold: "interjection", lo: "interjection",
  o: "interjection", oh: "interjection",
};

/** Tag tokens. Handles plural-stripping for unknown -s words. */
export function tagTokens(tokens: Token[]): TaggedToken[] {
  return tokens.map((t) => {
    // 1. Try direct dictionary lookup
    const direct = lookupEnglish(t.text);
    if (direct.length > 0) {
      return {
        ...t,
        part: direct[0].part,
        inDictionary: true,
        strippedPlural: false,
      };
    }

    // 2. Try function-word table
    const fw = FUNCTION_WORDS[t.text];
    if (fw) {
      return { ...t, part: fw, inDictionary: false, strippedPlural: false };
    }

    // 3. Plural strip: if word ends in -s, strip and retry dictionary
    if (t.text.length > 3 && t.text.endsWith("s") && !t.text.endsWith("ss")) {
      const singular = t.text.slice(0, -1);
      const rootMatches = lookupEnglish(singular);
      if (rootMatches.length > 0) {
        return {
          ...t,
          text: singular,
          part: rootMatches[0].part,
          inDictionary: true,
          strippedPlural: true,
          originalPlural: t.text,
        };
      }
    }

    // 4. Heuristics for unknown words
    let part: PartOfSpeech | "unknown" = "unknown";
    if (/ing$/.test(t.text)) part = "verb";
    else if (/ed$/.test(t.text)) part = "verb";
    else if (/ly$/.test(t.text)) part = "adverb";
    else if (/'s$/.test(t.text)) part = "pronoun";
    else part = "noun"; // default guess — most open-class words are nouns

    return { ...t, part, inDictionary: false, strippedPlural: false };
  });
}

// ---------- SVO normalisation ----------

/**
 * Preserve SVO order. English is already SVO so this is an identity
 * pass — the function exists as a structural hook for future
 * reordering heuristics (e.g. if we ever accept OSV queries).
 */
export function normaliseSVO(tokens: TaggedToken[]): TaggedToken[] {
  return tokens;
}

// ---------- Adjective-after-noun ----------

/**
 * Move adjectives to come AFTER the noun they modify.
 *
 * Patterns handled:
 *   [adj] [noun]      ->  [noun] [adj]
 *   [article] [adj] [noun]  ->  [article] [noun] [adj]
 *
 * e.g. "Holy Angel"           ->  Angel Holy
 *      "the mighty lord"      ->  the lord mighty
 *      "the eternal heavens"  ->  the heavens eternal
 */
export function adjectivesAfterNouns(tokens: TaggedToken[]): TaggedToken[] {
  const out: TaggedToken[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    // Pattern A: [article?] [adj] [noun]
    if (
      t.part === "adjective" &&
      i + 1 < tokens.length &&
      tokens[i + 1].part === "noun"
    ) {
      const adj = t;
      const noun = tokens[i + 1];
      out.push(noun, adj);
      i += 2;
      continue;
    }

    // Pattern B: [article] [adj] [noun]  ->  [article] [noun] [adj]
    if (
      t.part === "article" &&
      i + 2 < tokens.length &&
      tokens[i + 1].part === "adjective" &&
      tokens[i + 2].part === "noun"
    ) {
      const article = t;
      const adj = tokens[i + 1];
      const noun = tokens[i + 2];
      out.push(article, noun, adj);
      i += 3;
      continue;
    }

    out.push(t);
    i++;
  }
  return out;
}
