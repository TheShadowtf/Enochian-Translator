# Enochian Translator

**Live Demo:** [https://enotranslator.netlify.app/](https://enotranslator.netlify.app/)

A bidirectional English ↔ Enochian translator built with Next.js 16, TypeScript, and Tailwind CSS. Reads exclusively from a user-provided JSON dictionary. Traditional Dee-Kelley Enochian letterforms are rendered as inline SVG.

## Quick Start

```bash
# 1. Install dependencies
npm install        # or: bun install

# 2. Run the dev server
npm run dev        # or: bun run dev

# 3. Open http://localhost:3000
```

> **Note:** This archive contains the project source files only. `node_modules/` is not included — run `npm install` (or `bun install`) after extracting to install dependencies.

## What's Included

```
enochian-translator/
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Main translator UI
│   │   ├── layout.tsx                    # Root layout + fonts
│   │   ├── globals.css                   # Tailwind + parchment theme
│   │   └── api/translate/route.ts        # POST/GET translation endpoint
│   └── lib/enochian/
│       ├── dictionary.ts                 # JSON-backed dictionary loader (isomorphic)
│       ├── dictionary-server.ts          # Server-only fs.readFileSync loader
│       ├── glyphs.ts                     # SVG glyph mapping (20 traditional letters)
│       ├── grammar.ts                    # SVO + adjective-after-noun grammar engine
│       └── translator.ts                 # EN<->EO translator + self-tests
├── public/
│   ├── complete_enochian_dictionary.json # 311 entries — the SOLE source of truth
│   └── enochian-glyphs/                  # 21 SVG files (one per traditional letter)
├── scripts/
│   ├── generate_enochian_glyphs.py       # Python script that regenerates the SVGs
│   └── build_contact_sheet.py            # Helper to build a visual review sheet
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── components.json                       # shadcn/ui config
```

## Features

### 1. JSON-Only Dictionary Source
All translations come from `/public/complete_enochian_dictionary.json`. No internal word lists, no external API calls. To add vocabulary, edit that JSON file (or replace it entirely with your own).

### 2. Phrase-Matching-First Tokenizer
Multi-word English phrases are matched before single words. Longest phrases win. So `"the voices"` → `BIALO` (one phrase), not `"the" + "voices"` separately.

### 3. Phonetic Fallback Transliteration
If a word is missing from the JSON dictionary, it's transliterated letter-by-letter using spoken Enochian letter names:

```
a=Un, b=Pe, c=Veh, d=Gal, e=Graph, f=Or, g=Ged, h=Na,
i=Gon, j=Gon, k=Veh, l=Ur, m=Tal, n=Drux, o=Med, p=Mals,
q=Ger, r=Don, s=Fam, t=Gis, u=Van, v=Van, w=Van, x=Pal,
y=Gon, z=Fam
```

Example: `"Alice"` (not in dict) → `"Un Ur Gon Veh Graph"`

### 4. Reverse Direction (Enochian → English)
- Consecutive spoken letter names are collapsed back into a single English word. `"Un Ur Gon Veh Graph"` → `"alice"`
- Reverse dictionary lookup returns the **primary full phrase** (longest multi-word English key). `BIALO` → `"the voices"` (not `"voices"`).

### 5. Traditional Dee-Kelley SVG Glyphs
The Unicode Enochian block (U+10480–U+104A9) does not contain the correct traditional letterforms, so each of the 20 distinct letters is rendered as an inline SVG. Edit the files in `/public/enochian-glyphs/<name>.svg` to refine any glyph shape.

### 6. Two-Step Output
- **Step 1** — Latinised Enochian string (e.g. `Gal Graph Drux Gon Fam Un BIALO GOHULIM THIL NONCI`)
- **Step 2** — Traditional Enochian glyphs rendered as inline SVG

## API

### `POST /api/translate`
```json
// Request body
{ "input": "Alice, the angels gather out of the highest god", "direction": "en->eo" }
// direction: "en->eo" or "eo->en"

// Response (200)
{
  "direction": "en->eo",
  "input": "...",
  "latinOutput": "Gal Graph Drux Gon Fam Un BIALO GOHULIM THIL NONCI",
  "glyphOutput": "<svg>...</svg><svg>...</svg>...",
  "dictionaryHits": 4,
  "fallbacks": 1,
  "words": [ /* per-word breakdown */ ]
}
```

### `GET /api/translate?selfTest=true`
Runs the three built-in self-tests and returns the results as JSON.

### `GET /api/translate?dict=true`
Dumps the entire loaded dictionary.

## Built-in Self-Tests

The app includes three self-tests visible on the homepage:

1. **EN→EO** — `"Alice, the angels gather out of the highest god"` → `Un Ur Gon Veh Graph A C COMSELHA HE IAIDA` (5 dict, 1 fallback)
2. **EN→EO** — `"I am the one who god sent"` → `OL ZIR A L DS IAD DRIX` (7 dict, 0 fallback)
3. **EO→EN** — `"Un Ur Gon Veh Graph A C COMSELHA HE IAIDA Veh Graph Graph Mals"` → `alice the angels gather out of the highest god ceep` (5 dict, 2 fallback — proves phonetic reconstruction + primary-phrase lookup)

## Extending the Dictionary

Edit `/public/complete_enochian_dictionary.json` and add entries:

```json
{
  "your english word": "YOURENOCHIAN",
  "your english phrase": "YOURENOCHIANPHRASE"
}
```

The dictionary is reloaded automatically on the next page load (client-side) or server restart (server-side).

## Regenerating the SVG Glyphs

```bash
python3 scripts/generate_enochian_glyphs.py
```

This writes 21 SVG files to `/public/enochian-glyphs/`. Edit the path data in the Python script to change any glyph's shape, then re-run.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Inline SVG glyphs (no webfont required for Enochian letters)
- Cormorant Garamond + Noto Serif SC for display/body text

## Sources

- Donald Laycock, *The Complete Enochian Dictionary* (revised by Donald Tyson and Lon Milo DuQuette)
- The 48 Angelic Calls of John Dee & Edward Kelley
- The user-provided `complete_enochian_dictionary.json` is the authoritative source for all translations

## Caveats

Enochian is a fragmentary constructed language. This tool is a scholarly approximation for study and experimentation, not authoritative divination.
