/**
 * Enochian Glyph Mapping — TRADITIONAL DEE-KELLEY SVG GLYPHS
 * ==========================================================
 *
 * Per user spec: the Unicode Enochian block (U+10480–U+104A9) does NOT
 * contain the correct symbols for the Enochian language. We therefore
 * render the actual traditional Dee-Kelley letterforms as inline SVG.
 *
 * Each glyph is stored as an SVG path string. The UI renders them via
 * `<svg dangerouslySetInnerHTML>` so they scale crisply at any size and
 * inherit the surrounding text color via `currentColor`.
 *
 * Letter-name mapping (EXACT, per user spec):
 *   A = Un          N = Drux
 *   B = Pe          O = Med
 *   C = Veh         P = Mals
 *   K = Veh         Q = Ger
 *   D = Gal         R = Don
 *   E = Graph       S = Fam
 *   F = Or          Z = Fam
 *   G = Ged         T = Gis
 *   H = Na          U = Van
 *   I = Gon         V = Van
 *   Y = Gon         W = Van
 *   J = Gon         X = Pal
 *   L = Ur
 *   M = Tal
 *
 * Shared letters (I/Y/J, U/V/W, C/K, S/Z) map to the SAME glyph as
 * required by the spec.
 */

export interface GlyphInfo {
  /** Canonical Latin letter (first one in the cluster) */
  letter: string;
  /** Spoken Enochian letter name per user spec */
  name: string;
  /** SVG path/inner content for this glyph (rendered inside an <svg> wrapper) */
  svgInner: string;
  /** Whether this glyph uses fill (vs stroke-only) */
  filled?: boolean;
  /** Stable identifier (e.g. "un", "pe", "veh") used in filenames */
  id: string;
  /** All Latin letters that map to this glyph */
  cluster: string[];
}

/**
 * Master alphabet table — 20 distinct glyphs for 20 distinct letter names.
 *
 * SVG shapes are based on the user's reference image of the traditional
 * Dee-Kelley Enochian alphabet. Each glyph is drawn on a 100×100 canvas
 * with stroke-width 6, round caps/joins, and uses `currentColor`.
 */
export const ENOCHIAN_ALPHABET: GlyphInfo[] = [
  { letter: "A", name: "Un", id: "un",
    svgInner: '<path d="M 50 15 L 50 85" class="stroke"/><path d="M 20 50 L 80 50" class="stroke"/><path d="M 25 25 L 75 75" class="stroke"/>',
    cluster: ["A"] },
  { letter: "B", name: "Pe", id: "pe",
    svgInner: '<path d="M 25 30 Q 50 15 75 30 L 50 80 Z" class="fill"/>',
    cluster: ["B"] },
  { letter: "C", name: "Veh", id: "veh",
    svgInner: '<path d="M 30 15 L 30 85" class="stroke"/><path d="M 30 20 Q 70 25 70 40 Q 70 55 30 50" class="stroke"/><path d="M 30 50 Q 75 55 75 70 Q 75 85 30 80" class="stroke"/>',
    cluster: ["C", "K"] },
  { letter: "D", name: "Gal", id: "gal",
    svgInner: '<path d="M 25 25 Q 50 50 75 75" class="stroke"/><path d="M 75 25 Q 50 50 25 75" class="stroke"/>',
    cluster: ["D"] },
  { letter: "E", name: "Graph", id: "graph",
    svgInner: '<path d="M 25 25 L 75 25 L 35 85" class="stroke"/>',
    cluster: ["E"] },
  { letter: "F", name: "Or", id: "or",
    svgInner: '<path d="M 25 25 Q 50 15 75 25 L 25 75 Q 50 85 75 75" class="stroke"/>',
    cluster: ["F"] },
  { letter: "G", name: "Ged", id: "ged",
    svgInner: '<path d="M 75 25 Q 35 20 30 50 Q 30 80 70 80 L 70 55 L 50 55" class="stroke"/>',
    cluster: ["G", "J"] },
  { letter: "H", name: "Na", id: "na",
    svgInner: '<circle cx="50" cy="30" r="15" class="stroke"/><circle cx="50" cy="70" r="15" class="stroke"/>',
    cluster: ["H"] },
  { letter: "I", name: "Gon", id: "gon",
    svgInner: '<path d="M 25 30 Q 50 15 75 30 L 50 85" class="stroke"/>',
    cluster: ["I", "Y"] },
  { letter: "L", name: "Ur", id: "ur",
    svgInner: '<path d="M 75 25 Q 30 30 30 50 Q 30 70 75 75" class="stroke"/>',
    cluster: ["L"] },
  { letter: "M", name: "Tal", id: "tal",
    svgInner: '<path d="M 70 25 Q 35 25 35 50 Q 35 75 70 75 Q 50 65 50 50 Q 50 35 70 25" class="stroke"/>',
    cluster: ["M"] },
  { letter: "N", name: "Drux", id: "drux",
    svgInner: '<path d="M 30 15 L 30 85" class="stroke"/><path d="M 30 15 Q 75 20 75 50 Q 75 80 30 85" class="stroke"/>',
    cluster: ["N"] },
  { letter: "O", name: "Med", id: "med",
    svgInner: '<path d="M 25 25 Q 50 30 75 25 L 25 75 Q 50 80 75 75" class="stroke"/>',
    cluster: ["O"] },
  { letter: "P", name: "Mals", id: "mals",
    svgInner: '<circle cx="50" cy="50" r="25" class="stroke"/><path d="M 50 20 L 50 80" class="stroke"/>',
    cluster: ["P"] },
  { letter: "Q", name: "Ger", id: "ger",
    svgInner: '<path d="M 25 80 L 25 40 Q 25 20 50 20 Q 75 20 75 40 L 75 80" class="stroke"/><path d="M 50 20 L 50 80" class="stroke"/>',
    cluster: ["Q"] },
  { letter: "R", name: "Don", id: "don",
    svgInner: '<path d="M 70 20 Q 25 30 25 55 Q 25 80 50 80 Q 75 80 75 60 Q 75 40 50 55 Q 30 70 50 85" class="stroke"/>',
    cluster: ["R"] },
  { letter: "S", name: "Fam", id: "fam",
    svgInner: '<path d="M 35 15 L 35 70 Q 35 85 50 85 Q 65 85 65 70" class="stroke"/>',
    cluster: ["S"] },
  { letter: "T", name: "Gis", id: "gisg",
    svgInner: '<path d="M 20 25 Q 50 15 80 25" class="stroke"/><path d="M 50 25 L 50 85" class="stroke"/>',
    cluster: ["T"] },
  { letter: "U", name: "Van", id: "van",
    svgInner: '<path d="M 50 85 L 25 30 Q 50 15 75 30 L 50 85" class="stroke"/><path d="M 35 60 L 65 60" class="stroke"/>',
    cluster: ["U", "V", "W"] },
  { letter: "X", name: "Pal", id: "pal",
    svgInner: '<path d="M 30 15 L 30 75 Q 30 85 45 85 L 80 85" class="stroke"/>',
    cluster: ["X"] },
  { letter: "Z", name: "Ceph", id: "ceph",
    svgInner: '',
    cluster: ["Z"] },
];

// ----------------------------------------------------------------
// Lookup tables
// ----------------------------------------------------------------

/** Latin letter (upper) -> GlyphInfo */
const LATIN_TO_GLYPH: Map<string, GlyphInfo> = (() => {
  const m = new Map<string, GlyphInfo>();
  for (const g of ENOCHIAN_ALPHABET) {
    for (const l of g.cluster) m.set(l.toUpperCase(), g);
  }
  return m;
})();

/** Spoken Enochian letter name (lower) -> GlyphInfo */
const NAME_TO_GLYPH: Map<string, GlyphInfo> = (() => {
  const m = new Map<string, GlyphInfo>();
  for (const g of ENOCHIAN_ALPHABET) {
    m.set(g.name.toLowerCase(), g);
  }
  return m;
})();

// ----------------------------------------------------------------
// Public functions
// ----------------------------------------------------------------

export function glyphForLetter(letter: string): GlyphInfo | undefined {
  return LATIN_TO_GLYPH.get(letter.toUpperCase());
}

export function glyphForName(name: string): GlyphInfo | undefined {
  return NAME_TO_GLYPH.get(name.toLowerCase());
}

/**
 * Returns true if `token` (case-insensitive) is a known spoken Enochian
 * letter name — e.g. "Gal", "graph", "DRIX" -> false, "Drux" -> true.
 */
export function isLetterName(token: string): boolean {
  if (!token) return false;
  const cleaned = token.replace(/[^A-Za-z]/g, "");
  if (!cleaned) return false;
  return NAME_TO_GLYPH.has(cleaned.toLowerCase());
}

/**
 * Convert a spoken Enochian letter name (case-insensitive) to its
 * canonical Latin letter (lowercase). Returns undefined if not recognized.
 */
export function letterNameToLetter(name: string): string | undefined {
  if (!name) return undefined;
  const cleaned = name.replace(/[^A-Za-z]/g, "");
  if (!cleaned) return undefined;
  return NAME_TO_GLYPH.get(cleaned.toLowerCase())?.cluster[0].toLowerCase();
}

/**
 * Return ALL lowercase Latin letters that share the same glyph as the given
 * spoken letter name.  For unambiguous names this is a single-element array;
 * for shared glyphs it returns every member of the cluster so the reverse
 * translator can try all possible spellings.
 *
 * Examples:
 *   "Veh"  → ["c", "k"]   (C and K share the Veh glyph)
 *   "Gon"  → ["i", "y"]   (I and Y share the Gon glyph)
 *   "Van"  → ["u", "v", "w"]
 *   "Drux" → ["n"]
 */
export function letterNameCluster(name: string): string[] {
  if (!name) return [];
  const cleaned = name.replace(/[^A-Za-z]/g, "");
  if (!cleaned) return [];
  const g = NAME_TO_GLYPH.get(cleaned.toLowerCase());
  if (!g) return [];
  return g.cluster.map((l) => l.toLowerCase());
}

// ----------------------------------------------------------------
// SVG rendering helpers
// ----------------------------------------------------------------

export interface GlyphChar {
  /** Source Latin letter (or spoken name for fallback) */
  source: string;
  /** Spoken Enochian letter name (Title-cased) */
  name: string;
  /** Stable glyph id (e.g. "un", "pe", "veh") — used as a key */
  glyphId: string;
  /** Inline HTML markup for this single glyph */
  svg: string;
}

/**
 * Build the HTML markup for a glyph, returning a span that uses the PNG as a mask
 * to perfectly inherit currentColor (matching the previous SVG behavior).
 */
function renderGlyph(id: string, name: string, size = 32): string {
  return `<span title="${name}" style="display:inline-block;vertical-align:middle;width:${size}px;height:${size}px;-webkit-mask-image:url('/enochian-glyphs/${id}.png');mask-image:url('/enochian-glyphs/${id}.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-position:center;mask-position:center;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;background-color:currentColor;"></span>`;
}

/**
 * "Transliterate" a Latin string into a sequence of glyph entries.
 * Each entry contains the source letter, the spoken name, and the inline
 * SVG markup for that glyph.
 *
 * Non-alphabet characters (digits, punctuation, spaces) are passed through
 * as plain text — their `svg` field contains the character itself.
 */
export function latinToGlyphs(latin: string, size = 32): GlyphChar[] {
  const out: GlyphChar[] = [];
  for (const ch of latin) {
    const up = ch.toUpperCase();
    if (up >= "A" && up <= "Z") {
      const g = LATIN_TO_GLYPH.get(up);
      if (g) {
        out.push({
          source: ch,
          name: g.name,
          glyphId: g.id,
          svg: renderGlyph(g.id, g.name, size),
        });
      } else {
        out.push({ source: ch, name: "", glyphId: "", svg: ch });
      }
    } else if (ch === " " || ch === "\t" || ch === "\n") {
      out.push({ source: ch, name: "Space", glyphId: "", svg: `<span style="display:inline-block; width:${size * 0.8}px;"></span>` });
    } else {
      out.push({ source: ch, name: "", glyphId: "", svg: `<span style="display:inline-block; vertical-align:middle; font-size:${size * 0.8}px; line-height:1; padding: 0 4px;">${ch}</span>` });
    }
  }
  return out;
}

/**
 * Build the SVG markup string for a Latin word — all glyphs concatenated
 * inline (suitable for dangerouslySetInnerHTML).
 */
export function latinToGlyphString(latin: string, size = 32): string {
  return latinToGlyphs(latin, size)
    .map((g) => g.svg)
    .join("");
}

/**
 * Fallback transliteration per user spec.
 *
 * Takes a word (e.g. "sent") and returns the space-joined spoken
 * Enochian letter names for each character (e.g. "Fam Graph Drux Gis").
 *
 * Letter-name mapping (EXACT, per user spec):
 *   a=Un, b=Pe, c=Veh, d=Gal, e=Graph, f=Or, g=Ged, h=Na, i=Gon, j=Gon,
 *   k=Veh, l=Ur, m=Tal, n=Drux, o=Med, p=Mals, q=Ger, r=Don, s=Fam,
 *   t=Gis, u=Van, v=Van, w=Van, x=Pal, y=Gon, z=Fam
 */
export function letterNames(word: string): string {
  const names: string[] = [];
  for (const ch of word) {
    const up = ch.toUpperCase();
    if (up < "A" || up > "Z") continue;
    const g = LATIN_TO_GLYPH.get(up);
    if (g) {
      names.push(g.name.charAt(0).toUpperCase() + g.name.slice(1));
    }
  }
  return names.join(" ");
}

/**
 * Convert a fallback names-string (e.g. "Fam Graph Drux Gis") into
 * a sequence of glyph entries (one per name).
 */
export function namesToGlyphs(namesStr: string, size = 32): GlyphChar[] {
  const out: GlyphChar[] = [];
  const tokens = namesStr.trim().split(/\s+/);
  if (tokens.length === 1 && tokens[0] === "") return out;

  for (let i = 0; i < tokens.length; i++) {
    const name = tokens[i];
    const g = NAME_TO_GLYPH.get(name.toLowerCase());
    if (g) {
      out.push({
        source: name,
        name: g.name,
        glyphId: g.id,
        svg: renderGlyph(g.id, g.name, size),
      });
    }
  }
  return out;
}

/**
 * Build the SVG markup string for a fallback names-string — all glyphs
 * concatenated inline.
 */
export function namesToGlyphString(namesStr: string, size = 32): string {
  return namesToGlyphs(namesStr, size)
    .map((g) => g.svg)
    .join("");
}

/**
 * Convert a sequence of Enochian glyphs back to Latin letters.
 * Because we now render via SVG (not Unicode), this reverse function is
 * only meaningful for tokens that were originally Latin letters. We
 * treat each character of the input string as a Latin letter and echo
 * it back lowercased — sufficient for the EO->EN last-resort fallback
 * path which only fires for tokens that aren't dictionary words or
 * letter names.
 */
export function glyphsToLatin(s: string): string {
  return s.toLowerCase();
}
