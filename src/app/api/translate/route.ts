import { NextRequest, NextResponse } from "next/server";
import { translate, runSelfTest } from "@/lib/enochian/translator";
import { allEntries, dictionarySize } from "@/lib/enochian/dictionary";
// Side-effect import: triggers synchronous fs.readFileSync on the server.
// Must NOT be imported from any client component.
import "@/lib/enochian/dictionary-server";

export const runtime = "nodejs";

/**
 * POST /api/translate
 *   body: { input: string, direction: "en->eo" | "eo->en" }
 *   ->   TranslationResult
 *
 * GET /api/translate?selfTest=true  -> demo / sanity check (both test phrases)
 * GET /api/translate?dict=true      -> dump dictionary (from JSON file)
 * GET /api/translate                -> usage info
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = (body?.input ?? "").toString();
    const direction: "en->eo" | "eo->en" =
      body?.direction === "eo->en" ? "eo->en" : "en->eo";

    if (!input.trim()) {
      return NextResponse.json(
        { error: "Missing 'input' field" },
        { status: 400 }
      );
    }
    const result = translate(input, direction);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("selfTest") === "true") {
    return NextResponse.json(runSelfTest());
  }
  if (url.searchParams.get("dict") === "true") {
    return NextResponse.json({
      count: dictionarySize(),
      entries: allEntries(),
    });
  }
  return NextResponse.json({
    usage: "POST /api/translate with { input, direction: 'en->eo' | 'eo->en' }",
    dictionarySize: dictionarySize(),
  });
}
