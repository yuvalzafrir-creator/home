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

  it("falls back to 'none yet' in the prompt when there is no recent feedback", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue("Some summary.");

    await updateLearnedSummary(
      {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify(["mamad"]),
        freeText: null,
        learnedSummary: "Existing summary.",
      } as any,
      []
    );

    expect(claude.askClaude).toHaveBeenCalledWith(expect.stringContaining("none yet"));
  });

  it("labels a null learnedSummary as 'none yet' in the prompt", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue("Some summary.");

    await updateLearnedSummary(
      {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify(["mamad"]),
        freeText: null,
        learnedSummary: null,
      } as any,
      []
    );

    expect(claude.askClaude).toHaveBeenCalledWith(
      expect.stringContaining("Previous learned summary: none yet")
    );
  });

  it("labels empty mustHaveExtras as 'none' in the prompt", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue("Some summary.");

    await updateLearnedSummary(
      {
        locations: JSON.stringify(["Tel Aviv"]),
        budgetMax: 3000000,
        mustHaveExtras: JSON.stringify([]),
        freeText: null,
        learnedSummary: null,
      } as any,
      []
    );

    expect(claude.askClaude).toHaveBeenCalledWith(
      expect.stringContaining("Must-have extras: none")
    );
  });

  it("throws if Claude returns an empty summary", async () => {
    vi.spyOn(claude, "askClaude").mockResolvedValue("");

    await expect(
      updateLearnedSummary(
        {
          locations: JSON.stringify(["Tel Aviv"]),
          budgetMax: 3000000,
          mustHaveExtras: JSON.stringify(["mamad"]),
          freeText: null,
          learnedSummary: null,
        } as any,
        []
      )
    ).rejects.toThrow();
  });
});
