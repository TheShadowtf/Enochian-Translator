'use client';

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import {
  translate,
  runSelfTest,
  loadDictionary,
  type TranslationResult,
  type TranslatedWord,
} from "@/lib/enochian/translator";
import { allEntries, dictionarySize, type DictionaryEntry } from "@/lib/enochian/dictionary";
import { ENOCHIAN_ALPHABET, latinToGlyphString } from "@/lib/enochian/glyphs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

type Direction = "en->eo" | "eo->en";

const EXAMPLES: Record<Direction, string[]> = {
  "en->eo": [
    "Denisa, the voices are saying to talk to you",
    "I am the one who god sent",
    "holy angel",
    "the righteous angels",
    "behold the flame",
  ],
  "eo->en": [
    "Gal Graph Drux Gon Fam Un BIALO Veh Graph Graph Mals GOHULIM THIL NONCI",
    "BIALO GOHULIM THIL NONCI",
    "OL ZIR A L DS IAD DRIX",
    "G PIR",
    "MICMA PRGE",
  ],
};

/**
 * Render an HTML string of inline-SVG glyphs safely.
 *
 * The glyph strings come from our own glyphs.ts module (not user input),
 * so dangerouslySetInnerHTML is safe here.
 */
function GlyphSvg({ html, className }: { html: string; className?: string }) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "0.1em" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function Home() {
  const [direction, setDirection] = useState<Direction>("en->eo");
  const [input, setInput] = useState(
    "Denisa, the voices are saying to talk to you"
  );
  const deferredInput = useDeferredValue(input);
  const [dictFilter, setDictFilter] = useState("");
  const deferredDictFilter = useDeferredValue(dictFilter);
  const [dictLoaded, setDictLoaded] = useState(false);
  const [dictVersion, setDictVersion] = useState(0);

  // On the client, fetch the JSON dictionary from /complete_enochian_dictionary.json
  // before allowing translation. On the server the dict is loaded synchronously
  // by the dictionary module, so this is a no-op there.
  useEffect(() => {
    let mounted = true;
    loadDictionary().then(() => {
      if (mounted) {
        setDictLoaded(true);
        setDictVersion((v) => v + 1);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Re-run self-test whenever the dictionary reloads.
  const selfTest = useMemo(() => {
    if (!dictLoaded && typeof window !== "undefined") return null;
    return runSelfTest();
     
  }, [dictLoaded, dictVersion]);

  // Live translation (recomputed whenever input, direction, or dict changes).
  const result = useMemo(() => {
    if (!dictLoaded && typeof window !== "undefined") return null;
    if (!deferredInput.trim()) return null;
    return translate(deferredInput, direction);
     
  }, [deferredInput, direction, dictLoaded, dictVersion]);

  const dictionary = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dictVersion; // re-evaluate when dict reloads
    const all = allEntries() as DictionaryEntry[];
    const f = deferredDictFilter.trim().toLowerCase();
    
    let matches = all;
    if (f) {
      matches = all.filter(
        (e) =>
          e.enochian.toLowerCase().includes(f) ||
          e.english.toLowerCase().includes(f)
      );
    }
    
    // LIMIT to 50 results to prevent massive DOM rendering which causes typing lag
    return matches.slice(0, 50);
  }, [deferredDictFilter, dictVersion]);

  function swapDirection() {
    const next: Direction = direction === "en->eo" ? "eo->en" : "en->eo";
    if (result) {
      if (next === "eo->en") setInput(result.latinOutput);
      else setInput(result.englishOutput ?? "");
    }
    setDirection(next);
  }

  const dictCount = dictionarySize();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ---------- HERO HEADER ---------- */}
      <header className="parchment-card border-b border-burgundy/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-center">
          <div className="ornament-divider mb-4">
            <GlyphSvg html={latinToGlyphString("GOM", 24)} className="text-gold" />
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl md:text-6xl font-bold text-ink leading-tight">
            Enochian Translator
          </h1>
          <p className="font-serif-display text-lg sm:text-xl text-ink-soft mt-2 italic">
            The Angelic Language of John Dee &amp; Edward Kelley
          </p>
          <p className="text-sm text-ink-soft mt-4 max-w-2xl mx-auto leading-relaxed">
            Reads <strong>exclusively</strong> from{" "}
            <code className="bg-white/50 px-1 py-0.5 rounded text-burgundy text-xs">
              /public/complete_enochian_dictionary.json
            </code>
            {" "}— no internal word lists, no external APIs. Multi-word phrases
            are matched first (longest-first), missing words fall back to
            letter-by-letter spoken Enochian letter-name transliteration
            (e.g. &ldquo;sent&rdquo; → &ldquo;Fam Graph Drux Gis&rdquo;).
            Two-step output: Latinised Enochian + traditional Dee-Kelley glyphs
            (rendered as inline SVG).
          </p>
          <div className="ornament-divider mt-6">
            <GlyphSvg html={latinToGlyphString("CDR", 20)} className="text-gold" />
          </div>
        </div>
      </header>

      {/* ---------- MAIN CONTENT ---------- */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* ---------- DICTIONARY STATUS ---------- */}
        <div className="text-center">
          <Badge
            variant="outline"
            className={
              dictLoaded
                ? "border-burgundy/40 text-burgundy"
                : "border-gold/50 text-gold"
            }
          >
            {dictLoaded
              ? `JSON dictionary loaded — ${dictCount} entries`
              : "Loading JSON dictionary…"}
          </Badge>
        </div>

        {/* ---------- TRANSLATOR CARD ---------- */}
        <Card className="parchment-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="font-serif-display text-2xl text-ink">
                Translator
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-burgundy/40 text-burgundy capitalize"
                >
                  {direction === "en->eo" ? "English → Enochian" : "Enochian → English"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={swapDirection}
                  className="border-burgundy/40 text-burgundy hover:bg-burgundy/10"
                  aria-label="Swap translation direction"
                >
                  ⇄ Swap
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Direction tabs */}
            <Tabs
              value={direction}
              onValueChange={(v) => setDirection(v as Direction)}
            >
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="en->eo">English → Enochian</TabsTrigger>
                <TabsTrigger value="eo->en">Enochian → English</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-soft">
                {direction === "en->eo" ? "English input" : "Enochian input (Latin letters)"}
              </label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  direction === "en->eo"
                    ? "Type an English sentence…"
                    : "Type Enochian words in Latin letters, e.g. OL ZIR A L DS IAD DRIX…"
                }
                rows={3}
                className="bg-white/60 border-burgundy/30 text-ink font-mono text-base resize-y"
              />
              {/* Example chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {EXAMPLES[direction].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="text-xs px-2.5 py-1 rounded-full border border-gold/40 text-burgundy hover:bg-gold/10 transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Output */}
            {result && <OutputDisplay result={result} />}
          </CardContent>
        </Card>

        {/* ---------- SELF-TEST / DEMO CARD ---------- */}
        {/* 
        {selfTest && (
          <Card className="parchment-card">
            <CardHeader>
              <CardTitle className="font-serif-display text-2xl text-ink">
                Self-Test — JSON Dictionary + Phonetic Fallback + Reverse Reconstruction
              </CardTitle>
              <p className="text-sm text-ink-soft mt-1">
                Three built-in tests: two forward (EN→EO) proving JSON
                phrase-matching and the spoken-letter-name fallback, and one
                reverse (EO→EN) proving that consecutive letter names collapse
                back into a single English word AND that the dictionary returns
                the primary full phrase (e.g. BIALO → &ldquo;the voices&rdquo;,
                not just &ldquo;voices&rdquo;).
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <SelfTestBlock
                title="Test 1 — EN→EO — “Denisa, the voices are saying to talk to you”"
                blurb="‘Denisa’ is NOT in the JSON dictionary → falls back to spoken letter names: D=Gal, e=Graph, n=Drux, i=Gon, s=Fam, a=Un → ‘Gal Graph Drux Gon Fam Un’. Then the multi-word phrase matcher kicks in for ‘the voices’→BIALO, ‘are saying’→GOHULIM, ‘to talk’→THIL, ‘to you’→NONCI."
                result={selfTest.test1}
              />
              <Separator className="bg-burgundy/20" />
              <SelfTestBlock
                title="Test 2 — EN→EO — “I am the one who god sent”"
                blurb="Every word in this sentence IS in the JSON dictionary: i→OL, am→ZIR, the→A, one→L, who→DS, god→IAD, sent→DRIX. Note that ‘sent’ happens to be in the JSON (value ‘drix’), so no fallback is needed for this specific phrase — proving the dictionary takes priority over the fallback rule."
                result={selfTest.test2}
              />
              <Separator className="bg-burgundy/20" />
              <SelfTestBlock
                title="Test 3 — EO→EN — Reverse reconstruction + primary-phrase lookup"
                blurb="Reverse direction: ‘Gal Graph Drux Gon Fam Un’ is 6 consecutive letter names → collapsed back to ‘denisa’. ‘Veh Graph Graph Mals’ → ‘ceep’. BIALO/GOHULIM/THIL/NONCI pull the PRIMARY FULL phrase from the JSON (‘the voices’, ‘are saying’, ‘to talk’, ‘to you’) — NOT the partial single-word matches."
                result={selfTest.test3Reverse}
                showEnglish
              />
            </CardContent>
          </Card>
        )}
        */}

        {/* ---------- ALPHABET REFERENCE + DICTIONARY ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alphabet reference */}
          <Card className="parchment-card">
            <CardHeader>
              <CardTitle className="font-serif-display text-xl text-ink">
                Traditional Enochian Glyphs
              </CardTitle>
              <p className="text-xs text-ink-soft mt-1">
                Traditional Dee-Kelley letterforms rendered as inline SVG.
                Each Latin letter becomes its spoken Enochian letter name.
                Hover any glyph for details.
              </p>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={150}>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ENOCHIAN_ALPHABET.filter((g) => g.cluster.length > 0).map((g) => (
                    <Tooltip key={g.letter}>
                      <TooltipTrigger asChild>
                        <div className="glyph-cell rounded-md border border-gold/30 bg-white/40 p-2 flex flex-col items-center cursor-help">
                          <GlyphSvg html={latinToGlyphString(g.letter, 36)} className="text-burgundy" />
                          <span className="font-mono text-xs mt-1 text-ink">
                            {g.cluster.join("/")}
                          </span>
                          <span className="text-[10px] text-ink-soft italic">
                            {g.name}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-ink text-parchment border-burgundy/40">
                        <div className="text-xs">
                          <div><strong>{g.name}</strong> — SVG glyph <code>{g.id}</code></div>
                          <div>Cluster: {g.cluster.join(" / ")}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
              <div className="mt-4 text-xs text-ink-soft bg-white/40 rounded-md p-3 border border-burgundy/20">
                <strong className="text-burgundy">Shared-letter clusters:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>I / Y / J → Gon</li>
                  <li>U / V / W → Van</li>
                  <li>C / K → Veh</li>
                  <li>S / Z → Fam</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Dictionary browser */}
          <Card className="parchment-card">
            <CardHeader>
              <CardTitle className="font-serif-display text-xl text-ink">
                Dictionary Browser
              </CardTitle>
              <p className="text-xs text-ink-soft mt-1">
                {dictCount} entries loaded from{" "}
                <code className="text-burgundy">complete_enochian_dictionary.json</code>.
                Filter by Enochian or English.
              </p>
              <Input
                value={dictFilter}
                onChange={(e) => setDictFilter(e.target.value)}
                placeholder="Filter… e.g. ‘the voices’ or ‘bialo’"
                className="bg-white/60 border-burgundy/30 text-ink mt-2"
              />
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto fancy-scroll pr-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-parchment-dark/90 backdrop-blur">
                    <tr className="text-left text-ink-soft text-xs uppercase tracking-wider">
                      <th className="p-2">English</th>
                      <th className="p-2">Enochian</th>
                      <th className="p-2">Glyph</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dictionary.map((e, i) => (
                      <tr
                        key={`${e.english}-${e.enochian}-${i}`}
                        className="border-t border-burgundy/10 hover:bg-gold/5"
                      >
                        <td className="p-2 text-ink">
                          {e.english.includes(" ") ? (
                            <Badge variant="outline" className="text-[10px] mr-1 border-gold/40 text-gold">
                              phrase
                            </Badge>
                          ) : null}
                          {e.english}
                        </td>
                        <td className="p-2 font-mono text-burgundy font-semibold">
                          {e.enochian}
                        </td>
                        <td className="p-2 text-ink">
                          <GlyphSvg html={latinToGlyphString(e.enochian, 20)} className="text-burgundy" />
                        </td>
                      </tr>
                    ))}
                    {dictionary.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-ink-soft italic">
                          No matching entries.
                        </td>
                      </tr>
                    )}
                    {dictionary.length === 50 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-ink-soft italic text-xs">
                          Showing top 50 results. Type to narrow your search...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="mt-auto bg-ink text-parchment py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm space-y-2">
          <div className="ornament-divider text-gold-light">
            <GlyphSvg html={latinToGlyphString("PO", 16)} className="text-gold-light" />
          </div>
          <p>
            Reads exclusively from{" "}
            <code className="text-gold-light">/public/complete_enochian_dictionary.json</code>.
            No external APIs, no internal word lists.
          </p>
          <p className="text-xs text-parchment/60">
            Enochian is a fragmentary constructed language. This tool is a scholarly
            approximation for study and experimentation, not authoritative divination.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function OutputDisplay({ result }: { result: TranslationResult }) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge className="bg-burgundy/90 text-parchment">
          {result.dictionaryHits} from dictionary
        </Badge>
        <Badge variant="outline" className="border-gold/50 text-gold">
          {result.fallbacks} phonetic fallback{result.fallbacks === 1 ? "" : "s"}
        </Badge>
        {result.englishOutput && (
          <Badge variant="outline" className="border-burgundy/30 text-ink-soft">
            English output: <span className="font-mono ml-1">{result.englishOutput}</span>
          </Badge>
        )}
      </div>

      {/* Step 1: Latin output */}
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-soft mb-1">
          Step 1 — Latinised Enochian
        </div>
        <div className="bg-white/50 border border-burgundy/20 rounded-md p-3 font-mono text-lg text-ink break-words">
          {result.latinOutput || "—"}
        </div>
      </div>

      {/* Step 2: Glyph output */}
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-soft mb-1">
          Step 2 — Traditional Enochian Glyphs (inline SVG)
        </div>
        <div className="bg-white/50 border border-burgundy/20 rounded-md p-4 text-burgundy break-words text-center min-h-[80px] flex items-center justify-center flex-wrap gap-1">
          {result.glyphOutput ? (
            <GlyphSvg html={result.glyphOutput} className="text-burgundy" />
          ) : (
            "—"
          )}
        </div>
      </div>

      {/* Per-word breakdown */}
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-soft mb-2">
          Per-word breakdown
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {result.words.map((w, i) => (
            <WordCard key={i} word={w} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WordCard({ word }: { word: TranslatedWord }) {
  return (
    <div
      className={`rounded-md border p-3 ${
        word.fromDictionary
          ? "border-burgundy/30 bg-white/50"
          : "border-gold/40 bg-gold/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-ink-soft">
          {word.source}
        </span>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            word.fromDictionary
              ? "border-burgundy/40 text-burgundy"
              : "border-gold/50 text-gold"
          }`}
        >
          {word.fromDictionary ? "dictionary" : "fallback"}
        </Badge>
      </div>
      <div className="font-mono text-base text-burgundy font-semibold mt-1">
        {word.enochian}
      </div>
      {/* For EO->EN direction, show the English translation */}
      {word.english && (
        <div className="font-mono text-sm text-ink mt-1">
          → {word.english}
        </div>
      )}
      <div className="text-ink mt-1 min-h-[36px] flex items-center flex-wrap gap-0.5">
        {word.glyphs ? (
          <GlyphSvg html={word.glyphs} className="text-ink" />
        ) : null}
      </div>
      {word.note && (
        <div className="text-xs text-gold italic mt-1">{word.note}</div>
      )}
    </div>
  );
}

function SelfTestBlock({
  title,
  blurb,
  result,
  showEnglish = false,
}: {
  title: string;
  blurb: string;
  result: TranslationResult;
  showEnglish?: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-serif-display text-lg text-burgundy">{title}</h3>
      <p className="text-sm text-ink-soft">{blurb}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <div className="bg-white/50 border border-burgundy/20 rounded-md p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-soft">Input</div>
          <div className="font-mono text-sm text-ink mt-1">{result.input}</div>
        </div>
        <div className="bg-white/50 border border-burgundy/20 rounded-md p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-soft">
            {showEnglish ? "English output" : "Step 1: Latinised Enochian"}
          </div>
          <div className="font-mono text-sm text-burgundy mt-1 font-semibold">
            {showEnglish ? result.englishOutput : result.latinOutput}
          </div>
        </div>
      </div>
      <div className="bg-white/50 border border-burgundy/20 rounded-md p-3">
        <div className="text-[10px] uppercase tracking-wider text-ink-soft mb-1">
          Step 2: Traditional Enochian glyphs (SVG)
        </div>
        <div className="text-burgundy text-center min-h-[60px] flex items-center justify-center flex-wrap gap-1">
          {result.glyphOutput ? (
            <GlyphSvg html={result.glyphOutput} className="text-burgundy" />
          ) : (
            "—"
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge className="bg-burgundy/90 text-parchment">
          {result.dictionaryHits} dict
        </Badge>
        <Badge variant="outline" className="border-gold/50 text-gold">
          {result.fallbacks} fallback
        </Badge>
      </div>
    </div>
  );
}
