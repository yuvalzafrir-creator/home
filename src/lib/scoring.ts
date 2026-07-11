import { askClaude } from "@/lib/claude";
import type { PreferenceProfile } from "@prisma/client";
import type { ParsedListing } from "@/scraper/yad2-parser";

export interface ScoreResult {
  score: number;
  reason: string;
}

export async function scoreListing(
  profile: Pick<PreferenceProfile, "learnedSummary">,
  listing: Partial<ParsedListing>
): Promise<ScoreResult> {
  const prompt = `You are helping score a real estate listing against a buyer's preferences.

Buyer preferences: ${profile.learnedSummary ?? "No preferences recorded yet."}

Listing:
${JSON.stringify(listing, null, 2)}

Respond with ONLY a JSON object of the form {"score": <0-100 integer>, "reason": "<one sentence>"}. No other text.`;

  const raw = await askClaude(prompt);
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned);

  if (
    typeof parsed.score !== "number" ||
    !Number.isInteger(parsed.score) ||
    parsed.score < 0 ||
    parsed.score > 100 ||
    typeof parsed.reason !== "string"
  ) {
    throw new Error(`Unexpected scoring response shape: ${raw}`);
  }

  return { score: parsed.score, reason: parsed.reason };
}
