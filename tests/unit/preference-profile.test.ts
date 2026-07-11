import { describe, it, expect, vi } from "vitest";
import { updateLearnedSummary } from "@/lib/preference-profile";
import * as claude from "@/lib/claude";

describe("updateLearnedSummary", () => {
  it("asks Claude to rewrite the summary using profile + feedback and returns the text", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue(
      "Wants 3-4 room apartments in Tel Aviv/Ramat Gan under 3M with a mamad. Dislikes ground-floor units."
    );

    const summary = await updateLearnedSummary(
      {
        locations: JSON.stringify(["Tel Aviv", "Ramat Gan"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify(["mamad"]),
        freeText: "quiet street",
        learnedSummary: null,
      } as any,
      [
        { reaction: "dislike", note: "ground floor, too noisy", listing: { address: "Herzl 45", floor: 1 } },
        { reaction: "like", note: null, listing: { address: "Rothschild 12", floor: 3 } },
      ] as any
    );

    expect(summary).toContain("mamad");
    expect(claude.askClaude).toHaveBeenCalledWith(expect.stringContaining("ground floor"));
  });
});
