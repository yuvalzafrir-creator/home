import { askClaude } from "@/lib/claude";
import type { PreferenceProfile, Feedback, Listing } from "@prisma/client";

type FeedbackWithListing = Feedback & { listing: Pick<Listing, "address" | "floor"> };

export async function updateLearnedSummary(
  profile: Pick<
    PreferenceProfile,
    "locations" | "budgetMax" | "mustHaveExtras" | "freeText" | "learnedSummary"
  >,
  recentFeedback: FeedbackWithListing[]
): Promise<string> {
  const feedbackLines = recentFeedback
    .map((f) => `- ${f.reaction.toUpperCase()} "${f.listing.address}"${f.note ? ` — note: ${f.note}` : ""}`)
    .join("\n");

  const prompt = `You maintain a short, plain-language summary of a home buyer's preferences, used to score new listings.

Structured criteria:
- Locations: ${JSON.parse(profile.locations).join(", ")}
- Budget max: ${profile.budgetMax}
- Must-have extras: ${JSON.parse(profile.mustHaveExtras).join(", ") || "none"}
- Free text: ${profile.freeText ?? "none"}

Previous learned summary: ${profile.learnedSummary ?? "none yet"}

Recent feedback on listings they've seen:
${feedbackLines || "none yet"}

Rewrite the learned summary in 2-4 sentences, incorporating what the feedback reveals about their real preferences (e.g. patterns in what they liked or disliked). Respond with ONLY the summary text, no preamble.`;

  return askClaude(prompt);
}
