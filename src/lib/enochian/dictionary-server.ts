/**
 * Server-only Enochian dictionary loader.
 *
 * This file MUST only be imported from server-only entry points
 * (API routes, Server Components, server-side utilities). It uses
 * `node:fs` to load the JSON dictionary synchronously at module
 * init time. The Next.js bundler will refuse to include this file
 * in any client bundle because of the explicit `node:fs` import.
 *
 * Importing this module is a side-effect: the act of importing it
 * triggers `setDictionary(rawJson)` inside `./dictionary`.
 */

import fs from "node:fs";
import path from "node:path";
import { setDictionary } from "./dictionary";

const JSON_PATH = path.join(
  process.cwd(),
  "public",
  "complete_enochian_dictionary.json"
);

try {
  if (typeof window === "undefined" && fs.existsSync(JSON_PATH)) {
    const raw = fs.readFileSync(JSON_PATH, "utf-8");
    setDictionary(JSON.parse(raw));
  }
} catch (err) {
   
  console.error("Failed to load Enochian dictionary JSON:", err);
}

/**
 * Re-load the dictionary from disk. Useful if the JSON file has been
 * replaced at runtime and you want to pick up the new contents.
 */
export function reloadDictionaryServer(): void {
  if (typeof window !== "undefined") return;
  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  setDictionary(JSON.parse(raw));
}
