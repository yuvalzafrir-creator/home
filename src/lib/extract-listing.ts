import { load } from "cheerio";
import { askClaude } from "@/lib/claude";
import { looksLikeBotChallenge } from "@/lib/bot-challenge";

export interface ExtractedFields {
  address: string | null;
  price: number | null;
  rooms: number | null;
  sizeSqm: number | null;
  floor: number | null;
  hasParking: boolean;
  hasBalcony: boolean;
  hasMamad: boolean;
  hasElevator: boolean;
  description: string | null;
}

export type ExtractResult =
  | { ok: true; fields: ExtractedFields }
  | { ok: false; reason: "blocked" | "fetch_failed" | "parse_failed" };

const MAX_TEXT = 6000;

export function htmlToText(html: string): string {
  const $ = load(html);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

export function parseExtractedFields(raw: string): ExtractedFields | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  const int = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? Math.round(v) : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const bool = (v: unknown) => v === true;
  return {
    address: str(o.address),
    price: int(o.price),
    rooms: num(o.rooms),
    sizeSqm: int(o.sizeSqm),
    floor: int(o.floor),
    hasParking: bool(o.hasParking),
    hasBalcony: bool(o.hasBalcony),
    hasMamad: bool(o.hasMamad),
    hasElevator: bool(o.hasElevator),
    description: str(o.description),
  };
}

function extractionPrompt(text: string): string {
  return `Extract real-estate listing details from the page text below. Respond with ONLY a JSON object with these keys (use null when unknown): {"address": string|null, "price": number|null (shekels, integer), "rooms": number|null, "sizeSqm": number|null (integer), "floor": number|null, "hasParking": boolean, "hasBalcony": boolean, "hasMamad": boolean, "hasElevator": boolean, "description": string|null}. No other text.

Page text:
${text}`;
}

export async function extractListingFromUrl(url: string): Promise<ExtractResult> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, reason: "fetch_failed" };
    html = await res.text();
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  if (looksLikeBotChallenge(html)) return { ok: false, reason: "blocked" };

  let raw: string;
  try {
    raw = await askClaude(extractionPrompt(htmlToText(html)));
  } catch {
    return { ok: false, reason: "parse_failed" };
  }

  const fields = parseExtractedFields(raw);
  return fields ? { ok: true, fields } : { ok: false, reason: "parse_failed" };
}
